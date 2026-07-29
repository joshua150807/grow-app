import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import type { AuthTokenVerifier } from '../src/auth/types.js';
import type { TrainingTemplateRepository } from '../src/modules/trainingTemplates/trainingTemplateRepository.js';
import type {
  TrainingTemplateSaveOutcome,
  TrainingTemplateSaveRepository,
} from '../src/modules/trainingTemplates/trainingTemplateSaveRepository.js';
import { createTrainingTemplateService } from '../src/modules/trainingTemplates/trainingTemplateService.js';

const user = { id: '11111111-1111-4111-8111-111111111111', email: null, role: 'authenticated' };
const templateId = '22222222-2222-4222-8222-222222222222';
const revisionId = '33333333-3333-4333-8333-333333333333';
const unitId = '44444444-4444-4444-8444-444444444444';
const logicalUnitKey = '55555555-5555-4555-8555-555555555555';
const exerciseRowId = '66666666-6666-4666-8666-666666666666';
const logicalTargetExerciseKey = '77777777-7777-4777-8777-777777777777';
const systemExerciseId = '88888888-8888-4888-8888-888888888888';
const setId = '99999999-9999-4999-8999-999999999999';
const logicalTargetSetKey = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const userPlanId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const verify: AuthTokenVerifier = async (token) => token === 'user' ? user : null;
const headers = { authorization: 'Bearer user' };

const templateSummary = {
  id: templateId, name: 'Push Pull Legs', description: null, status: 'active' as const, version: 1,
  currentRevisionId: revisionId, imageReference: null,
  createdAt: '2026-07-26T10:00:00.000Z', updatedAt: '2026-07-26T10:00:00.000Z',
};

const template = {
  ...templateSummary,
  revision: {
    id: revisionId, revisionNumber: 1, createdAt: '2026-07-26T10:00:00.000Z', defaultWeeklyGoal: 4,
    units: [{
      id: unitId, logicalUnitKey, name: 'Push', unitType: 'strength' as const, orderIndex: 0,
      exercises: [{
        id: exerciseRowId, logicalTargetExerciseKey, exerciseId: systemExerciseId, orderIndex: 0, note: null,
        targetSets: [{
          id: setId, logicalTargetSetKey, orderIndex: 0, setType: 'work' as const,
          targetWeightKg: 60, targetReps: { minimum: 8, maximum: 10 }, targetRir: 2, plannedRestSeconds: 90,
        }],
      }],
    }],
  },
};

const noInstance = { isSaved: false, isActive: false, userPlanId: null };

function repository(overrides: Partial<TrainingTemplateRepository> = {}): TrainingTemplateRepository {
  return {
    list: vi.fn(async () => [{ template: templateSummary, userPlan: noInstance }]),
    find: vi.fn(async () => ({ template, userPlan: noInstance })),
    ...overrides,
  };
}

const okOutcome: TrainingTemplateSaveOutcome = {
  outcome: 'ok', userPlan: { isSaved: true, isActive: false, userPlanId },
};

function saveRepository(overrides: Partial<TrainingTemplateSaveRepository> = {}): TrainingTemplateSaveRepository {
  return {
    save: vi.fn(async () => okOutcome),
    unsave: vi.fn(async () => okOutcome),
    activate: vi.fn(async () => okOutcome),
    ...overrides,
  };
}

function app(value: TrainingTemplateRepository, saveValue: TrainingTemplateSaveRepository = saveRepository()) {
  return buildApp({
    authTokenVerifier: verify,
    trainingTemplateService: createTrainingTemplateService(value, saveValue),
  });
}

