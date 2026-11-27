import type pg from 'pg';
import { getPgPool } from '../../../db/client.js';

export type MentorActionStatus = 'proposed' | 'executing' | 'executed' | 'rejected' | 'failed' | 'expired';

export type MentorActionRecord = {
  id: string;
  message_id: string | null;
  type: string;
  payload: Record<string, unknown>;
  summary: string;
  status: MentorActionStatus;
  result_ref: Record<string, unknown> | null;
  error_code: string | null;
  decided_at: string | Date | null;
  created_at: string | Date;
};

/** All methods are bound to the authenticated user id. */
export type MentorActionRepository = {
  find(userId: string, actionId: string): Promise<MentorActionRecord | null>;
  listForMessages(userId: string, messageIds: string[]): Promise<MentorActionRecord[]>;
  /** proposed -> executing, only if still proposed and not older than maxAgeMs. */
  claim(userId: string, actionId: string, maxAgeMs: number): Promise<MentorActionRecord | null>;
  /** proposed -> rejected or expired. */
  decide(userId: string, actionId: string, status: 'rejected' | 'expired'): Promise<MentorActionRecord | null>;
  /** executing -> executed or failed. */
  finish(
    userId: string,
    actionId: string,
    result: { status: 'executed'; resultRef: Record<string, unknown> | null } | { status: 'failed'; errorCode: string },
  ): Promise<MentorActionRecord | null>;
};

export const actionColumns =
  'id, message_id, type, payload, summary, status, result_ref, error_code, decided_at, created_at';

export function createMentorActionRepository(
  getPool: () => pg.Pool = getPgPool,
): MentorActionRepository {
  return {
    async find(userId, actionId) {
      const result = await getPool().query<MentorActionRecord>(
        `select ${actionColumns} from public.mentor_actions where id = $1 and user_id = $2`,
        [actionId, userId],
      );
      return result.rows[0] ?? null;
    },

    async listForMessages(userId, messageIds) {
      if (messageIds.length === 0) return [];
      const result = await getPool().query<MentorActionRecord>(
        `select ${actionColumns} from public.mentor_actions
         where user_id = $1 and message_id = any($2::uuid[])
         order by created_at asc, id asc`,
        [userId, messageIds],
      );
      return result.rows;
    },

    async claim(userId, actionId, maxAgeMs) {
      const notBefore = new Date(Math.max(Date.now() - maxAgeMs, 0));
      const result = await getPool().query<MentorActionRecord>(
        `update public.mentor_actions
         set status = 'executing', decided_at = now()
         where id = $1 and user_id = $2 and status = 'proposed' and created_at > $3
         returning ${actionColumns}`,
        [actionId, userId, notBefore],
      );
      return result.rows[0] ?? null;
    },

    async decide(userId, actionId, status) {
      const result = await getPool().query<MentorActionRecord>(
        `update public.mentor_actions
         set status = $3, decided_at = now()
         where id = $1 and user_id = $2 and status = 'proposed'
         returning ${actionColumns}`,
        [actionId, userId, status],
      );
      return result.rows[0] ?? null;
    },

    async finish(userId, actionId, outcome) {
      const result = await getPool().query<MentorActionRecord>(
        `update public.mentor_actions
         set status = $3, result_ref = $4, error_code = $5
         where id = $1 and user_id = $2 and status = 'executing'
         returning ${actionColumns}`,
        [
          actionId,
          userId,
          outcome.status,
          outcome.status === 'executed' ? outcome.resultRef : null,
          outcome.status === 'failed' ? outcome.errorCode.slice(0, 64) : null,
        ],
      );
      return result.rows[0] ?? null;
    },
  };
}
