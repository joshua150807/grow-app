// Release-Blocker-Fixplan 2026-11-26 -- API regression tests (blocks B1, B5, B10).
// Runs against the current @grow/shared sources: `npx vitest run -c vitest.fixplan.config.ts`.
import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import type { AuthTokenVerifier } from '../src/auth/types.js';
import { errorHandler } from '../src/errors/errorHandler.js';
import type { TrainingSessionRepository } from '../src/modules/trainingSessions/trainingSessionRepository.js';
import {
  measuredSessionDurationSql, plausibleSetSql, reliableTimingSql, setVolumeSql,
} from '../src/modules/trainingSessions/trainingSessionRepository.js';
import { createTrainingSessionService } from '../src/modules/trainingSessions/trainingSessionService.js';

const user = { id: '11111111-1111-4111-8111-111111111111', email: null, role: 'authenticated' };
const verify: AuthTokenVerifier = async (token) => (token === 'user' ? user : null);
const headers = { authorization: 'Bearer user' };
function repo(overrides: Partial<TrainingSessionRepository>): TrainingSessionRepository {
  return {
    create: vi.fn(), findLastExerciseNote: vi.fn(), list: vi.fn(), find: vi.fn(),
    listHistory: vi.fn(), findHistory: vi.fn(), getStats: vi.fn(), ...overrides,
  } as TrainingSessionRepository;
}
const body = (set: Record<string, unknown>) => ({
  planId: '33333333-3333-4333-8333-333333333333', unitId: '55555555-5555-4555-8555-555555555555', status: 'completed',
  idempotencyKey: '88888888-8888-4888-8888-888888888888', exercises: [{
    exerciseId: '77777777-7777-4777-8777-777777777777', logicalTargetExerciseKey: null, orderIndex: 0, note: null,
    sets: [{ clientSetId: '99999999-9999-4999-8999-999999999999', logicalTargetSetKey: null, orderIndex: 0, setType: 'work',
      weightKg: 60, reps: 8, rir: null, note: null, completedAt: '2026-11-25T10:00:00.000Z', actualRestSeconds: null, ...set }],
  }],
});

describe('B1: internal response contract violations', () => {
  it('logs the violation (paths only, no values) and answers 500 INTERNAL_ERROR', async () => {
    const error = vi.fn();
    const send = vi.fn();
    const reply = { status: vi.fn(() => ({ send })) };
    const service = createTrainingSessionService(repo({
      getStats: vi.fn(async () => ({ totalSessions: 1, totalDurationSeconds: 0, totalVolumeKg: Number.POSITIVE_INFINITY })),
    }));
    const thrown = await service.getStats(user).catch((caught: unknown) => caught);
    expect(thrown).toBeInstanceOf(Error);
    expect(String((thrown as Error).message)).toContain('totalVolumeKg');
    expect(String((thrown as Error).message)).not.toContain('Infinity');
    await errorHandler(thrown as never, { id: 'r1', log: { error } } as never, reply as never);
    expect(error).toHaveBeenCalledTimes(1);
    expect(reply.status).toHaveBeenCalledWith(500);
    expect(send.mock.calls[0][0].error.code).toBe('INTERNAL_ERROR');
  });
  it('keeps real client input errors as 400 with the session validation code', async () => {
    const app = buildApp({ authTokenVerifier: verify, trainingSessionService: createTrainingSessionService(repo({})) });
    const response = await app.inject({ method: 'GET', url: '/v1/training/sessions?limit=0', headers });
    await app.close();
    expect(response.statusCode).toBe(400);
  });
});

describe('B2: oversized input is a deterministic pre-write 400 the client can recognise', () => {
  for (const [name, set] of [
    ['reps above int32', { reps: 3_000_000_000 }], ['reps above 1000', { reps: 1001 }],
    ['weight 1e308', { weightKg: 1e308 }], ['weight above 1500', { weightKg: 1500.5 }],
    ['rest above 24h', { actualRestSeconds: 86_401 }],
  ] as const) {
    it(name, async () => {
      const create = vi.fn();
      const app = buildApp({ authTokenVerifier: verify, trainingSessionService: createTrainingSessionService(repo({ create })) });
      const response = await app.inject({ method: 'POST', url: '/v1/training/sessions', headers, payload: body(set) });
      await app.close();
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('TRAINING_SESSION_VALIDATION_ERROR');
      expect(create).not.toHaveBeenCalled();
    });
  }
});

describe('B5/B10: defensive aggregate SQL', () => {
  it('excludes implausible stored sets from every volume expression', () => {
    expect(plausibleSetSql).toContain('s.weight_kg <= 1500');
    expect(plausibleSetSql).toContain('s.reps <= 1000');
    expect(setVolumeSql).toContain(`when not (${plausibleSetSql}) then null`);
  });
  it('does not treat raw spans above 6 h as measured duration', () => {
    expect(reliableTimingSql).toContain('make_interval(secs => 21600)');
    expect(measuredSessionDurationSql).toContain(reliableTimingSql);
  });
});
