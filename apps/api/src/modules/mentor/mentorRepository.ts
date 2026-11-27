import type pg from 'pg';
import { getPgPool } from '../../db/client.js';

export type MentorSettingsRecord = {
  consent_version: string | null;
  consented_at: string | null;
  memory_enabled: boolean;
  journal_access_enabled: boolean;
  notes_access_enabled: boolean;
};

export type MentorConversationRecord = {
  id: string;
  title: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MentorMessageRecord = {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
};

export type SaveMentorExchangeInput = {
  userId: string;
  conversationId: string | null;
  newConversationTitle: string;
  userContent: string;
  userCreatedAt: Date;
  assistant: {
    content: string;
    promptVersion: string;
    provider: string;
    model: string;
    inputTokens: number | null;
    outputTokens: number | null;
  };
  usageDate: string;
};

export type SaveMentorExchangeResult = {
  conversation: MentorConversationRecord;
  userMessage: MentorMessageRecord;
  assistantMessage: MentorMessageRecord;
};

/**
 * Every method takes the authenticated user id and binds all queries to it.
 * Callers must never pass ids taken from request bodies as userId.
 */
export type MentorRepository = {
  getSettings(userId: string): Promise<MentorSettingsRecord | null>;
  grantConsent(userId: string, version: string): Promise<MentorSettingsRecord>;
  withdrawConsent(userId: string): Promise<MentorSettingsRecord | null>;
  setMemoryEnabled(userId: string, enabled: boolean): Promise<MentorSettingsRecord>;
  addTokenUsage(userId: string, usageDate: string, inputTokens: number, outputTokens: number): Promise<void>;
  listConversations(userId: string, limit: number, offset: number): Promise<MentorConversationRecord[]>;
  findConversation(userId: string, conversationId: string): Promise<MentorConversationRecord | null>;
  /** Newest first. Returns null when the `before` message does not belong to the conversation. */
  listMessages(
    userId: string,
    conversationId: string,
    limit: number,
    beforeMessageId?: string,
  ): Promise<MentorMessageRecord[] | null>;
  /** Oldest first, the newest `limit` messages. */
  recentMessages(userId: string, conversationId: string, limit: number): Promise<MentorMessageRecord[]>;
  renameConversation(userId: string, conversationId: string, title: string): Promise<MentorConversationRecord | null>;
  deleteConversation(userId: string, conversationId: string): Promise<boolean>;
  getDailyUsage(userId: string, usageDate: string): Promise<number>;
  /** Atomically reserves one message. Returns the new count or null if the limit is reached. */
  consumeDailyQuota(userId: string, usageDate: string, limit: number): Promise<number | null>;
  refundDailyQuota(userId: string, usageDate: string): Promise<void>;
  /** Returns null when the target conversation no longer exists for this user. */
  saveExchange(input: SaveMentorExchangeInput): Promise<SaveMentorExchangeResult | null>;
};

type Queryable = Pick<pg.Pool, 'query'>;

const settingsColumns = `
  consent_version, consented_at, memory_enabled, journal_access_enabled, notes_access_enabled
`;
const conversationColumns = 'id, title, last_message_at, created_at, updated_at';
const messageColumns = 'id, conversation_id, role, content, created_at';

function isForeignKeyViolation(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && (error as { code?: unknown }).code === '23503');
}

