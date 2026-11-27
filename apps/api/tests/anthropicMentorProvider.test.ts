import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';
import { createMentorReplyEngine } from '../src/modules/mentor/mentorReplyEngine.js';
import {
  createAnthropicMentorProvider,
  MENTOR_REFUSAL_REPLY,
  type AnthropicMessagesClient,
} from '../src/modules/mentor/provider/anthropicMentorProvider.js';
import { createMentorProvider } from '../src/modules/mentor/provider/createMentorProvider.js';
import { MentorProviderError } from '../src/modules/mentor/provider/mentorProvider.js';

const config = {
  ANTHROPIC_API_KEY: 'test-key',
  MENTOR_ANTHROPIC_MODEL: 'claude-sonnet-5-5',
  MENTOR_ANTHROPIC_EFFORT: 'low' as const,
};

type FakeMessage = {
  model?: string;
  stop_reason?: string;
  content?: Array<{ type: string; text?: string }>;
  usage?: Record<string, number | null>;
};

function fakeClient(result: FakeMessage | Error) {
  const create = vi.fn(async () => {
    if (result instanceof Error) throw result;
    return {
      model: result.model ?? 'claude-sonnet-5-5',
      stop_reason: result.stop_reason ?? 'end_turn',
      content: result.content ?? [{ type: 'text', text: 'Hallo!' }],
      usage: result.usage ?? { input_tokens: 100, cache_read_input_tokens: 900, cache_creation_input_tokens: 0, output_tokens: 50 },
    };
  });
  const client = { beta: { messages: { create } } } as unknown as AnthropicMessagesClient;
  return { client, create };
}

function request(signal = new AbortController().signal) {
  return {
    system: 'SYSTEM',
    messages: [
      { role: 'user' as const, content: 'Frage 1' },
      { role: 'assistant' as const, content: 'Antwort 1' },
      { role: 'user' as const, content: 'Frage 2' },
    ],
    maxOutputTokens: 4096,
    signal,
  };
}

describe('anthropic mentor provider', () => {
  it('sends model, effort, caching, fallbacks, system prompt and history', async () => {
    const { client, create } = fakeClient({});
    const signal = new AbortController().signal;
    await createAnthropicMentorProvider(config, client).generateReply(request(signal));

    expect(create).toHaveBeenCalledTimes(1);
    const [params, options] = create.mock.calls[0] as unknown as [Record<string, unknown>, { signal: AbortSignal }];
    expect(params).toMatchObject({
      model: 'claude-sonnet-5-5',
      max_tokens: 4096,
      system: 'SYSTEM',
      output_config: { effort: 'low' },
      cache_control: { type: 'ephemeral' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      messages: [
        { role: 'user', content: 'Frage 1' },
        { role: 'assistant', content: 'Antwort 1' },
        { role: 'user', content: 'Frage 2' },
      ],
    });
    expect(params).not.toHaveProperty('thinking');
    expect(params).not.toHaveProperty('temperature');
    expect(options.signal).toBe(signal);
  });

  it('returns only text blocks and counts cached input tokens', async () => {
    const { client } = fakeClient({
      content: [
        { type: 'thinking', text: '' },
        { type: 'text', text: 'Teil 1' },
        { type: 'fallback' },
        { type: 'text', text: 'Teil 2' },
      ],
    });
    const reply = await createAnthropicMentorProvider(config, client).generateReply(request());
    expect(reply).toEqual({
      content: 'Teil 1\nTeil 2',
      model: 'claude-sonnet-5-5',
      inputTokens: 1000,
      outputTokens: 50,
      truncated: false,
    });
  });

  it('flags truncated replies', async () => {
    const { client } = fakeClient({ stop_reason: 'max_tokens' });
    expect((await createAnthropicMentorProvider(config, client).generateReply(request())).truncated).toBe(true);
  });

  it('answers politely when the whole chain refuses', async () => {
    const { client } = fakeClient({ stop_reason: 'refusal', content: [] });
    const reply = await createAnthropicMentorProvider(config, client).generateReply(request());
    expect(reply.content).toBe(MENTOR_REFUSAL_REPLY);
  });

  it('rejects empty replies', async () => {
    const { client } = fakeClient({ content: [{ type: 'text', text: '  ' }] });
    await expect(createAnthropicMentorProvider(config, client).generateReply(request()))
      .rejects.toMatchObject({ kind: 'invalid_response' });
  });

  it('maps SDK errors to provider error kinds', async () => {
    const cases: Array<[Error, string]> = [
      [new Anthropic.RateLimitError(429, undefined, 'rate limited', new Headers()), 'rate_limited'],
      [new Anthropic.APIConnectionTimeoutError(), 'timeout'],
      [new Anthropic.APIUserAbortError(), 'timeout'],
      [new Anthropic.AuthenticationError(401, undefined, 'invalid key', new Headers()), 'unavailable'],
      [new Anthropic.BadRequestError(400, undefined, 'credit balance too low', new Headers()), 'unavailable'],
      [new Anthropic.InternalServerError(529, undefined, 'overloaded', new Headers()), 'unavailable'],
      [new Error('socket hang up'), 'unavailable'],
    ];
    for (const [error, kind] of cases) {
      const { client } = fakeClient(error);
      const result = createAnthropicMentorProvider(config, client).generateReply(request());
      await expect(result).rejects.toBeInstanceOf(MentorProviderError);
      await expect(result).rejects.toMatchObject({ kind });
    }
  });

  it('reaches the app as a safe 502 without leaking vendor details', async () => {
    const { client } = fakeClient(new Anthropic.BadRequestError(400, undefined, 'Your credit balance is too low', new Headers()));
    const engine = createMentorReplyEngine(createAnthropicMentorProvider(config, client), {
      MENTOR_PROVIDER_TIMEOUT_MS: 1000,
      MENTOR_MAX_OUTPUT_TOKENS: 4096,
      MENTOR_HISTORY_MESSAGES: 20,
    });
    const result = engine.generateReply({ history: [], userMessage: 'Hallo' });
    await expect(result).rejects.toMatchObject({ statusCode: 502, code: 'MENTOR_PROVIDER_UNAVAILABLE' });
    await result.catch((error: Error) => expect(error.message).not.toContain('credit'));
  });

  it('requires an API key unless a client is injected', () => {
    expect(() => createAnthropicMentorProvider({ ...config, ANTHROPIC_API_KEY: '' })).toThrow(/ANTHROPIC_API_KEY/);
    expect(createMentorProvider({ MENTOR_PROVIDER: 'anthropic', ...config }).name).toBe('anthropic');
  });
});
