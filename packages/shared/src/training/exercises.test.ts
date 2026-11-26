import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  createTrainingExerciseInputSchema,
  listTrainingExercisesQuerySchema,
  listTrainingExercisesResponseSchema,
  trainingExerciseDetailResponseSchema,
  trainingExerciseIdParamsSchema,
  trainingExerciseSchema,
  type CreateTrainingExerciseInput,
  type ListTrainingExercisesQuery,
  type TrainingExercise,
} from '../index.js';

const exercise: TrainingExercise = {
  id: '11111111-1111-4111-8111-111111111111',
  systemKey: 'barbell_back_squat',
  scope: 'system',
  status: 'active',
  category: 'strength',
  loadType: 'total_weight',
  name: 'Kniebeuge',
  mainMuscle: 'quadriceps',
  supportingMuscles: ['glutes'],
  difficulty: null,
  equipment: ['barbell'],
  isHome: false,
  isGym: true,
  isBodyweight: false,
  imageReference: null,
  executionInstructions: null,
  commonMistakes: null,
  safetyNotes: null,
  version: 1,
  createdAt: '2026-07-26T10:00:00.000Z',
  updatedAt: '2026-07-26T10:00:00.000Z',
};

describe('training exercise shared contracts', () => {
  it('exports and validates the complete DTO including nullable fields', () => {
    expect(trainingExerciseSchema.parse(exercise)).toEqual(exercise);
    expect(trainingExerciseSchema.parse({
      ...exercise,
      systemKey: null,
      mainMuscle: null,
      difficulty: null,
      imageReference: null,
      executionInstructions: null,
      commonMistakes: null,
      safetyNotes: null,
    })).toBeDefined();
    expectTypeOf<TrainingExercise>().toEqualTypeOf<typeof exercise>();
  });

  it.each([
    ['id', 'not-a-uuid'],
    ['scope', 'foreign'],
    ['status', 'draft'],
    ['category', 'unknown'],
    ['loadType', 'unknown'],
    ['version', 0],
    ['createdAt', 'not-a-time'],
    ['updatedAt', '2026-07-26'],
  ])('rejects an invalid %s', (field, value) => {
    expect(trainingExerciseSchema.safeParse({ ...exercise, [field]: value }).success).toBe(false);
  });

  it('applies query defaults and parses canonical integer strings', () => {
    expect(listTrainingExercisesQuerySchema.parse({})).toEqual({ limit: 50, page: 0 });
    expect(listTrainingExercisesQuerySchema.parse({ limit: '1', page: '0' }))
      .toEqual({ limit: 1, page: 0 });
    expect(listTrainingExercisesQuerySchema.parse({ limit: '100', page: '12' }))
      .toEqual({ limit: 100, page: 12 });
  });

  it.each([
    { limit: '' },
    { limit: '0' },
    { limit: '101' },
    { limit: '-1' },
    { limit: '1.5' },
    { limit: 'abc' },
    { limit: ['1', '2'] },
    { limit: '1e2' },
    { page: '' },
    { page: '-1' },
    { page: '1.5' },
    { page: 'abc' },
    { page: ['0', '1'] },
    { page: '1e2' },
    { page: String(Number.MAX_SAFE_INTEGER + 1) },
  ])('rejects invalid pagination %#', (query) => {
    expect(listTrainingExercisesQuerySchema.safeParse(query).success).toBe(false);
  });

  it('accepts only pagination values whose calculated offset is a safe integer', () => {
    expect(listTrainingExercisesQuerySchema.parse({
      limit: '1',
      page: String(Number.MAX_SAFE_INTEGER),
    })).toMatchObject({ limit: 1, page: Number.MAX_SAFE_INTEGER });
    expect(listTrainingExercisesQuerySchema.safeParse({
      limit: '2',
      page: String(Number.MAX_SAFE_INTEGER),
    }).success).toBe(false);
    expect(listTrainingExercisesQuerySchema.parse({
      limit: '100',
      page: String(Math.floor(Number.MAX_SAFE_INTEGER / 100)),
    })).toMatchObject({
      limit: 100,
      page: Math.floor(Number.MAX_SAFE_INTEGER / 100),
    });
    expect(listTrainingExercisesQuerySchema.safeParse({
      limit: '100',
      page: String(Math.floor(Number.MAX_SAFE_INTEGER / 100) + 1),
    }).success).toBe(false);
  });

  it('trims search and muscle while rejecting empty trimmed search', () => {
    expect(listTrainingExercisesQuerySchema.parse({ search: '  Knie  ', muscle: ' quads ' }))
      .toMatchObject({ search: 'Knie', muscle: 'quads' });
    expect(listTrainingExercisesQuerySchema.safeParse({ search: '   ' }).success).toBe(false);
  });

  it('accepts every filter and rejects unknown filter values', () => {
    const parsed = listTrainingExercisesQuerySchema.parse({
      category: 'strength',
      loadType: 'per_hand',
      muscle: 'biceps',
      equipment: 'dumbbell',
      environment: 'home',
      scope: 'user',
    });
    expect(parsed).toMatchObject({
      category: 'strength',
      loadType: 'per_hand',
      muscle: 'biceps',
      equipment: 'dumbbell',
      environment: 'home',
      scope: 'user',
    });
    for (const query of [
      { category: 'unknown' },
      { loadType: 'unknown' },
      { equipment: ' dumbbell' },
      { environment: 'outside' },
      { scope: 'foreign' },
      { extra: 'field' },
    ]) {
      expect(listTrainingExercisesQuerySchema.safeParse(query).success).toBe(false);
    }
    expectTypeOf<ListTrainingExercisesQuery['limit']>().toEqualTypeOf<number>();
  });

  it('validates ID params and list/detail responses', () => {
    expect(trainingExerciseIdParamsSchema.parse({ exerciseId: exercise.id }))
      .toEqual({ exerciseId: exercise.id });
    expect(trainingExerciseIdParamsSchema.safeParse({ exerciseId: 'bad' }).success).toBe(false);
    expect(listTrainingExercisesResponseSchema.parse({
      exercises: [exercise],
      pagination: { page: 0, limit: 50, hasMore: false },
    })).toBeDefined();
    expect(trainingExerciseDetailResponseSchema.parse({ exercise })).toBeDefined();
  });
});

