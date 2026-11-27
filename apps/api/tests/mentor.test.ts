import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { AppError } from '../src/errors/appError.js';
import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import type { AuthTokenVerifier } from '../src/auth/types.js';
import type { MentorReplyEngine } from '../src/modules/mentor/mentorReplyEngine.js';
import type {
  MentorConversationRecord,
  MentorMessageRecord,
  MentorRepository,
  MentorSettingsRecord,
} from '../src/modules/mentor/mentorRepository.js';
import { createMentorService, deriveConversationTitle } from '../src/modules/mentor/mentorService.js';
import { MentorProviderError } from '../src/modules/mentor/provider/mentorProvider.js';
import { createMentorReplyEngine } from '../src/modules/mentor/mentorReplyEngine.js';
import { createMockMemoryExtractor, type MentorMemoryExtractor } from '../src/modules/mentor/memory/mentorMemoryExtractor.js';
import type { MentorMemoryRecord, MentorMemoryRepository } from '../src/modules/mentor/memory/mentorMemoryRepository.js';
import { createMentorMemoryService } from '../src/modules/mentor/memory/mentorMemoryService.js';
import {
  createMentorActionRegistry,
  type MentorActionDefinition,
} from '../src/modules/mentor/actions/mentorActionRegistry.js';
import type { MentorActionRecord, MentorActionRepository } from '../src/modules/mentor/actions/mentorActionRepository.js';
import { createMentorActionService } from '../src/modules/mentor/actions/mentorActionService.js';

const userA = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'a@example.com', role: 'authenticated' };
const userB = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', email: 'b@example.com', role: 'authenticated' };

const verifier: AuthTokenVerifier = async (token) => {
  if (token === 'token-a') return userA;
  if (token === 'token-b') return userB;
  return null;
};

const baseConfig = {
  MENTOR_PROVIDER: 'mock' as const,
  ANTHROPIC_API_KEY: '',
  MENTOR_ANTHROPIC_MODEL: 'claude-sonnet-5-5',
  MENTOR_ANTHROPIC_EFFORT: 'low' as const,
  MENTOR_MEMORY_MODEL: 'claude-haiku-5-5',
  MENTOR_MEMORY_MAX_ACTIVE: 3,
  MENTOR_PROVIDER_TIMEOUT_MS: 1000,
  MENTOR_MAX_OUTPUT_TOKENS: 256,
  MENTOR_HISTORY_MESSAGES: 6,
  MENTOR_DAILY_MESSAGE_LIMIT: 3,
  MENTOR_BURST_LIMIT_PER_MINUTE: 50,
  MENTOR_QUOTA_TIME_ZONE: 'Europe/Berlin',
};

type Conversation = MentorConversationRecord & { user_id: string };
type Message = MentorMessageRecord & { user_id: string };

