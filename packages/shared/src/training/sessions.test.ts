import { describe, expect, it } from 'vitest';
import {
  createTrainingSessionInputSchema,
  persistedSessionExerciseSchema,
  sessionCompletionExerciseInputSchema,
  trainingSessionDetailResponseSchema,
  trainingSessionSchema,
} from '../index.js';

const ids = Array.from({ length: 10 }, (_, index) => (
  `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`
));

function set(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    clientSetId: ids[4],
    logicalTargetSetKey: ids[5],
    orderIndex: 0,
    setType: 'work',
    weightKg: 80,
    reps: 8,
    rir: 2,
    note: 'felt strong',
    completedAt: '2026-07-31T10:00:00.000Z',
    actualRestSeconds: 90,
    ...overrides,
  };
}

function exercise(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    exerciseId: ids[2],
    logicalTargetExerciseKey: ids[3],
    orderIndex: 0,
    sets: [set()],
    ...overrides,
  };
}

function sessionInput(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    planId: ids[0],
    unitId: ids[1],
    status: 'completed',
    idempotencyKey: ids[9],
    startedAt: null,
    endedAt: null,
    pausedDurationSeconds: 0,
    exercises: [exercise()],
    ...overrides,
  };
}

describe('training session API contracts', () => {
  it('accepts a fully populated exercise/set completion', () => {
    expect(createTrainingSessionInputSchema.parse(sessionInput())).toEqual({
      ...sessionInput(), exercises: [{ ...exercise(), note: null }],
    });
  });

  it('accepts a rest-day session with no exercises at all', () => {
    const input = sessionInput({ status: 'incomplete', exercises: [] });
    expect(createTrainingSessionInputSchema.parse(input)).toEqual(input);
  });

  it('accepts null weight/reps/rir/note/rest and a null set correlation key', () => {
    const input = sessionInput({
      exercises: [exercise({
        sets: [set({
          logicalTargetSetKey: null, weightKg: null, reps: null, rir: null, note: null, actualRestSeconds: null,
        })],
      })],
    });
    expect(createTrainingSessionInputSchema.parse(input)).toEqual({
      ...input, exercises: [{ ...input.exercises[0], note: null }],
    });
  });

  it('rejects an unknown top-level field (e.g. a client-invented session note)', () => {
    expect(createTrainingSessionInputSchema.safeParse({ ...sessionInput(), note: 'nope' }).success).toBe(false);
  });

  it('normalizes a missing legacy exercise note to null', () => {
    expect(sessionCompletionExerciseInputSchema.parse(exercise()).note).toBeNull();
  });

  it('accepts an explicit null exercise note', () => {
    expect(sessionCompletionExerciseInputSchema.parse(exercise({ note: null })).note).toBeNull();
  });

  it('accepts a valid exercise note and preserves the existing trimming contract', () => {
    expect(sessionCompletionExerciseInputSchema.parse(exercise({ note: '  Griff breiter  ' })).note)
      .toBe('Griff breiter');
  });

  it('rejects invalid exercise note values', () => {
    expect(sessionCompletionExerciseInputSchema.safeParse(exercise({ note: 123 })).success).toBe(false);
    expect(sessionCompletionExerciseInputSchema.safeParse(exercise({ note: 'x'.repeat(1_001) })).success).toBe(false);
  });

  it('rejects duplicate set order positions within one exercise', () => {
    const input = sessionInput({
      exercises: [exercise({ sets: [set({ orderIndex: 0 }), set({ orderIndex: 0, clientSetId: ids[6] })] })],
    });
    expect(createTrainingSessionInputSchema.safeParse(input).success).toBe(false);
  });

  it('rejects duplicate client set ids within one exercise', () => {
    const input = sessionInput({
      exercises: [exercise({ sets: [set({ orderIndex: 0 }), set({ orderIndex: 1 })] })],
    });
    expect(createTrainingSessionInputSchema.safeParse(input).success).toBe(false);
  });

  it('rejects a set correlated to a target set when its exercise has no logicalTargetExerciseKey', () => {
    const input = sessionInput({
      exercises: [exercise({ logicalTargetExerciseKey: null, sets: [set({ logicalTargetSetKey: ids[7] })] })],
    });
    expect(createTrainingSessionInputSchema.safeParse(input).success).toBe(false);
  });

  it('accepts an ad-hoc exercise (no logicalTargetExerciseKey) whose sets are all uncorrelated', () => {
    const input = sessionInput({
      exercises: [exercise({ logicalTargetExerciseKey: null, sets: [set({ logicalTargetSetKey: null })] })],
    });
    expect(createTrainingSessionInputSchema.parse(input)).toEqual({
      ...input, exercises: [{ ...input.exercises[0], note: null }],
    });
  });

  it('rejects duplicate exercise order positions', () => {
    const input = sessionInput({
      exercises: [
        exercise({ orderIndex: 0 }),
        exercise({ orderIndex: 0, logicalTargetExerciseKey: ids[8], sets: [set({ clientSetId: ids[6] })] }),
      ],
    });
    expect(createTrainingSessionInputSchema.safeParse(input).success).toBe(false);
  });

  it('rejects duplicate exercise logical target keys', () => {
    const input = sessionInput({
      exercises: [
        exercise({ orderIndex: 0 }),
        exercise({ orderIndex: 1, sets: [set({ clientSetId: ids[6] })] }),
      ],
    });
    expect(createTrainingSessionInputSchema.safeParse(input).success).toBe(false);
  });

  it('requires at least one set per exercise', () => {
    expect(sessionCompletionExerciseInputSchema.safeParse(exercise({ sets: [] })).success).toBe(false);
  });

  it('rejects an invalid status (no server-side active/in-progress state)', () => {
    expect(createTrainingSessionInputSchema.safeParse(sessionInput({ status: 'active' })).success).toBe(false);
  });

  it('defaults startedAt/endedAt/pausedDurationSeconds to null/null/0 for a legacy request that omits them', () => {
    const legacy = sessionInput();
    const { startedAt: _startedAt, endedAt: _endedAt, pausedDurationSeconds: _paused, ...withoutTiming } = legacy;
    const parsed = createTrainingSessionInputSchema.parse(withoutTiming);
    expect(parsed.startedAt).toBeNull();
    expect(parsed.endedAt).toBeNull();
    expect(parsed.pausedDurationSeconds).toBe(0);
  });

  it('accepts a fully populated timing request', () => {
    const input = sessionInput({
      startedAt: '2026-07-31T09:00:00.000Z', endedAt: '2026-07-31T09:45:00.000Z', pausedDurationSeconds: 60,
    });
    const parsed = createTrainingSessionInputSchema.parse(input);
    expect(parsed.startedAt).toBe('2026-07-31T09:00:00.000Z');
    expect(parsed.endedAt).toBe('2026-07-31T09:45:00.000Z');
    expect(parsed.pausedDurationSeconds).toBe(60);
  });

  it('rejects startedAt without endedAt (and vice versa) — timing must be all-or-nothing', () => {
    expect(createTrainingSessionInputSchema.safeParse(
      sessionInput({ startedAt: '2026-07-31T09:00:00.000Z', endedAt: null }),
    ).success).toBe(false);
    expect(createTrainingSessionInputSchema.safeParse(
      sessionInput({ startedAt: null, endedAt: '2026-07-31T09:45:00.000Z' }),
    ).success).toBe(false);
  });

  it('rejects endedAt before startedAt', () => {
    const input = sessionInput({ startedAt: '2026-07-31T09:00:00.000Z', endedAt: '2026-07-31T08:59:59.000Z' });
    expect(createTrainingSessionInputSchema.safeParse(input).success).toBe(false);
  });

  it('accepts endedAt equal to startedAt (a zero-length gross duration)', () => {
    const input = sessionInput({ startedAt: '2026-07-31T09:00:00.000Z', endedAt: '2026-07-31T09:00:00.000Z' });
    expect(createTrainingSessionInputSchema.safeParse(input).success).toBe(true);
  });

  it('rejects a negative pausedDurationSeconds', () => {
    const input = sessionInput({ pausedDurationSeconds: -1 });
    expect(createTrainingSessionInputSchema.safeParse(input).success).toBe(false);
  });

  it('rejects a pausedDurationSeconds larger than the gross startedAt..endedAt span', () => {
    const input = sessionInput({
      startedAt: '2026-07-31T09:00:00.000Z', endedAt: '2026-07-31T09:10:00.000Z', pausedDurationSeconds: 601,
    });
    expect(createTrainingSessionInputSchema.safeParse(input).success).toBe(false);
  });

  it('accepts a pausedDurationSeconds exactly equal to the gross span', () => {
    const input = sessionInput({
      startedAt: '2026-07-31T09:00:00.000Z', endedAt: '2026-07-31T09:10:00.000Z', pausedDurationSeconds: 600,
    });
    expect(createTrainingSessionInputSchema.safeParse(input).success).toBe(true);
  });

  it('round-trips a persisted session with a null plan/revision/unit backlink and a null exercise/set correlation', () => {
    const persisted = {
      id: ids[0],
      planId: null,
      planRevisionId: null,
      sourceUnitId: null,
      planName: 'Strength',
      revisionNumber: 2,
      logicalUnitKey: ids[1],
      unitName: 'Day 1',
      unitType: 'strength' as const,
      status: 'completed' as const,
      idempotencyKey: ids[9],
      startedAt: '2026-07-31T09:00:00.000Z',
      endedAt: '2026-07-31T10:00:00.000Z',
      pausedDurationSeconds: 120,
      createdAt: '2026-07-31T10:00:00.000Z',
      exercises: [{
        id: ids[2],
        exerciseId: ids[3],
        exerciseName: 'Bankdrücken',
        exerciseMainMuscle: 'chest',
        logicalTargetExerciseKey: null,
        orderIndex: 0,
        note: null,
        sets: [{
          id: ids[4],
          clientSetId: ids[5],
          logicalTargetSetKey: null,
          orderIndex: 0,
          setType: 'work' as const,
          weightKg: 80,
          reps: 8,
          rir: null,
          note: null,
          completedAt: '2026-07-31T10:05:00.000Z',
          actualRestSeconds: null,
          version: 1,
        }],
      }],
    };
    expect(trainingSessionSchema.parse(persisted)).toEqual(persisted);
    expect(persistedSessionExerciseSchema.parse(persisted.exercises[0])).toEqual(persisted.exercises[0]);
    expect(trainingSessionDetailResponseSchema.parse({ session: persisted, created: false })).toEqual({
      session: persisted, created: false,
    });
  });
});
