import type { AuthUser } from '../../../auth/types.js';
import { AppError } from '../../../errors/appError.js';
import type { MentorMemoryExtractor } from './mentorMemoryExtractor.js';
import type { MentorMemoryRecord, MentorMemoryRepository } from './mentorMemoryRepository.js';
import { mentorMemoryIdSchema, updateMentorMemoryRequestSchema } from './mentorMemorySchemas.js';

export type MentorMemoryLogger = {
  warn(details: Record<string, unknown>, message: string): void;
};

export type MentorMemoryServiceOptions = {
  repository: MentorMemoryRepository;
  extractor: MentorMemoryExtractor;
  maxActive: number;
  timeZone: string;
  timeoutMs: number;
  recordTokens?: (userId: string, inputTokens: number, outputTokens: number) => Promise<void>;
  logger?: MentorMemoryLogger;
  now?: () => Date;
};

export type MentorMemoryService = ReturnType<typeof createMentorMemoryService>;

/** Memories passed to the system prompt. */
export const PROMPT_MEMORY_LIMIT = 80;
/** Memories shown in the app and passed to the extractor. */
const LIST_LIMIT = 200;

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function mapMemory(record: MentorMemoryRecord) {
  return {
    id: record.id,
    category: record.category,
    content: record.content,
    status: record.status,
    created_at: toIso(record.created_at),
    updated_at: toIso(record.updated_at),
  };
}

function memoryNotFound(): AppError {
  return new AppError(404, 'MENTOR_MEMORY_NOT_FOUND', 'Mentor memory was not found.');
}

export function createMentorMemoryService(options: MentorMemoryServiceOptions) {
  const { repository, extractor } = options;
  const now = options.now ?? (() => new Date());

  return {
    async list(user: AuthUser) {
      return (await repository.list(user.id, LIST_LIMIT)).map(mapMemory);
    },

    async update(user: AuthUser, memoryIdValue: unknown, body: unknown) {
      const parsedId = mentorMemoryIdSchema.safeParse(memoryIdValue);
      if (!parsedId.success) throw memoryNotFound();
      const input = updateMentorMemoryRequestSchema.parse(body);
      const updated = await repository.update(user.id, parsedId.data, input);
      if (!updated) throw memoryNotFound();
      return mapMemory(updated);
    },

    async delete(user: AuthUser, memoryIdValue: unknown) {
      const parsedId = mentorMemoryIdSchema.safeParse(memoryIdValue);
      if (!parsedId.success || !(await repository.delete(user.id, parsedId.data))) {
        throw memoryNotFound();
      }
    },

    async deleteAll(user: AuthUser) {
      return { deleted: await repository.deleteAll(user.id) };
    },

    /** Memories for the system prompt, newest first, active before resolved. */
    async forPrompt(userId: string) {
      const records = await repository.list(userId, PROMPT_MEMORY_LIMIT);
      return records.map((record) => ({
        category: record.category,
        content: record.content,
        status: record.status,
        updatedAt: toIso(record.updated_at),
      }));
    },

    /**
     * Runs after a reply has been delivered. Never throws: memory is a
     * best-effort feature and must not break the chat.
     */
    async processExchange(input: {
      userId: string;
      userMessage: string;
      assistantReply: string;
      sourceMessageId: string | null;
    }) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), options.timeoutMs);
      try {
        const existing = await repository.list(input.userId, LIST_LIMIT);
        const result = await extractor.extract({
          existing,
          userMessage: input.userMessage,
          assistantReply: input.assistantReply,
          now: now(),
          timeZone: options.timeZone,
          signal: controller.signal,
        });

        let addBudget = Math.max(options.maxActive - (await repository.countActive(input.userId)), 0);
        const operations = result.operations.filter((operation) => {
          if (operation.type !== 'add') return true;
          if (addBudget <= 0) return false;
          addBudget -= 1;
          return true;
        });

        await repository.applyOperations(input.userId, operations, input.sourceMessageId);
        if (options.recordTokens && (result.inputTokens || result.outputTokens)) {
          await options.recordTokens(input.userId, result.inputTokens, result.outputTokens);
        }
      } catch (error) {
        // Metadata only: never log message or memory content.
        options.logger?.warn(
          { extractor: extractor.name, error: error instanceof Error ? error.name : 'unknown' },
          'Mentor memory update failed',
        );
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
