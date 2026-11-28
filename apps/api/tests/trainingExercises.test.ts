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

const privateExercise = {
  ...exercise,
  id: '22222222-2222-4222-8222-222222222222',
  systemKey: null,
  scope: 'user' as const,
  name: 'Kabelrudern eng',
  mainMuscle: 'back',
  supportingMuscles: [],
  difficulty: null,
  equipment: [],
  isGym: false,
  executionInstructions: null,
};

function repository(overrides: Partial<TrainingExerciseRepository> = {}): TrainingExerciseRepository {
  return {
    list: vi.fn(async () => ({ exercises: [exercise], hasMore: false })),
    findVisible: vi.fn(async () => exercise),
    findVisibleMany: vi.fn(async () => [exercise]),
    create: vi.fn(async () => ({ outcome: 'created' as const, exercise: privateExercise })),
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

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'] as const)('exposes no %s endpoint for a single exercise', async (method) => {
    const server = app(repository());
    expect((await server.inject({
      method, url: `/v1/training/exercises/${exerciseId}`, headers, payload: {},
    })).statusCode).toBe(404);
    await server.close();
  });

  it.each(['PUT', 'PATCH', 'DELETE'] as const)('exposes no %s write endpoint on the collection', async (method) => {
    const server = app(repository());
    expect((await server.inject({
      method, url: '/v1/training/exercises', headers, payload: {},
    })).statusCode).toBe(404);
    await server.close();
  });
});

