// Release-Blocker-Fixplan B2 (2026-11-26): plausibility limits for NEW input, while persisted/read
// schemas stay open so historical rows remain readable (audit F03/F04/F05, U3).
import { describe, expect, it } from 'vitest';
import {
  createTrainingPlanInputSchema,
  createTrainingSessionInputSchema,
  hasAtMostDecimals,
  persistedSessionSetSchema,
  persistedTargetSetSchema,
  setCorrectionInputSchema,
  targetSetInputSchema,
  TRAINING_V2_LIMITS,
  updateWeeklyGoalInputSchema,
} from '../index.js';

const PG_INT_MAX = 2_147_483_647;
const set = (patch: Record<string, unknown> = {}) => ({
  clientSetId: '99999999-9999-4999-8999-999999999999', logicalTargetSetKey: null, orderIndex: 0, setType: 'work',
  weightKg: 60, reps: 8, rir: null, note: null, completedAt: '2026-11-25T10:00:00.000Z', actualRestSeconds: null, ...patch,
});
const session = (setPatch: Record<string, unknown> = {}, patch: Record<string, unknown> = {}) => ({
  planId: '33333333-3333-4333-8333-333333333333', unitId: '55555555-5555-4555-8555-555555555555', status: 'completed',
  idempotencyKey: '88888888-8888-4888-8888-888888888888',
  exercises: [{ exerciseId: '77777777-7777-4777-8777-777777777777', logicalTargetExerciseKey: null, orderIndex: 0, note: null, sets: [set(setPatch)] }],
  ...patch,
});
const ok = (value: unknown) => createTrainingSessionInputSchema.safeParse(value).success;
const target = (patch: Record<string, unknown> = {}) => ({
  logicalTargetSetKey: '44444444-4444-4444-8444-444444444444', orderIndex: 0, setType: 'work', targetWeightKg: 50,
  targetReps: { minimum: 8, maximum: 10 }, targetRir: 2, plannedRestSeconds: 90, importedFromLegacyPlan: false, ...patch,
});
const plan = (weeklyGoal: unknown) => ({
  name: 'P', weeklyGoal,
  units: [{ logicalUnitKey: '66666666-6666-4666-8666-666666666666', name: 'R', unitType: 'rest', orderIndex: 0, exercises: [] }],
});

describe('session set input limits', () => {
  it('accepts the documented limits and typical values', () => {
    expect(ok(session({ weightKg: TRAINING_V2_LIMITS.maxWeightKg, reps: TRAINING_V2_LIMITS.maxReps }))).toBe(true);
    expect(ok(session({ weightKg: 22.75 }))).toBe(true);
    expect(ok(session({ weightKg: 0.125 }))).toBe(true);
    expect(ok(session({ weightKg: 1499.999 }))).toBe(true);
    expect(ok(session({ weightKg: 0 }))).toBe(true);
    expect(ok(session({ weightKg: null, reps: null }))).toBe(true);
    expect(ok(session({ actualRestSeconds: 86_400 }))).toBe(true);
  });
  it('rejects values above the limits, non-finite numbers and too many decimals with a contract error', () => {
    expect(ok(session({ weightKg: 1500.001 }))).toBe(false);
    expect(ok(session({ weightKg: 1e308 }))).toBe(false);
    expect(ok(session({ weightKg: Number.POSITIVE_INFINITY }))).toBe(false);
    expect(ok(session({ weightKg: Number.NaN }))).toBe(false);
    expect(ok(session({ weightKg: 12.3456 }))).toBe(false);
    expect(ok(session({ weightKg: -0.5 }))).toBe(false);
    expect(ok(session({ reps: 1001 }))).toBe(false);
    expect(ok(session({ reps: PG_INT_MAX + 1 }))).toBe(false);
    expect(ok(session({ actualRestSeconds: 86_401 }))).toBe(false);
    expect(ok(session({ actualRestSeconds: PG_INT_MAX + 1 }))).toBe(false);
  });
  it('bounds pausedDurationSeconds: 0 without timing, never above the PostgreSQL integer range', () => {
    expect(ok(session({}, { pausedDurationSeconds: 0 }))).toBe(true);
    expect(ok(session({}, { pausedDurationSeconds: 60 }))).toBe(false);
    expect(ok(session({}, { pausedDurationSeconds: PG_INT_MAX + 1 }))).toBe(false);
    expect(ok(session({}, { startedAt: '2026-11-25T09:00:00.000Z', endedAt: '2026-11-25T10:00:00.000Z', pausedDurationSeconds: 600 }))).toBe(true);
    expect(ok(session({}, { startedAt: '2026-11-25T09:00:00.000Z', endedAt: '2026-11-25T10:00:00.000Z', pausedDurationSeconds: 3601 }))).toBe(false);
  });
  it('applies the same limits to set corrections', () => {
    expect(setCorrectionInputSchema.safeParse({ expectedVersion: 1, weightKg: 1e308, reps: 5, rir: null, note: null }).success).toBe(false);
    expect(setCorrectionInputSchema.safeParse({ expectedVersion: 1, weightKg: 100, reps: 5, rir: null, note: null }).success).toBe(true);
  });
});

