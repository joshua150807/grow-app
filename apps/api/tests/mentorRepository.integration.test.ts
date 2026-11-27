import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { createMentorRepository, type MentorRepository } from '../src/modules/mentor/mentorRepository.js';
import {
  createMentorMemoryRepository,
  type MentorMemoryRepository,
} from '../src/modules/mentor/memory/mentorMemoryRepository.js';

const expectedDatabaseName = 'grow_api_integration_test';
const expectedPort = '55432';
const userA = '11111111-1111-4111-8111-111111111111';
const userB = '22222222-2222-4222-8222-222222222222';

const dropMentorObjects = `
  drop table if exists public.mentor_memories cascade;
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

const assistant = {
  content: 'Antwort',
  promptVersion: 'mentor-test',
  provider: 'mock',
  model: 'mock-model',
  inputTokens: 10,
  outputTokens: 20,
};

describe('mentor repository PostgreSQL integration', () => {
  let pool: Pool;
  let repository: MentorRepository;
  let memories: MentorMemoryRepository;

  beforeAll(async () => {
    pool = new Pool({ connectionString: guardedUrl(), max: 12 });
    await pool.query(`
      ${dropMentorObjects}
      drop table if exists auth.users cascade;
      create schema if not exists auth;
      do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
      do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
      do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
      create table auth.users (id uuid primary key);
    `);
    await pool.query(await readFile(
      new URL('../../../supabase/migrations/20261127120000_mentor_foundation.sql', import.meta.url),
      'utf8',
    ));
    await pool.query(await readFile(
      new URL('../../../supabase/migrations/20261127130000_mentor_memories.sql', import.meta.url),
      'utf8',
    ));
    repository = createMentorRepository(() => pool);
    memories = createMentorMemoryRepository(() => pool);
  });

  beforeEach(async () => {
    await pool.query(`truncate public.mentor_memories, public.mentor_messages, public.mentor_conversations,
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

  it('grants and withdraws consent idempotently', async () => {
    expect(await repository.getSettings(userA)).toBeNull();
    expect(await repository.withdrawConsent(userA)).toBeNull();
    expect((await repository.grantConsent(userA, 'v1')).consent_version).toBe('v1');
    expect((await repository.grantConsent(userA, 'v1')).consent_version).toBe('v1');
    const withdrawn = await repository.withdrawConsent(userA);
    expect(withdrawn).toMatchObject({ consent_version: null, consented_at: null, memory_enabled: true });
  });

  it('reserves daily quota atomically under concurrency', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () => repository.consumeDailyQuota(userA, '2026-11-27', 3)),
    );
    expect(results.filter((value) => value !== null).sort()).toEqual([1, 2, 3]);
    expect(await repository.getDailyUsage(userA, '2026-11-27')).toBe(3);
    expect(await repository.getDailyUsage(userA, '2026-11-28')).toBe(0);
    expect(await repository.getDailyUsage(userB, '2026-11-27')).toBe(0);

    await repository.refundDailyQuota(userA, '2026-11-27');
    expect(await repository.getDailyUsage(userA, '2026-11-27')).toBe(2);
    expect(await repository.consumeDailyQuota(userA, '2026-11-27', 3)).toBe(3);
  });

  it('saves an exchange in order, creates the conversation and tracks tokens', async () => {
    await repository.consumeDailyQuota(userA, '2026-11-27', 30);
    const saved = await repository.saveExchange({
      userId: userA,
      conversationId: null,
      newConversationTitle: 'Training',
      userContent: 'Frage',
      userCreatedAt: new Date(),
      assistant,
      usageDate: '2026-11-27',
    });
    expect(saved?.conversation.title).toBe('Training');
    expect(saved?.conversation.last_message_at).not.toBeNull();

    const conversationId = saved!.conversation.id;
    await repository.consumeDailyQuota(userA, '2026-11-27', 30);
    await repository.saveExchange({
      userId: userA,
      conversationId,
      newConversationTitle: 'ignored',
      userContent: 'Folgefrage',
      userCreatedAt: new Date(),
      assistant: { ...assistant, content: 'Zweite Antwort' },
      usageDate: '2026-11-27',
    });

    const recent = await repository.recentMessages(userA, conversationId, 10);
    expect(recent.map((m) => [m.role, m.content])).toEqual([
      ['user', 'Frage'],
      ['assistant', 'Antwort'],
      ['user', 'Folgefrage'],
      ['assistant', 'Zweite Antwort'],
    ]);
    expect((await repository.recentMessages(userA, conversationId, 2)).map((m) => m.content))
      .toEqual(['Folgefrage', 'Zweite Antwort']);

    const usage = await pool.query('select message_count, input_tokens, output_tokens from public.mentor_usage_daily');
    expect(usage.rows[0]).toEqual({ message_count: 2, input_tokens: '20', output_tokens: '40' });

    const stored = await pool.query(
      `select prompt_version, provider, model from public.mentor_messages where role = 'assistant' limit 1`,
    );
    expect(stored.rows[0]).toEqual({ prompt_version: 'mentor-test', provider: 'mock', model: 'mock-model' });
  });

  it('paginates messages with a cursor and rejects foreign cursors', async () => {
    const first = await repository.saveExchange({
      userId: userA, conversationId: null, newConversationTitle: 'A', userContent: 'q1',
      userCreatedAt: new Date(), assistant: { ...assistant, content: 'a1' }, usageDate: '2026-11-27',
    });
    const conversationId = first!.conversation.id;
    await repository.saveExchange({
      userId: userA, conversationId, newConversationTitle: 'A', userContent: 'q2',
      userCreatedAt: new Date(), assistant: { ...assistant, content: 'a2' }, usageDate: '2026-11-27',
    });

    const newest = await repository.listMessages(userA, conversationId, 2);
    expect(newest!.map((m) => m.content)).toEqual(['a2', 'q2']);
    const older = await repository.listMessages(userA, conversationId, 10, newest![1].id);
    expect(older!.map((m) => m.content)).toEqual(['a1', 'q1']);

    const other = await repository.saveExchange({
      userId: userB, conversationId: null, newConversationTitle: 'B', userContent: 'b',
      userCreatedAt: new Date(), assistant, usageDate: '2026-11-27',
    });
    expect(await repository.listMessages(userA, conversationId, 10, other!.userMessage.id)).toBeNull();
  });

  it('never touches another user conversation', async () => {
    const saved = await repository.saveExchange({
      userId: userA, conversationId: null, newConversationTitle: 'Privat', userContent: 'geheim',
      userCreatedAt: new Date(), assistant, usageDate: '2026-11-27',
    });
    const conversationId = saved!.conversation.id;

    expect(await repository.findConversation(userB, conversationId)).toBeNull();
    expect(await repository.listMessages(userB, conversationId, 10)).toEqual([]);
    expect(await repository.recentMessages(userB, conversationId, 10)).toEqual([]);
    expect(await repository.renameConversation(userB, conversationId, 'Hijack')).toBeNull();
    expect(await repository.deleteConversation(userB, conversationId)).toBe(false);
    expect(await repository.saveExchange({
      userId: userB, conversationId, newConversationTitle: 'x', userContent: 'x',
      userCreatedAt: new Date(), assistant, usageDate: '2026-11-27',
    })).toBeNull();
    expect(await repository.listConversations(userB, 10, 0)).toEqual([]);

    expect((await repository.findConversation(userA, conversationId))?.title).toBe('Privat');
    expect(await repository.recentMessages(userA, conversationId, 10)).toHaveLength(2);
  });

  it('orders conversations by latest activity and deletes with messages', async () => {
    const older = await repository.saveExchange({
      userId: userA, conversationId: null, newConversationTitle: 'Alt', userContent: '1',
      userCreatedAt: new Date('2026-11-01T10:00:00Z'), assistant, usageDate: '2026-11-01',
    });
    const newer = await repository.saveExchange({
      userId: userA, conversationId: null, newConversationTitle: 'Neu', userContent: '2',
      userCreatedAt: new Date('2026-11-02T10:00:00Z'), assistant, usageDate: '2026-11-02',
    });
    await repository.saveExchange({
      userId: userA, conversationId: older!.conversation.id, newConversationTitle: 'x', userContent: '3',
      userCreatedAt: new Date(Date.now() + 60_000), assistant, usageDate: '2026-11-27',
    });

    expect((await repository.listConversations(userA, 10, 0)).map((c) => c.title)).toEqual(['Alt', 'Neu']);
    expect((await repository.listConversations(userA, 1, 1)).map((c) => c.title)).toEqual(['Neu']);

    expect(await repository.deleteConversation(userA, newer!.conversation.id)).toBe(true);
    const remaining = await pool.query('select count(*)::int as count from public.mentor_messages');
    expect(remaining.rows[0].count).toBe(4);
  });

  it('stores memories per user, ignores foreign ids and keeps resolved facts', async () => {
    await memories.applyOperations(userA, [
      { type: 'add', category: 'health', content: 'Linkes Knie verletzt' },
      { type: 'add', category: 'goals', content: '10 km laufen' },
    ], null);
    await memories.applyOperations(userB, [{ type: 'add', category: 'other', content: 'B-Fakt' }], null);
    const listA = await memories.list(userA, 10);
    expect(listA.map((m) => m.content).sort()).toEqual(['10 km laufen', 'Linkes Knie verletzt']);
    const knee = listA.find((m) => m.content.includes('Knie'))!;
    const factOfB = (await memories.list(userB, 10))[0];

    await memories.applyOperations(userA, [
      { type: 'resolve', id: knee.id },
      { type: 'update', id: factOfB.id, content: 'hijack' },
      { type: 'resolve', id: factOfB.id },
    ], null);
    expect((await memories.list(userB, 10))[0]).toMatchObject({ content: 'B-Fakt', status: 'active' });
    expect((await memories.list(userA, 10)).find((m) => m.id === knee.id)?.status).toBe('resolved');
    expect(await memories.countActive(userA)).toBe(1);

    expect(await memories.update(userB, knee.id, { content: 'x' })).toBeNull();
    expect(await memories.delete(userB, knee.id)).toBe(false);
    expect((await memories.update(userA, knee.id, { content: 'Knie wieder fit' }))?.content).toBe('Knie wieder fit');
    expect(await memories.deleteAll(userA)).toBe(2);
    expect(await memories.list(userB, 10)).toHaveLength(1);
  });

  it('enforces memory constraints, denies client roles and cascades', async () => {
    await expect(memories.applyOperations(userA, [{ type: 'add', category: 'nope' as never, content: 'x' }], null))
      .rejects.toMatchObject({ code: '23514' });
    await expect(memories.applyOperations(userA, [{ type: 'add', category: 'other', content: 'x'.repeat(301) }], null))
      .rejects.toMatchObject({ code: '23514' });
    expect(await memories.list(userA, 10)).toEqual([]);

    const saved = await repository.saveExchange({
      userId: userA, conversationId: null, newConversationTitle: 'T', userContent: 'Knie verletzt',
      userCreatedAt: new Date(), assistant, usageDate: '2026-11-27',
    });
    await memories.applyOperations(userA, [{ type: 'add', category: 'health', content: 'Knie verletzt' }], saved!.userMessage.id);

    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query('set local role authenticated');
      await expect(client.query('select * from public.mentor_memories')).rejects.toMatchObject({ code: '42501' });
    } finally {
      await client.query('rollback');
      client.release();
    }

    await repository.deleteConversation(userA, saved!.conversation.id);
    const kept = await pool.query('select source_message_id from public.mentor_memories');
    expect(kept.rows).toEqual([{ source_message_id: null }]);

    await pool.query('delete from auth.users where id = $1', [userA]);
    expect((await pool.query('select 1 from public.mentor_memories')).rowCount).toBe(0);
  });

  it('upserts memory setting and adds token usage', async () => {
    expect((await repository.setMemoryEnabled(userA, false)).memory_enabled).toBe(false);
    expect((await repository.getSettings(userA))?.consent_version).toBeNull();
    await repository.addTokenUsage(userA, '2026-11-27', 100, 10);
    await repository.addTokenUsage(userA, '2026-11-27', 50, 5);
    const usage = await pool.query('select message_count, input_tokens, output_tokens from public.mentor_usage_daily');
    expect(usage.rows[0]).toEqual({ message_count: 0, input_tokens: '150', output_tokens: '15' });
  });
});