export function createMentorRepository(
  getPool: () => pg.Pool = getPgPool,
): MentorRepository {
  const db = (): Queryable => getPool();

  return {
    async getSettings(userId) {
      const result = await db().query<MentorSettingsRecord>(
        `select ${settingsColumns} from public.mentor_settings where user_id = $1`,
        [userId],
      );
      return result.rows[0] ?? null;
    },

    async grantConsent(userId, version) {
      const result = await db().query<MentorSettingsRecord>(
        `insert into public.mentor_settings (user_id, consent_version, consented_at)
         values ($1, $2, now())
         on conflict (user_id) do update
           set consent_version = excluded.consent_version,
               consented_at = excluded.consented_at
         returning ${settingsColumns}`,
        [userId, version],
      );
      return result.rows[0];
    },

    async withdrawConsent(userId) {
      const result = await db().query<MentorSettingsRecord>(
        `update public.mentor_settings
         set consent_version = null, consented_at = null
         where user_id = $1
         returning ${settingsColumns}`,
        [userId],
      );
      return result.rows[0] ?? null;
    },

    async setMemoryEnabled(userId, enabled) {
      const result = await db().query<MentorSettingsRecord>(
        `insert into public.mentor_settings (user_id, memory_enabled)
         values ($1, $2)
         on conflict (user_id) do update set memory_enabled = excluded.memory_enabled
         returning ${settingsColumns}`,
        [userId, enabled],
      );
      return result.rows[0];
    },

    async addTokenUsage(userId, usageDate, inputTokens, outputTokens) {
      await db().query(
        `insert into public.mentor_usage_daily (user_id, usage_date, input_tokens, output_tokens)
         values ($1, $2, $3, $4)
         on conflict (user_id, usage_date) do update
           set input_tokens = public.mentor_usage_daily.input_tokens + excluded.input_tokens,
               output_tokens = public.mentor_usage_daily.output_tokens + excluded.output_tokens`,
        [userId, usageDate, inputTokens, outputTokens],
      );
    },

    async listConversations(userId, limit, offset) {
      const result = await db().query<MentorConversationRecord>(
        `select ${conversationColumns}
         from public.mentor_conversations
         where user_id = $1
         order by last_message_at desc nulls last, created_at desc, id desc
         limit $2 offset $3`,
        [userId, limit, offset],
      );
      return result.rows;
    },

    async findConversation(userId, conversationId) {
      const result = await db().query<MentorConversationRecord>(
        `select ${conversationColumns}
         from public.mentor_conversations
         where id = $1 and user_id = $2`,
        [conversationId, userId],
      );
      return result.rows[0] ?? null;
    },

    async listMessages(userId, conversationId, limit, beforeMessageId) {
      if (!beforeMessageId) {
        const result = await db().query<MentorMessageRecord>(
          `select ${messageColumns}
           from public.mentor_messages
           where conversation_id = $1 and user_id = $2
           order by created_at desc, id desc
           limit $3`,
          [conversationId, userId, limit],
        );
        return result.rows;
      }

      const cursor = await db().query<{ created_at: string; id: string }>(
        `select created_at, id from public.mentor_messages
         where id = $1 and conversation_id = $2 and user_id = $3`,
        [beforeMessageId, conversationId, userId],
      );
      if (!cursor.rows[0]) return null;

      const result = await db().query<MentorMessageRecord>(
        `select ${messageColumns}
         from public.mentor_messages
         where conversation_id = $1 and user_id = $2
           and (created_at, id) < ($3::timestamptz, $4::uuid)
         order by created_at desc, id desc
         limit $5`,
        [conversationId, userId, cursor.rows[0].created_at, cursor.rows[0].id, limit],
      );
      return result.rows;
    },

    async recentMessages(userId, conversationId, limit) {
      const result = await db().query<MentorMessageRecord>(
        `select * from (
           select ${messageColumns}
           from public.mentor_messages
           where conversation_id = $1 and user_id = $2
           order by created_at desc, id desc
           limit $3
         ) recent
         order by created_at asc, id asc`,
        [conversationId, userId, limit],
      );
      return result.rows;
    },

    async renameConversation(userId, conversationId, title) {
      const result = await db().query<MentorConversationRecord>(
        `update public.mentor_conversations
         set title = $3
         where id = $1 and user_id = $2
         returning ${conversationColumns}`,
        [conversationId, userId, title],
      );
      return result.rows[0] ?? null;
    },

    async deleteConversation(userId, conversationId) {
      const result = await db().query(
        'delete from public.mentor_conversations where id = $1 and user_id = $2',
        [conversationId, userId],
      );
      return (result.rowCount ?? 0) > 0;
    },

    async getDailyUsage(userId, usageDate) {
      const result = await db().query<{ message_count: number }>(
        'select message_count from public.mentor_usage_daily where user_id = $1 and usage_date = $2',
        [userId, usageDate],
      );
      return result.rows[0]?.message_count ?? 0;
    },

    async consumeDailyQuota(userId, usageDate, limit) {
      const result = await db().query<{ message_count: number }>(
        `insert into public.mentor_usage_daily (user_id, usage_date, message_count)
         values ($1, $2, 1)
         on conflict (user_id, usage_date) do update
           set message_count = public.mentor_usage_daily.message_count + 1
           where public.mentor_usage_daily.message_count < $3
         returning message_count`,
        [userId, usageDate, limit],
      );
      return result.rows[0]?.message_count ?? null;
    },

    async refundDailyQuota(userId, usageDate) {
      await db().query(
        `update public.mentor_usage_daily
         set message_count = greatest(message_count - 1, 0)
         where user_id = $1 and usage_date = $2`,
        [userId, usageDate],
      );
    },

    async saveExchange(input) {
      const client = await getPool().connect();
      try {
        await client.query('begin');

        let conversationId = input.conversationId;
        if (!conversationId) {
          const created = await client.query<{ id: string }>(
            `insert into public.mentor_conversations (user_id, title)
             values ($1, $2)
             returning id`,
            [input.userId, input.newConversationTitle],
          );
          conversationId = created.rows[0].id;
        }

        const userMessage = await client.query<MentorMessageRecord>(
          `insert into public.mentor_messages (conversation_id, user_id, role, content, created_at)
           values ($1, $2, 'user', $3, $4)
           returning ${messageColumns}`,
          [conversationId, input.userId, input.userContent, input.userCreatedAt],
        );

        const assistantMessage = await client.query<MentorMessageRecord>(
          `insert into public.mentor_messages (
             conversation_id, user_id, role, content, prompt_version, provider, model,
             input_tokens, output_tokens, created_at
           )
           values (
             $1, $2, 'assistant', $3, $4, $5, $6, $7, $8,
             greatest(clock_timestamp(), $9::timestamptz + interval '1 millisecond')
           )
           returning ${messageColumns}`,
          [
            conversationId,
            input.userId,
            input.assistant.content,
            input.assistant.promptVersion,
            input.assistant.provider,
            input.assistant.model,
            input.assistant.inputTokens,
            input.assistant.outputTokens,
            input.userCreatedAt,
          ],
        );

        await client.query(
          `update public.mentor_usage_daily
           set input_tokens = input_tokens + $3, output_tokens = output_tokens + $4
           where user_id = $1 and usage_date = $2`,
          [input.userId, input.usageDate, input.assistant.inputTokens ?? 0, input.assistant.outputTokens ?? 0],
        );

        const conversation = await client.query<MentorConversationRecord>(
          `select ${conversationColumns} from public.mentor_conversations where id = $1 and user_id = $2`,
          [conversationId, input.userId],
        );

        await client.query('commit');
        return {
          conversation: conversation.rows[0],
          userMessage: userMessage.rows[0],
          assistantMessage: assistantMessage.rows[0],
        };
      } catch (error) {
        await client.query('rollback');
        if (isForeignKeyViolation(error)) return null;
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