describe('training exercise create API', () => {
  function post(payload: Record<string, unknown>, requestHeaders: Record<string, string> | undefined = headers) {
    return app(repository()).inject({
      method: 'POST', url: '/v1/training/exercises', headers: requestHeaders, payload,
    });
  }

  it('requires authentication and never calls the repository', async () => {
    const value = repository();
    const server = app(value);
    const response = await server.inject({
      method: 'POST', url: '/v1/training/exercises', payload: { name: 'Neue Übung', mainMuscle: 'back' },
    });
    expect(response.statusCode).toBe(401);
    expect(value.create).not.toHaveBeenCalled();
    await server.close();
  });

  it('creates a private exercise and returns it with 201', async () => {
    const value = repository();
    const server = app(value);
    const response = await server.inject({
      method: 'POST',
      url: '/v1/training/exercises',
      headers,
      payload: { name: 'Kabelrudern eng', mainMuscle: 'back' },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ exercise: privateExercise });
    expect(value.create).toHaveBeenCalledWith(
      user.id,
      { name: 'Kabelrudern eng', mainMuscle: 'back', category: 'strength' },
    );
    await server.close();
  });

  it('defaults the muscle group to other and the category to strength when omitted', async () => {
    const value = repository();
    const server = app(value);
    const response = await server.inject({
      method: 'POST', url: '/v1/training/exercises', headers, payload: { name: 'Neue Übung' },
    });
    expect(response.statusCode).toBe(201);
    expect(value.create).toHaveBeenCalledWith(
      user.id,
      { name: 'Neue Übung', mainMuscle: 'other', category: 'strength' },
    );
    await server.close();
  });

  it.each([
    'chest', 'back', 'legs', 'shoulders', 'biceps', 'triceps', 'abs', 'forearms', 'other',
  ])('accepts the %s muscle group', async (mainMuscle) => {
    const response = await post({ name: 'Übung', mainMuscle });
    expect(response.statusCode).toBe(201);
  });

  it.each(['strength', 'cardio', 'mobility', 'stretching'])(
    'accepts the %s category, matching the unit types that can reach the picker (plus cardio)',
    async (category) => {
      const value = repository();
      const server = app(value);
      const response = await server.inject({
        method: 'POST', url: '/v1/training/exercises', headers, payload: { name: 'Übung', mainMuscle: 'back', category },
      });
      expect(response.statusCode).toBe(201);
      expect(value.create).toHaveBeenCalledWith(user.id, { name: 'Übung', mainMuscle: 'back', category });
      await server.close();
    },
  );

  it('rejects an unknown category', async () => {
    const response = await post({ name: 'Übung', mainMuscle: 'back', category: 'yoga' });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('TRAINING_EXERCISE_VALIDATION_ERROR');
  });

  it.each([
    { name: '' },
    { name: '   ' },
    {},
    { name: 'Übung', mainMuscle: 'quads' },
    { name: 'Übung', mainMuscle: 'back', scope: 'system' },
    { name: 'Übung', mainMuscle: 'back', systemKey: 'barbell_back_squat' },
  ])('rejects invalid input %#', async (payload) => {
    const value = repository();
    const server = app(value);
    const response = await server.inject({
      method: 'POST', url: '/v1/training/exercises', headers, payload,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('TRAINING_EXERCISE_VALIDATION_ERROR');
    expect(value.create).not.toHaveBeenCalled();
    await server.close();
  });

  it('returns a conflict when the repository reports a duplicate owner-scoped name', async () => {
    const value = repository({ create: vi.fn(async () => ({ outcome: 'conflict' as const })) });
    const server = app(value);
    const response = await server.inject({
      method: 'POST',
      url: '/v1/training/exercises',
      headers,
      payload: { name: 'Kabelrudern eng', mainMuscle: 'back' },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error).toMatchObject({ code: 'TRAINING_EXERCISE_CONFLICT' });
    await server.close();
  });
});

describe('training exercise batch lookup API', () => {
  it('requires authentication', async () => {
    const value = repository();
    const server = app(value);
    const response = await server.inject({ method: 'GET', url: `/v1/training/exercises/lookup?ids=${exerciseId}` });
    expect(response.statusCode).toBe(401);
    expect(value.findVisibleMany).not.toHaveBeenCalled();
    await server.close();
  });

  it('resolves comma-separated ids in one repository call and is not shadowed by the detail route', async () => {
    const value = repository({ findVisibleMany: vi.fn(async () => [exercise, privateExercise]) });
    const server = app(value);
    const response = await server.inject({
      method: 'GET',
      url: `/v1/training/exercises/lookup?ids=${exerciseId},${privateExercise.id},${exerciseId}`,
      headers,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ exercises: [exercise, privateExercise] });
    expect(value.findVisibleMany).toHaveBeenCalledOnce();
    expect(value.findVisibleMany).toHaveBeenCalledWith(user.id, [exerciseId, privateExercise.id]);
    expect(value.findVisible).not.toHaveBeenCalled();
    await server.close();
  });

  it.each([
    '/v1/training/exercises/lookup',
    '/v1/training/exercises/lookup?ids=',
    '/v1/training/exercises/lookup?ids=not-a-uuid',
    `/v1/training/exercises/lookup?ids=${exerciseId}&extra=1`,
    `/v1/training/exercises/lookup?ids=${Array.from({ length: 101 }, () => exerciseId).join(',')}`,
  ])('rejects invalid lookup query %s', async (url) => {
    const value = repository();
    const server = app(value);
    const response = await server.inject({ method: 'GET', url, headers });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('TRAINING_EXERCISE_VALIDATION_ERROR');
    expect(value.findVisibleMany).not.toHaveBeenCalled();
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

  it('uses the owner-safe visibility predicate for batch lookups', async () => {
    const query = vi.fn(async () => ({ rows: [] }));
    const value = createTrainingExerciseRepository({ query } as never);
    expect(await value.findVisibleMany(user.id, [exerciseId])).toEqual([]);
    const [sql, parameters] = query.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain("exercise.scope = 'user' and exercise.owner_user_id = $1");
    expect(sql).toContain('exercise.id = any($2::uuid[])');
    expect(parameters).toEqual([user.id, [exerciseId]]);
    expect(await value.findVisibleMany(user.id, [])).toEqual([]);
    expect(query).toHaveBeenCalledOnce();
  });

  it('inserts a scope=user row with the given category and an on-conflict target matching the partial unique index', async () => {
    const query = vi.fn(async () => ({ rows: [row] }));
    const value = createTrainingExerciseRepository({ query } as never);
    const result = await value.create(user.id, { name: 'Kabelrudern eng', mainMuscle: 'back', category: 'mobility' });
    const [sql, parameters] = query.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain("values ('user', $1, 'active', $4, $5, $2, $3)");
    expect(sql).toContain('on conflict (owner_user_id, (lower(regexp_replace(btrim(name)');
    expect(sql).toContain("where scope = 'user' and status = 'active'");
    expect(sql).toContain('do nothing');
    expect(sql).toMatch(/\binsert\b/i);
    expect(parameters).toEqual([user.id, 'Kabelrudern eng', 'back', 'mobility', 'no_weight_tracking']);
    expect(result).toEqual({ outcome: 'created', exercise: mapTrainingExerciseRow(row) });
  });

  it.each([
    ['strength', 'total_weight'],
    ['cardio', 'no_weight_tracking'],
    ['mobility', 'no_weight_tracking'],
    ['stretching', 'no_weight_tracking'],
  ] as const)('derives load_type %s -> %s from the system catalog convention for that category', async (category, expectedLoadType) => {
    const query = vi.fn(async () => ({ rows: [row] }));
    const value = createTrainingExerciseRepository({ query } as never);
    await value.create(user.id, { name: 'Übung', mainMuscle: 'back', category });
    const [, parameters] = query.mock.calls[0] as unknown as [string, unknown[]];
    expect(parameters).toEqual([user.id, 'Übung', 'back', category, expectedLoadType]);
  });

  it('reports a conflict when the on-conflict do-nothing branch suppresses the insert', async () => {
    const query = vi.fn(async () => ({ rows: [] }));
    const value = createTrainingExerciseRepository({ query } as never);
    const result = await value.create(user.id, { name: 'Kabelrudern eng', mainMuscle: 'back', category: 'strength' });
    expect(result).toEqual({ outcome: 'conflict' });
  });
});
