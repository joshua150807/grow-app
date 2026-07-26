import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { buildApp } from '../src/app.js';
import type { AuthTokenVerifier } from '../src/auth/types.js';
import { createTrainingPlanRepository } from '../src/modules/trainingPlans/trainingPlanRepository.js';
import { createTrainingPlanService } from '../src/modules/trainingPlans/trainingPlanService.js';

const expectedDatabaseName = 'grow_api_integration_test';
const expectedPort = '55432';
const userA = '11111111-1111-4111-8111-111111111111';
const userB = '22222222-2222-4222-8222-222222222222';
const verify: AuthTokenVerifier = async (token) => token === 'user-a'
  ? { id: userA, email: null, role: 'authenticated' }
  : token === 'user-b' ? { id: userB, email: null, role: 'authenticated' } : null;
const headersA = { authorization: 'Bearer user-a' };
const headersB = { authorization: 'Bearer user-b' };
const tables = [
  'training_exercise_alternatives_v2', 'training_template_target_sets_v2',
  'training_template_exercises_v2', 'training_template_units_v2',
  'training_template_revisions_v2', 'training_templates_v2',
  'training_plan_cycle_states_v2', 'training_plan_activations_v2',
  'training_weekly_goal_versions_v2', 'training_plan_target_sets_v2',
  'training_plan_exercises_v2', 'training_plan_units_v2',
  'training_plan_revisions_v2', 'training_plans_v2', 'training_exercises_v2',
];

function guardedUrl(): string {
  const value = process.env.TEST_DATABASE_URL;
  if (!value || process.env.ALLOW_INTEGRATION_DB_RESET !== 'true') {
    throw new Error('Guarded local integration database configuration is required.');
  }
  const url = new URL(value);
  if (
    url.hostname !== '127.0.0.1'
    || url.port !== expectedPort
    || decodeURIComponent(url.pathname.slice(1)) !== expectedDatabaseName
  ) throw new Error('Training plan integration tests only allow the guarded local database.');
  if (process.env.DATABASE_URL === value) throw new Error('TEST_DATABASE_URL must not equal DATABASE_URL.');
  return value;
}

async function dropSchema(pool: Pool) {
  await pool.query(`drop table if exists ${tables.map((table) => `public.${table}`).join(',')} cascade`);
  await pool.query('drop function if exists public.set_training_v2_updated_at()');
  await pool.query('drop function if exists public.prevent_training_v2_revision_update()');
}

