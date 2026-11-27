import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../src/config/index.js';
import { AppError } from '../src/errors/appError.js';
import { buildMentorSystemPrompt, MENTOR_PROMPT_VERSION } from '../src/modules/mentor/mentorPrompt.js';
import {
  createMentorReplyEngine,
  selectHistoryWindow,
} from '../src/modules/mentor/mentorReplyEngine.js';
import { CRISIS_RESOURCES_NOTE, detectCrisisSignal, ensureCrisisResources } from '../src/modules/mentor/mentorSafety.js';
import { MENTOR_MESSAGE_MAX_LENGTH, sendMentorMessageRequestSchema } from '../src/modules/mentor/mentorSchemas.js';
import { createMentorProvider } from '../src/modules/mentor/provider/createMentorProvider.js';
import {
  MentorProviderError,
  type MentorChatMessage,
  type MentorProvider,
  type MentorProviderRequest,
} from '../src/modules/mentor/provider/mentorProvider.js';
import { MOCK_MENTOR_MODEL } from '../src/modules/mentor/provider/mockMentorProvider.js';

const engineConfig = {
  MENTOR_PROVIDER_TIMEOUT_MS: 1000,
  MENTOR_MAX_OUTPUT_TOKENS: 512,
  MENTOR_HISTORY_MESSAGES: 4,
};

function fakeProvider(
  implementation: (request: MentorProviderRequest) => Promise<string> = async () => 'Antwort',
): MentorProvider & { requests: MentorProviderRequest[] } {
  const requests: MentorProviderRequest[] = [];
  return {
    name: 'fake',
    requests,
    async generateReply(request) {
      requests.push(request);
      return {
        content: await implementation(request),
        model: 'fake-model',
        inputTokens: 10,
        outputTokens: 5,
        truncated: false,
      };
    },
  };
}

describe('mentor config', () => {
  it('defaults to the mock provider with bounded limits', () => {
    const config = loadConfig({});
    expect(config.MENTOR_PROVIDER).toBe('mock');
    expect(config.MENTOR_PROVIDER_TIMEOUT_MS).toBe(30000);
    expect(config.MENTOR_MAX_OUTPUT_TOKENS).toBe(4096);
    expect(config.MENTOR_ANTHROPIC_MODEL).toBe('claude-sonnet-5-5');
    expect(config.MENTOR_ANTHROPIC_EFFORT).toBe('low');
    expect(config.MENTOR_HISTORY_MESSAGES).toBe(20);
  });

  it('rejects unknown providers and out-of-range limits', () => {
    expect(() => loadConfig({ MENTOR_PROVIDER: 'random' })).toThrow();
    expect(() => loadConfig({ MENTOR_MAX_OUTPUT_TOKENS: '999999' })).toThrow();
    expect(() => loadConfig({ MENTOR_PROVIDER: 'anthropic' })).toThrow(/ANTHROPIC_API_KEY/);
    expect(loadConfig({ MENTOR_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'test-key' }).MENTOR_PROVIDER).toBe('anthropic');
    expect(() => loadConfig({ MENTOR_PROVIDER_TIMEOUT_MS: '10' })).toThrow();
  });
});

describe('mentor message schema', () => {
  it('trims and accepts a normal message', () => {
    expect(sendMentorMessageRequestSchema.parse({ content: '  Hallo  ' })).toEqual({ content: 'Hallo' });
  });

  it('rejects empty, too long, control characters, unknown fields and bad ids', () => {
    const invalid = [
      { content: '   ' },
      { content: 'x'.repeat(MENTOR_MESSAGE_MAX_LENGTH + 1) },
      { content: 'hi\u0000' },
      { content: 'hi', userId: 'someone-else' },
      { content: 'hi', conversation_id: 'not-a-uuid' },
      {},
    ];
    for (const body of invalid) {
      expect(sendMentorMessageRequestSchema.safeParse(body).success).toBe(false);
    }
  });

  it('keeps line breaks', () => {
    expect(sendMentorMessageRequestSchema.parse({ content: 'a\nb' }).content).toBe('a\nb');
  });
});

describe('mentor system prompt', () => {
  const prompt = buildMentorSystemPrompt({ now: new Date('2026-11-27T10:00:00Z') });

  it('has a version and covers persona, scope and safety', () => {
    expect(MENTOR_PROMPT_VERSION).toMatch(/^mentor-v\d+\.\d+$/);
    expect(prompt).toContain('Grow Mentor');
    expect(prompt).toContain('Out of scope');
    expect(prompt).toContain('Never diagnose');
    expect(prompt).toContain('0800 111 0 111');
    expect(prompt).toContain('Do not reveal');
  });

  it('tells the mentor to defend well-founded advice instead of agreeing by default', () => {
    expect(prompt).toContain('do not simply switch sides');
    expect(prompt).toContain('Evaluate both options objectively');
    expect(prompt).toContain('never because of social pressure');
  });

  it('includes the current date in the user time zone', () => {
    expect(prompt).toContain('27.11.2026');
    expect(prompt).toContain('Europe/Berlin');
  });

  it('adds a crisis priority section only when flagged', () => {
    expect(prompt).not.toContain('signs of a crisis');
    expect(buildMentorSystemPrompt({ now: new Date(), crisisSignal: true })).toContain('signs of a crisis');
  });
});