describe('training template API', () => {
  it.each([
    ['GET', '/v1/training/templates'],
    ['GET', `/v1/training/templates/${templateId}`],
    ['PUT', `/v1/training/templates/${templateId}/save`],
    ['DELETE', `/v1/training/templates/${templateId}/save`],
    ['POST', `/v1/training/templates/${templateId}/activate`],
  ])('requires auth for %s %s', async (method, url) => {
    const value = repository();
    const save = saveRepository();
    const server = app(value, save);
    const response = await server.inject({ method: method as 'GET', url });
    expect(response.statusCode).toBe(401);
    expect(value.list).not.toHaveBeenCalled();
    expect(value.find).not.toHaveBeenCalled();
    expect(save.save).not.toHaveBeenCalled();
    expect(save.unsave).not.toHaveBeenCalled();
    expect(save.activate).not.toHaveBeenCalled();
    await server.close();
  });

  it('lists active templates scoped to the authenticated user for projection', async () => {
    const value = repository();
    const server = app(value);
    const response = await server.inject({ method: 'GET', url: '/v1/training/templates', headers });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ templates: [{ template: templateSummary, userPlan: noInstance }] });
    expect(value.list).toHaveBeenCalledWith(user.id);
  });

  it('returns full detail mapping with nested units, exercises and target sets in order', async () => {
    const value = repository();
    const server = app(value);
    const response = await server.inject({
      method: 'GET', url: `/v1/training/templates/${templateId}`, headers,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ template, userPlan: noInstance });
    expect(value.find).toHaveBeenCalledWith(user.id, templateId);
  });

  it('returns 404 for an unknown or non-active template without leaking existence', async () => {
    const value = repository({ find: vi.fn(async () => null) });
    const server = app(value);
    const response = await server.inject({
      method: 'GET', url: `/v1/training/templates/${templateId}`, headers,
    });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('TRAINING_TEMPLATE_NOT_FOUND');
  });

  it('rejects a malformed templateId as a validation error, not a 404', async () => {
    const value = repository();
    const server = app(value);
    const response = await server.inject({
      method: 'GET', url: '/v1/training/templates/not-a-uuid', headers,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('TRAINING_TEMPLATE_VALIDATION_ERROR');
    expect(value.find).not.toHaveBeenCalled();
  });

  it.each([
    ['no user instance at all', noInstance],
    ['saved, not active', { isSaved: true, isActive: false, userPlanId }],
    ['active and saved', { isSaved: true, isActive: true, userPlanId }],
    ['active but not saved', { isSaved: false, isActive: true, userPlanId }],
    ['existing unsaved and inactive instance', { isSaved: false, isActive: false, userPlanId }],
  ])('passes the %s user projection through unchanged for the detail endpoint', async (_label, userPlan) => {
    const value = repository({ find: vi.fn(async () => ({ template, userPlan })) });
    const server = app(value);
    const response = await server.inject({
      method: 'GET', url: `/v1/training/templates/${templateId}`, headers,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().userPlan).toEqual(userPlan);
  });

  it('never forwards a client-supplied user id — only the authenticated owner scopes projection lookups', async () => {
    const value = repository();
    const server = app(value);
    await server.inject({
      method: 'GET', url: '/v1/training/templates', headers, payload: { userId: 'someone-else' },
    });
    await server.inject({
      method: 'GET', url: `/v1/training/templates/${templateId}`, headers, payload: { userId: 'someone-else' },
    });
    expect(value.list).toHaveBeenCalledWith(user.id);
    expect(value.find).toHaveBeenCalledWith(user.id, templateId);
  });
});

describe('training template save/unsave/activate API', () => {
  it('PUT save calls the owner-scoped save repository and returns only the userPlan envelope', async () => {
    const save = saveRepository();
    const server = app(repository(), save);
    const response = await server.inject({
      method: 'PUT', url: `/v1/training/templates/${templateId}/save`, headers,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ userPlan: okOutcome.userPlan });
    expect(save.save).toHaveBeenCalledWith(user.id, templateId);
    expect(save.unsave).not.toHaveBeenCalled();
    expect(save.activate).not.toHaveBeenCalled();
    await server.close();
  });

  it('DELETE save calls the owner-scoped unsave repository and returns only the userPlan envelope', async () => {
    const save = saveRepository({ unsave: vi.fn(async () => ({ outcome: 'ok' as const, userPlan: noInstance })) });
    const server = app(repository(), save);
    const response = await server.inject({
      method: 'DELETE', url: `/v1/training/templates/${templateId}/save`, headers,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ userPlan: noInstance });
    expect(save.unsave).toHaveBeenCalledWith(user.id, templateId);
    expect(save.save).not.toHaveBeenCalled();
    expect(save.activate).not.toHaveBeenCalled();
    await server.close();
  });

  it('POST activate calls the owner-scoped activate repository and returns only the userPlan envelope', async () => {
    const activeOutcome: TrainingTemplateSaveOutcome = {
      outcome: 'ok', userPlan: { isSaved: false, isActive: true, userPlanId },
    };
    const save = saveRepository({ activate: vi.fn(async () => activeOutcome) });
    const server = app(repository(), save);
    const response = await server.inject({
      method: 'POST', url: `/v1/training/templates/${templateId}/activate`, headers,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ userPlan: activeOutcome.userPlan });
    expect(save.activate).toHaveBeenCalledWith(user.id, templateId);
    await server.close();
  });

  it.each([
    ['PUT', `/v1/training/templates/${templateId}/save`, 'save'],
    ['DELETE', `/v1/training/templates/${templateId}/save`, 'unsave'],
    ['POST', `/v1/training/templates/${templateId}/activate`, 'activate'],
  ] as const)('%s %s returns 404 without leaking template existence when the repository reports not_found', async (method, url, key) => {
    const save = saveRepository({ [key]: vi.fn(async () => ({ outcome: 'not_found' })) } as never);
    const server = app(repository(), save);
    const response = await server.inject({ method, url, headers });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('TRAINING_TEMPLATE_NOT_FOUND');
    await server.close();
  });

  it.each([
    ['PUT', `/v1/training/templates/not-a-uuid/save`, 'save'],
    ['DELETE', `/v1/training/templates/not-a-uuid/save`, 'unsave'],
    ['POST', `/v1/training/templates/not-a-uuid/activate`, 'activate'],
  ] as const)('%s %s rejects a malformed templateId without calling the repository', async (method, url, key) => {
    const save = saveRepository();
    const server = app(repository(), save);
    const response = await server.inject({ method, url, headers });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('TRAINING_TEMPLATE_VALIDATION_ERROR');
    expect(save[key]).not.toHaveBeenCalled();
    await server.close();
  });

  it.each([
    ['PUT', `/v1/training/templates/${templateId}/save`, 'save'],
    ['POST', `/v1/training/templates/${templateId}/activate`, 'activate'],
  ] as const)('%s %s maps an unavailable copied exercise to TRAINING_EXERCISE_NOT_AVAILABLE', async (method, url, key) => {
    const save = saveRepository({
      [key]: vi.fn(async () => {
        const error = new Error('One or more exercises are unavailable.');
        error.name = 'TrainingExerciseNotAvailableError';
        throw error;
      }),
    } as never);
    const server = app(repository(), save);
    const response = await server.inject({ method, url, headers });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('TRAINING_EXERCISE_NOT_AVAILABLE');
    await server.close();
  });

  it('never forwards a client-supplied user id for save/unsave/activate', async () => {
    const save = saveRepository();
    const server = app(repository(), save);
    await server.inject({
      method: 'PUT', url: `/v1/training/templates/${templateId}/save`, headers,
      payload: { userId: 'someone-else' },
    });
    await server.inject({
      method: 'DELETE', url: `/v1/training/templates/${templateId}/save`, headers,
      payload: { userId: 'someone-else' },
    });
    await server.inject({
      method: 'POST', url: `/v1/training/templates/${templateId}/activate`, headers,
      payload: { userId: 'someone-else' },
    });
    expect(save.save).toHaveBeenCalledWith(user.id, templateId);
    expect(save.unsave).toHaveBeenCalledWith(user.id, templateId);
    expect(save.activate).toHaveBeenCalledWith(user.id, templateId);
    await server.close();
  });
});
