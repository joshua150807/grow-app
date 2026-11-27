import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Pool, type PoolClient } from 'pg';

const expectedDatabaseName = 'grow_api_integration_test';
const expectedPort = '55432';
const userA = '11111111-1111-4111-8111-111111111111';
const userB = '22222222-2222-4222-8222-222222222222';

const dropMentorObjects = `
  drop table if exists public.mentor_messages, public.mentor_conversations,
    public.mentor_usage_daily, public.mentor_settings cascade;
  drop function if exists public.touch_mentor_conversation();
  drop function if exists public.set_mentor_updated_at();
`;

function guardedUrl(): string {
  const value = process.env.TEST_DATABASE_URL;
  if (!value || process.env.ALLOW_INTEGRATION_DB_RESET !== 'true') {
    throw new Error('Guarded local integration database configuration is required.');
  }
  const url = new URL(value);
  const database = decodeURIComponent(url.pathname.slice(1));
  if (url.hostname !== '127.0.0.1' || url.port !== expectedPort || database !== expectedDatabaseName) {
    throw new Error('Mentor integration tests only allow the guarded local test database.');
  }
  if (process.env.DATABASE_URL && process.env.DATABASE_URL === value) {
    throw new Error('TEST_DATABASE_URL must not equal DATABASE_URL.');
  }
  return value;
}

async function inRole<T>(
  pool: Pool,
  role: 'anon' | 'authenticated' | 'service_role',
  userId: string,
  operation: (client: PoolClient) => Promise<T>,
) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(`set local role ${role}`);
    await client.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId]);
    return await operation(client);
  } finally {
    await client.query('rollback');
    client.release();
  }
}

async function createConversation(pool: Pool, userId: string, title: string | null = null) {
  const result = await pool.query<{ id: string }>(
    'insert into public.mentor_conversations (user_id, title) values ($1, $2) returning id',
    [userId, title],
  );
  return result.rows[0].id;
}