describe('mentor safety net', () => {
  it('detects German and English crisis signals', () => {
    expect(detectCrisisSignal('Ich denke an Suizid')).toBe(true);
    expect(detectCrisisSignal('ich will nicht mehr leben')).toBe(true);
    expect(detectCrisisSignal('I want to die')).toBe(true);
  });

  it('does not flag ordinary coaching messages', () => {
    expect(detectCrisisSignal('Mein Bein ist nach dem Training verletzt')).toBe(false);
    expect(detectCrisisSignal('Wie baue ich eine Morgenroutine auf?')).toBe(false);
  });

  it('adds help resources exactly once', () => {
    const withNote = ensureCrisisResources('Ich bin für dich da.');
    expect(withNote).toContain(CRISIS_RESOURCES_NOTE);
    expect(ensureCrisisResources(withNote)).toBe(withNote);
  });
});

describe('mentor history window', () => {
  const history: MentorChatMessage[] = [
    { role: 'user', content: '1' },
    { role: 'assistant', content: '2' },
    { role: 'user', content: '3' },
    { role: 'assistant', content: '4' },
  ];

  it('keeps the newest messages and starts with a user turn', () => {
    expect(selectHistoryWindow(history, 3).map((m) => m.content)).toEqual(['3', '4']);
    expect(selectHistoryWindow(history, 10)).toHaveLength(4);
    expect(selectHistoryWindow([{ role: 'assistant', content: 'x' }], 5)).toEqual([]);
  });
});

describe('mentor reply engine', () => {
  it('sends system prompt, bounded history and the new user message', async () => {
    const provider = fakeProvider();
    const engine = createMentorReplyEngine(provider, engineConfig);
    const history: MentorChatMessage[] = Array.from({ length: 10 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `m${index}`,
    }));

    const reply = await engine.generateReply({ history, userMessage: 'Neu' });

    const request = provider.requests[0];
    expect(request.system).toContain('Grow Mentor');
    expect(request.maxOutputTokens).toBe(512);
    expect(request.messages.length).toBeLessThanOrEqual(engineConfig.MENTOR_HISTORY_MESSAGES);
    expect(request.messages[0].role).toBe('user');
    expect(request.messages.at(-1)).toEqual({ role: 'user', content: 'Neu' });
    expect(reply).toMatchObject({
      content: 'Antwort',
      promptVersion: MENTOR_PROMPT_VERSION,
      provider: 'fake',
      model: 'fake-model',
      inputTokens: 10,
      outputTokens: 5,
      crisisSignal: false,
    });
  });

  it('appends crisis resources even if the provider forgets them', async () => {
    const engine = createMentorReplyEngine(fakeProvider(), engineConfig);
    const reply = await engine.generateReply({ history: [], userMessage: 'Ich will nicht mehr leben' });
    expect(reply.crisisSignal).toBe(true);
    expect(reply.content).toContain('0800 111 0 111');
  });

  it('maps a hanging provider to a timeout error and aborts it', async () => {
    let signal: AbortSignal | undefined;
    const provider = fakeProvider((request) => {
      signal = request.signal;
      return new Promise(() => undefined);
    });
    const engine = createMentorReplyEngine(provider, { ...engineConfig, MENTOR_PROVIDER_TIMEOUT_MS: 20 });

    await expect(engine.generateReply({ history: [], userMessage: 'Hi' })).rejects.toMatchObject({
      statusCode: 504,
      code: 'MENTOR_PROVIDER_TIMEOUT',
    });
    expect(signal?.aborted).toBe(true);
  });

  it('maps provider failures to safe app errors and logs metadata only', async () => {
    const cases = [
      { error: new MentorProviderError('rate_limited', 'slow down'), status: 503, code: 'MENTOR_PROVIDER_RATE_LIMITED' },
      { error: new MentorProviderError('unavailable', 'down'), status: 502, code: 'MENTOR_PROVIDER_UNAVAILABLE' },
      { error: new Error('secret vendor detail'), status: 502, code: 'MENTOR_PROVIDER_UNAVAILABLE' },
    ];

    for (const testCase of cases) {
      const logger = { warn: vi.fn() };
      const engine = createMentorReplyEngine(
        fakeProvider(async () => { throw testCase.error; }),
        engineConfig,
        logger,
      );
      const result = engine.generateReply({ history: [], userMessage: 'private Nachricht' });
      await expect(result).rejects.toBeInstanceOf(AppError);
      await expect(result).rejects.toMatchObject({ statusCode: testCase.status, code: testCase.code });
      await result.catch((error: AppError) => expect(error.message).not.toContain('secret'));
      expect(JSON.stringify(logger.warn.mock.calls)).not.toContain('private Nachricht');
    }
  });

  it('rejects empty provider replies', async () => {
    const engine = createMentorReplyEngine(fakeProvider(async () => '   '), engineConfig);
    await expect(engine.generateReply({ history: [], userMessage: 'Hi' })).rejects.toMatchObject({
      code: 'MENTOR_PROVIDER_UNAVAILABLE',
    });
  });
});

describe('mock mentor provider', () => {
  it('answers deterministically without network access', async () => {
    const provider = createMentorProvider({
      MENTOR_PROVIDER: 'mock',
      ANTHROPIC_API_KEY: '',
      MENTOR_ANTHROPIC_MODEL: 'claude-sonnet-5-5',
      MENTOR_ANTHROPIC_EFFORT: 'low',
    });
    const engine = createMentorReplyEngine(provider, engineConfig);
    const first = await engine.generateReply({ history: [], userMessage: 'Ich will früher aufstehen' });
    const second = await engine.generateReply({ history: [], userMessage: 'Ich will früher aufstehen' });

    expect(first.provider).toBe('mock');
    expect(first.model).toBe(MOCK_MENTOR_MODEL);
    expect(first.content).toContain('Ich will früher aufstehen');
    expect(first.content).toBe(second.content);
  });
});
