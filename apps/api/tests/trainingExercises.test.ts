import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import type { AuthTokenVerifier } from '../src/auth/types.js';
import {
  createTrainingExerciseRepository,
  mapTrainingExerciseRow,
  type TrainingExerciseRepository,
  type TrainingExerciseRow,
} from '../src/modules/trainingExercises/trainingExerciseRepository.js';
import { createTrainingExerciseService } from '../src/modules/trainingExercises/trainingExerciseService.js';

const user = { id: '11111111-1111-4111-8111-111111111111', email: null, role: 'authenticated' };
const exerciseId = '33333333-3333-4333-8333-333333333333';
const verify: AuthTokenVerifier = async (token) => token === 'user' ? user : null;
const headers = { authorization: 'Bearer user' };
const exercise = {
  id: exerciseId,
  systemKey: 'catalog_key',
  scope: 'system' as const,
  status: 'active' as const,
  category: 'strength' as const,
  loadType: 'total_weight' as const,
  name: 'Catalog entry',
  mainMuscle: 'chest',
  supportingMuscles: ['triceps'],
  difficulty: 'intermediate',
  equipment: ['barbell'],
  isHome: false,
  isGym: true,
  isBodyweight: false,
  imageReference: null,
  executionInstructions: 'Instructions',
  commonMistakes: null,
  safetyNotes: null,
  version: 1,
  createdAt: '2026-07-26T10:00:00.000Z',
  updatedAt: '2026-07-26T10:00:00.000Z',
};

function repository(overrides: Partial<TrainingExerciseRepository> = {}): TrainingExerciseRepository {
  return {
    list: vi.fn(async () => ({ exercises: [exercise], hasMore: false })),
    findVisible: vi.fn(async () => exercise),
    ...overrides,
  };
}

function app(value: TrainingExerciseRepository) {
  return buildApp({
    authTokenVerifier: verify,
    trainingExerciseService: createTrainingExerciseService(value),
  });
}

describe('training exercise API', () => {
  it.each([
    '/v1/training/exercises',
    `/v1/training/exercises/${exerciseId}`,
  ])('requires authentication for GET %s', async (url) => {
    const value = repository();
    const server = app(value);
    expect((await server.inject({ method: 'GET', url })).statusCode).toBe(401);
    expect(value.list).not.toHaveBeenCalled();
    expect(value.findVisible).not.toHaveBeenCalled();
    await server.close();
  });

  it('parses strict list filters and returns bounded pagination metadata', async () => {
    const value = repository({ list: vi.fn(async () => ({ exercises: [exercise], hasMore: true })) });
    const server = app(value);
    const response = await server.inject({
      method: 'GET',
      url: '/v1/training/exercises?search=%20entry%20&category=strength&loadType=total_weight'
        + '&muscle=chest&equipment=barbell&environment=gym&scope=system&limit=1&page=2',
      headers,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      exercises: [exercise],
      pagination: { page: 2, limit: 1, hasMore: true },
    });
    expect(value.list).toHaveBeenCalledWith(user.id, {
      search: 'entry',
      category: 'strength',
      loadType: 'total_weight',
      muscle: 'chest',
      equipment: 'barbell',
      environment: 'gym',
      scope: 'system',
      limit: 1,
      page: 2,
    });
    await server.close();
  });

  it('keeps exercise list, exercise detail and the existing plan list as separate routes', async () => {
    const value = repository();
    const planList = vi.fn(async () => []);
    const server = buildApp({
      authTokenVerifier: verify,
      trainingExerciseService: createTrainingExerciseService(value),
      trainingPlanService: { list: planList } as never,
    });
    expect((await server.inject({
      method: 'GET', url: '/v1/training/exercises', headers,
    })).statusCode).toBe(200);
    expect((await server.inject({
      method: 'GET', url: `/v1/training/exercises/${exerciseId}`, headers,
    })).statusCode).toBe(200);
    const plans = await server.inject({
      method: 'GET', url: '/v1/training/plans', headers,
    });
    expect(plans.statusCode).toBe(200);
    expect(plans.json()).toEqual({ plans: [] });
    expect(value.list).toHaveBeenCalledOnce();
    expect(value.findVisible).toHaveBeenCalledOnce();
    expect(planList).toHaveBeenCalledOnce();
    await server.close();
  });

  it.each([
    '/v1/training/exercises?unknown=value',
    '/v1/training/exercises?limit=0',
    '/v1/training/exercises?limit=101',
    '/v1/training/exercises?page=-1',
    '/v1/training/exercises?scope=foreign',
    '/v1/training/exercises?search=a&search=b',
  ])('returns the exercise validation error for invalid query %s', async (url) => {
    const server = app(repository());
    const response = await server.inject({ method: 'GET', url, headers });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('TRAINING_EXERCISE_VALIDATION_ERROR');
    await server.close();
  });

  it('validates detail UUID and makes absent exercises indistinguishable', async () => {
    const missing = repository({ findVisible: vi.fn(async () => null) });
    const server = app(missing);
    const invalid = await server.inject({
      method: 'GET', url: '/v1/training/exercises/not-a-uuid', headers,
    });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json().error.code).toBe('TRAINING_EXERCISE_VALIDATION_ERROR');

    const absent = await server.inject({
      method: 'GET', url: `/v1/training/exercises/${exerciseId}`, headers,
    });
    expect(absent.statusCode).toBe(404);
    expect(absent.json().error).toMatchObject({
      code: 'TRAINING_EXERCISE_NOT_FOUND',
      message: 'Training exercise was not found.',
    });
    expect(missing.findVisible).toHaveBeenCalledWith(user.id, exerciseId);
    await server.close();
  });

  it('routes internal response contract violations through the internal 500 handler', async () => {
    const value = repository({
      list: vi.fn(async () => ({
        exercises: [{ ...exercise, version: 0 }] as never,
        hasMore: false,
      })),
    });
    const server = app(value);
    const response = await server.inject({
      method: 'GET', url: '/v1/training/exercises', headers,
    });
    expect(response.statusCode).toBe(500);
    expect(response.json().error).toMatchObject({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error.',
    });
    expect(response.json().error.code).not.toBe('TRAINING_EXERCISE_VALIDATION_ERROR');
    expect(response.json().error).not.toHaveProperty('details');
    await server.close();
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'] as const)('exposes no %s write endpoint', async (method) => {
    const server = app(repository());
    expect((await server.inject({
      method, url: `/v1/training/exercises/${exerciseId}`, headers, payload: {},
    })).statusCode).toBe(404);
    await server.close();
  });
});

