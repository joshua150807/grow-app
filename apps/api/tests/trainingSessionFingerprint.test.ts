import { createTrainingSessionInputSchema, type CreateTrainingSessionInput } from '@grow/shared';
import { describe, expect, it } from 'vitest';
import { computeSessionRequestFingerprint } from '../src/modules/trainingSessions/trainingSessionFingerprint.js';

const planId = '11111111-1111-4111-8111-111111111111';
const unitId = '22222222-2222-4222-8222-222222222222';
const exerciseA = '33333333-3333-4333-8333-333333333333';
const exerciseB = '44444444-4444-4444-8444-444444444444';
const targetExerciseA = '55555555-5555-4555-8555-555555555555';
const targetExerciseB = '66666666-6666-4666-8666-666666666666';
const clientSetA = '77777777-7777-4777-8777-777777777777';
const clientSetB = '88888888-8888-4888-8888-888888888888';
const idempotencyKey = '99999999-9999-4999-8999-999999999999';

function baseInput(): CreateTrainingSessionInput {
  return {
    planId,
    unitId,
    status: 'completed',
    idempotencyKey,
    exercises: [
      {
        exerciseId: exerciseA,
        logicalTargetExerciseKey: targetExerciseA,
        orderIndex: 0,
        note: null,
        sets: [{
          clientSetId: clientSetA,
          logicalTargetSetKey: null,
          orderIndex: 0,
          setType: 'work',
          weightKg: 80,
          reps: 8,
          rir: 2,
          note: null,
          completedAt: '2026-07-31T09:00:00.000Z',
          actualRestSeconds: 90,
        }],
      },
      {
        exerciseId: exerciseB,
        logicalTargetExerciseKey: targetExerciseB,
        orderIndex: 1,
        note: null,
        sets: [{
          clientSetId: clientSetB,
          logicalTargetSetKey: null,
          orderIndex: 0,
          setType: 'work',
          weightKg: 40,
          reps: 12,
          rir: 1,
          note: 'burnout',
          completedAt: '2026-07-31T09:10:00.000Z',
          actualRestSeconds: 60,
        }],
      },
    ],
  };
}

describe('computeSessionRequestFingerprint', () => {
  it('produces a 64-character hex sha256 digest', () => {
    expect(computeSessionRequestFingerprint(baseInput())).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is stable across repeated calls with the same input', () => {
    expect(computeSessionRequestFingerprint(baseInput())).toBe(computeSessionRequestFingerprint(baseInput()));
  });

  it('ignores exercise submission order (array reordering does not change the fingerprint)', () => {
    const input = baseInput();
    const reordered: CreateTrainingSessionInput = { ...input, exercises: [...input.exercises].reverse() };
    expect(computeSessionRequestFingerprint(reordered)).toBe(computeSessionRequestFingerprint(input));
  });

  it('ignores set submission order within one exercise', () => {
    const input = baseInput();
    const withTwoSets: CreateTrainingSessionInput = {
      ...input,
      exercises: [{
        ...input.exercises[0],
        sets: [
          { ...input.exercises[0].sets[0], orderIndex: 0 },
          { ...input.exercises[0].sets[0], clientSetId: clientSetB, orderIndex: 1, weightKg: 82.5 },
        ],
      }],
    };
    const reordered: CreateTrainingSessionInput = {
      ...withTwoSets,
      exercises: [{ ...withTwoSets.exercises[0], sets: [...withTwoSets.exercises[0].sets].reverse() }],
    };
    expect(computeSessionRequestFingerprint(reordered)).toBe(computeSessionRequestFingerprint(withTwoSets));
  });

  it('ignores idempotencyKey (not part of the compared payload)', () => {
    const input = baseInput();
    const differentKey: CreateTrainingSessionInput = { ...input, idempotencyKey: planId };
    expect(computeSessionRequestFingerprint(differentKey)).toBe(computeSessionRequestFingerprint(input));
  });

  it('changes when the status differs', () => {
    const input = baseInput();
    expect(computeSessionRequestFingerprint({ ...input, status: 'incomplete' }))
      .not.toBe(computeSessionRequestFingerprint(input));
  });

  it('changes when a set weight differs', () => {
    const input = baseInput();
    const changed: CreateTrainingSessionInput = {
      ...input,
      exercises: [{ ...input.exercises[0], sets: [{ ...input.exercises[0].sets[0], weightKg: 82.5 }] }, input.exercises[1]],
    };
    expect(computeSessionRequestFingerprint(changed)).not.toBe(computeSessionRequestFingerprint(input));
  });

  it('changes when a set note differs', () => {
    const input = baseInput();
    const changed: CreateTrainingSessionInput = {
      ...input,
      exercises: [{ ...input.exercises[0], sets: [{ ...input.exercises[0].sets[0], note: 'changed my mind' }] }, input.exercises[1]],
    };
    expect(computeSessionRequestFingerprint(changed)).not.toBe(computeSessionRequestFingerprint(input));
  });

  it('changes when an exercise note differs', () => {
    const input = baseInput();
    const changed: CreateTrainingSessionInput = {
      ...input,
      exercises: [{ ...input.exercises[0], note: 'shoulder felt tight' }, input.exercises[1]],
    };
    expect(computeSessionRequestFingerprint(changed)).not.toBe(computeSessionRequestFingerprint(input));
  });

  it('treats a legacy missing exercise note exactly like an explicit null note after normalization', () => {
    const explicitNull = baseInput();
    const legacy = {
      ...explicitNull,
      exercises: explicitNull.exercises.map(({ note: _note, ...exercise }) => exercise),
    };
    expect(computeSessionRequestFingerprint(createTrainingSessionInputSchema.parse(legacy)))
      .toBe(computeSessionRequestFingerprint(createTrainingSessionInputSchema.parse(explicitNull)));
  });

  it('changes when the exercise set differs (extra exercise added)', () => {
    const input = baseInput();
    const changed: CreateTrainingSessionInput = { ...input, exercises: [input.exercises[0]] };
    expect(computeSessionRequestFingerprint(changed)).not.toBe(computeSessionRequestFingerprint(input));
  });

  it('changes when unitId differs', () => {
    const input = baseInput();
    expect(computeSessionRequestFingerprint({ ...input, unitId: planId }))
      .not.toBe(computeSessionRequestFingerprint(input));
  });
});
