import type { TrainingSession } from '@grow/shared';
import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import type { AuthTokenVerifier } from '../src/auth/types.js';
import type {
  CreateSessionResult,
  TrainingSessionRepository,
} from '../src/modules/trainingSessions/trainingSessionRepository.js';
import { createTrainingSessionService } from '../src/modules/trainingSessions/trainingSessionService.js';

const user = { id: '11111111-1111-4111-8111-111111111111', email: null, role: 'authenticated' };
const planId = '33333333-3333-4333-8333-333333333333';
const unitId = '55555555-5555-4555-8555-555555555555';
const logicalUnitKey = '66666666-6666-4666-8666-666666666666';
const exerciseId = '77777777-7777-4777-8777-777777777777';
const idempotencyKey = '88888888-8888-4888-8888-888888888888';
const clientSetId = '99999999-9999-4999-8999-999999999999';
const verify: AuthTokenVerifier = async (token) => token === 'user' ? user : null;
const headers = { authorization: 'Bearer user' };

const session: TrainingSession = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  planId,
  planRevisionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  sourceUnitId: unitId,
  planName: 'Strength',
  revisionNumber: 1,
  logicalUnitKey,
  unitName: 'Day 1',
  unitType: 'strength',
  status: 'completed',
  idempotencyKey,
  createdAt: '2026-07-31T10:00:00.000Z',
  exercises: [],
};

const { exercises: _sessionExercises, ...sessionSummary } = session;

function createInput(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    planId,
    unitId,
    status: 'completed',
    idempotencyKey,
    exercises: [{
      exerciseId,
      logicalTargetExerciseKey: null,
      orderIndex: 0,
      note: null,
      sets: [{
        clientSetId,
        logicalTargetSetKey: null,
        orderIndex: 0,
        setType: 'work',
        weightKg: 80,
        reps: 8,
        rir: 2,
        note: null,
        completedAt: '2026-07-31T09:55:00.000Z',
        actualRestSeconds: 90,
      }],
    }],
    ...overrides,
  };
}

function repository(overrides: Partial<TrainingSessionRepository> = {}): TrainingSessionRepository {
  return {
    create: vi.fn(async (): Promise<CreateSessionResult> => ({ outcome: 'ok', session, created: true })),
    findLastExerciseNote: vi.fn(async () => null),
    list: vi.fn(async () => ({ sessions: [], hasMore: false })),
    find: vi.fn(async () => null),
    ...overrides,
  };
}

function app(value: TrainingSessionRepository) {
  return buildApp({ authTokenVerifier: verify, trainingSessionService: createTrainingSessionService(value) });
}

