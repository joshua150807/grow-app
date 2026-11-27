import type { AuthUser } from '../../../auth/types.js';
import { AppError } from '../../../errors/appError.js';
import type { MentorToolCall, MentorToolDefinition, MentorToolResult } from '../provider/mentorProvider.js';
import type { MentorActionRecord, MentorActionRepository } from './mentorActionRepository.js';
import {
  toolNameForType,
  typeForToolName,
  type MentorActionRegistry,
} from './mentorActionRegistry.js';
import { z } from 'zod';

export const MENTOR_ACTION_MAX_PROPOSALS = 3;
/** Proposals that are not decided within this time can no longer be confirmed. */
export const MENTOR_ACTION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const READ_RESULT_MAX_CHARS = 8000;

export type MentorActionLogger = {
  warn(details: Record<string, unknown>, message: string): void;
};

export type ProposedMentorAction = {
  type: string;
  payload: Record<string, unknown>;
  summary: string;
};

export type MentorActionService = ReturnType<typeof createMentorActionService>;

const actionIdSchema = z.string().uuid();

function toIso(value: string | Date | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function mapAction(record: MentorActionRecord) {
  return {
    id: record.id,
    message_id: record.message_id,
    type: record.type,
    summary: record.summary,
    status: record.status,
    error_code: record.error_code,
    decided_at: toIso(record.decided_at),
    created_at: toIso(record.created_at),
  };
}

const STATUS_NOTE: Record<string, string> = {
  proposed: 'waiting for the user',
  executing: 'being executed',
  executed: 'confirmed and executed',
  rejected: 'rejected by the user',
  failed: 'failed',
  expired: 'expired',
};

/** Short note appended to an assistant message in the history sent to the model. */
export function describeActionsForHistory(actions: Pick<MentorActionRecord, 'summary' | 'status'>[]): string {
  if (actions.length === 0) return '';
  return actions.map((action) => `[Proposal: ${action.summary} – ${STATUS_NOTE[action.status] ?? action.status}]`).join('\n');
}

function actionNotFound(): AppError {
  return new AppError(404, 'MENTOR_ACTION_NOT_FOUND', 'Mentor action was not found.');
}

function errorCodeOf(error: unknown): string {
  if (error instanceof AppError) return error.code;
  if (error instanceof z.ZodError) return 'VALIDATION_ERROR';
  return 'INTERNAL_ERROR';
}

export function createMentorActionService(options: {
  repository: MentorActionRepository;
  registry: MentorActionRegistry;
  logger?: MentorActionLogger;
  maxAgeMs?: number;
}) {
  const { repository, registry } = options;
  const maxAgeMs = options.maxAgeMs ?? MENTOR_ACTION_MAX_AGE_MS;

  async function requireOwnAction(userId: string, actionIdValue: unknown) {
    const parsed = actionIdSchema.safeParse(actionIdValue);
    if (!parsed.success) throw actionNotFound();
    const action = await repository.find(userId, parsed.data);
    if (!action) throw actionNotFound();
    return action;
  }

  function alreadyDecided(action: MentorActionRecord): AppError {
    return new AppError(409, 'MENTOR_ACTION_ALREADY_DECIDED', 'This action has already been decided.', {
      action: mapAction(action),
    });
  }

  return {
    hasTools: () => registry.list().length > 0,

    /**
     * Creates the tool set for one reply. Write calls are only collected as
     * proposals; read calls run immediately for the authenticated user.
     */
    createToolSession(userId: string) {
      const proposals: ProposedMentorAction[] = [];
      const tools: MentorToolDefinition[] = registry.list().map((definition) => ({
        name: toolNameForType(definition.type),
        description: definition.kind === 'write'
          ? `${definition.description} This only creates a proposal the user must confirm.`
          : definition.description,
        inputSchema: definition.jsonSchema,
      }));

      async function onToolCall(call: MentorToolCall): Promise<MentorToolResult> {
        const definition = registry.get(typeForToolName(call.name));
        if (!definition) return { content: 'Unknown tool.', isError: true };

        const parsed = definition.inputSchema.safeParse(call.input);
        if (!parsed.success) {
          const issues = parsed.error.issues.slice(0, 5).map((issue) => `${issue.path.join('.') || 'input'}: ${issue.message}`);
          return { content: `Invalid input. ${issues.join('; ')}`, isError: true };
        }

        if (definition.kind === 'read') {
          try {
            const result = await definition.execute(userId, parsed.data);
            const json = JSON.stringify(result.data ?? null);
            return { content: json.length > READ_RESULT_MAX_CHARS ? `${json.slice(0, READ_RESULT_MAX_CHARS)}…(truncated)` : json };
          } catch (error) {
            options.logger?.warn({ type: definition.type, code: errorCodeOf(error) }, 'Mentor read action failed');
            return { content: 'Reading this data failed. Continue without it and tell the user briefly.', isError: true };
          }
        }

        if (proposals.length >= MENTOR_ACTION_MAX_PROPOSALS) {
          return { content: 'Proposal limit for this reply reached. Do not propose more changes now.', isError: true };
        }
        let summary: string;
        try {
          summary = (await definition.summarize(parsed.data, userId)).trim().slice(0, 300);
        } catch (error) {
          if (error instanceof AppError && error.statusCode < 500) {
            return { content: `Cannot propose this: ${error.message}`, isError: true };
          }
          options.logger?.warn({ type: definition.type, code: errorCodeOf(error) }, 'Mentor action summary failed');
          return { content: 'Preparing this proposal failed. Tell the user briefly.', isError: true };
        }
        proposals.push({
          type: definition.type,
          payload: parsed.data as Record<string, unknown>,
          summary,
        });
        return {
          content: 'Proposal created. The user now sees it as a card and decides. It is NOT executed yet.',
        };
      }

      return { tools, onToolCall, proposals };
    },

    async listForMessages(userId: string, messageIds: string[]) {
      return repository.listForMessages(userId, messageIds);
    },

    async confirm(user: AuthUser, actionIdValue: unknown) {
      const action = await requireOwnAction(user.id, actionIdValue);
      if (action.status !== 'proposed') throw alreadyDecided(action);

      const claimed = await repository.claim(user.id, action.id, maxAgeMs);
      if (!claimed) {
        const current = await repository.find(user.id, action.id);
        if (current?.status === 'proposed') {
          const expired = await repository.decide(user.id, action.id, 'expired');
          throw new AppError(409, 'MENTOR_ACTION_EXPIRED', 'This proposal has expired.', {
            action: expired ? mapAction(expired) : null,
          });
        }
        throw current ? alreadyDecided(current) : actionNotFound();
      }

      const definition = registry.get(claimed.type);
      if (!definition || definition.kind !== 'write') {
        const failed = await repository.finish(user.id, claimed.id, { status: 'failed', errorCode: 'ACTION_UNAVAILABLE' });
        return mapAction(failed ?? claimed);
      }

      try {
        // Re-validate: the stored payload may predate a schema change.
        const input = definition.inputSchema.parse(claimed.payload);
        const result = await definition.execute(user.id, input);
        const executed = await repository.finish(user.id, claimed.id, {
          status: 'executed',
          resultRef: result.resultRef ?? null,
        });
        return mapAction(executed ?? claimed);
      } catch (error) {
        const errorCode = errorCodeOf(error);
        options.logger?.warn({ type: claimed.type, code: errorCode }, 'Mentor action execution failed');
        const failed = await repository.finish(user.id, claimed.id, { status: 'failed', errorCode });
        return mapAction(failed ?? claimed);
      }
    },

    async reject(user: AuthUser, actionIdValue: unknown) {
      const action = await requireOwnAction(user.id, actionIdValue);
      if (action.status !== 'proposed') throw alreadyDecided(action);
      const rejected = await repository.decide(user.id, action.id, 'rejected');
      if (!rejected) {
        const current = await repository.find(user.id, action.id);
        throw current ? alreadyDecided(current) : actionNotFound();
      }
      return mapAction(rejected);
    },
  };
}