function createInMemoryRepository() {
  const settings = new Map<string, MentorSettingsRecord>();
  const conversations: Conversation[] = [];
  const messages: Message[] = [];
  const usage = new Map<string, { count: number; input: number; output: number }>();
  const actions: Array<MentorActionRecord & { user_id: string }> = [];
  let clock = Date.parse('2026-11-27T09:00:00Z');
  const tick = () => new Date((clock += 1000)).toISOString();
  const strip = <T extends { user_id: string }>({ user_id: _ignored, ...rest }: T) => rest;

  const repository: MentorRepository = {
    async getSettings(userId) { return settings.get(userId) ?? null; },
    async grantConsent(userId, version) {
      const value = {
        consent_version: version,
        consented_at: tick(),
        memory_enabled: true,
        journal_access_enabled: false,
        notes_access_enabled: false,
      };
      settings.set(userId, value);
      return value;
    },
    async withdrawConsent(userId) {
      const value = settings.get(userId);
      if (!value) return null;
      value.consent_version = null;
      value.consented_at = null;
      return value;
    },
    async updateSettings(userId, changes) {
      const value = settings.get(userId) ?? {
        consent_version: null,
        consented_at: null,
        memory_enabled: true,
        journal_access_enabled: false,
        notes_access_enabled: false,
      };
      Object.assign(value, Object.fromEntries(Object.entries(changes).filter(([, entry]) => entry !== undefined)));
      settings.set(userId, value);
      return value;
    },
    async addTokenUsage() {},
    async listConversations(userId, limit, offset) {
      return conversations
        .filter((c) => c.user_id === userId)
        .sort((a, b) => (b.last_message_at ?? '').localeCompare(a.last_message_at ?? ''))
        .slice(offset, offset + limit)
        .map(strip);
    },
    async findConversation(userId, id) {
      const found = conversations.find((c) => c.id === id && c.user_id === userId);
      return found ? strip(found) : null;
    },
    async listMessages(userId, conversationId, limit, before) {
      const list = messages
        .filter((m) => m.user_id === userId && m.conversation_id === conversationId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
      if (!before) return list.slice(0, limit).map(strip);
      const index = list.findIndex((m) => m.id === before);
      if (index === -1) return null;
      return list.slice(index + 1, index + 1 + limit).map(strip);
    },
    async recentMessages(userId, conversationId, limit) {
      return messages
        .filter((m) => m.user_id === userId && m.conversation_id === conversationId)
        .slice(-limit)
        .map(strip);
    },
    async renameConversation(userId, id, title) {
      const found = conversations.find((c) => c.id === id && c.user_id === userId);
      if (!found) return null;
      found.title = title;
      return strip(found);
    },
    async deleteConversation(userId, id) {
      const index = conversations.findIndex((c) => c.id === id && c.user_id === userId);
      if (index === -1) return false;
      conversations.splice(index, 1);
      return true;
    },
    async getDailyUsage(userId, date) { return usage.get(`${userId}:${date}`)?.count ?? 0; },
    async consumeDailyQuota(userId, date, limit) {
      const key = `${userId}:${date}`;
      const entry = usage.get(key) ?? { count: 0, input: 0, output: 0 };
      if (entry.count >= limit) return null;
      entry.count += 1;
      usage.set(key, entry);
      return entry.count;
    },
    async refundDailyQuota(userId, date) {
      const entry = usage.get(`${userId}:${date}`);
      if (entry) entry.count = Math.max(entry.count - 1, 0);
    },
    async saveExchange(input) {
      let conversation = input.conversationId
        ? conversations.find((c) => c.id === input.conversationId && c.user_id === input.userId)
        : undefined;
      if (input.conversationId && !conversation) return null;
      if (!conversation) {
        const createdAt = tick();
        conversation = {
          id: randomUUID(),
          user_id: input.userId,
          title: input.newConversationTitle,
          last_message_at: null,
          created_at: createdAt,
          updated_at: createdAt,
        };
        conversations.push(conversation);
      }
      const userMessage: Message = {
        id: randomUUID(), conversation_id: conversation.id, user_id: input.userId,
        role: 'user', content: input.userContent, created_at: tick(),
      };
      const assistantMessage: Message = {
        id: randomUUID(), conversation_id: conversation.id, user_id: input.userId,
        role: 'assistant', content: input.assistant.content, created_at: tick(),
      };
      messages.push(userMessage, assistantMessage);
      conversation.last_message_at = assistantMessage.created_at;
      const created = (input.proposedActions ?? []).map((proposal) => {
        const record = {
          id: randomUUID(),
          user_id: input.userId,
          message_id: assistantMessage.id,
          type: proposal.type,
          payload: proposal.payload,
          summary: proposal.summary,
          status: 'proposed' as const,
          result_ref: null,
          error_code: null,
          decided_at: null,
          created_at: new Date().toISOString(),
        };
        actions.push(record);
        return record;
      });
      return {
        conversation: strip(conversation),
        userMessage: strip(userMessage),
        assistantMessage: strip(assistantMessage),
        actions: created.map(strip),
      };
    },
  };

  const actionRepository: MentorActionRepository = {
    async find(userId, id) {
      const found = actions.find((a) => a.id === id && a.user_id === userId);
      return found ? strip(found) : null;
    },
    async listForMessages(userId, ids) {
      return actions.filter((a) => a.user_id === userId && a.message_id && ids.includes(a.message_id)).map(strip);
    },
    async claim(userId, id, maxAgeMs) {
      const found = actions.find((a) => a.id === id && a.user_id === userId && a.status === 'proposed');
      if (!found || Date.now() - Date.parse(String(found.created_at)) >= maxAgeMs) return null;
      found.status = 'executing';
      return strip(found);
    },
    async decide(userId, id, status) {
      const found = actions.find((a) => a.id === id && a.user_id === userId && a.status === 'proposed');
      if (!found) return null;
      found.status = status;
      return strip(found);
    },
    async finish(userId, id, outcome) {
      const found = actions.find((a) => a.id === id && a.user_id === userId && a.status === 'executing');
      if (!found) return null;
      found.status = outcome.status;
      if (outcome.status === 'executed') found.result_ref = outcome.resultRef;
      else found.error_code = outcome.errorCode;
      return strip(found);
    },
  };

  return { repository, usage, messages, actions, actionRepository };
}

function createInMemoryMemoryRepository() {
  const memories: Array<MentorMemoryRecord & { user_id: string }> = [];
  let counter = 0;
  const strip = ({ user_id: _ignored, ...rest }: MentorMemoryRecord & { user_id: string }) => rest;
  const repository: MentorMemoryRepository = {
    async list(userId, limit) {
      return memories.filter((m) => m.user_id === userId).slice(0, limit).map(strip);
    },
    async countActive(userId) {
      return memories.filter((m) => m.user_id === userId && m.status === 'active').length;
    },
    async update(userId, id, changes) {
      const found = memories.find((m) => m.id === id && m.user_id === userId);
      if (!found) return null;
      if (changes.content !== undefined) found.content = changes.content;
      if (changes.status !== undefined) found.status = changes.status;
      return strip(found);
    },
    async delete(userId, id) {
      const index = memories.findIndex((m) => m.id === id && m.user_id === userId);
      if (index === -1) return false;
      memories.splice(index, 1);
      return true;
    },
    async deleteAll(userId) {
      const before = memories.length;
      for (let index = memories.length - 1; index >= 0; index -= 1) {
        if (memories[index].user_id === userId) memories.splice(index, 1);
      }
      return before - memories.length;
    },
    async applyOperations(userId, operations) {
      for (const operation of operations) {
        if (operation.type === 'add') {
          counter += 1;
          memories.unshift({
            id: `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`,
            user_id: userId,
            category: operation.category,
            content: operation.content,
            status: 'active',
            created_at: '2026-11-27T10:00:00.000Z',
            updated_at: '2026-11-27T10:00:00.000Z',
          });
        } else {
          const found = memories.find((m) => m.id === operation.id && m.user_id === userId);
          if (!found) continue;
          if (operation.type === 'update') found.content = operation.content;
          else found.status = 'resolved';
        }
      }
    },
  };
  return { repository, memories };
}

function setup(options: {
  replyEngine?: MentorReplyEngine;
  config?: Partial<typeof baseConfig>;
  mentorEnabled?: boolean;
  extractor?: MentorMemoryExtractor;
  actionDefinitions?: MentorActionDefinition[];
  actionMaxAgeMs?: number;
} = {}) {
  const store = createInMemoryRepository();
  const memoryStore = createInMemoryMemoryRepository();
  const background: Promise<void>[] = [];
  const config = { ...baseConfig, ...options.config };
  const replyEngine = options.replyEngine ?? createMentorReplyEngine(
    { name: 'fake', generateReply: async () => ({ content: 'Coach-Antwort', model: 'fake', inputTokens: 3, outputTokens: 4, truncated: false }) },
    config,
  );
  const memoryService = createMentorMemoryService({
    repository: memoryStore.repository,
    extractor: options.extractor ?? createMockMemoryExtractor(),
    maxActive: config.MENTOR_MEMORY_MAX_ACTIVE,
    timeZone: config.MENTOR_QUOTA_TIME_ZONE,
    timeoutMs: 1000,
  });
  const actionService = createMentorActionService({
    repository: store.actionRepository,
    registry: createMentorActionRegistry(options.actionDefinitions ?? []),
    maxAgeMs: options.actionMaxAgeMs,
    getAccessSettings: async (userId) => {
      const current = await store.repository.getSettings(userId);
      return {
        journal_access_enabled: current?.journal_access_enabled === true,
        notes_access_enabled: current?.notes_access_enabled === true,
      };
    },
  });
  const mentorService = createMentorService({
    repository: store.repository,
    replyEngine,
    config,
    now: () => new Date('2026-11-27T10:00:00Z'),
    memoryService,
    actionService,
    runInBackground: (task) => { background.push(task()); },
  });
  const flush = () => Promise.all(background.splice(0));
  const app = buildApp({
    authTokenVerifier: verifier,
    mentorEnabled: options.mentorEnabled ?? true,
    mentorService,
  });
  const call = (method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, token?: string, payload?: unknown) =>
    app.inject({
      method,
      url,
      headers: token ? { authorization: `Bearer ${token}` } : {},
      ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
    });
  const consent = (token: string) => call('PUT', '/v1/mentor/consent', token, { version: 'v1' });
  return { app, call, consent, store, memoryStore, flush };
}

describe('mentor feature flag', () => {
  it('does not register mentor routes unless enabled', async () => {
    const { app, call } = setup({ mentorEnabled: false });
    const response = await call('GET', '/v1/mentor/settings', 'token-a');
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('NOT_FOUND');
    await app.close();
  });

  it('is disabled by default in the real config', async () => {
    const app = buildApp({ authTokenVerifier: verifier });
    const response = await app.inject({
      method: 'GET', url: '/v1/mentor/settings', headers: { authorization: 'Bearer token-a' },
    });
    expect(response.statusCode).toBe(404);
    await app.close();
  });
});

describe('mentor auth and consent', () => {
  it('requires authentication on every route', async () => {
    const { app, call } = setup();
    const routes: Array<['GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', string]> = [
      ['GET', '/v1/mentor/settings'],
      ['PUT', '/v1/mentor/consent'],
      ['DELETE', '/v1/mentor/consent'],
      ['GET', '/v1/mentor/usage'],
      ['GET', '/v1/mentor/conversations'],
      ['GET', `/v1/mentor/conversations/${randomUUID()}/messages`],
      ['PATCH', `/v1/mentor/conversations/${randomUUID()}`],
      ['DELETE', `/v1/mentor/conversations/${randomUUID()}`],
      ['POST', '/v1/mentor/messages'],
    ];
    for (const [method, url] of routes) {
      const response = await call(method, url);
      expect(response.statusCode, `${method} ${url}`).toBe(401);
    }
    await app.close();
  });

  it('blocks messages until the current consent version is granted, and after withdrawal', async () => {
    const { app, call, consent, store } = setup();
    const blocked = await call('POST', '/v1/mentor/messages', 'token-a', { content: 'Hallo' });
    expect(blocked.statusCode).toBe(403);
    expect(blocked.json().error.code).toBe('MENTOR_CONSENT_REQUIRED');
    expect(store.usage.size).toBe(0);

    expect((await call('PUT', '/v1/mentor/consent', 'token-a', { version: 'v0' })).statusCode).toBe(400);
    const granted = await consent('token-a');
    expect(granted.json().settings).toMatchObject({ has_consent: true, consent_version: 'v1' });
    expect((await call('POST', '/v1/mentor/messages', 'token-a', { content: 'Hallo' })).statusCode).toBe(201);

    const withdrawn = await call('DELETE', '/v1/mentor/consent', 'token-a');
    expect(withdrawn.json().settings.has_consent).toBe(false);
    expect((await call('POST', '/v1/mentor/messages', 'token-a', { content: 'Hallo' })).statusCode).toBe(403);
    await app.close();
  });

  it('returns default settings for users without a row', async () => {
    const { app, call } = setup();
    const response = await call('GET', '/v1/mentor/settings', 'token-a');
    expect(response.json().settings).toEqual({
      consent_required_version: 'v1',
      has_consent: false,
      consent_version: null,
      consented_at: null,
      memory_enabled: true,
      journal_access_enabled: false,
      notes_access_enabled: false,
    });
    await app.close();
  });
});

describe('mentor conversations', () => {
  it('creates a conversation on the first message and continues it with history', async () => {
    const replies: Array<{ history: number; message: string }> = [];
    const replyEngine: MentorReplyEngine = {
      async generateReply(input) {
        replies.push({ history: input.history.length, message: input.userMessage });
        return {
          content: `Antwort ${replies.length}`, promptVersion: 'mentor-test', provider: 'fake', model: 'fake',
          inputTokens: null, outputTokens: null, truncated: false, crisisSignal: false,
        };
      },
    };
    const { app, call, consent } = setup({ replyEngine });
    await consent('token-a');

    const first = await call('POST', '/v1/mentor/messages', 'token-a', { content: '  Wie werde ich disziplinierter?  ' });
    expect(first.statusCode).toBe(201);
    const body = first.json();
    expect(body.conversation.title).toBe('Wie werde ich disziplinierter?');
    expect(body.user_message).toMatchObject({ role: 'user', content: 'Wie werde ich disziplinierter?' });
    expect(body.assistant_message).toMatchObject({ role: 'assistant', content: 'Antwort 1' });
    expect(body.usage).toEqual({ used: 1, limit: 3, remaining: 2, resets_at: '2026-11-27T23:00:00.000Z' });

    const second = await call('POST', '/v1/mentor/messages', 'token-a', {
      conversation_id: body.conversation.id, content: 'Und morgens?',
    });
    expect(second.statusCode).toBe(201);
    expect(second.json().conversation.id).toBe(body.conversation.id);
    expect(replies).toEqual([
      { history: 0, message: 'Wie werde ich disziplinierter?' },
      { history: 2, message: 'Und morgens?' },
    ]);

    const list = await call('GET', '/v1/mentor/conversations', 'token-a');
    expect(list.json()).toMatchObject({ page: 0, limit: 20, has_more: false });
    expect(list.json().conversations).toHaveLength(1);

    const history = await call('GET', `/v1/mentor/conversations/${body.conversation.id}/messages?limit=3`, 'token-a');
    expect(history.json().messages.map((m: { content: string }) => m.content))
      .toEqual(['Antwort 1', 'Und morgens?', 'Antwort 2']);
    expect(history.json().has_more).toBe(true);

    const olderCursor = history.json().messages[0].id;
    const older = await call(
      'GET', `/v1/mentor/conversations/${body.conversation.id}/messages?limit=3&before=${olderCursor}`, 'token-a',
    );
    expect(older.json().messages.map((m: { content: string }) => m.content)).toEqual(['Wie werde ich disziplinierter?']);
    expect(older.json().has_more).toBe(false);
    await app.close();
  });

  it('isolates conversations between users', async () => {
    const { app, call, consent } = setup();
    await consent('token-a');
    await consent('token-b');
    const created = await call('POST', '/v1/mentor/messages', 'token-a', { content: 'Privat' });
    const conversationId = created.json().conversation.id;

    const attempts = [
      await call('GET', `/v1/mentor/conversations/${conversationId}/messages`, 'token-b'),
      await call('PATCH', `/v1/mentor/conversations/${conversationId}`, 'token-b', { title: 'Hijack' }),
      await call('DELETE', `/v1/mentor/conversations/${conversationId}`, 'token-b'),
      await call('POST', '/v1/mentor/messages', 'token-b', { conversation_id: conversationId, content: 'Hi' }),
    ];
    for (const response of attempts) {
      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe('MENTOR_CONVERSATION_NOT_FOUND');
    }
    expect((await call('GET', '/v1/mentor/conversations', 'token-b')).json().conversations).toEqual([]);
    expect((await call('GET', `/v1/mentor/conversations/${conversationId}/messages`, 'token-a')).statusCode).toBe(200);
    await app.close();
  });

  it('renames and deletes own conversations', async () => {
    const { app, call, consent } = setup();
    await consent('token-a');
    const id = (await call('POST', '/v1/mentor/messages', 'token-a', { content: 'Business' })).json().conversation.id;

    const renamed = await call('PATCH', `/v1/mentor/conversations/${id}`, 'token-a', { title: '  Mein   Business  ' });
    expect(renamed.json().conversation.title).toBe('Mein Business');
    expect((await call('PATCH', `/v1/mentor/conversations/${id}`, 'token-a', { title: ' ' })).statusCode).toBe(400);

    expect((await call('DELETE', `/v1/mentor/conversations/${id}`, 'token-a')).statusCode).toBe(204);
    expect((await call('DELETE', `/v1/mentor/conversations/${id}`, 'token-a')).statusCode).toBe(404);
    expect((await call('GET', '/v1/mentor/conversations/not-a-uuid/messages', 'token-a')).statusCode).toBe(404);
    await app.close();
  });

  it('rejects invalid message payloads without consuming quota', async () => {
    const { app, call, consent, store } = setup();
    await consent('token-a');
    for (const payload of [{ content: '' }, { content: 'x'.repeat(4001) }, { content: 'hi', user_id: userB.id }]) {
      const response = await call('POST', '/v1/mentor/messages', 'token-a', payload);
      expect(response.statusCode).toBe(400);
    }
    expect(store.usage.size).toBe(0);
    await app.close();
  });
});

describe('mentor limits', () => {
  it('enforces the daily limit and reports usage', async () => {
    const { app, call, consent } = setup();
    await consent('token-a');
    for (let index = 0; index < 3; index += 1) {
      expect((await call('POST', '/v1/mentor/messages', 'token-a', { content: `Nachricht ${index}` })).statusCode).toBe(201);
    }
    const limited = await call('POST', '/v1/mentor/messages', 'token-a', { content: 'Noch eine' });
    expect(limited.statusCode).toBe(429);
    expect(limited.json().error.code).toBe('MENTOR_DAILY_LIMIT_REACHED');
    expect(limited.json().error.details.usage).toMatchObject({ used: 3, limit: 3, remaining: 0 });

    expect((await call('GET', '/v1/mentor/usage', 'token-a')).json().usage).toMatchObject({ used: 3, remaining: 0 });
    expect((await call('GET', '/v1/mentor/usage', 'token-b')).json().usage).toMatchObject({ used: 0, remaining: 3 });
    await app.close();
  });

  it('enforces the burst limit per user', async () => {
    const { app, call, consent } = setup({ config: { MENTOR_BURST_LIMIT_PER_MINUTE: 2, MENTOR_DAILY_MESSAGE_LIMIT: 10 } });
    await consent('token-a');
    await consent('token-b');
    expect((await call('POST', '/v1/mentor/messages', 'token-a', { content: '1' })).statusCode).toBe(201);
    expect((await call('POST', '/v1/mentor/messages', 'token-a', { content: '2' })).statusCode).toBe(201);
    const limited = await call('POST', '/v1/mentor/messages', 'token-a', { content: '3' });
    expect(limited.statusCode).toBe(429);
    expect(limited.json().error.code).toBe('MENTOR_RATE_LIMITED');
    expect((await call('POST', '/v1/mentor/messages', 'token-b', { content: '1' })).statusCode).toBe(201);
    await app.close();
  });

  it('refunds quota and stores nothing when the provider fails', async () => {
    const failing = vi.fn(async () => { throw new MentorProviderError('unavailable', 'down'); });
    const replyEngine = createMentorReplyEngine({ name: 'fake', generateReply: failing }, baseConfig);
    const { app, call, consent, store } = setup({ replyEngine });
    await consent('token-a');

    const response = await call('POST', '/v1/mentor/messages', 'token-a', { content: 'Hallo' });
    expect(response.statusCode).toBe(502);
    expect(response.json().error.code).toBe('MENTOR_PROVIDER_UNAVAILABLE');
    expect((await call('GET', '/v1/mentor/usage', 'token-a')).json().usage.used).toBe(0);
    expect(store.messages).toHaveLength(0);
    expect((await call('GET', '/v1/mentor/conversations', 'token-a')).json().conversations).toEqual([]);
    await app.close();
  });
});

describe('conversation titles', () => {
  it('uses the first non-empty line, collapsed and shortened', () => {
    expect(deriveConversationTitle('\n  Hallo   Welt \nZweite Zeile')).toBe('Hallo Welt');
    const long = deriveConversationTitle('a'.repeat(100));
    expect(long).toHaveLength(60);
    expect(long.endsWith('…')).toBe(true);
  });
});

describe('mentor memory', () => {
  function capturingEngine() {
    const seen: Array<Array<{ content: string; status: string }>> = [];
    const replyEngine: MentorReplyEngine = {
      async generateReply(input) {
        seen.push((input.memories ?? []).map((m) => ({ content: m.content, status: m.status })));
        return {
          content: 'Antwort', promptVersion: 'test', provider: 'fake', model: 'fake',
          inputTokens: null, outputTokens: null, truncated: false, crisisSignal: input.userMessage.includes('nicht mehr leben'),
        };
      },
    };
    return { replyEngine, seen };
  }

  it('remembers facts after a reply and uses them in later chats', async () => {
    const { replyEngine, seen } = capturingEngine();
    const { app, call, consent, flush } = setup({ replyEngine });
    await consent('token-a');

    await call('POST', '/v1/mentor/messages', 'token-a', { content: 'Merke dir: Linkes Knie am 27.11.2026 verletzt.' });
    await flush();
    const list = await call('GET', '/v1/mentor/memories', 'token-a');
    expect(list.json().memories).toMatchObject([
      { category: 'other', content: 'Linkes Knie am 27.11.2026 verletzt.', status: 'active' },
    ]);

    await call('POST', '/v1/mentor/messages', 'token-a', { content: 'Neuer Chat: mein rechtes Bein ist stärker.' });
    expect(seen.at(-1)).toEqual([{ content: 'Linkes Knie am 27.11.2026 verletzt.', status: 'active' }]);
    expect((await call('GET', '/v1/mentor/memories', 'token-b')).json().memories).toEqual([]);
    await app.close();
  });

  it('stops remembering and using memories when disabled', async () => {
    const { replyEngine, seen } = capturingEngine();
    const { app, call, consent, flush, memoryStore } = setup({ replyEngine });
    await consent('token-a');
    await call('POST', '/v1/mentor/messages', 'token-a', { content: 'Merke dir: Ziel 10 km laufen.' });
    await flush();

    const disabled = await call('PATCH', '/v1/mentor/settings', 'token-a', { memory_enabled: false });
    expect(disabled.json().settings.memory_enabled).toBe(false);
    await call('POST', '/v1/mentor/messages', 'token-a', { content: 'Merke dir: Noch ein Fakt.' });
    await flush();

    expect(seen.at(-1)).toEqual([]);
    expect(memoryStore.memories).toHaveLength(1);
    expect((await call('PATCH', '/v1/mentor/settings', 'token-a', { memory_enabled: 'nein' })).statusCode).toBe(400);
    await app.close();
  });

  it('does not extract memories from crisis messages', async () => {
    const extract = vi.fn(async () => ({ operations: [], inputTokens: 0, outputTokens: 0 }));
    const { replyEngine } = capturingEngine();
    const { app, call, consent, flush } = setup({ replyEngine, extractor: { name: 'spy', extract } });
    await consent('token-a');
    await call('POST', '/v1/mentor/messages', 'token-a', { content: 'Ich will nicht mehr leben' });
    await flush();
    expect(extract).not.toHaveBeenCalled();
    await app.close();
  });

  it('keeps the chat working when memory extraction fails', async () => {
    const extractor: MentorMemoryExtractor = { name: 'broken', extract: async () => { throw new Error('boom'); } };
    const { app, call, consent, flush } = setup({ extractor });
    await consent('token-a');
    const response = await call('POST', '/v1/mentor/messages', 'token-a', { content: 'Hallo' });
    await flush();
    expect(response.statusCode).toBe(201);
    await app.close();
  });

  it('caps the number of active memories', async () => {
    const { app, call, consent, flush, memoryStore } = setup();
    await consent('token-a');
    for (let index = 0; index < 5; index += 1) {
      await call('POST', '/v1/mentor/messages', 'token-a', { content: `Merke dir: Fakt ${index}` });
      await flush();
    }
    expect(memoryStore.memories).toHaveLength(baseConfig.MENTOR_MEMORY_MAX_ACTIVE);
    await app.close();
  });

  it('lets users edit, resolve and delete only their own memories', async () => {
    const { app, call, consent, flush } = setup();
    await consent('token-a');
    await call('POST', '/v1/mentor/messages', 'token-a', { content: 'Merke dir: Knie verletzt' });
    await call('POST', '/v1/mentor/messages', 'token-a', { content: 'Merke dir: Will ein Buch pro Monat lesen' });
    await flush();
    const [first, second] = (await call('GET', '/v1/mentor/memories', 'token-a')).json().memories;

    for (const response of [
      await call('PATCH', `/v1/mentor/memories/${first.id}`, 'token-b', { status: 'resolved' }),
      await call('DELETE', `/v1/mentor/memories/${first.id}`, 'token-b'),
      await call('PATCH', '/v1/mentor/memories/not-a-uuid', 'token-a', { status: 'resolved' }),
    ]) {
      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe('MENTOR_MEMORY_NOT_FOUND');
    }

    const resolved = await call('PATCH', `/v1/mentor/memories/${first.id}`, 'token-a', { status: 'resolved' });
    expect(resolved.json().memory.status).toBe('resolved');
    const edited = await call('PATCH', `/v1/mentor/memories/${first.id}`, 'token-a', { content: '  Knie wieder fit  ' });
    expect(edited.json().memory.content).toBe('Knie wieder fit');
    expect((await call('PATCH', `/v1/mentor/memories/${first.id}`, 'token-a', {})).statusCode).toBe(400);
    expect((await call('PATCH', `/v1/mentor/memories/${first.id}`, 'token-a', { content: 'x'.repeat(301) })).statusCode).toBe(400);

    expect((await call('DELETE', `/v1/mentor/memories/${second.id}`, 'token-a')).statusCode).toBe(204);
    expect((await call('DELETE', '/v1/mentor/memories', 'token-a')).json()).toEqual({ deleted: 1 });
    expect((await call('GET', '/v1/mentor/memories', 'token-a')).json().memories).toEqual([]);
    await app.close();
  });
});

describe('mentor actions', () => {
  function testDefinitions() {
    const created: Array<{ userId: string; title: string }> = [];
    const reads: string[] = [];
    const definitions: MentorActionDefinition[] = [
      {
        type: 'test.create_note',
        kind: 'write',
        description: 'Create a note.',
        inputSchema: z.object({ title: z.string().min(1).max(50) }).strict(),
        jsonSchema: { type: 'object', properties: { title: { type: 'string' } }, required: ['title'] },
        summarize: (input: { title: string }) => `Notiz „${input.title}“ anlegen`,
        async execute(userId: string, input: { title: string }) {
          if (input.title === 'fail') throw new AppError(409, 'HABIT_COLLECTION_CONFLICT', 'conflict');
          created.push({ userId, title: input.title });
          return { resultRef: { note_id: `note-${created.length}` } };
        },
      },
      {
        type: 'test.read_stats',
        kind: 'read',
        description: 'Read stats.',
        inputSchema: z.object({}).strict(),
        jsonSchema: { type: 'object', properties: {} },
        summarize: () => 'Statistik lesen',
        async execute(userId: string) {
          reads.push(userId);
          return { data: { streak: 5 } };
        },
      },
    ];
    return { definitions, created, reads };
  }

  /** Provider that performs scripted tool calls, then answers with the tool results. */
  function scriptedEngine(calls: Array<{ name: string; input: unknown }>) {
    const requests: Array<{ tools: string[]; history: string[] }> = [];
    const results: string[] = [];
    const engine = createMentorReplyEngine({
      name: 'scripted',
      async generateReply(request) {
        requests.push({
          tools: (request.tools ?? []).map((tool) => tool.name),
          history: request.messages.map((message) => message.content),
        });
        for (const call of calls) {
          const result = await request.onToolCall?.(call);
          if (result) results.push(`${result.isError ? 'ERR' : 'OK'}: ${result.content}`);
        }
        return { content: 'Erledigt vorbereitet.', model: 'scripted', inputTokens: null, outputTokens: null, truncated: false };
      },
    }, baseConfig);
    return { engine, requests, results };
  }

  it('stores write calls as proposals and executes only after confirmation', async () => {
    const { definitions, created } = testDefinitions();
    const { engine, requests } = scriptedEngine([{ name: 'test__create_note', input: { title: 'Lesen' } }]);
    const { app, call, consent } = setup({ replyEngine: engine, actionDefinitions: definitions });
    await consent('token-a');

    const sent = await call('POST', '/v1/mentor/messages', 'token-a', { content: 'Leg mir eine Notiz an' });
    expect(sent.statusCode).toBe(201);
    expect(requests[0].tools).toEqual(['test__create_note', 'test__read_stats']);
    const [action] = sent.json().assistant_message.actions;
    expect(action).toMatchObject({ type: 'test.create_note', summary: 'Notiz „Lesen“ anlegen', status: 'proposed' });
    expect(created).toEqual([]);

    const confirmed = await call('POST', `/v1/mentor/actions/${action.id}/confirm`, 'token-a');
    expect(confirmed.statusCode).toBe(200);
    expect(confirmed.json().action.status).toBe('executed');
    expect(created).toEqual([{ userId: userA.id, title: 'Lesen' }]);

    const again = await call('POST', `/v1/mentor/actions/${action.id}/confirm`, 'token-a');
    expect(again.statusCode).toBe(409);
    expect(again.json().error.code).toBe('MENTOR_ACTION_ALREADY_DECIDED');
    expect(created).toHaveLength(1);

    const history = await call('GET', `/v1/mentor/conversations/${sent.json().conversation.id}/messages`, 'token-a');
    expect(history.json().messages[1].actions[0].status).toBe('executed');
    await app.close();
  });

  it('tells the model about earlier proposals and their status', async () => {
    const { definitions } = testDefinitions();
    const first = scriptedEngine([{ name: 'test__create_note', input: { title: 'Lesen' } }]);
    const { app, call, consent } = setup({ replyEngine: first.engine, actionDefinitions: definitions });
    await consent('token-a');
    const sent = await call('POST', '/v1/mentor/messages', 'token-a', { content: 'Notiz bitte' });
    await call('POST', `/v1/mentor/actions/${sent.json().assistant_message.actions[0].id}/reject`, 'token-a');
    await call('POST', '/v1/mentor/messages', 'token-a', { conversation_id: sent.json().conversation.id, content: 'Und jetzt?' });
    expect(first.requests[1].history.join('\n')).toContain('[Proposal: Notiz „Lesen“ anlegen – rejected by the user]');
    await app.close();
  });

  it('rejects proposals and blocks confirming them later', async () => {
    const { definitions, created } = testDefinitions();
    const { engine } = scriptedEngine([{ name: 'test__create_note', input: { title: 'Lesen' } }]);
    const { app, call, consent } = setup({ replyEngine: engine, actionDefinitions: definitions });
    await consent('token-a');
    const actionId = (await call('POST', '/v1/mentor/messages', 'token-a', { content: 'x' })).json().assistant_message.actions[0].id;

    expect((await call('POST', `/v1/mentor/actions/${actionId}/reject`, 'token-a')).json().action.status).toBe('rejected');
    expect((await call('POST', `/v1/mentor/actions/${actionId}/confirm`, 'token-a')).statusCode).toBe(409);
    expect(created).toEqual([]);
    await app.close();
  });

  it('never lets another user decide an action', async () => {
    const { definitions, created } = testDefinitions();
    const { engine } = scriptedEngine([{ name: 'test__create_note', input: { title: 'Lesen' } }]);
    const { app, call, consent } = setup({ replyEngine: engine, actionDefinitions: definitions });
    await consent('token-a');
    const actionId = (await call('POST', '/v1/mentor/messages', 'token-a', { content: 'x' })).json().assistant_message.actions[0].id;

    for (const response of [
      await call('POST', `/v1/mentor/actions/${actionId}/confirm`, 'token-b'),
      await call('POST', `/v1/mentor/actions/${actionId}/reject`, 'token-b'),
      await call('POST', '/v1/mentor/actions/not-a-uuid/confirm', 'token-a'),
    ]) {
      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe('MENTOR_ACTION_NOT_FOUND');
    }
    expect((await call('POST', `/v1/mentor/actions/${actionId}/confirm`)).statusCode).toBe(401);
    expect(created).toEqual([]);
    await app.close();
  });

  it('drops invalid or unknown tool calls and limits proposals per reply', async () => {
    const { definitions } = testDefinitions();
    const { engine, results } = scriptedEngine([
      { name: 'test__create_note', input: { title: '' } },
      { name: 'test__create_note', input: { title: 'ok', user_id: userB.id } },
      { name: 'evil__drop_tables', input: {} },
      ...Array.from({ length: 4 }, (_, index) => ({ name: 'test__create_note', input: { title: `N${index}` } })),
    ]);
    const { app, call, consent } = setup({ replyEngine: engine, actionDefinitions: definitions });
    await consent('token-a');
    const sent = await call('POST', '/v1/mentor/messages', 'token-a', { content: 'x' });

    expect(sent.json().assistant_message.actions.map((a: { summary: string }) => a.summary))
      .toEqual(['Notiz „N0“ anlegen', 'Notiz „N1“ anlegen', 'Notiz „N2“ anlegen']);
    expect(results.slice(0, 3).every((result) => result.startsWith('ERR'))).toBe(true);
    expect(results.at(-1)).toMatch(/^ERR: Proposal limit/);
    await app.close();
  });

  it('runs read tools immediately for the current user without storing proposals', async () => {
    const { definitions, reads } = testDefinitions();
    const { engine, results } = scriptedEngine([{ name: 'test__read_stats', input: {} }]);
    const { app, call, consent } = setup({ replyEngine: engine, actionDefinitions: definitions });
    await consent('token-a');
    const sent = await call('POST', '/v1/mentor/messages', 'token-a', { content: 'Wie läuft es?' });
    expect(sent.json().assistant_message.actions).toEqual([]);
    expect(reads).toEqual([userA.id]);
    expect(results).toEqual(['OK: {"streak":5}']);
    await app.close();
  });

  it('marks failed executions and expired proposals', async () => {
    const { definitions } = testDefinitions();
    const failing = scriptedEngine([{ name: 'test__create_note', input: { title: 'fail' } }]);
    const one = setup({ replyEngine: failing.engine, actionDefinitions: definitions });
    await one.consent('token-a');
    const failId = (await one.call('POST', '/v1/mentor/messages', 'token-a', { content: 'x' })).json().assistant_message.actions[0].id;
    const failed = await one.call('POST', `/v1/mentor/actions/${failId}/confirm`, 'token-a');
    expect(failed.statusCode).toBe(200);
    expect(failed.json().action).toMatchObject({ status: 'failed', error_code: 'HABIT_COLLECTION_CONFLICT' });
    await one.app.close();

    const stale = scriptedEngine([{ name: 'test__create_note', input: { title: 'Alt' } }]);
    const two = setup({ replyEngine: stale.engine, actionDefinitions: definitions, actionMaxAgeMs: 1 });
    await two.consent('token-a');
    const staleId = (await two.call('POST', '/v1/mentor/messages', 'token-a', { content: 'x' })).json().assistant_message.actions[0].id;
    await new Promise((resolve) => setTimeout(resolve, 10));
    const expired = await two.call('POST', `/v1/mentor/actions/${staleId}/confirm`, 'token-a');
    expect(expired.statusCode).toBe(409);
    expect(expired.json().error.code).toBe('MENTOR_ACTION_EXPIRED');
    expect(expired.json().error.details.action.status).toBe('expired');
    await two.app.close();
  });

  it('offers no tools when no actions are registered', async () => {
    const { engine, requests } = scriptedEngine([]);
    const { app, call, consent } = setup({ replyEngine: engine });
    await consent('token-a');
    await call('POST', '/v1/mentor/messages', 'token-a', { content: 'Hallo' });
    expect(requests[0].tools).toEqual([]);
    await app.close();
  });
});

describe('mentor data-access switches', () => {
  function journalDefinitions() {
    const written: string[] = [];
    const definitions: MentorActionDefinition[] = [
      {
        type: 'stats.read',
        kind: 'read',
        description: 'Ungated tool.',
        inputSchema: z.object({}).strict(),
        jsonSchema: { type: 'object', properties: {} },
        summarize: () => 'Statistik lesen',
        async execute() { return { data: {} }; },
      },
      {
        type: 'journal.list',
        kind: 'read',
        requiresSetting: 'journal_access_enabled',
        description: 'Read journal.',
        inputSchema: z.object({}).strict(),
        jsonSchema: { type: 'object', properties: {} },
        summarize: () => 'Journal lesen',
        async execute() { return { data: { entries: ['privat'] } }; },
      },
      {
        type: 'journal_entry.create',
        kind: 'write',
        requiresSetting: 'journal_access_enabled',
        description: 'Write journal.',
        inputSchema: z.object({ text: z.string() }).strict(),
        jsonSchema: { type: 'object', properties: { text: { type: 'string' } } },
        summarize: () => 'Journal-Eintrag anlegen',
        async execute(_userId: string, input: { text: string }) { written.push(input.text); return {}; },
      },
    ];
    return { definitions, written };
  }

  function engineWith(calls: Array<{ name: string; input: unknown }>) {
    const offered: string[][] = [];
    const results: string[] = [];
    const engine = createMentorReplyEngine({
      name: 'scripted',
      async generateReply(request) {
        offered.push((request.tools ?? []).map((tool) => tool.name));
        for (const callItem of calls) {
          const result = await request.onToolCall?.(callItem);
          if (result) results.push(`${result.isError ? 'ERR' : 'OK'}: ${result.content}`);
        }
        return { content: 'ok', model: 'scripted', inputTokens: null, outputTokens: null, truncated: false };
      },
    }, baseConfig);
    return { engine, offered, results };
  }

  it('hides and blocks journal tools until the user turns access on', async () => {
    const { definitions } = journalDefinitions();
    const { engine, offered, results } = engineWith([{ name: 'journal__list', input: {} }]);
    const { app, call, consent } = setup({ replyEngine: engine, actionDefinitions: definitions });
    await consent('token-a');

    await call('POST', '/v1/mentor/messages', 'token-a', { content: 'Was steht im Journal?' });
    expect(offered[0]).toEqual(['stats__read']);
    expect(results[0]).toMatch(/^ERR: The user has not allowed access/);

    const enabled = await call('PATCH', '/v1/mentor/settings', 'token-a', { journal_access_enabled: true });
    expect(enabled.json().settings).toMatchObject({ journal_access_enabled: true, notes_access_enabled: false, memory_enabled: true });
    await call('POST', '/v1/mentor/messages', 'token-a', { content: 'Und jetzt?' });
    expect(offered[1]).toEqual(['stats__read', 'journal__list', 'journal_entry__create']);
    expect(results[1]).toBe('OK: {"entries":["privat"]}');

    expect((await call('PATCH', '/v1/mentor/settings', 'token-a', {})).statusCode).toBe(400);
    expect((await call('PATCH', '/v1/mentor/settings', 'token-a', { notes_access_enabled: 'ja' })).statusCode).toBe(400);
    await app.close();
  });

  it('does not execute a journal proposal after access was turned off', async () => {
    const { definitions, written } = journalDefinitions();
    const { engine } = engineWith([{ name: 'journal_entry__create', input: { text: 'Heute war gut' } }]);
    const { app, call, consent } = setup({ replyEngine: engine, actionDefinitions: definitions });
    await consent('token-a');
    await call('PATCH', '/v1/mentor/settings', 'token-a', { journal_access_enabled: true });
    const actionId = (await call('POST', '/v1/mentor/messages', 'token-a', { content: 'Schreib ins Journal' }))
      .json().assistant_message.actions[0].id;

    await call('PATCH', '/v1/mentor/settings', 'token-a', { journal_access_enabled: false });
    const confirmed = await call('POST', `/v1/mentor/actions/${actionId}/confirm`, 'token-a');
    expect(confirmed.json().action).toMatchObject({ status: 'failed', error_code: 'ACCESS_DISABLED' });
    expect(written).toEqual([]);
    await app.close();
  });
});
