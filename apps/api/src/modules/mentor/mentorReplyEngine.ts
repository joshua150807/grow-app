import type { AppConfig } from '../../config/index.js';
import { AppError } from '../../errors/appError.js';
import { buildMentorSystemPrompt, MENTOR_PROMPT_VERSION, type MentorPromptMemory } from './mentorPrompt.js';
import { detectCrisisSignal, ensureCrisisResources } from './mentorSafety.js';
import {
  MentorProviderError,
  type MentorChatMessage,
  type MentorProvider,
} from './provider/mentorProvider.js';

export type MentorReplyEngineConfig = Pick<
  AppConfig,
  'MENTOR_PROVIDER_TIMEOUT_MS' | 'MENTOR_MAX_OUTPUT_TOKENS' | 'MENTOR_HISTORY_MESSAGES'
>;

export type MentorReplyLogger = {
  warn(details: Record<string, unknown>, message: string): void;
};

export type GenerateMentorReplyInput = {
  /** Previous messages of the conversation, oldest first. */
  history: MentorChatMessage[];
  /** Already validated user message. */
  userMessage: string;
  now?: Date;
  timeZone?: string;
  memories?: MentorPromptMemory[];
};

export type MentorReply = {
  content: string;
  promptVersion: string;
  provider: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  truncated: boolean;
  crisisSignal: boolean;
};

export type MentorReplyEngine = {
  generateReply(input: GenerateMentorReplyInput): Promise<MentorReply>;
};

/**
 * Keeps the newest messages and guarantees the window starts with a user turn,
 * which several LLM APIs require.
 */
export function selectHistoryWindow(history: MentorChatMessage[], limit: number): MentorChatMessage[] {
  const window = history.slice(-limit);
  const firstUserIndex = window.findIndex((message) => message.role === 'user');
  return firstUserIndex === -1 ? [] : window.slice(firstUserIndex);
}

function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  if (error instanceof MentorProviderError) {
    switch (error.kind) {
      case 'timeout':
        return new AppError(504, 'MENTOR_PROVIDER_TIMEOUT', 'The mentor took too long to answer. Please try again.');
      case 'rate_limited':
        return new AppError(503, 'MENTOR_PROVIDER_RATE_LIMITED', 'The mentor is busy right now. Please try again shortly.');
      default:
        return new AppError(502, 'MENTOR_PROVIDER_UNAVAILABLE', 'The mentor is currently unavailable. Please try again later.');
    }
  }

  return new AppError(502, 'MENTOR_PROVIDER_UNAVAILABLE', 'The mentor is currently unavailable. Please try again later.');
}

async function withTimeout<T>(
  timeoutMs: number,
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;

  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new MentorProviderError('timeout', 'Mentor provider timed out.'));
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation(controller.signal), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export function createMentorReplyEngine(
  provider: MentorProvider,
  config: MentorReplyEngineConfig,
  logger?: MentorReplyLogger,
): MentorReplyEngine {
  return {
    async generateReply(input) {
      const crisisSignal = detectCrisisSignal(input.userMessage);
      const system = buildMentorSystemPrompt({
        now: input.now ?? new Date(),
        timeZone: input.timeZone,
        crisisSignal,
        memories: input.memories,
      });
      const messages: MentorChatMessage[] = [
        ...selectHistoryWindow(input.history, config.MENTOR_HISTORY_MESSAGES - 1),
        { role: 'user', content: input.userMessage },
      ];

      let response;
      try {
        response = await withTimeout(config.MENTOR_PROVIDER_TIMEOUT_MS, (signal) => provider.generateReply({
          system,
          messages,
          maxOutputTokens: config.MENTOR_MAX_OUTPUT_TOKENS,
          signal,
        }));
      } catch (error) {
        const appError = toAppError(error);
        // Metadata only: message content must never be logged.
        logger?.warn(
          {
            provider: provider.name,
            code: appError.code,
            kind: error instanceof MentorProviderError ? error.kind : 'unknown',
          },
          'Mentor provider request failed',
        );
        throw appError;
      }

      const content = response.content.trim();
      if (!content) {
        throw toAppError(new MentorProviderError('invalid_response', 'Mentor provider returned an empty reply.'));
      }

      return {
        content: crisisSignal ? ensureCrisisResources(content) : content,
        promptVersion: MENTOR_PROMPT_VERSION,
        provider: provider.name,
        model: response.model,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        truncated: response.truncated,
        crisisSignal,
      };
    },
  };
}
