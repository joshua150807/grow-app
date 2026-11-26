// Audit 2026-11-26. `it.fails` documents an open finding: the block asserts the EXPECTED behavior and is
// reported green only while the product still behaves incorrectly (flip to `it` once fixed).
// Fixplan 2026-11-26: F03/F05/F04/F06 are fixed (blocks B1/B2) -- flipped to `it`, characterizations inverted.
import { createTrainingSessionInputSchema, createTrainingPlanInputSchema } from '@grow/shared';
import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import type { AuthTokenVerifier } from '../src/auth/types.js';
import type { TrainingSessionRepository } from '../src/modules/trainingSessions/trainingSessionRepository.js';
import { createTrainingSessionService } from '../src/modules/trainingSessions/trainingSessionService.js';

const user = { id: '11111111-1111-4111-8111-111111111111', email: null, role: 'authenticated' };
const verify: AuthTokenVerifier = async (token) => token === 'user' ? user : null;
const headers = { authorization: 'Bearer user' };
const PG_INT_MAX = 2147483647;

function repo(overrides: Partial<TrainingSessionRepository>): TrainingSessionRepository {
  return {
    create: vi.fn(), findLastExerciseNote: vi.fn(), list: vi.fn(), find: vi.fn(),
    listHistory: vi.fn(), findHistory: vi.fn(), getStats: vi.fn(), ...overrides,
  } as TrainingSessionRepository;
}
const sessionInput = (set: Record<string, unknown>) => ({
  planId: '33333333-3333-4333-8333-333333333333', unitId: '55555555-5555-4555-8555-555555555555', status: 'completed',
  idempotencyKey: '88888888-8888-4888-8888-888888888888', exercises: [{
    exerciseId: '77777777-7777-4777-8777-777777777777', logicalTargetExerciseKey: null, orderIndex: 0, note: null,
    sets: [{ clientSetId: '99999999-9999-4999-8999-999999999999', logicalTargetSetKey: null, orderIndex: 0, setType: 'work',
      weightKg: 60, reps: 8, rir: null, note: null, completedAt: '2026-11-25T10:00:00.000Z', actualRestSeconds: null, ...set }],
  }],
});

describe('AUDIT-F03/F05 input bounds', () => {
  it('fixed: the shared contract no longer accepts values the integer columns cannot store', () => {
    expect(createTrainingSessionInputSchema.safeParse(sessionInput({ reps: PG_INT_MAX + 1 })).success).toBe(false);
    expect(createTrainingSessionInputSchema.safeParse(sessionInput({ actualRestSeconds: PG_INT_MAX + 1 })).success).toBe(false);
    expect(createTrainingSessionInputSchema.safeParse(sessionInput({ weightKg: 1e308 })).success).toBe(false);
  });
  it('expected: reps / rest / pause / weeklyGoal above PostgreSQL integer range are a 400 contract error', () => {
    expect(createTrainingSessionInputSchema.safeParse(sessionInput({ reps: PG_INT_MAX + 1 })).success).toBe(false);
    expect(createTrainingSessionInputSchema.safeParse({ ...sessionInput({}), pausedDurationSeconds: PG_INT_MAX + 1 }).success).toBe(false);
  });
  it('expected: weeklyGoal has a plausible upper bound', () => {
    const plan = { name: 'P', weeklyGoal: 3_000_000_000, units: [{ logicalUnitKey: '66666666-6666-4666-8666-666666666666', name: 'R', unitType: 'rest', orderIndex: 0, exercises: [] }] };
    expect(createTrainingPlanInputSchema.safeParse(plan).success).toBe(false);
  });
  it('expected: a weightKg that makes the aggregated volume non-finite is rejected at write time', () => {
    expect(createTrainingSessionInputSchema.safeParse(sessionInput({ weightKg: 1e308, reps: 10 })).success).toBe(false);
  });
});

describe('AUDIT-F06 internal response contract violations', () => {
  it('fixed: a stored aggregate the response contract rejects is no longer reported as HTTP 400 VALIDATION_ERROR', async () => {
    const app = buildApp({ authTokenVerifier: verify, trainingSessionService: createTrainingSessionService(repo({
      getStats: vi.fn(async () => ({ totalSessions: 1, totalDurationSeconds: 0, totalVolumeKg: Number.POSITIVE_INFINITY })),
    })) });
    const response = await app.inject({ method: 'GET', url: '/v1/training/sessions/stats', headers });
    expect(response.statusCode).toBe(500);
    expect(response.json().error.code).toBe('INTERNAL_ERROR');
    await app.close();
  });
  it('expected: an internal contract violation is a 5xx, never a client validation error', async () => {
    const app = buildApp({ authTokenVerifier: verify, trainingSessionService: createTrainingSessionService(repo({
      getStats: vi.fn(async () => ({ totalSessions: 1, totalDurationSeconds: 0, totalVolumeKg: Number.POSITIVE_INFINITY })),
    })) });
    const response = await app.inject({ method: 'GET', url: '/v1/training/sessions/stats', headers });
    await app.close();
    expect(response.statusCode).toBeGreaterThanOrEqual(500);
  });
});

describe('AUDIT-F09 unbounded payload sizes', () => {
  it('fixed (Fixplan B11): a session with thousands of sets is rejected by the array caps', () => {
    const big = sessionInput({});
    big.exercises[0].sets = Array.from({ length: 5000 }, (_, i) => ({ ...big.exercises[0].sets[0], orderIndex: i,
      clientSetId: `99999999-9999-4999-8999-${String(i).padStart(12, '0')}` }));
    expect(createTrainingSessionInputSchema.safeParse(big).success).toBe(false);
  });
});