describe('training session API', () => {
  it('requires auth for POST /v1/training/sessions', async () => {
    const value = repository();
    const server = app(value);
    const response = await server.inject({ method: 'POST', url: '/v1/training/sessions', payload: createInput() });
    expect(response.statusCode).toBe(401);
    expect(value.create).not.toHaveBeenCalled();
    await server.close();
  });

  it('creates a new terminal session and returns 201 with created:true', async () => {
    const value = repository();
    const server = app(value);
    const response = await server.inject({
      method: 'POST', url: '/v1/training/sessions', headers, payload: createInput(),
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ session, created: true });
    expect(value.create).toHaveBeenCalledWith(user.id, expect.objectContaining({ planId, unitId, status: 'completed' }));
    await server.close();
  });

  it('accepts a legacy request without exercise.note and normalizes it to null before repository access', async () => {
    const value = repository();
    const server = app(value);
    const input = createInput();
    const legacyExercises = (input.exercises as Array<Record<string, unknown>>)
      .map(({ note: _note, ...exercise }) => exercise);
    const response = await server.inject({
      method: 'POST', url: '/v1/training/sessions', headers, payload: { ...input, exercises: legacyExercises },
    });
    expect(response.statusCode).toBe(201);
    expect(value.create).toHaveBeenCalledWith(user.id, expect.objectContaining({
      exercises: [expect.objectContaining({ note: null })],
    }));
    await server.close();
  });

  it('returns 200 (not 201) for an idempotent replay of the same key', async () => {
    const value = repository({
      create: vi.fn(async (): Promise<CreateSessionResult> => ({ outcome: 'ok', session, created: false })),
    });
    const server = app(value);
    const response = await server.inject({
      method: 'POST', url: '/v1/training/sessions', headers, payload: createInput(),
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ session, created: false });
    await server.close();
  });

  it('rejects a structurally invalid body without calling the repository', async () => {
    const value = repository();
    const server = app(value);
    const response = await server.inject({
      method: 'POST', url: '/v1/training/sessions', headers, payload: { ...createInput(), planId: 'not-a-uuid' },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('TRAINING_SESSION_VALIDATION_ERROR');
    expect(value.create).not.toHaveBeenCalled();
    await server.close();
  });

  it('maps plan_not_found to an owner-safe 404', async () => {
    const value = repository({ create: vi.fn(async (): Promise<CreateSessionResult> => ({ outcome: 'plan_not_found' })) });
    const server = app(value);
    const response = await server.inject({
      method: 'POST', url: '/v1/training/sessions', headers, payload: createInput(),
    });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('TRAINING_SESSION_PLAN_NOT_FOUND');
    await server.close();
  });

  it('maps unit_not_found to 400 (unit does not belong to this plan)', async () => {
    const value = repository({ create: vi.fn(async (): Promise<CreateSessionResult> => ({ outcome: 'unit_not_found' })) });
    const server = app(value);
    const response = await server.inject({
      method: 'POST', url: '/v1/training/sessions', headers, payload: createInput(),
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('TRAINING_SESSION_UNIT_NOT_AVAILABLE');
    await server.close();
  });

  it('maps reference_not_available to 400 (unknown exercise/target correlation)', async () => {
    const value = repository({
      create: vi.fn(async (): Promise<CreateSessionResult> => ({ outcome: 'reference_not_available' })),
    });
    const server = app(value);
    const response = await server.inject({
      method: 'POST', url: '/v1/training/sessions', headers, payload: createInput(),
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('TRAINING_SESSION_REFERENCE_NOT_AVAILABLE');
    await server.close();
  });

  it('maps a repository-detected fingerprint conflict to 409 TRAINING_SESSION_CONFLICT', async () => {
    // The repository (not the service) owns the idempotency decision -- it returns
    // 'conflict' once it has compared the stored request fingerprint against the incoming
    // one and found them to differ under the same idempotency key. The service must not
    // re-derive this from the session payload itself (see trainingSessionService.ts).
    const value = repository({
      create: vi.fn(async (): Promise<CreateSessionResult> => ({ outcome: 'conflict' })),
    });
    const server = app(value);
    const response = await server.inject({
      method: 'POST', url: '/v1/training/sessions', headers, payload: createInput(),
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('TRAINING_SESSION_CONFLICT');
    await server.close();
  });

  it('accepts a rest-day-style session with no exercises', async () => {
    const value = repository();
    const server = app(value);
    const response = await server.inject({
      method: 'POST', url: '/v1/training/sessions', headers, payload: createInput({ exercises: [] }),
    });
    expect(response.statusCode).toBe(201);
    await server.close();
  });

  it('requires auth for GET /v1/training/exercises/:exerciseId/last-note', async () => {
    const value = repository();
    const server = app(value);
    const response = await server.inject({ method: 'GET', url: `/v1/training/exercises/${exerciseId}/last-note` });
    expect(response.statusCode).toBe(401);
    expect(value.findLastExerciseNote).not.toHaveBeenCalled();
    await server.close();
  });

  it('returns the note/completedAt of the exercise\'s most recent session set that has one', async () => {
    const value = repository({
      findLastExerciseNote: vi.fn(async () => ({ note: 'Griff etwas breiter', completedAt: '2026-07-30T18:00:00.000Z' })),
    });
    const server = app(value);
    const response = await server.inject({
      method: 'GET', url: `/v1/training/exercises/${exerciseId}/last-note`, headers,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ note: 'Griff etwas breiter', completedAt: '2026-07-30T18:00:00.000Z' });
    expect(value.findLastExerciseNote).toHaveBeenCalledWith(user.id, exerciseId);
    await server.close();
  });

  it('returns note:null, completedAt:null (not 404) when no past note exists for this exercise', async () => {
    const value = repository();
    const server = app(value);
    const response = await server.inject({
      method: 'GET', url: `/v1/training/exercises/${exerciseId}/last-note`, headers,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ note: null, completedAt: null });
    await server.close();
  });

  it('rejects a non-uuid exerciseId param', async () => {
    const value = repository();
    const server = app(value);
    const response = await server.inject({
      method: 'GET', url: '/v1/training/exercises/not-a-uuid/last-note', headers,
    });
    expect(response.statusCode).toBe(400);
    expect(value.findLastExerciseNote).not.toHaveBeenCalled();
    await server.close();
  });

  it('requires auth for GET /v1/training/sessions', async () => {
    const value = repository();
    const server = app(value);
    const response = await server.inject({ method: 'GET', url: '/v1/training/sessions' });
    expect(response.statusCode).toBe(401);
    expect(value.list).not.toHaveBeenCalled();
    await server.close();
  });

  it('lists sessions using the repository\'s summary + hasMore result and default pagination', async () => {
    const value = repository({
      list: vi.fn(async () => ({ sessions: [sessionSummary], hasMore: true })),
    });
    const server = app(value);
    const response = await server.inject({ method: 'GET', url: '/v1/training/sessions', headers });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      sessions: [sessionSummary],
      pagination: { page: 0, limit: 50, hasMore: true },
    });
    expect(value.list).toHaveBeenCalledWith(user.id, { page: 0, limit: 50 });
    await server.close();
  });

  it('passes page/limit query params through to the repository and echoes them in pagination', async () => {
    const value = repository({
      list: vi.fn(async () => ({ sessions: [], hasMore: false })),
    });
    const server = app(value);
    const response = await server.inject({
      method: 'GET', url: '/v1/training/sessions?page=2&limit=10', headers,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().pagination).toEqual({ page: 2, limit: 10, hasMore: false });
    expect(value.list).toHaveBeenCalledWith(user.id, { page: 2, limit: 10 });
    await server.close();
  });

  it('rejects an out-of-range limit without calling the repository', async () => {
    const value = repository();
    const server = app(value);
    const response = await server.inject({
      method: 'GET', url: '/v1/training/sessions?limit=0', headers,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('TRAINING_SESSION_VALIDATION_ERROR');
    expect(value.list).not.toHaveBeenCalled();
    await server.close();
  });

  it('requires auth for GET /v1/training/sessions/:sessionId', async () => {
    const value = repository();
    const server = app(value);
    const response = await server.inject({ method: 'GET', url: `/v1/training/sessions/${session.id}` });
    expect(response.statusCode).toBe(401);
    expect(value.find).not.toHaveBeenCalled();
    await server.close();
  });

  it('returns the full session snapshot by id', async () => {
    const value = repository({ find: vi.fn(async () => session) });
    const server = app(value);
    const response = await server.inject({
      method: 'GET', url: `/v1/training/sessions/${session.id}`, headers,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ session });
    expect(value.find).toHaveBeenCalledWith(user.id, session.id);
    await server.close();
  });

  it('maps a missing/foreign session to 404 TRAINING_SESSION_NOT_FOUND', async () => {
    const value = repository({ find: vi.fn(async () => null) });
    const server = app(value);
    const response = await server.inject({
      method: 'GET', url: `/v1/training/sessions/${session.id}`, headers,
    });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('TRAINING_SESSION_NOT_FOUND');
    await server.close();
  });

  it('rejects a non-uuid sessionId param without calling the repository', async () => {
    const value = repository();
    const server = app(value);
    const response = await server.inject({
      method: 'GET', url: '/v1/training/sessions/not-a-uuid', headers,
    });
    expect(response.statusCode).toBe(400);
    expect(value.find).not.toHaveBeenCalled();
    await server.close();
  });
});