describe('historical read schemas stay open (no new unreadable-history path)', () => {
  it('still parses stored sets and target sets above the new input limits', () => {
    const stored = { ...set({ weightKg: 99_999, reps: 9_999, actualRestSeconds: 999_999 }), id: '12121212-1212-4212-8212-121212121212', version: 1 };
    expect(persistedSessionSetSchema.safeParse(stored).success).toBe(true);
    expect(persistedSessionSetSchema.safeParse({ ...stored, weightKg: 1e308 }).success).toBe(true);
    const storedTarget = { ...target({ targetWeightKg: 5000, targetReps: { minimum: 2000, maximum: 3000 }, plannedRestSeconds: 7200 }), id: '13131313-1313-4313-8313-131313131313' };
    expect(persistedTargetSetSchema.safeParse(storedTarget).success).toBe(true);
  });
});

describe('plan input limits', () => {
  it('bounds target sets', () => {
    expect(targetSetInputSchema.safeParse(target()).success).toBe(true);
    expect(targetSetInputSchema.safeParse(target({ targetWeightKg: 1500.5 })).success).toBe(false);
    expect(targetSetInputSchema.safeParse(target({ targetReps: { minimum: 8, maximum: 1001 } })).success).toBe(false);
    expect(targetSetInputSchema.safeParse(target({ plannedRestSeconds: 3600 })).success).toBe(true);
    expect(targetSetInputSchema.safeParse(target({ plannedRestSeconds: 3601 })).success).toBe(false);
  });
  it('accepts weekly goals 1-7 only, on create and on the weekly-goal update', () => {
    for (const goal of [1, 7]) expect(createTrainingPlanInputSchema.safeParse(plan(goal)).success).toBe(true);
    for (const goal of [0, 8, 1_000_000, 3_000_000_000, 2.5]) expect(createTrainingPlanInputSchema.safeParse(plan(goal)).success).toBe(false);
    expect(updateWeeklyGoalInputSchema.safeParse({ expectedVersion: 1, weeklyGoal: 8 }).success).toBe(false);
    expect(updateWeeklyGoalInputSchema.safeParse({ expectedVersion: 1, weeklyGoal: 7 }).success).toBe(true);
  });
});

describe('hasAtMostDecimals', () => {
  it('tolerates binary float noise but counts real decimals', () => {
    expect(hasAtMostDecimals(0.1 + 0.2, 3)).toBe(true);
    expect(hasAtMostDecimals(1499.999, 3)).toBe(true);
    expect(hasAtMostDecimals(1.0005, 3)).toBe(false);
  });
});

describe('reliable measured duration (Fixplan B10)', () => {
  it('keeps durations up to 6 h and treats longer raw spans as not reliably measured', async () => {
    const { getEffectiveTrainingSessionDurationSeconds } = await import('../index.js');
    const at = (h: number) => new Date(Date.UTC(2026, 10, 25, 8) + h * 3_600_000).toISOString();
    expect(getEffectiveTrainingSessionDurationSeconds({ startedAt: at(0), endedAt: at(6), pausedDurationSeconds: 0 })).toBe(21_600);
    expect(getEffectiveTrainingSessionDurationSeconds({ startedAt: at(0), endedAt: at(26), pausedDurationSeconds: 0 })).toBeNull();
  });
});

describe('request size caps (Fixplan B11)', () => {
  it('accepts sessions/plans up to the caps and rejects larger ones', () => {
    const sets = (n: number) => Array.from({ length: n }, (_, i) => set({ orderIndex: i, clientSetId: `99999999-9999-4999-8999-${String(i).padStart(12, '0')}` }));
    const withSets = (n: number) => ({ ...session(), exercises: [{ ...session().exercises[0], sets: sets(n) }] });
    expect(ok(withSets(30))).toBe(true);
    expect(ok(withSets(31))).toBe(false);
    const exercises = (n: number) => Array.from({ length: n }, (_, i) => ({ ...session().exercises[0], orderIndex: i,
      exerciseId: `77777777-7777-4777-8777-${String(i).padStart(12, '0')}` }));
    expect(ok({ ...session(), exercises: exercises(30) })).toBe(true);
    expect(ok({ ...session(), exercises: exercises(31) })).toBe(false);
    const units = (n: number) => Array.from({ length: n }, (_, i) => ({ logicalUnitKey: `66666666-6666-4666-8666-${String(i).padStart(12, '0')}`,
      name: `R${i}`, unitType: 'rest', orderIndex: i, exercises: [] }));
    expect(createTrainingPlanInputSchema.safeParse({ ...plan(3), units: units(14) }).success).toBe(true);
    expect(createTrainingPlanInputSchema.safeParse({ ...plan(3), units: units(15) }).success).toBe(false);
  });
});
