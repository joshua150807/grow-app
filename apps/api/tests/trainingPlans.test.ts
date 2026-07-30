import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import type { AuthTokenVerifier } from '../src/auth/types.js';
import type { TrainingPlanRepository } from '../src/modules/trainingPlans/trainingPlanRepository.js';
import {
  createTrainingPlanRepository,
  mapTrainingPlanSummary,
  type PlanRow,
} from '../src/modules/trainingPlans/trainingPlanRepository.js';
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
  schedule: null,
  sourceTemplateId: null, savedAt: null, sourceTemplateImageReference: null,
  revision: {
    id: revisionId, revisionNumber: 1, createdAt: '2026-07-26T10:00:00.000Z',
    sourceTemplateRevisionId: null,
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

  it('accepts an exerciseDraft row in place of exerciseId and passes it through to the repository unchanged', async () => {
    const value = repository();
    const server = app(value);
    const draftInput = {
      ...createInput,
      units: [{
        ...createInput.units[0],
        unitType: 'strength',
        exercises: [{
          logicalTargetExerciseKey: '77777777-7777-4777-8777-777777777777',
          exerciseDraft: { logicalKey: '88888888-8888-4888-8888-888888888888', name: 'Kabelrudern eng' },
          orderIndex: 0,
          note: null,
          targetSets: [{
            logicalTargetSetKey: '99999999-9999-4999-8999-999999999999',
            orderIndex: 0, setType: 'work', targetWeightKg: 50,
            targetReps: { minimum: 8, maximum: 10 }, targetRir: null,
            plannedRestSeconds: 0, importedFromLegacyPlan: false,
          }],
        }],
      }],
    };
    const response = await server.inject({
      method: 'POST', url: '/v1/training/plans', headers, payload: draftInput,
    });
    expect(response.statusCode).toBe(201);
    expect(value.create).toHaveBeenCalledWith(user.id, expect.objectContaining({
      units: [expect.objectContaining({
        exercises: [expect.objectContaining({
          exerciseDraft: {
            logicalKey: '88888888-8888-4888-8888-888888888888',
            name: 'Kabelrudern eng',
            mainMuscle: 'other',
            category: 'strength',
          },
        })],
      })],
    }));
    const [, passedInput] = (value.create as ReturnType<typeof vi.fn>).mock.calls[0] as [string, {
      units: Array<{ exercises: Array<{ exerciseId?: string }> }>;
    }];
    expect(passedInput.units[0].exercises[0].exerciseId).toBeUndefined();
    await server.close();
  });

  it('rejects a row with both exerciseId and exerciseDraft, and a row with neither', async () => {
    const server = app(repository());
    const baseExercise = {
      logicalTargetExerciseKey: '77777777-7777-4777-8777-777777777777',
      orderIndex: 0,
      note: null,
      targetSets: [{
        logicalTargetSetKey: '99999999-9999-4999-8999-999999999999',
        orderIndex: 0, setType: 'work', targetWeightKg: 50,
        targetReps: { minimum: 8, maximum: 10 }, targetRir: null,
        plannedRestSeconds: 0, importedFromLegacyPlan: false,
      }],
    };
    const unitFor = (exercise: Record<string, unknown>) => ({
      logicalUnitKey: logicalUnitKey, name: 'Day 1', unitType: 'strength', orderIndex: 0, exercises: [exercise],
    });
    const both = {
      ...createInput,
      units: [unitFor({
        ...baseExercise,
        exerciseId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        exerciseDraft: { logicalKey: '88888888-8888-4888-8888-888888888888', name: 'X' },
      })],
    };
    const neither = { ...createInput, units: [unitFor(baseExercise)] };
    const responseBoth = await server.inject({ method: 'POST', url: '/v1/training/plans', headers, payload: both });
    const responseNeither = await server.inject({ method: 'POST', url: '/v1/training/plans', headers, payload: neither });
    expect(responseBoth.statusCode).toBe(400);
    expect(responseBoth.json().error.code).toBe('TRAINING_PLAN_VALIDATION_ERROR');
    expect(responseNeither.statusCode).toBe(400);
    expect(responseNeither.json().error.code).toBe('TRAINING_PLAN_VALIDATION_ERROR');
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
    const scheduledRecord = {
      ...record,
      status: 'scheduled' as const,
      schedule: {
        startDate: '2026-07-27',
        timeZone: 'Europe/Berlin',
        effectiveAt: '2026-07-26T22:00:00.000Z',
      },
    };
    const value = repository({ find: vi.fn(async () => scheduledRecord) });
    const server = app(value);
    const response = await server.inject({
      method: 'POST', url: `/v1/training/plans/${planId}/schedule`, headers,
      payload: { expectedVersion: 1, startDate: '2026-07-27', timeZone: 'Europe/Berlin' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().plan.schedule).toEqual(scheduledRecord.schedule);
    expect(value.schedule).toHaveBeenCalledWith(
      user.id, planId, 1, '2026-07-27',
      new Date('2026-07-26T22:00:00.000Z'), 'Europe/Berlin',
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

describe('training plan read repository', () => {
  const row: PlanRow = {
    id: planId,
    name: 'Scheduled',
    status: 'scheduled',
    version: 2,
    current_revision_id: revisionId,
    weekly_goal: 3,
    created_at: '2026-07-26T10:00:00.000Z',
    updated_at: '2026-07-27T10:00:00.000Z',
    activated_at: null,
    archived_at: null,
    schedule_start_date: '2026-10-25',
    schedule_timezone: 'Europe/Berlin',
    schedule_effective_at: '2026-10-24T22:00:00.000Z',
    source_template_id: null,
    saved_at: null,
    template_image_reference: null,
  };

  it('maps the persisted local schedule without reconstructing it from UTC', () => {
    expect(mapTrainingPlanSummary(row).schedule).toEqual({
      startDate: '2026-10-25',
      timeZone: 'Europe/Berlin',
      effectiveAt: '2026-10-24T22:00:00.000Z',
    });
    expect(() => mapTrainingPlanSummary({
      ...row,
      status: 'active',
      schedule_start_date: '2026-10-26',
    })).toThrow('Internal training plan contract violation.');
    expect(() => mapTrainingPlanSummary({
      ...row,
      schedule_start_date: null,
      schedule_timezone: null,
      schedule_effective_at: null,
    })).toThrow('Internal training plan contract violation.');
  });

  it('loads all four owned statuses and the pending schedule in one deterministically ordered query', async () => {
    const query = vi.fn(async () => ({ rows: [row] }));
    const value = createTrainingPlanRepository({ query } as never);
    expect(await value.list(user.id)).toEqual([mapTrainingPlanSummary(row)]);
    expect(query).toHaveBeenCalledOnce();
    const [sql, parameters] = query.mock.calls[0] as unknown as [string, unknown[]];
    expect(parameters).toEqual([user.id]);
    expect(sql).toContain("plan.user_id=$1");
    expect(sql).toContain("plan.status in ('active','scheduled','draft','archived')");
    expect(sql).toContain("activation.status='pending'");
    expect(sql).toContain('left join lateral');
    expect(sql).toContain("when 'active' then 0 when 'scheduled' then 1 when 'draft' then 2 else 3");
    expect(sql).toContain("case when plan.status='scheduled' then schedule.effective_at end asc");
    expect(sql).toContain("case when plan.status<>'scheduled' then plan.updated_at end desc");
    expect(sql).toContain('plan.id asc');
  });
});
