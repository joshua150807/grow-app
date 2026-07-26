import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import type { AuthTokenVerifier } from '../src/auth/types.js';
import type { TrainingPlanRepository } from '../src/modules/trainingPlans/trainingPlanRepository.js';
import { createTrainingPlanService } from '../src/modules/trainingPlans/trainingPlanService.js';

const user = { id: '11111111-1111-4111-8111-111111111111', email: null, role: 'authenticated' };
const other = { id: '22222222-2222-4222-8222-222222222222', email: null, role: 'authenticated' };
const planId = '33333333-3333-4333-8333-333333333333';
const revisionId = '44444444-4444-4444-8444-444444444444';
const unitId = '55555555-5555-4555-8555-555555555555';
const logicalUnitKey = '66666666-6666-4666-8666-666666666666';
const verify: AuthTokenVerifier = async (token) => token === 'user' ? user : token === 'other' ? other : null;
const headers = { authorization: 'Bearer user' };

const record = {
  id: planId, name: 'Strength', status: 'draft' as const, version: 1,
  currentRevisionId: revisionId, weeklyGoal: 3,
  createdAt: '2026-07-26T10:00:00.000Z', updatedAt: '2026-07-26T10:00:00.000Z',
  activatedAt: null, archivedAt: null,
  revision: {
    id: revisionId, revisionNumber: 1, createdAt: '2026-07-26T10:00:00.000Z',
    units: [{ id: unitId, logicalUnitKey, name: 'Day 1', unitType: 'rest' as const, orderIndex: 0, exercises: [] }],
  },
};
const createInput = {
  name: 'Strength', weeklyGoal: 3,
  units: [{ logicalUnitKey, name: 'Day 1', unitType: 'rest', orderIndex: 0, exercises: [] }],
};

function repository(overrides: Partial<TrainingPlanRepository> = {}): TrainingPlanRepository {
  const ok = { outcome: 'ok' as const, planId };
  return {
    list: vi.fn(async () => []),
    find: vi.fn(async () => record),
    create: vi.fn(async () => planId),
    update: vi.fn(async () => ok),
    activate: vi.fn(async () => ok),
    schedule: vi.fn(async () => ok),
    archive: vi.fn(async () => ok),
    updateWeeklyGoal: vi.fn(async () => ok),
    ...overrides,
  };
}

function app(value: TrainingPlanRepository) {
  return buildApp({ authTokenVerifier: verify, trainingPlanService: createTrainingPlanService(value) });
}

