import type { AuthUser } from '../../auth/types.js';
import { config as defaultConfig, type AppConfig } from '../../config/index.js';
import { AppError } from '../../errors/appError.js';
import { addLocalDays, dateKey, localDateTimeToUtc, localParts } from '../profileStats/timezone.js';
import {
  createMentorReplyEngine,
  type MentorReplyEngine,
  type MentorReplyLogger,
} from './mentorReplyEngine.js';
import {
  createMentorRepository,
  type MentorConversationRecord,
  type MentorMessageRecord,
  type MentorRepository,
  type MentorSettingsRecord,
} from './mentorRepository.js';
import {
  grantMentorConsentRequestSchema,
  listMentorConversationsQuerySchema,
  listMentorMessagesQuerySchema,
  MENTOR_CONSENT_VERSION,
  mentorConversationIdSchema,
  renameMentorConversationRequestSchema,
  sendMentorMessageRequestSchema,
} from './mentorSchemas.js';
import { createMentorProvider } from './provider/createMentorProvider.js';

export type MentorServiceConfig = Pick<
  AppConfig,
  | 'MENTOR_PROVIDER'
  | 'ANTHROPIC_API_KEY'
  | 'MENTOR_ANTHROPIC_MODEL'
  | 'MENTOR_ANTHROPIC_EFFORT'
  | 'MENTOR_PROVIDER_TIMEOUT_MS'
  | 'MENTOR_MAX_OUTPUT_TOKENS'
  | 'MENTOR_HISTORY_MESSAGES'
  | 'MENTOR_DAILY_MESSAGE_LIMIT'
  | 'MENTOR_BURST_LIMIT_PER_MINUTE'
  | 'MENTOR_QUOTA_TIME_ZONE'
>;

export type MentorServiceDependencies = {
  repository?: MentorRepository;
  replyEngine?: MentorReplyEngine;
  config?: MentorServiceConfig;
  now?: () => Date;
  logger?: MentorReplyLogger;
};

export type MentorService = ReturnType<typeof createMentorService>;

const TITLE_MAX_LENGTH = 60;
const BURST_WINDOW_MS = 60_000;

function toIso(value: string | Date | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapConversation(record: MentorConversationRecord) {
  return {
    id: record.id,
    title: record.title,
    last_message_at: toIso(record.last_message_at),
    created_at: toIso(record.created_at),
    updated_at: toIso(record.updated_at),
  };
}

function mapMessage(record: MentorMessageRecord) {
  return {
    id: record.id,
    conversation_id: record.conversation_id,
    role: record.role,
    content: record.content,
    created_at: toIso(record.created_at),
  };
}

function mapSettings(record: MentorSettingsRecord | null) {
  const consentVersion = record?.consent_version ?? null;
  return {
    consent_required_version: MENTOR_CONSENT_VERSION,
    has_consent: consentVersion === MENTOR_CONSENT_VERSION,
    consent_version: consentVersion,
    consented_at: toIso(record?.consented_at ?? null),
    memory_enabled: record?.memory_enabled ?? true,
    journal_access_enabled: record?.journal_access_enabled ?? false,
    notes_access_enabled: record?.notes_access_enabled ?? false,
  };
}

export function deriveConversationTitle(message: string): string {
  const firstLine = message.split('\n').find((line) => line.trim()) ?? message;
  const collapsed = firstLine.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= TITLE_MAX_LENGTH) return collapsed;
  return `${collapsed.slice(0, TITLE_MAX_LENGTH - 1).trimEnd()}…`;
}

function conversationNotFound(): AppError {
  return new AppError(404, 'MENTOR_CONVERSATION_NOT_FOUND', 'Mentor conversation was not found.');
}

/**
 * Per-process sliding window against bursts. The daily quota in the database
 * stays the authoritative limit across instances.
 */
function createBurstLimiter(limit: number) {
  const hits = new Map<string, number[]>();
  return {
    tryAcquire(userId: string, nowMs: number): boolean {
      const recent = (hits.get(userId) ?? []).filter((timestamp) => nowMs - timestamp < BURST_WINDOW_MS);
      if (recent.length >= limit) {
        hits.set(userId, recent);
        return false;
      }
      recent.push(nowMs);
      hits.set(userId, recent);
      return true;
    },
    release(userId: string) {
      const recent = hits.get(userId);
      recent?.pop();
      if (recent && recent.length === 0) hits.delete(userId);
    },
  };
}

