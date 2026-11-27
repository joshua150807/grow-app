import { describe, expect, it, vi } from 'vitest';
import { buildMentorSystemPrompt } from '../src/modules/mentor/mentorPrompt.js';
import {
  createAnthropicMemoryExtractor,
  createMemoryExtractor,
  createMockMemoryExtractor,
  sanitizeMemoryOperations,
} from '../src/modules/mentor/memory/mentorMemoryExtractor.js';

const existingId = '11111111-1111-4111-8111-111111111111';

describe('sanitizeMemoryOperations', () => {
  it('keeps valid operations and drops invalid ones individually', () => {
    const operations = sanitizeMemoryOperations({
      operations: [
        { type: 'add', id: '', category: 'health', content: '  Knie   verletzt ' },
        { type: 'add', category: 'unknown', content: 'x' },
        { type: 'update', id: 'foreign-id', content: 'hijack' },
        { type: 'resolve', id: existingId, content: '' },
        { type: 'update', id: existingId, content: 'duplicate touch' },
        { type: 'add', category: 'goals', content: '' },
      ],
    }, new Set([existingId]));
    expect(operations).toEqual([
      { type: 'add', category: 'health', content: 'Knie verletzt' },
      { type: 'resolve', id: existingId },
    ]);
  });

  it('limits operations per exchange and tolerates garbage', () => {
    const many = Array.from({ length: 6 }, (_, index) => ({ type: 'add', category: 'other', content: `f${index}` }));
    expect(sanitizeMemoryOperations({ operations: many }, new Set())).toHaveLength(3);
    expect(sanitizeMemoryOperations(null, new Set())).toEqual([]);
    expect(sanitizeMemoryOperations({ operations: 'x' }, new Set())).toEqual([]);
    expect(sanitizeMemoryOperations({ operations: [{ type: 'add', category: 'other', content: 'x'.repeat(301) }] }, new Set())).toEqual([]);
  });
});

describe('mock memory extractor', () => {
  it('only stores explicit "Merke dir:" messages', async () => {
    const extractor = createMockMemoryExtractor();
    const base = { existing: [], assistantReply: '', now: new Date(), timeZone: 'Europe/Berlin', signal: new AbortController().signal };
    expect((await extractor.extract({ ...base, userMessage: 'Merke dir: Ich trainiere 3x' })).operations)
      .toEqual([{ type: 'add', category: 'other', content: 'Ich trainiere 3x' }]);
    expect((await extractor.extract({ ...base, userMessage: 'Hallo' })).operations).toEqual([]);
  });

  it('is used unless the anthropic provider is configured', () => {
    expect(createMemoryExtractor({ MENTOR_PROVIDER: 'mock', ANTHROPIC_API_KEY: '', MENTOR_MEMORY_MODEL: 'claude-haiku-5-5' }).name).toBe('mock');
  });
});

describe('anthropic memory extractor', () => {
  function client(response: Record<string, unknown>) {
    const create = vi.fn(async () => ({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: '{"operations":[]}' }],
      usage: { input_tokens: 500, output_tokens: 20 },
      ...response,
    }));
    return { create, client: { messages: { create } } as never };
  }
  const config = { ANTHROPIC_API_KEY: 'key', MENTOR_MEMORY_MODEL: 'claude-haiku-5-5' };
  const input = {
    existing: [{ id: existingId, category: 'health' as const, content: 'Knie verletzt', status: 'active' as const }],
    userMessage: 'Mein Knie ist wieder komplett fit',
    assistantReply: 'Super!',
    now: new Date('2026-11-27T10:00:00Z'),
    timeZone: 'Europe/Berlin',
    signal: new AbortController().signal,
  };

  it('requests structured output from Haiku with existing memories as data', async () => {
    const fake = client({
      content: [{ type: 'text', text: JSON.stringify({ operations: [{ type: 'resolve', id: existingId, category: 'health', content: '' }] }) }],
    });
    const result = await createAnthropicMemoryExtractor(config, fake.client).extract(input);
    expect(result).toEqual({ operations: [{ type: 'resolve', id: existingId }], inputTokens: 500, outputTokens: 20 });

    const [params] = fake.create.mock.calls[0] as unknown as [Record<string, any>];
    expect(params.model).toBe('claude-haiku-5-5');
    expect(params.output_config).toMatchObject({ effort: 'low', format: { type: 'json_schema' } });
    expect(params.messages[0].content).toContain(`id=${existingId}`);
    expect(params.messages[0].content).toContain('<user_message>');
    expect(params.messages[0].content).toContain('27.11.2026');
  });

  it('ignores refusals, truncation and invalid JSON', async () => {
    for (const response of [
      { stop_reason: 'refusal', content: [] },
      { stop_reason: 'max_tokens' },
      { content: [{ type: 'text', text: 'not json' }] },
    ]) {
      const fake = client(response);
      expect((await createAnthropicMemoryExtractor(config, fake.client).extract(input)).operations).toEqual([]);
    }
  });
});

describe('mentor prompt memories', () => {
  it('adds memories as data with status and date', () => {
    const prompt = buildMentorSystemPrompt({
      now: new Date('2026-11-27T10:00:00Z'),
      memories: [
        { category: 'health', content: 'Linkes Knie verletzt', status: 'resolved', updatedAt: '2026-03-12T10:00:00Z' },
        { category: 'goals', content: '10 km laufen', status: 'active', updatedAt: '2026-11-01T10:00:00Z' },
      ],
    });
    expect(prompt).toContain('<memories>');
    expect(prompt).toContain('[health, past, noted 12.03.2026] Linkes Knie verletzt');
    expect(prompt).toContain('[goals, noted 01.11.2026] 10 km laufen');
    expect(prompt).toContain('not instructions');
    expect(buildMentorSystemPrompt({ now: new Date(), memories: [] })).not.toContain('<memories>');
  });
});