describe('training plan API PostgreSQL integration', () => {
  let pool: Pool;
  let server: ReturnType<typeof buildApp>;
  let systemExercise: string;
  let ownExercise: string;
  let foreignExercise: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: guardedUrl() });
    await dropSchema(pool);
    await pool.query(`
      create schema if not exists auth;
      do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
      do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
      do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
      drop table if exists auth.users cascade;
      create table auth.users(id uuid primary key);
    `);
    const migration = await readFile(
      new URL('../../../supabase/migrations/20260726180000_training_v2_plan_core.sql', import.meta.url),
      'utf8',
    );
    await pool.query(migration);
    server = buildApp({
      authTokenVerifier: verify,
      trainingPlanService: createTrainingPlanService(createTrainingPlanRepository(pool)),
    });
  });

  beforeEach(async () => {
    await pool.query(`truncate ${tables.map((table) => `public.${table}`).join(',')} cascade`);
    await pool.query('truncate auth.users cascade');
    await pool.query('insert into auth.users(id) values ($1),($2)', [userA, userB]);
    const result = await pool.query(`
      insert into public.training_exercises_v2(scope,owner_user_id,status,category,load_type,name)
      values
        ('system',null,'active','strength','total_weight','System'),
        ('user',$1,'active','strength','total_weight','Own'),
        ('user',$2,'active','strength','total_weight','Foreign')
      returning id,owner_user_id
    `, [userA, userB]);
    foreignExercise = String(result.rows.find((row) => row.owner_user_id === userB).id);
    ownExercise = String(result.rows.find((row) => row.owner_user_id === userA).id);
    systemExercise = String(result.rows.find((row) => row.owner_user_id === null).id);
  });

  afterAll(async () => {
    if (server) await server.close();
    if (!pool) return;
    try {
      await dropSchema(pool);
      await pool.query('drop table if exists auth.users cascade');
    } finally {
      await pool.end();
    }
  });

  function targetExercise(exerciseId: string, orderIndex: number) {
    return {
      logicalTargetExerciseKey: randomUUID(), exerciseId, orderIndex, note: null,
      targetSets: [{
        logicalTargetSetKey: randomUUID(), orderIndex: 0, setType: 'work',
        targetWeightKg: 80, targetReps: { minimum: 8, maximum: 10 }, targetRir: 2,
        plannedRestSeconds: 120, importedFromLegacyPlan: false,
      }],
    };
  }

  function payload(options: { active?: boolean; twoUnits?: boolean; exerciseIds?: string[] } = {}) {
    const firstKey = randomUUID();
    const units = [{
      logicalUnitKey: firstKey, name: 'Strength', unitType: 'strength', orderIndex: 0,
      exercises: (options.exerciseIds ?? [systemExercise, ownExercise])
        .map((id, index) => targetExercise(id, index)),
    }];
    if (options.twoUnits) {
      units.push({
        logicalUnitKey: randomUUID(), name: 'Rest', unitType: 'rest', orderIndex: 1,
        exercises: [],
      });
    }
    return { name: 'Plan', weeklyGoal: 3, activateImmediately: options.active ?? false, units };
  }

  async function create(input = payload()) {
    return server.inject({ method: 'POST', url: '/v1/training/plans', headers: headersA, payload: input });
  }

  it('creates plan, revision, ordered children, individual sets and weekly goal atomically', async () => {
    const response = await create();
    expect(response.statusCode).toBe(201);
    const plan = response.json().plan;
    expect(plan.revision.revisionNumber).toBe(1);
    expect(plan.revision.units[0].exercises).toHaveLength(2);
    expect(plan.revision.units[0].exercises[0].targetSets).toHaveLength(1);
    expect(plan.weeklyGoal).toBe(3);
    const counts = await pool.query(`
      select
        (select count(*)::int from public.training_plans_v2) plans,
        (select count(*)::int from public.training_plan_revisions_v2) revisions,
        (select count(*)::int from public.training_plan_target_sets_v2) sets
    `);
    expect(counts.rows[0]).toEqual({ plans: 1, revisions: 1, sets: 2 });

    const failed = await create(payload({ exerciseIds: [systemExercise, foreignExercise] }));
    expect(failed.statusCode).toBe(400);
    expect(failed.json().error.code).toBe('TRAINING_EXERCISE_NOT_AVAILABLE');
    expect((await pool.query('select count(*)::int count from public.training_plans_v2')).rows[0].count).toBe(1);
  });

  it('isolates plan reads and writes by authenticated owner', async () => {
    const created = await create();
    const id = created.json().plan.id;
    const foreignRead = await server.inject({ method: 'GET', url: `/v1/training/plans/${id}`, headers: headersB });
    const foreignWrite = await server.inject({
      method: 'PATCH', url: `/v1/training/plans/${id}`, headers: headersB,
      payload: { name: 'Foreign', expectedVersion: 1, units: payload().units },
    });
    expect(foreignRead.statusCode).toBe(404);
    expect(foreignWrite.statusCode).toBe(404);
  });

  it('creates a new immutable revision and remaps a deleted next unit', async () => {
    const initial = payload({ active: true, twoUnits: true });
    const created = await create(initial);
    const plan = created.json().plan;
    const remaining = initial.units[1];
    const update = await server.inject({
      method: 'PATCH', url: `/v1/training/plans/${plan.id}`, headers: headersA,
      payload: { name: 'Updated', expectedVersion: 1, units: [{ ...remaining, orderIndex: 0 }] },
    });
    expect(update.statusCode).toBe(200);
    expect(update.json().plan.revision.revisionNumber).toBe(2);
    expect((await pool.query(
      'select count(*)::int count from public.training_plan_revisions_v2 where plan_id=$1', [plan.id],
    )).rows[0].count).toBe(2);
    const cycle = await pool.query(`
      select cycle.last_trigger,unit.logical_unit_key
      from public.training_plan_cycle_states_v2 cycle
      join public.training_plan_units_v2 unit on unit.id=cycle.next_unit_id
      where cycle.plan_id=$1
    `, [plan.id]);
    expect(cycle.rows[0]).toEqual({
      last_trigger: 'plan_revision_remapped',
      logical_unit_key: remaining.logicalUnitKey,
    });
    const stale = await server.inject({
      method: 'PATCH', url: `/v1/training/plans/${plan.id}`, headers: headersA,
      payload: { name: 'Stale', expectedVersion: 1, units: [{ ...remaining, orderIndex: 0 }] },
    });
    expect(stale.statusCode).toBe(409);
    expect(stale.json().error.code).toBe('TRAINING_PLAN_VERSION_CONFLICT');
  });

  it('activation archives the old active plan and reactivation resets to unit one', async () => {
    const old = (await create(payload({ active: true }))).json().plan;
    const next = (await create(payload({ twoUnits: true }))).json().plan;
    const activated = await server.inject({
      method: 'POST', url: `/v1/training/plans/${next.id}/activate`, headers: headersA,
      payload: { expectedVersion: 1 },
    });
    expect(activated.statusCode).toBe(200);
    const statuses = await pool.query(
      'select id,status from public.training_plans_v2 where id=any($1::uuid[]) order by id',
      [[old.id, next.id]],
    );
    expect(statuses.rows.find((row) => row.id === old.id).status).toBe('archived');
    expect(statuses.rows.find((row) => row.id === next.id).status).toBe('active');
    const reactivated = await server.inject({
      method: 'POST', url: `/v1/training/plans/${old.id}/reactivate`, headers: headersA,
      payload: { expectedVersion: 2 },
    });
    expect(reactivated.statusCode).toBe(200);
    const cycle = await pool.query(
      'select next_order_index,last_trigger from public.training_plan_cycle_states_v2 where plan_id=$1',
      [old.id],
    );
    expect(cycle.rows[0]).toEqual({ next_order_index: 0, last_trigger: 'plan_reactivated' });
  });

  it('schedules local midnight and rejects a second scheduled plan', async () => {
    const first = (await create()).json().plan;
    const second = (await create()).json().plan;
    const scheduled = await server.inject({
      method: 'POST', url: `/v1/training/plans/${first.id}/schedule`, headers: headersA,
      payload: { expectedVersion: 1, startDate: '2026-07-27', timeZone: 'Europe/Berlin' },
    });
    expect(scheduled.statusCode).toBe(200);
    const activation = await pool.query(
      'select effective_at,timezone from public.training_plan_activations_v2 where plan_id=$1',
      [first.id],
    );
    expect(new Date(activation.rows[0].effective_at).toISOString()).toBe('2026-07-26T22:00:00.000Z');
    expect(activation.rows[0].timezone).toBe('Europe/Berlin');
    const conflict = await server.inject({
      method: 'POST', url: `/v1/training/plans/${second.id}/schedule`, headers: headersA,
      payload: { expectedVersion: 1, startDate: '2026-08-01', timeZone: 'Europe/Berlin' },
    });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json().error.code).toBe('TRAINING_SCHEDULE_CONFLICT');
  });

  it('versions weekly goals and archives without deleting revisions', async () => {
    const plan = (await create()).json().plan;
    const goal = await server.inject({
      method: 'PUT', url: `/v1/training/plans/${plan.id}/weekly-goal`, headers: headersA,
      payload: { expectedVersion: 1, weeklyGoal: 4 },
    });
    expect(goal.statusCode).toBe(200);
    expect(goal.json().plan.weeklyGoal).toBe(4);
    expect((await pool.query(
      'select count(*)::int count from public.training_weekly_goal_versions_v2 where plan_id=$1', [plan.id],
    )).rows[0].count).toBe(2);
    const archived = await server.inject({
      method: 'POST', url: `/v1/training/plans/${plan.id}/archive`, headers: headersA,
      payload: { expectedVersion: 2 },
    });
    expect(archived.statusCode).toBe(200);
    expect(archived.json().plan.status).toBe('archived');
    expect((await pool.query(
      'select count(*)::int count from public.training_plan_revisions_v2 where plan_id=$1', [plan.id],
    )).rows[0].count).toBe(1);
  });
});