export function createMentorService(dependencies: MentorServiceDependencies = {}) {
  const config = dependencies.config ?? defaultConfig;
  const repository = dependencies.repository ?? createMentorRepository();
  const replyEngine = dependencies.replyEngine
    ?? createMentorReplyEngine(createMentorProvider(config), config, dependencies.logger);
  const now = dependencies.now ?? (() => new Date());
  const burstLimiter = createBurstLimiter(config.MENTOR_BURST_LIMIT_PER_MINUTE);

  function usageWindow(instant: Date) {
    const today = localParts(instant, config.MENTOR_QUOTA_TIME_ZONE);
    return {
      usageDate: dateKey(today),
      resetsAt: localDateTimeToUtc(addLocalDays(today, 1), config.MENTOR_QUOTA_TIME_ZONE).toISOString(),
    };
  }

  function usagePayload(used: number, resetsAt: string) {
    const limit = config.MENTOR_DAILY_MESSAGE_LIMIT;
    return { used, limit, remaining: Math.max(limit - used, 0), resets_at: resetsAt };
  }

  async function requireConsent(userId: string) {
    const settings = await repository.getSettings(userId);
    if (settings?.consent_version !== MENTOR_CONSENT_VERSION) {
      throw new AppError(403, 'MENTOR_CONSENT_REQUIRED', 'Please agree to the KI Mentor terms first.', {
        consent_required_version: MENTOR_CONSENT_VERSION,
      });
    }
  }

  async function requireConversation(userId: string, conversationIdValue: unknown) {
    const parsed = mentorConversationIdSchema.safeParse(conversationIdValue);
    if (!parsed.success) throw conversationNotFound();
    const conversation = await repository.findConversation(userId, parsed.data);
    if (!conversation) throw conversationNotFound();
    return conversation;
  }

  return {
    async getSettings(user: AuthUser) {
      return mapSettings(await repository.getSettings(user.id));
    },

    async grantConsent(user: AuthUser, body: unknown) {
      const input = grantMentorConsentRequestSchema.parse(body);
      return mapSettings(await repository.grantConsent(user.id, input.version));
    },

    async withdrawConsent(user: AuthUser) {
      return mapSettings(await repository.withdrawConsent(user.id));
    },

    async getUsage(user: AuthUser) {
      const window = usageWindow(now());
      return usagePayload(await repository.getDailyUsage(user.id, window.usageDate), window.resetsAt);
    },

    async listConversations(user: AuthUser, query: unknown) {
      const input = listMentorConversationsQuerySchema.parse(query ?? {});
      const records = await repository.listConversations(user.id, input.limit + 1, input.page * input.limit);
      return {
        conversations: records.slice(0, input.limit).map(mapConversation),
        page: input.page,
        limit: input.limit,
        has_more: records.length > input.limit,
      };
    },

    async listMessages(user: AuthUser, conversationIdValue: unknown, query: unknown) {
      const conversation = await requireConversation(user.id, conversationIdValue);
      const input = listMentorMessagesQuerySchema.parse(query ?? {});
      const records = await repository.listMessages(user.id, conversation.id, input.limit + 1, input.before);
      if (!records) {
        throw new AppError(400, 'VALIDATION_ERROR', 'The message cursor is invalid.');
      }
      const page = records.slice(0, input.limit);
      return {
        conversation: mapConversation(conversation),
        // Oldest first for direct rendering in the chat.
        messages: page.reverse().map(mapMessage),
        has_more: records.length > input.limit,
      };
    },

    async renameConversation(user: AuthUser, conversationIdValue: unknown, body: unknown) {
      const conversation = await requireConversation(user.id, conversationIdValue);
      const input = renameMentorConversationRequestSchema.parse(body);
      const updated = await repository.renameConversation(user.id, conversation.id, input.title);
      if (!updated) throw conversationNotFound();
      return mapConversation(updated);
    },

    async deleteConversation(user: AuthUser, conversationIdValue: unknown) {
      const parsed = mentorConversationIdSchema.safeParse(conversationIdValue);
      if (!parsed.success || !(await repository.deleteConversation(user.id, parsed.data))) {
        throw conversationNotFound();
      }
    },

    async sendMessage(user: AuthUser, body: unknown) {
      const input = sendMentorMessageRequestSchema.parse(body);
      await requireConsent(user.id);

      const conversation = input.conversation_id
        ? await requireConversation(user.id, input.conversation_id)
        : null;

      const receivedAt = now();
      if (!burstLimiter.tryAcquire(user.id, receivedAt.getTime())) {
        throw new AppError(429, 'MENTOR_RATE_LIMITED', 'You are sending messages too quickly. Please wait a moment.');
      }

      const window = usageWindow(receivedAt);
      const used = await repository.consumeDailyQuota(
        user.id,
        window.usageDate,
        config.MENTOR_DAILY_MESSAGE_LIMIT,
      );
      if (used === null) {
        burstLimiter.release(user.id);
        throw new AppError(429, 'MENTOR_DAILY_LIMIT_REACHED', 'You have reached today\'s mentor message limit.', {
          usage: usagePayload(config.MENTOR_DAILY_MESSAGE_LIMIT, window.resetsAt),
        });
      }

      try {
        const history = conversation
          ? await repository.recentMessages(user.id, conversation.id, config.MENTOR_HISTORY_MESSAGES)
          : [];

        const reply = await replyEngine.generateReply({
          history: history.map((message) => ({ role: message.role, content: message.content })),
          userMessage: input.content,
          now: receivedAt,
          timeZone: config.MENTOR_QUOTA_TIME_ZONE,
        });

        const saved = await repository.saveExchange({
          userId: user.id,
          conversationId: conversation?.id ?? null,
          newConversationTitle: deriveConversationTitle(input.content),
          userContent: input.content,
          userCreatedAt: receivedAt,
          assistant: {
            content: reply.content,
            promptVersion: reply.promptVersion,
            provider: reply.provider,
            model: reply.model,
            inputTokens: reply.inputTokens,
            outputTokens: reply.outputTokens,
          },
          usageDate: window.usageDate,
        });
        if (!saved) throw conversationNotFound();

        return {
          conversation: mapConversation(saved.conversation),
          user_message: mapMessage(saved.userMessage),
          assistant_message: mapMessage(saved.assistantMessage),
          safety: { crisis_resources_shown: reply.crisisSignal },
          usage: usagePayload(used, window.resetsAt),
        };
      } catch (error) {
        // A failed reply must not cost the user a message.
        await repository.refundDailyQuota(user.id, window.usageDate).catch(() => undefined);
        burstLimiter.release(user.id);
        throw error;
      }
    },
  };
}
