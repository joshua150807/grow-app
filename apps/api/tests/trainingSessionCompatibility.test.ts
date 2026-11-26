import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as shared from '@grow/shared';

const require = createRequire(import.meta.url);
const { loadModule } = require('../../mobile/features/tools/training-v2/testing/loadModule.cjs');
const mobileDirectory = fileURLToPath(new URL('../../mobile/features/tools/training-v2/services/', import.meta.url));

// Frozen pre-history wire fixture: no aggregates, same terminal session and timing semantics.
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const legacy = {
  id, planId: null, planRevisionId: null, sourceUnitId: null,
  planName: 'Plan', revisionNumber: 1, logicalUnitKey: id, unitName: 'Unit',
  unitType: 'strength', status: 'completed', idempotencyKey: id,
  startedAt: null, endedAt: null, pausedDurationSeconds: 0,
  createdAt: '2026-07-31T10:00:00.000Z', exercises: [],
};
const input = { planId: id, unitId: id, status: 'completed', idempotencyKey: id, exercises: [] };
const { exercises: _exercises, ...legacySummary } = legacy;
const pagination = { page: 0, limit: 20, hasMore: false };

function api(payload: unknown, status = 200) {
  vi.stubEnv('EXPO_PUBLIC_API_URL', 'https://api.example.test');
  const fetch = vi.fn(async (_url: string, _init: RequestInit) => new Response(JSON.stringify(payload), { status }));
  vi.stubGlobal('fetch', fetch);
  return { fetch, client: loadModule(mobileDirectory, './trainingV2Api.js', {
    '@grow/shared': shared,
    '../../../../services/supabaseClient': {
      supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'test-only' } } }) } },
    },
  }) };
}
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('actual mobile consumer with actual shared package schemas', () => {
  it.each([true, false])('accepts previous save responses, created=%s, without requiring aggregates', async (created) => {
    const { client, fetch } = api({ session: legacy, created }, created ? 201 : 200);
    expect(await client.createTrainingV2Session(input)).toEqual({ session: legacy, created });
    expect(fetch.mock.calls[0][0]).toBe('https://api.example.test/v1/training/sessions');
  });

  it('accepts extended history/detail responses on their explicit read routes', async () => {
    const summary = { ...legacySummary, exerciseCount: 0, volumeKg: 0 };
    const { client, fetch } = api({ sessions: [summary], pagination });
    expect(await client.listTrainingV2Sessions({ limit: 20 })).toEqual({ sessions: [summary], pagination });
    expect(fetch.mock.calls[0][0]).toBe('https://api.example.test/v1/training/session-history?limit=20');
    const detail = { ...legacy, volumeKg: 0 };
    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ session: detail }), { status: 200 }));
    expect(await client.getTrainingV2Session(id)).toEqual(detail);
    expect(fetch.mock.calls[1][0]).toBe(`https://api.example.test/v1/training/session-history/${id}`);
  });

  it('handles previous read payloads as controlled contract errors instead of inventing aggregates', async () => {
    const { client, fetch } = api({ sessions: [legacySummary], pagination });
    await expect(client.listTrainingV2Sessions()).rejects.toMatchObject({ code: 'TRAINING_V2_CONTRACT_ERROR' });
    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ session: legacy }), { status: 200 }));
    await expect(client.getTrainingV2Session(id)).rejects.toMatchObject({ code: 'TRAINING_V2_CONTRACT_ERROR' });
  });

  it('reports an older API without history routes as unavailable without retrying or writing', async () => {
    const { client, fetch } = api({ error: 'Not Found' }, 404);
    await expect(client.listTrainingV2Sessions()).rejects.toMatchObject({ code: 'TRAINING_V2_HISTORY_UNAVAILABLE' });
    await expect(client.getTrainingV2Session(id)).rejects.toMatchObject({ code: 'TRAINING_V2_HISTORY_UNAVAILABLE' });
    expect(fetch).toHaveBeenCalledTimes(2);
    for (const call of fetch.mock.calls) expect(call[1]).toMatchObject({ method: 'GET' });
  });

  it('reads stats and recognizes when older APIs treat stats as a session ID', async () => {
    const totals = { totalSessions: 2, totalDurationSeconds: 30.5, totalVolumeKg: 640 };
    const { client, fetch } = api(totals);
    expect(await client.getTrainingV2SessionStats()).toEqual(totals);
    expect(fetch).toHaveBeenLastCalledWith('https://api.example.test/v1/training/sessions/stats',
      expect.objectContaining({ method: 'GET' }));
    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ error: {
      code: 'TRAINING_SESSION_VALIDATION_ERROR', details: { fieldErrors: { sessionId: ['Invalid uuid'] } },
    } }), { status: 400 }));
    await expect(client.getTrainingV2SessionStats()).rejects.toMatchObject({ code: 'TRAINING_V2_HISTORY_UNAVAILABLE' });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('preserves missing/foreign session errors and authentication errors', async () => {
    const { client, fetch } = api({ error: { code: 'TRAINING_SESSION_NOT_FOUND' } }, 404);
    await expect(client.getTrainingV2Session(id)).rejects.toMatchObject({ code: 'TRAINING_SESSION_NOT_FOUND' });
    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED' } }), { status: 401 }));
    await expect(client.listTrainingV2Sessions()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});
