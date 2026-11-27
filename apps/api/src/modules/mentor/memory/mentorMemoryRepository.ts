import type pg from 'pg';
import { getPgPool } from '../../../db/client.js';
import type { MentorMemoryCategory, MentorMemoryStatus } from './mentorMemorySchemas.js';

export type MentorMemoryRecord = {
  id: string;
  category: MentorMemoryCategory;
  content: string;
  status: MentorMemoryStatus;
  created_at: string | Date;
  updated_at: string | Date;
};

export type MentorMemoryOperation =
  | { type: 'add'; category: MentorMemoryCategory; content: string }
  | { type: 'update'; id: string; content: string }
  | { type: 'resolve'; id: string };

/** All methods are bound to the authenticated user id. */
export type MentorMemoryRepository = {
  list(userId: string, limit: number): Promise<MentorMemoryRecord[]>;
  countActive(userId: string): Promise<number>;
  update(
    userId: string,
    memoryId: string,
    changes: { content?: string; status?: MentorMemoryStatus },
  ): Promise<MentorMemoryRecord | null>;
  delete(userId: string, memoryId: string): Promise<boolean>;
  deleteAll(userId: string): Promise<number>;
  /** Applies extractor operations atomically; ids of other users are ignored. */
  applyOperations(
    userId: string,
    operations: MentorMemoryOperation[],
    sourceMessageId: string | null,
  ): Promise<void>;
};

const columns = 'id, category, content, status, created_at, updated_at';

export function createMentorMemoryRepository(
  getPool: () => pg.Pool = getPgPool,
): MentorMemoryRepository {
  return {
    async list(userId, limit) {
      const result = await getPool().query<MentorMemoryRecord>(
        `select ${columns} from public.mentor_memories
         where user_id = $1
         order by status asc, updated_at desc, id desc
         limit $2`,
        [userId, limit],
      );
      return result.rows;
    },

    async countActive(userId) {
      const result = await getPool().query<{ count: number }>(
        `select count(*)::int as count from public.mentor_memories where user_id = $1 and status = 'active'`,
        [userId],
      );
      return result.rows[0]?.count ?? 0;
    },

    async update(userId, memoryId, changes) {
      const result = await getPool().query<MentorMemoryRecord>(
        `update public.mentor_memories
         set content = coalesce($3, content), status = coalesce($4, status)
         where id = $1 and user_id = $2
         returning ${columns}`,
        [memoryId, userId, changes.content ?? null, changes.status ?? null],
      );
      return result.rows[0] ?? null;
    },

    async delete(userId, memoryId) {
      const result = await getPool().query(
        'delete from public.mentor_memories where id = $1 and user_id = $2',
        [memoryId, userId],
      );
      return (result.rowCount ?? 0) > 0;
    },

    async deleteAll(userId) {
      const result = await getPool().query('delete from public.mentor_memories where user_id = $1', [userId]);
      return result.rowCount ?? 0;
    },

    async applyOperations(userId, operations, sourceMessageId) {
      if (operations.length === 0) return;
      const client = await getPool().connect();
      try {
        await client.query('begin');
        for (const operation of operations) {
          if (operation.type === 'add') {
            await client.query(
              `insert into public.mentor_memories (user_id, category, content, source_message_id)
               values ($1, $2, $3, $4)`,
              [userId, operation.category, operation.content, sourceMessageId],
            );
          } else if (operation.type === 'update') {
            await client.query(
              `update public.mentor_memories set content = $3, status = 'active'
               where id = $1 and user_id = $2`,
              [operation.id, userId, operation.content],
            );
          } else {
            await client.query(
              `update public.mentor_memories set status = 'resolved'
               where id = $1 and user_id = $2`,
              [operation.id, userId],
            );
          }
        }
        await client.query('commit');
      } catch (error) {
        await client.query('rollback');
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