describe('training exercise repository', () => {
  const row: TrainingExerciseRow = {
    id: exerciseId,
    system_key: 'catalog_key',
    scope: 'system',
    status: 'active',
    category: 'strength',
    load_type: 'total_weight',
    name: 'Catalog entry',
    main_muscle: 'chest',
    supporting_muscles: ['triceps'],
    difficulty: 'intermediate',
    equipment: ['barbell'],
    is_home: false,
    is_gym: true,
    is_bodyweight: false,
    image_reference: null,
    execution_instructions: 'Instructions',
    common_mistakes: null,
    safety_notes: null,
    version: 1,
    created_at: new Date('2026-07-26T10:00:00.000Z'),
    updated_at: '2026-07-26T10:00:00.000Z',
  };

  it('maps every persisted field to the public DTO', () => {
    expect(mapTrainingExerciseRow(row)).toEqual(exercise);
  });

  it('uses bound AND filters, escaped literal search and stable limit-plus-one pagination', async () => {
    const query = vi.fn(async () => ({ rows: [row, row, row] }));
    const value = createTrainingExerciseRepository({ query } as never);
    const result = await value.list(user.id, {
      search: String.raw`50%_gain`,
      category: 'strength',
      loadType: 'total_weight',
      muscle: 'chest',
      equipment: 'barbell',
      environment: 'gym',
      scope: 'system',
      limit: 2,
      page: 3,
    });
    const [sql, parameters] = query.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain("exercise.status = 'active'");
    expect(sql).toContain("exercise.scope = 'system' and exercise.owner_user_id is null");
    expect(sql).toContain("exercise.scope = 'user' and exercise.owner_user_id = $1");
    expect(sql).toContain('order by lower(exercise.name) asc, exercise.id asc');
    expect(sql).toContain('unnest(exercise.supporting_muscles)');
    expect(sql).toContain('unnest(exercise.equipment)');
    expect(sql).not.toContain(String.raw`50%_gain`);
    expect(sql).not.toContain('public.exercises ');
    expect(parameters).toEqual([
      user.id, String.raw`%50\%\_gain%`, 'strength', 'total_weight', 'chest',
      'barbell', 'system', 3, 6,
    ]);
    expect(result).toEqual({ exercises: [exercise, exercise], hasMore: true });
  });

  it('uses the same owner-safe visibility predicate for detail reads', async () => {
    const query = vi.fn(async () => ({ rows: [] }));
    const value = createTrainingExerciseRepository({ query } as never);
    expect(await value.findVisible(user.id, exerciseId)).toBeNull();
    const [sql, parameters] = query.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain("exercise.status = 'active'");
    expect(sql).toContain("exercise.scope = 'system' and exercise.owner_user_id is null");
    expect(sql).toContain("exercise.scope = 'user' and exercise.owner_user_id = $1");
    expect(sql).toContain('exercise.id = $2');
    expect(parameters).toEqual([user.id, exerciseId]);
    expect(sql).not.toMatch(/\b(insert|update|delete)\b/i);
    expect(sql).not.toContain('public.exercises ');
  });
});
