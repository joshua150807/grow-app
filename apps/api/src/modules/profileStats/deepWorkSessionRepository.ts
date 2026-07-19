import type pg from 'pg';
import { getPgPool } from '../../db/client.js';
import type { DeepWorkSessionInput } from './profileStatsSchemas.js';

export type DeepWorkSession = {
  id: string; client_session_id: string; duration_seconds: number; completed_at: string; created_at: string;
};
export type DeepWorkSessionRepository = {
  insertOrFind(userId: string, input: DeepWorkSessionInput): Promise<{ session: DeepWorkSession; created: boolean }>;
};
type Queryable = Pick<pg.Pool, 'query'>;

function map(row: Record<string, unknown>): DeepWorkSession {
  return {
    id: String(row.id), client_session_id: String(row.client_session_id), duration_seconds: Number(row.duration_seconds),
    completed_at: new Date(String(row.completed_at)).toISOString(), created_at: new Date(String(row.created_at)).toISOString(),
  };
}

export function createDeepWorkSessionRepository(db: Queryable = getPgPool()): DeepWorkSessionRepository {
  return {
    async insertOrFind(userId, input) {
      const inserted = await db.query(
        `insert into public.deep_work_sessions (user_id, client_session_id, duration_seconds, completed_at)
         values ($1, $2, $3, $4::timestamptz)
         on conflict (user_id, client_session_id) do nothing
         returning id, client_session_id, duration_seconds, completed_at, created_at`,
        [userId, input.client_session_id, input.duration_seconds, input.completed_at],
      );
      if (inserted.rows[0]) return { session: map(inserted.rows[0]), created: true };
      const existing = await db.query(
        `select id, client_session_id, duration_seconds, completed_at, created_at
         from public.deep_work_sessions where user_id = $1 and client_session_id = $2`,
        [userId, input.client_session_id],
      );
      if (!existing.rows[0]) throw new Error('Deep-work idempotency row was not found after conflict.');
      return { session: map(existing.rows[0]), created: false };
    },
  };
}