describe('training plan API', () => {
  it.each([
    ['GET', '/v1/training/plans'],
    ['GET', `/v1/training/plans/${planId}`],
    ['POST', '/v1/training/plans'],
    ['PATCH', `/v1/training/plans/${planId}`],
    ['POST', `/v1/training/plans/${planId}/activate`],
    ['POST', `/v1/training/plans/${planId}/schedule`],
    ['POST', `/v1/training/plans/${planId}/reactivate`],
    ['POST', `/v1/training/plans/${planId}/archive`],
    ['PUT', `/v1/training/plans/${planId}/weekly-goal`],
  ])('requires auth for %s %s', async (method, url) => {
    const value = repository();
    const server = app(value);
    const response = await server.inject({ method: method as 'GET', url });
    expect(response.statusCode).toBe(401);
    expect(value.find).not.toHaveBeenCalled();
    await server.close();
  });

  it('lists and reads plans using only the authenticated owner', async () => {
    const value = repository({ list: vi.fn(async () => [record]) });
    const server = app(value);
    expect((await server.inject({ method: 'GET', url: '/v1/training/plans', headers })).statusCode).toBe(200);
    expect((await server.inject({ method: 'GET', url: `/v1/training/plans/${planId}`, headers })).statusCode).toBe(200);
    expect(value.list).toHaveBeenCalledWith(user.id);
    expect(value.find).toHaveBeenCalledWith(user.id, planId);
    await server.close();
  });

  it('returns owner-safe 404 for foreign plans', async () => {
    const value = repository({ find: vi.fn(async () => null) });
    const server = app(value);
    const response = await server.inject({ method: 'GET', url: `/v1/training/plans/${planId}`, headers });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('TRAINING_PLAN_NOT_FOUND');
    await server.close();
  });

  it('creates a strict plan without accepting client userId', async () => {
    const value = repository();
    const server = app(value);
    const valid = await server.inject({ method: 'POST', url: '/v1/training/plans', headers, payload: createInput });
    const invalid = await server.inject({
      method: 'POST', url: '/v1/training/plans', headers, payload: { ...createInput, userId: other.id },
    });
    expect(valid.statusCode).toBe(201);
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json().error.code).toBe('TRAINING_PLAN_VALIDATION_ERROR');
    expect(value.create).toHaveBeenCalledWith(user.id, expect.objectContaining({ name: 'Strength' }));
    await server.close();
  });

  it('maps version, status, schedule and exercise conflicts to stable codes', async () => {
    const cases = [
      ['version_conflict', 'TRAINING_PLAN_VERSION_CONFLICT'],
      ['status_conflict', 'TRAINING_PLAN_STATUS_CONFLICT'],
      ['schedule_conflict', 'TRAINING_SCHEDULE_CONFLICT'],
    ] as const;
    for (const [outcome, code] of cases) {
      const value = repository({ activate: vi.fn(async () => ({ outcome })) });
      const server = app(value);
      const response = await server.inject({
        method: 'POST', url: `/v1/training/plans/${planId}/activate`, headers,
        payload: { expectedVersion: 1 },
      });
      expect(response.statusCode).toBe(409);
      expect(response.json().error.code).toBe(code);
      await server.close();
    }
    const value = repository({ create: vi.fn(async () => {
      const error = new Error('unavailable');
      error.name = 'TrainingExerciseNotAvailableError';
      throw error;
    }) });
    const server = app(value);
    const response = await server.inject({ method: 'POST', url: '/v1/training/plans', headers, payload: createInput });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('TRAINING_EXERCISE_NOT_AVAILABLE');
    await server.close();
  });

  it('converts scheduled local midnight to the selected IANA time zone', async () => {
    const value = repository();
    const server = app(value);
    const response = await server.inject({
      method: 'POST', url: `/v1/training/plans/${planId}/schedule`, headers,
      payload: { expectedVersion: 1, startDate: '2026-07-27', timeZone: 'Europe/Berlin' },
    });
    expect(response.statusCode).toBe(200);
    expect(value.schedule).toHaveBeenCalledWith(
      user.id, planId, 1, new Date('2026-07-26T22:00:00.000Z'), 'Europe/Berlin',
    );
    await server.close();
  });

  it('passes versioned update, reactivation, archive and weekly-goal operations to the owner repository', async () => {
    const value = repository();
    const server = app(value);
    const tree = { name: 'Updated', expectedVersion: 1, units: createInput.units };
    expect((await server.inject({
      method: 'PATCH', url: `/v1/training/plans/${planId}`, headers, payload: tree,
    })).statusCode).toBe(200);
    expect((await server.inject({
      method: 'POST', url: `/v1/training/plans/${planId}/reactivate`, headers,
      payload: { expectedVersion: 1 },
    })).statusCode).toBe(200);
    expect((await server.inject({
      method: 'POST', url: `/v1/training/plans/${planId}/archive`, headers,
      payload: { expectedVersion: 1 },
    })).statusCode).toBe(200);
    expect((await server.inject({
      method: 'PUT', url: `/v1/training/plans/${planId}/weekly-goal`, headers,
      payload: { expectedVersion: 1, weeklyGoal: 4 },
    })).statusCode).toBe(200);
    expect(value.update).toHaveBeenCalledWith(user.id, planId, expect.objectContaining({ expectedVersion: 1 }));
    expect(value.activate).toHaveBeenCalledWith(user.id, planId, 1, true);
    expect(value.archive).toHaveBeenCalledWith(user.id, planId, 1);
    expect(value.updateWeeklyGoal).toHaveBeenCalledWith(user.id, planId, 1, 4);
    await server.close();
  });
});
