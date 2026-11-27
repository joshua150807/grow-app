import { randomUUID } from 'node:crypto';
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

const userA = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'a@example.com', role: 'authenticated' };
const userB = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', email: 'b@example.com', role: 'authenticated' };

const verifier: AuthTokenVerifier = async (token) => {
  if (token === 'token-a') return userA;
  if (token === 'token-b') return userB;
  return null;
};

const baseConfig = {
  MENTOR_PROVIDER: 'mock' as const,
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
      return {
        conversation: strip(conversation),
        userMessage: strip(userMessage),
        assistantMessage: strip(assistantMessage),
      };
    },
  };

  return { repository, usage, messages };
}

function setup(options: {
  replyEngine?: MentorReplyEngine;
  config?: Partial<typeof baseConfig>;
  mentorEnabled?: boolean;
} = {}) {
  const store = createInMemoryRepository();
  const config = { ...baseConfig, ...options.config };
  const replyEngine = options.replyEngine ?? createMentorReplyEngine(
    { name: 'fake', generateReply: async () => ({ content: 'Coach-Antwort', model: 'fake', inputTokens: 3, outputTokens: 4, truncated: false }) },
    config,
  );
  const mentorService = createMentorService({
    repository: store.repository,
    replyEngine,
    config,
    now: () => new Date('2026-11-27T10:00:00Z'),
  });
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
  return { app, call, consent, store };
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