describe('create training exercise input contract', () => {
  it('accepts a name with an explicit muscle group and category', () => {
    const input: CreateTrainingExerciseInput = { name: 'Kabelrudern eng', mainMuscle: 'back', category: 'mobility' };
    expect(createTrainingExerciseInputSchema.parse(input)).toEqual(input);
  });

  it('defaults the muscle group to other and the category to strength when omitted', () => {
    expect(createTrainingExerciseInputSchema.parse({ name: 'Neue Übung' }))
      .toEqual({ name: 'Neue Übung', mainMuscle: 'other', category: 'strength' });
  });

  it.each([
    'chest', 'back', 'legs', 'shoulders', 'biceps', 'triceps', 'abs', 'forearms', 'other',
  ])('accepts the %s muscle group', (mainMuscle) => {
    expect(createTrainingExerciseInputSchema.safeParse({ name: 'Übung', mainMuscle }).success)
      .toBe(true);
  });

  it.each(['strength', 'cardio', 'mobility', 'stretching'])('accepts the %s category', (category) => {
    expect(createTrainingExerciseInputSchema.safeParse({ name: 'Übung', category }).success)
      .toBe(true);
  });

  it('rejects an unknown category', () => {
    expect(createTrainingExerciseInputSchema.safeParse({ name: 'Übung', category: 'yoga' }).success)
      .toBe(false);
  });

  it('trims the name and rejects an empty or overlong one', () => {
    expect(createTrainingExerciseInputSchema.parse({ name: '  Kniebeuge  ', mainMuscle: 'legs' }).name)
      .toBe('Kniebeuge');
    expect(createTrainingExerciseInputSchema.safeParse({ name: '', mainMuscle: 'legs' }).success)
      .toBe(false);
    expect(createTrainingExerciseInputSchema.safeParse({ name: '   ', mainMuscle: 'legs' }).success)
      .toBe(false);
    expect(createTrainingExerciseInputSchema.safeParse({ name: 'a'.repeat(121), mainMuscle: 'legs' }).success)
      .toBe(false);
  });

  it('rejects an unknown muscle group and unknown/system-identity fields', () => {
    expect(createTrainingExerciseInputSchema.safeParse({ name: 'Übung', mainMuscle: 'quads' }).success)
      .toBe(false);
    for (const extra of [
      { scope: 'system' },
      { systemKey: 'barbell_back_squat' },
      { ownerUserId: '11111111-1111-4111-8111-111111111111' },
      { id: '11111111-1111-4111-8111-111111111111' },
    ]) {
      expect(createTrainingExerciseInputSchema.safeParse({ name: 'Übung', mainMuscle: 'legs', ...extra }).success)
        .toBe(false);
    }
  });
});