describe('mentor foundation PostgreSQL integration', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: guardedUrl() });
    await pool.query(`
      ${dropMentorObjects}
      drop table if exists auth.users cascade;
      create schema if not exists auth;
      do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
      do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
      do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
      create table auth.users (id uuid primary key);
      grant usage on schema auth, public to anon, authenticated, service_role;
    `);
    const sql = await readFile(
      new URL('../../../supabase/migrations/20261127120000_mentor_foundation.sql', import.meta.url),
      'utf8',
    );
    await pool.query(sql);
  });

  beforeEach(async () => {
    await pool.query(`truncate public.mentor_messages, public.mentor_conversations,
      public.mentor_usage_daily, public.mentor_settings, auth.users cascade`);
    await pool.query('insert into auth.users (id) values ($1), ($2)', [userA, userB]);
  });

  afterAll(async () => {
    if (!pool) return;
    try {
      await pool.query(`${dropMentorObjects} drop table if exists auth.users cascade;`);
    } finally {
      await pool.end();
    }
  });

  it('denies all direct client access for anon and authenticated', async () => {
    const conversationId = await createConversation(pool, userA);
    for (const role of ['anon', 'authenticated'] as const) {
      for (const table of ['mentor_conversations', 'mentor_messages', 'mentor_usage_daily', 'mentor_settings']) {
        await expect(
          inRole(pool, role, userA, (client) => client.query(`select * from public.${table}`)),
        ).rejects.toMatchObject({ code: '42501' });
      }
      await expect(
        inRole(pool, role, userA, (client) => client.query(
          `insert into public.mentor_messages (conversation_id, user_id, role, content)
           values ($1, $2, 'user', 'hi')`,
          [conversationId, userA],
        )),
      ).rejects.toMatchObject({ code: '42501' });
    }
  });

  it('lets service_role write and read mentor data', async () => {
    const rows = await inRole(pool, 'service_role', userA, async (client) => {
      const conversation = await client.query<{ id: string }>(
        `insert into public.mentor_conversations (user_id, title) values ($1, 'Training') returning id`,
        [userA],
      );
      await client.query(
        `insert into public.mentor_messages (conversation_id, user_id, role, content)
         values ($1, $2, 'user', 'Hallo Mentor')`,
        [conversation.rows[0].id, userA],
      );
      return (await client.query('select role, content from public.mentor_messages')).rows;
    });
    expect(rows).toEqual([{ role: 'user', content: 'Hallo Mentor' }]);
  });

  it('rejects a message that points to another user conversation', async () => {
    const conversationOfB = await createConversation(pool, userB);
    await expect(pool.query(
      `insert into public.mentor_messages (conversation_id, user_id, role, content)
       values ($1, $2, 'user', 'fremd')`,
      [conversationOfB, userA],
    )).rejects.toMatchObject({ code: '23503' });
  });

  it('enforces role, content, title and token constraints', async () => {
    const conversationId = await createConversation(pool, userA);
    const insertMessage = (role: string, content: string, tokens: number | null = null) => pool.query(
      `insert into public.mentor_messages (conversation_id, user_id, role, content, input_tokens)
       values ($1, $2, $3, $4, $5)`,
      [conversationId, userA, role, content, tokens],
    );
    await expect(insertMessage('system', 'x')).rejects.toMatchObject({ code: '23514' });
    await expect(insertMessage('user', '   ')).rejects.toMatchObject({ code: '23514' });
    await expect(insertMessage('user', 'x'.repeat(20001))).rejects.toMatchObject({ code: '23514' });
    await expect(insertMessage('user', 'ok', -1)).rejects.toMatchObject({ code: '23514' });
    await expect(createConversation(pool, userA, ' ')).rejects.toMatchObject({ code: '23514' });
    await expect(createConversation(pool, userA, 'x'.repeat(81))).rejects.toMatchObject({ code: '23514' });
    await expect(pool.query(
      `insert into public.mentor_settings (user_id, consent_version) values ($1, 'v1')`,
      [userA],
    )).rejects.toMatchObject({ code: '23514' });
  });

  it('updates last_message_at on new messages and updated_at on changes', async () => {
    const conversationId = await createConversation(pool, userA);
    await pool.query(
      `insert into public.mentor_messages (conversation_id, user_id, role, content, created_at)
       values ($1, $2, 'user', 'eins', '2026-11-01T10:00:00Z'),
              ($1, $2, 'assistant', 'zwei', '2026-11-01T10:00:05Z')`,
      [conversationId, userA],
    );
    const touched = await pool.query<{ last_message_at: Date }>(
      'select last_message_at from public.mentor_conversations where id = $1',
      [conversationId],
    );
    expect(touched.rows[0].last_message_at.toISOString()).toBe('2026-11-01T10:00:05.000Z');

    await pool.query(
      `update public.mentor_conversations set updated_at = '2000-01-01', title = 'Neu' where id = $1`,
      [conversationId],
    );
    const updated = await pool.query<{ updated_at: Date }>(
      'select updated_at from public.mentor_conversations where id = $1',
      [conversationId],
    );
    expect(updated.rows[0].updated_at.getFullYear()).toBeGreaterThan(2000);
  });

  it('cascades conversation and account deletion', async () => {
    const conversationId = await createConversation(pool, userA);
    await pool.query(
      `insert into public.mentor_messages (conversation_id, user_id, role, content)
       values ($1, $2, 'user', 'hi')`,
      [conversationId, userA],
    );
    await pool.query(
      `insert into public.mentor_usage_daily (user_id, usage_date, message_count) values ($1, current_date, 1)`,
      [userA],
    );
    await pool.query(
      `insert into public.mentor_settings (user_id, consent_version, consented_at) values ($1, 'v1', now())`,
      [userA],
    );

    await pool.query('delete from public.mentor_conversations where id = $1', [conversationId]);
    expect((await pool.query('select 1 from public.mentor_messages')).rowCount).toBe(0);

    await pool.query('delete from auth.users where id = $1', [userA]);
    for (const table of ['mentor_conversations', 'mentor_usage_daily', 'mentor_settings']) {
      expect((await pool.query(`select 1 from public.${table}`)).rowCount).toBe(0);
    }
  });
});
