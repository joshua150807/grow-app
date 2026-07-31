import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { buildApp } from '../src/app.js';
import type { AuthTokenVerifier } from '../src/auth/types.js';
import {
  applyPlanActivation, createTrainingPlanRepository, transaction,
} from '../src/modules/trainingPlans/trainingPlanRepository.js';
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
  await pool.query('drop function if exists public.is_training_v2_clean_text_array(text[]) cascade');
  await pool.query('drop function if exists public.prevent_training_v2_exercise_identity_update() cascade');
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
    // Only the schema/column additions (system_key, equipment, the identity-immutability
    // trigger) are needed here — trainingExerciseRepository's create() (reused by
    // resolveExerciseDraft below) selects and returns those columns. The system-catalog seed
    // migration (20260726200000) is deliberately not loaded: these tests never rely on the
    // seeded 90-row catalog, only on manually inserted system/user rows.
    const exerciseCatalogFoundationMigration = await readFile(
      new URL(
        '../../../supabase/migrations/20260726190000_training_v2_exercise_catalog_foundation.sql',
        import.meta.url,
      ),
      'utf8',
    );
    await pool.query(exerciseCatalogFoundationMigration);
    const activationMigration = await readFile(
      new URL('../../../supabase/migrations/20260726210000_training_v2_activation_start_date.sql', import.meta.url),
      'utf8',
    );
    await pool.query(activationMigration);
    const provenanceMigration = await readFile(
      new URL('../../../supabase/migrations/20260728210635_training_v2_template_provenance.sql', import.meta.url),
      'utf8',
    );
    await pool.query(provenanceMigration);
    const privateExerciseUniquenessMigration = await readFile(
      new URL(
        '../../../supabase/migrations/20260729060000_training_v2_private_exercise_name_uniqueness.sql',
        import.meta.url,
      ),
      'utf8',
    );
    await pool.query(privateExerciseUniquenessMigration);
    const tombstonesMigration = await readFile(
      new URL('../../../supabase/migrations/20260731130000_training_v2_plan_tombstones.sql', import.meta.url),
      'utf8',
    );
    await pool.query(tombstonesMigration);
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
      insert into public.training_exercises_v2(scope,owner_user_id,status,category,load_type,name,system_key)
      values
        ('system',null,'active','strength','total_weight','System','system'),
        ('user',$1,'active','strength','total_weight','Own',null),
        ('user',$2,'active','strength','total_weight','Foreign',null)
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

  function targetExerciseDraft(
    draft: { logicalKey: string; name: string; mainMuscle?: string; category?: string },
    orderIndex: number,
  ) {
    return {
      logicalTargetExerciseKey: randomUUID(),
      exerciseDraft: {
        logicalKey: draft.logicalKey, name: draft.name,
        mainMuscle: draft.mainMuscle ?? 'other', category: draft.category ?? 'strength',
      },
      orderIndex,
      note: null,
      targetSets: [{
        logicalTargetSetKey: randomUUID(), orderIndex: 0, setType: 'work',
        targetWeightKg: 80, targetReps: { minimum: 8, maximum: 10 }, targetRir: 2,
        plannedRestSeconds: 120, importedFromLegacyPlan: false,
      }],
    };
  }

  function singleUnitPayload(exercises: unknown[], options: { expectedVersion?: number } = {}) {
    const units = [{ logicalUnitKey: randomUUID(), name: 'Strength', unitType: 'strength', orderIndex: 0, exercises }];
    return options.expectedVersion === undefined
      ? { name: 'Plan', weeklyGoal: 3, activateImmediately: false, units }
      : { name: 'Plan', expectedVersion: options.expectedVersion, units };
  }

  async function ownPrivateExerciseByName(ownerId: string, name: string) {
    const result = await pool.query<{ id: string; main_muscle: string | null; status: string }>(`
      select id, main_muscle, status from public.training_exercises_v2
      where owner_user_id = $1 and scope = 'user'
        and lower(regexp_replace(btrim(name), '\\s+', ' ', 'g'))
          = lower(regexp_replace(btrim($2), '\\s+', ' ', 'g'))
    `, [ownerId, name]);
    return result.rows[0] ?? null;
  }

  async function insertExercise(options: {
    scope: 'system' | 'user'; ownerId?: string; name: string; mainMuscle?: string | null; category?: string;
  }) {
    const systemKey = options.scope === 'system' ? `system_${randomUUID().replaceAll('-', '')}` : null;
    const result = await pool.query<{ id: string }>(`
      insert into public.training_exercises_v2(scope,owner_user_id,status,category,load_type,name,main_muscle,system_key)
      values ($1,$2,'active',$3,'total_weight',$4,$5,$6) returning id
    `, [
      options.scope, options.ownerId ?? null, options.category ?? 'strength',
      options.name, options.mainMuscle ?? null, systemKey,
    ]);
    return String(result.rows[0].id);
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

  async function create(input: Record<string, unknown> = payload()) {
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
    expect(plan.schedule).toBeNull();
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

  it('returns an internal contract error for a non-scheduled plan with a pending activation', async () => {
    const plan = (await create(payload({ active: true }))).json().plan;
    await pool.query(`
      insert into public.training_plan_activations_v2(
        plan_id,revision_id,user_id,start_date,effective_at,timezone,status,expected_plan_version
      ) values ($1,$2,$3,'2026-07-28','2026-07-27T22:00:00Z','Europe/Berlin','pending',$4)
    `, [plan.id, plan.currentRevisionId, userA, plan.version]);
    const response = await server.inject({
      method: 'GET', url: `/v1/training/plans/${plan.id}`, headers: headersA,
    });
    expect(response.statusCode).toBe(500);
    expect(response.json().error).toMatchObject({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error.',
    });
    expect(response.json().error).not.toHaveProperty('details');
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
    expect(update.json().plan.schedule).toBeNull();
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
    expect(activated.json().plan.schedule).toBeNull();
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
    expect(reactivated.json().plan.schedule).toBeNull();
    const cycle = await pool.query(
      'select next_order_index,last_trigger from public.training_plan_cycle_states_v2 where plan_id=$1',
      [old.id],
    );
    expect(cycle.rows[0]).toEqual({ next_order_index: 0, last_trigger: 'plan_reactivated' });
  });

  it('soft-deletes an active own plan as a tombstone: row and revision tree survive, cycle state is removed, and the active slot is freed', async () => {
    const plan = (await create(payload({ active: true }))).json().plan;
    // Immediate activation (activateImmediately on create) never inserts a
    // training_plan_activations_v2 row — that table is only for a *pending* scheduled
    // activation (see schedule()) — so there is nothing to cancel here; the surviving tables
    // below are the ones a hard delete used to cascade away and a tombstone must not touch.
    const survivingTables = [
      'training_plan_revisions_v2', 'training_plan_units_v2', 'training_plan_exercises_v2',
      'training_plan_target_sets_v2', 'training_weekly_goal_versions_v2',
    ];
    const before: Record<string, number> = {};
    for (const table of survivingTables) {
      const result = await pool.query(`select count(*)::int as count from public.${table} where plan_id=$1`, [plan.id]);
      before[table] = result.rows[0].count;
      expect(before[table]).toBeGreaterThan(0);
    }
    const cycleBefore = await pool.query(
      'select count(*)::int as count from public.training_plan_cycle_states_v2 where plan_id=$1', [plan.id],
    );
    expect(cycleBefore.rows[0].count).toBe(1);

    const response = await server.inject({
      method: 'DELETE', url: `/v1/training/plans/${plan.id}`, headers: headersA,
    });

    expect(response.statusCode).toBe(204);
    expect(response.body).toBe('');

    const row = await pool.query(
      'select status,deleted_at,archived_at,version from public.training_plans_v2 where id=$1', [plan.id],
    );
    expect(row.rows).toHaveLength(1);
    expect(row.rows[0].status).toBe('archived');
    expect(row.rows[0].deleted_at).not.toBeNull();
    expect(row.rows[0].archived_at).not.toBeNull();
    expect(Number(row.rows[0].version)).toBe(2);

    for (const table of survivingTables) {
      const after = await pool.query(`select count(*)::int as count from public.${table} where plan_id=$1`, [plan.id]);
      expect(after.rows[0].count).toBe(before[table]);
    }
    const cycleAfter = await pool.query(
      'select count(*)::int as count from public.training_plan_cycle_states_v2 where plan_id=$1', [plan.id],
    );
    expect(cycleAfter.rows[0].count).toBe(0);

    const activePlans = await pool.query(
      "select id from public.training_plans_v2 where user_id=$1 and status='active'", [userA],
    );
    expect(activePlans.rows).toHaveLength(0);

    // The freed active slot is immediately usable again, not just vacated in name.
    const another = await create(payload({ active: true }));
    expect(another.statusCode).toBe(201);
    expect(another.json().plan.status).toBe('active');
  });

  it('excludes a deleted plan from the list and its detail with an owner-safe 404', async () => {
    const plan = (await create()).json().plan;
    const deletion = await server.inject({ method: 'DELETE', url: `/v1/training/plans/${plan.id}`, headers: headersA });
    expect(deletion.statusCode).toBe(204);

    const list = await server.inject({ method: 'GET', url: '/v1/training/plans', headers: headersA });
    expect((list.json().plans as Array<{ id: string }>).map((entry) => entry.id)).not.toContain(plan.id);

    const detail = await server.inject({ method: 'GET', url: `/v1/training/plans/${plan.id}`, headers: headersA });
    expect(detail.statusCode).toBe(404);
    expect(detail.json().error.code).toBe('TRAINING_PLAN_NOT_FOUND');
  });

  it('rejects editing, activating, reactivating, scheduling, archiving, changing the weekly goal of, or re-deleting a deleted plan', async () => {
    const plan = (await create()).json().plan;
    const deletion = await server.inject({ method: 'DELETE', url: `/v1/training/plans/${plan.id}`, headers: headersA });
    expect(deletion.statusCode).toBe(204);

    const attempts = [
      { method: 'PATCH' as const, url: `/v1/training/plans/${plan.id}`, payload: { name: 'Edited', expectedVersion: 2, units: payload().units } },
      { method: 'POST' as const, url: `/v1/training/plans/${plan.id}/activate`, payload: { expectedVersion: 2 } },
      // A deleted plan is always archived — reactivate must still refuse it, not confuse it
      // with an ordinary (never-deleted) archived plan, which the separate reactivation test
      // above already proves works.
      { method: 'POST' as const, url: `/v1/training/plans/${plan.id}/reactivate`, payload: { expectedVersion: 2 } },
      { method: 'POST' as const, url: `/v1/training/plans/${plan.id}/schedule`, payload: { expectedVersion: 2, startDate: '2026-08-01', timeZone: 'Europe/Berlin' } },
      { method: 'POST' as const, url: `/v1/training/plans/${plan.id}/archive`, payload: { expectedVersion: 2 } },
      { method: 'PUT' as const, url: `/v1/training/plans/${plan.id}/weekly-goal`, payload: { expectedVersion: 2, weeklyGoal: 5 } },
      { method: 'DELETE' as const, url: `/v1/training/plans/${plan.id}`, payload: undefined },
    ];
    for (const attempt of attempts) {
      const response = await server.inject({
        method: attempt.method, url: attempt.url, headers: headersA, payload: attempt.payload,
      });
      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe('TRAINING_PLAN_NOT_FOUND');
    }

    const stillThere = await pool.query(
      'select status,deleted_at from public.training_plans_v2 where id=$1', [plan.id],
    );
    expect(stillThere.rows).toHaveLength(1);
    expect(stillThere.rows[0].status).toBe('archived');
    expect(stillThere.rows[0].deleted_at).not.toBeNull();
  });

  it('applyPlanActivation() against a tombstoned plan throws no DB error, leaves it deleted/archived/inactive, and occupies no active slot', async () => {
    const plan = (await create(payload({ active: true }))).json().plan;
    const deletion = await server.inject({ method: 'DELETE', url: `/v1/training/plans/${plan.id}`, headers: headersA });
    expect(deletion.statusCode).toBe(204);

    // A future caller (e.g. a scheduled-activation runner over training_plan_activations_v2)
    // must be able to call this exported, shared function directly without first
    // re-verifying deleted_at itself — applyPlanActivation must defend on its own.
    await expect(transaction(pool, (client) => (
      applyPlanActivation(client, userA, plan.id, plan.currentRevisionId, false)
    ))).resolves.toBeUndefined();

    const row = await pool.query(
      'select status,deleted_at,archived_at,activated_at from public.training_plans_v2 where id=$1', [plan.id],
    );
    expect(row.rows).toHaveLength(1);
    expect(row.rows[0].status).toBe('archived');
    expect(row.rows[0].deleted_at).not.toBeNull();
    expect(row.rows[0].archived_at).not.toBeNull();

    const activePlans = await pool.query(
      "select id from public.training_plans_v2 where user_id=$1 and status='active'", [userA],
    );
    expect(activePlans.rows).toHaveLength(0);

    // resetCycle must not run for a target that was never actually (re)activated -- it would
    // otherwise re-create the very cycle state delete() removed.
    const cycle = await pool.query(
      'select count(*)::int as count from public.training_plan_cycle_states_v2 where plan_id=$1', [plan.id],
    );
    expect(cycle.rows[0].count).toBe(0);
  });

  async function markAsGrowInstance(planId: string, { savedAt }: { savedAt: Date | null }) {
    const template = await pool.query<{ id: string }>(
      "insert into public.training_templates_v2(name,status) values ('Grow Plan','active') returning id",
    );
    await pool.query(
      'update public.training_plans_v2 set source_template_id=$1,saved_at=$2 where id=$3',
      [template.rows[0].id, savedAt, planId],
    );
  }

  async function dependentCounts(planId: string) {
    const tables = [
      'training_plan_revisions_v2', 'training_plan_units_v2', 'training_plan_exercises_v2',
      'training_plan_target_sets_v2', 'training_weekly_goal_versions_v2',
    ];
    const counts: Record<string, number> = {};
    for (const table of tables) {
      const result = await pool.query(`select count(*)::int as count from public.${table} where plan_id=$1`, [planId]);
      counts[table] = result.rows[0].count;
    }
    return counts;
  }

  it('rejects deleting a saved Grow instance (source_template_id set, saved_at set) with owner-safe 404, changing nothing', async () => {
    const plan = (await create()).json().plan;
    await markAsGrowInstance(plan.id, { savedAt: new Date() });
    const before = await dependentCounts(plan.id);
    expect(Object.values(before).every((count) => count > 0)).toBe(true);

    const response = await server.inject({
      method: 'DELETE', url: `/v1/training/plans/${plan.id}`, headers: headersA,
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('TRAINING_PLAN_NOT_FOUND');
    const row = await pool.query(
      'select status,saved_at,source_template_id from public.training_plans_v2 where id=$1', [plan.id],
    );
    expect(row.rows).toHaveLength(1);
    expect(row.rows[0].source_template_id).not.toBeNull();
    expect(row.rows[0].saved_at).not.toBeNull();
    expect(await dependentCounts(plan.id)).toEqual(before);
  });

  it('rejects deleting an active, unsaved Grow instance (source_template_id set, saved_at null) with owner-safe 404, changing nothing — it stays active', async () => {
    const plan = (await create(payload({ active: true }))).json().plan;
    await markAsGrowInstance(plan.id, { savedAt: null });
    const before = await dependentCounts(plan.id);

    const response = await server.inject({
      method: 'DELETE', url: `/v1/training/plans/${plan.id}`, headers: headersA,
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('TRAINING_PLAN_NOT_FOUND');
    const row = await pool.query(
      'select status,saved_at,source_template_id from public.training_plans_v2 where id=$1', [plan.id],
    );
    expect(row.rows).toHaveLength(1);
    expect(row.rows[0].status).toBe('active');
    expect(row.rows[0].saved_at).toBeNull();
    expect(row.rows[0].source_template_id).not.toBeNull();
    expect(await dependentCounts(plan.id)).toEqual(before);
  });

  it('rejects deleting another user\'s plan with owner-safe 404 and leaves it fully intact', async () => {
    const plan = (await create()).json().plan;
    const response = await server.inject({
      method: 'DELETE', url: `/v1/training/plans/${plan.id}`, headers: headersB,
    });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('TRAINING_PLAN_NOT_FOUND');
    const stillThere = await pool.query('select id from public.training_plans_v2 where id=$1', [plan.id]);
    expect(stillThere.rows).toHaveLength(1);
  });

  it('deleting a missing/already-deleted plan id returns the same owner-safe 404', async () => {
    const plan = (await create()).json().plan;
    const first = await server.inject({ method: 'DELETE', url: `/v1/training/plans/${plan.id}`, headers: headersA });
    expect(first.statusCode).toBe(204);
    const second = await server.inject({ method: 'DELETE', url: `/v1/training/plans/${plan.id}`, headers: headersA });
    expect(second.statusCode).toBe(404);
    expect(second.json().error.code).toBe('TRAINING_PLAN_NOT_FOUND');
  });

  it('schedules local midnight and rejects a second scheduled plan', async () => {
    const first = (await create()).json().plan;
    const second = (await create()).json().plan;
    const scheduled = await server.inject({
      method: 'POST', url: `/v1/training/plans/${first.id}/schedule`, headers: headersA,
      payload: { expectedVersion: 1, startDate: '2026-07-27', timeZone: 'Europe/Berlin' },
    });
    expect(scheduled.statusCode, JSON.stringify(scheduled.json())).toBe(200);
    expect(scheduled.json().plan.schedule).toEqual({
      startDate: '2026-07-27',
      timeZone: 'Europe/Berlin',
      effectiveAt: '2026-07-26T22:00:00.000Z',
    });
    const detail = await server.inject({
      method: 'GET', url: `/v1/training/plans/${first.id}`, headers: headersA,
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().plan.schedule).toEqual(scheduled.json().plan.schedule);
    const activation = await pool.query(
      'select start_date::text,effective_at,timezone from public.training_plan_activations_v2 where plan_id=$1',
      [first.id],
    );
    expect(activation.rows[0].start_date).toBe('2026-07-27');
    expect(new Date(activation.rows[0].effective_at).toISOString()).toBe('2026-07-26T22:00:00.000Z');
    expect(activation.rows[0].timezone).toBe('Europe/Berlin');
    const conflict = await server.inject({
      method: 'POST', url: `/v1/training/plans/${second.id}/schedule`, headers: headersA,
      payload: { expectedVersion: 1, startDate: '2026-08-01', timeZone: 'Europe/Berlin' },
    });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json().error.code).toBe('TRAINING_SCHEDULE_CONFLICT');
    const archived = await server.inject({
      method: 'POST', url: `/v1/training/plans/${first.id}/archive`, headers: headersA,
      payload: { expectedVersion: 2 },
    });
    expect(archived.statusCode).toBe(200);
    expect(archived.json().plan.schedule).toBeNull();
  });

  it('lists owned active, scheduled, draft and archived plans in deterministic status order', async () => {
    const active = (await create(payload({ active: true }))).json().plan;
    const scheduled = (await create()).json().plan;
    const scheduleResponse = await server.inject({
      method: 'POST', url: `/v1/training/plans/${scheduled.id}/schedule`, headers: headersA,
      payload: { expectedVersion: 1, startDate: '2026-11-01', timeZone: 'America/New_York' },
    });
    expect(scheduleResponse.statusCode, JSON.stringify(scheduleResponse.json())).toBe(200);
    const draftOld = (await create()).json().plan;
    const draftNew = (await create()).json().plan;
    const archivedOld = (await create()).json().plan;
    expect((await server.inject({
      method: 'POST', url: `/v1/training/plans/${archivedOld.id}/archive`, headers: headersA,
      payload: { expectedVersion: 1 },
    })).statusCode).toBe(200);
    const archivedNew = (await create()).json().plan;
    expect((await server.inject({
      method: 'POST', url: `/v1/training/plans/${archivedNew.id}/archive`, headers: headersA,
      payload: { expectedVersion: 1 },
    })).statusCode).toBe(200);
    await pool.query('alter table public.training_plans_v2 disable trigger training_plans_v2_set_updated_at');
    await pool.query(`
      update public.training_plans_v2
      set updated_at = case id
        when $1 then '2026-07-27T10:00:00Z'::timestamptz
        when $2 then '2026-07-27T11:00:00Z'::timestamptz
        when $3 then '2026-07-27T08:00:00Z'::timestamptz
        when $4 then '2026-07-27T09:00:00Z'::timestamptz
        else updated_at
      end
      where id=any($5::uuid[])
    `, [
      draftOld.id, draftNew.id, archivedOld.id, archivedNew.id,
      [draftOld.id, draftNew.id, archivedOld.id, archivedNew.id],
    ]);
    await pool.query('alter table public.training_plans_v2 enable trigger training_plans_v2_set_updated_at');
    const foreign = await server.inject({
      method: 'POST', url: '/v1/training/plans', headers: headersB,
      payload: payload({ exerciseIds: [systemExercise] }),
    });
    expect(foreign.statusCode).toBe(201);

    const response = await server.inject({
      method: 'GET', url: '/v1/training/plans', headers: headersA,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().plans.map((plan: { id: string }) => plan.id))
      .toEqual([
        active.id, scheduled.id,
        draftNew.id, draftOld.id,
        archivedNew.id, archivedOld.id,
      ]);
    expect(response.json().plans.map((plan: { status: string }) => plan.status))
      .toEqual(['active', 'scheduled', 'draft', 'draft', 'archived', 'archived']);
    expect(response.json().plans.some((plan: { id: string }) => plan.id === foreign.json().plan.id))
      .toBe(false);
    expect(response.json().plans.find((plan: { id: string }) => plan.id === scheduled.id).schedule)
      .toEqual({
        startDate: '2026-11-01',
        timeZone: 'America/New_York',
        effectiveAt: '2026-11-01T04:00:00.000Z',
      });
    expect(response.json().plans.filter((plan: { id: string }) => plan.id !== scheduled.id)
      .every((plan: { schedule: unknown }) => plan.schedule === null)).toBe(true);
  });

  it('versions weekly goals and archives without deleting revisions', async () => {
    const plan = (await create()).json().plan;
    const goal = await server.inject({
      method: 'PUT', url: `/v1/training/plans/${plan.id}/weekly-goal`, headers: headersA,
      payload: { expectedVersion: 1, weeklyGoal: 4 },
    });
    expect(goal.statusCode).toBe(200);
    expect(goal.json().plan.weeklyGoal).toBe(4);
    expect(goal.json().plan.schedule).toBeNull();
    expect((await pool.query(
      'select count(*)::int count from public.training_weekly_goal_versions_v2 where plan_id=$1', [plan.id],
    )).rows[0].count).toBe(2);
    const archived = await server.inject({
      method: 'POST', url: `/v1/training/plans/${plan.id}/archive`, headers: headersA,
      payload: { expectedVersion: 2 },
    });
    expect(archived.statusCode).toBe(200);
    expect(archived.json().plan.status).toBe('archived');
    expect(archived.json().plan.schedule).toBeNull();
    expect((await pool.query(
      'select count(*)::int count from public.training_plan_revisions_v2 where plan_id=$1', [plan.id],
    )).rows[0].count).toBe(1);
  });

  describe('private exercise draft resolution', () => {
    it('legacy exerciseId-only input stays green after the additive schema change', async () => {
      const response = await create();
      expect(response.statusCode).toBe(201);
      expect(response.json().plan.revision.units[0].exercises).toHaveLength(2);
    });

    it('creates an unknown draft exercise atomically together with plan create', async () => {
      const draft = { logicalKey: randomUUID(), name: 'Kabelrudern eng', mainMuscle: 'back', category: 'strength' };
      const response = await create(singleUnitPayload([targetExerciseDraft(draft, 0)]));
      expect(response.statusCode).toBe(201);
      const exercise = await ownPrivateExerciseByName(userA, draft.name);
      expect(exercise).toMatchObject({ main_muscle: 'back', status: 'active' });
      expect(response.json().plan.revision.units[0].exercises[0].exerciseId).toBe(exercise!.id);
      const loadType = await pool.query('select load_type,category from public.training_exercises_v2 where id=$1', [exercise!.id]);
      expect(loadType.rows[0]).toEqual({ load_type: 'total_weight', category: 'strength' });
    });

    it('creates an unknown draft exercise atomically together with plan update', async () => {
      const created = (await create()).json().plan;
      const draft = { logicalKey: randomUUID(), name: 'Neue Zugübung', mainMuscle: 'legs', category: 'mobility' };
      const response = await server.inject({
        method: 'PATCH', url: `/v1/training/plans/${created.id}`, headers: headersA,
        payload: singleUnitPayload([targetExerciseDraft(draft, 0)], { expectedVersion: 1 }),
      });
      expect(response.statusCode).toBe(200);
      const exercise = await ownPrivateExerciseByName(userA, draft.name);
      expect(exercise).toMatchObject({ main_muscle: 'legs' });
      const loadType = await pool.query('select load_type from public.training_exercises_v2 where id=$1', [exercise!.id]);
      expect(loadType.rows[0].load_type).toBe('no_weight_tracking');
    });

    it('resolves several plan rows sharing one draft logicalKey to the exact same exercise id', async () => {
      const draft = { logicalKey: randomUUID(), name: 'Geteilte Übung', mainMuscle: 'chest', category: 'strength' };
      const units = [
        { logicalUnitKey: randomUUID(), name: 'Tag 1', unitType: 'strength', orderIndex: 0, exercises: [targetExerciseDraft(draft, 0)] },
        { logicalUnitKey: randomUUID(), name: 'Tag 2', unitType: 'strength', orderIndex: 1, exercises: [targetExerciseDraft(draft, 0)] },
      ];
      const response = await create({ name: 'Plan', weeklyGoal: 3, activateImmediately: false, units });
      expect(response.statusCode).toBe(201);
      const [first, second] = response.json().plan.revision.units;
      expect(first.exercises[0].exerciseId).toBe(second.exercises[0].exerciseId);
      const count = await pool.query(
        `select count(*)::int count from public.training_exercises_v2
         where owner_user_id=$1 and scope='user'
           and lower(regexp_replace(btrim(name),'\\s+',' ','g')) = 'geteilte übung'`,
        [userA],
      );
      expect(count.rows[0].count).toBe(1);
    });

    it('reuses a normalized-equal draft instead of creating a duplicate', async () => {
      const first = await create(singleUnitPayload([
        targetExerciseDraft({ logicalKey: randomUUID(), name: 'Kabel  Rudern', mainMuscle: 'back' }, 0),
      ]));
      expect(first.statusCode).toBe(201);
      const firstId = first.json().plan.revision.units[0].exercises[0].exerciseId;

      const second = await create(singleUnitPayload([
        targetExerciseDraft({ logicalKey: randomUUID(), name: '  kabel rudern ', mainMuscle: 'back' }, 0),
      ]));
      expect(second.statusCode).toBe(201);
      expect(second.json().plan.revision.units[0].exercises[0].exerciseId).toBe(firstId);

      const count = await pool.query(
        `select count(*)::int count from public.training_exercises_v2
         where owner_user_id=$1 and scope='user'
           and lower(regexp_replace(btrim(name),'\\s+',' ','g')) = 'kabel rudern'`,
        [userA],
      );
      expect(count.rows[0].count).toBe(1);
    });

    it('reuses the system exercise id when a draft matches only a system exercise exactly (no private row created)', async () => {
      const systemId = await insertExercise({
        scope: 'system', name: 'Langhantelrudern', mainMuscle: 'upper_back', category: 'strength',
      });
      const before = await pool.query(
        'select count(*)::int count from public.training_exercises_v2 where scope=\'user\' and owner_user_id=$1',
        [userA],
      );

      // upper_back maps to the 'back' UI group (see FINE_SYSTEM_MUSCLE_TO_UI_GROUP) — the
      // draft names that same UI group explicitly, matching the system exercise exactly.
      const response = await create(singleUnitPayload([
        targetExerciseDraft({ logicalKey: randomUUID(), name: 'Langhantelrudern', mainMuscle: 'back', category: 'strength' }, 0),
      ]));

      expect(response.statusCode).toBe(201);
      expect(response.json().plan.revision.units[0].exercises[0].exerciseId).toBe(systemId);
      const after = await pool.query(
        'select count(*)::int count from public.training_exercises_v2 where scope=\'user\' and owner_user_id=$1',
        [userA],
      );
      expect(after.rows[0].count).toBe(before.rows[0].count);
      const system = await pool.query('select name,main_muscle,category from public.training_exercises_v2 where id=$1', [systemId]);
      expect(system.rows[0]).toEqual({ name: 'Langhantelrudern', main_muscle: 'upper_back', category: 'strength' });
    });

    it('reuses the system exercise id when the draft name is only normalized-equal (trim/case/whitespace) to it', async () => {
      const systemId = await insertExercise({
        scope: 'system', name: 'Beinpresse', mainMuscle: 'quadriceps', category: 'strength',
      });
      const response = await create(singleUnitPayload([
        targetExerciseDraft({ logicalKey: randomUUID(), name: '  BEINPRESSE  ', mainMuscle: 'legs', category: 'strength' }, 0),
      ]));
      expect(response.statusCode).toBe(201);
      expect(response.json().plan.revision.units[0].exercises[0].exerciseId).toBe(systemId);
    });

    it('creates an independent private copy when the draft category differs from a same-named, same-muscle system exercise (system untouched)', async () => {
      const systemId = await insertExercise({
        scope: 'system', name: 'Ausfallschritte', mainMuscle: 'quadriceps', category: 'strength',
      });
      const response = await create(singleUnitPayload([
        targetExerciseDraft({ logicalKey: randomUUID(), name: 'Ausfallschritte', mainMuscle: 'legs', category: 'mobility' }, 0),
      ]));
      expect(response.statusCode).toBe(201);
      const created = response.json().plan.revision.units[0].exercises[0].exerciseId;
      expect(created).not.toBe(systemId);
      const system = await pool.query('select category,main_muscle from public.training_exercises_v2 where id=$1', [systemId]);
      expect(system.rows[0]).toEqual({ category: 'strength', main_muscle: 'quadriceps' });
      const own = await ownPrivateExerciseByName(userA, 'Ausfallschritte');
      expect(own).toMatchObject({ id: created, main_muscle: 'legs' });
      const ownCategory = await pool.query('select category from public.training_exercises_v2 where id=$1', [created]);
      expect(ownCategory.rows[0].category).toBe('mobility');
    });

    it('prefers the caller\'s own private exercise over a same-named system exercise', async () => {
      const systemId = await insertExercise({ scope: 'system', name: 'Kabelrudern eng', mainMuscle: 'lats' });
      const ownId = await insertExercise({ scope: 'user', ownerId: userA, name: 'Kabelrudern eng', mainMuscle: 'back' });

      const response = await create(singleUnitPayload([
        targetExerciseDraft({ logicalKey: randomUUID(), name: 'Kabelrudern eng', mainMuscle: 'back' }, 0),
      ]));
      expect(response.statusCode).toBe(201);
      expect(response.json().plan.revision.units[0].exercises[0].exerciseId).toBe(ownId);
      expect(response.json().plan.revision.units[0].exercises[0].exerciseId).not.toBe(systemId);
      const count = await pool.query(
        `select count(*)::int count from public.training_exercises_v2
         where owner_user_id=$1 and scope='user'
           and lower(regexp_replace(btrim(name),'\\s+',' ','g')) = 'kabelrudern eng'`,
        [userA],
      );
      expect(count.rows[0].count).toBe(1);
    });

    it('creates an independent private copy when the draft name differs from a similarly themed system exercise (system untouched)', async () => {
      const systemId = await insertExercise({ scope: 'system', name: 'Kniebeuge', mainMuscle: 'quadriceps' });
      const response = await create(singleUnitPayload([
        targetExerciseDraft({ logicalKey: randomUUID(), name: 'Kniebeuge Variante', mainMuscle: 'legs' }, 0),
      ]));
      expect(response.statusCode).toBe(201);
      const created = response.json().plan.revision.units[0].exercises[0].exerciseId;
      expect(created).not.toBe(systemId);
      const system = await pool.query('select name,main_muscle from public.training_exercises_v2 where id=$1', [systemId]);
      expect(system.rows[0]).toEqual({ name: 'Kniebeuge', main_muscle: 'quadriceps' });
    });

    it('creates an independent private copy when the draft muscle group differs from a same-named system exercise (system untouched)', async () => {
      const systemId = await insertExercise({ scope: 'system', name: 'Schulterdrücken', mainMuscle: 'front_delts' });
      const response = await create(singleUnitPayload([
        targetExerciseDraft({ logicalKey: randomUUID(), name: 'Schulterdrücken', mainMuscle: 'chest' }, 0),
      ]));
      expect(response.statusCode).toBe(201);
      const created = response.json().plan.revision.units[0].exercises[0].exerciseId;
      expect(created).not.toBe(systemId);
      const system = await pool.query('select main_muscle from public.training_exercises_v2 where id=$1', [systemId]);
      expect(system.rows[0].main_muscle).toBe('front_delts');
      const own = await ownPrivateExerciseByName(userA, 'Schulterdrücken');
      expect(own).toMatchObject({ id: created, main_muscle: 'chest' });
    });

    it('changing a draft to a new name creates an independent private exercise and leaves the previously used one untouched', async () => {
      const oldOwn = await insertExercise({ scope: 'user', ownerId: userA, name: 'Altes Rudern', mainMuscle: 'back' });
      const response = await create(singleUnitPayload([
        targetExerciseDraft({ logicalKey: randomUUID(), name: 'Neues Rudern', mainMuscle: 'back' }, 0),
      ]));
      expect(response.statusCode).toBe(201);
      const created = response.json().plan.revision.units[0].exercises[0].exerciseId;
      expect(created).not.toBe(oldOwn);
      const old = await pool.query('select name from public.training_exercises_v2 where id=$1', [oldOwn]);
      expect(old.rows[0].name).toBe('Altes Rudern');
    });

    it('an explicitly changed muscle group for the same private exercise name updates the canonical mapping in place', async () => {
      const ownId = await insertExercise({ scope: 'user', ownerId: userA, name: 'Bankdrücken eng', mainMuscle: 'chest' });
      const response = await create(singleUnitPayload([
        targetExerciseDraft({ logicalKey: randomUUID(), name: 'Bankdrücken eng', mainMuscle: 'triceps' }, 0),
      ]));
      expect(response.statusCode).toBe(201);
      expect(response.json().plan.revision.units[0].exercises[0].exerciseId).toBe(ownId);
      const updated = await pool.query('select main_muscle from public.training_exercises_v2 where id=$1', [ownId]);
      expect(updated.rows[0].main_muscle).toBe('triceps');
      const count = await pool.query(
        `select count(*)::int count from public.training_exercises_v2
         where owner_user_id=$1 and scope='user'
           and lower(regexp_replace(btrim(name),'\\s+',' ','g')) = 'bankdrücken eng'`,
        [userA],
      );
      expect(count.rows[0].count).toBe(1);
    });

    it('still rejects a foreign private exercise referenced by exerciseId', async () => {
      const response = await create(singleUnitPayload([targetExercise(foreignExercise, 0)]));
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('TRAINING_EXERCISE_NOT_AVAILABLE');
    });

    it('lets two truly concurrent saves resolve the same draft name without creating a duplicate exercise', async () => {
      const [first, second] = await Promise.all([
        create(singleUnitPayload([
          targetExerciseDraft({ logicalKey: randomUUID(), name: 'Parallele Übung', mainMuscle: 'abs' }, 0),
        ])),
        create(singleUnitPayload([
          targetExerciseDraft({ logicalKey: randomUUID(), name: 'parallele  übung', mainMuscle: 'abs' }, 0),
        ])),
      ]);
      expect(first.statusCode).toBe(201);
      expect(second.statusCode).toBe(201);
      expect(first.json().plan.revision.units[0].exercises[0].exerciseId)
        .toBe(second.json().plan.revision.units[0].exercises[0].exerciseId);
      const count = await pool.query(
        `select count(*)::int count from public.training_exercises_v2
         where owner_user_id=$1 and scope='user'
           and lower(regexp_replace(btrim(name),'\\s+',' ','g')) = 'parallele übung'`,
        [userA],
      );
      expect(count.rows[0].count).toBe(1);
    });

    it('a forced failure after exercise-draft resolution leaves neither the new exercise nor a partial plan behind', async () => {
      const draft = { logicalKey: randomUUID(), name: 'Rollback Übung', mainMuscle: 'biceps', category: 'strength' };
      const bogusExerciseId = randomUUID();
      const units = [
        { logicalUnitKey: randomUUID(), name: 'Tag 1', unitType: 'strength', orderIndex: 0, exercises: [targetExerciseDraft(draft, 0)] },
        { logicalUnitKey: randomUUID(), name: 'Tag 2', unitType: 'strength', orderIndex: 1, exercises: [targetExercise(bogusExerciseId, 0)] },
      ];
      const plansBefore = await pool.query('select count(*)::int count from public.training_plans_v2');
      const response = await create({ name: 'Plan', weeklyGoal: 3, activateImmediately: false, units });
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('TRAINING_EXERCISE_NOT_AVAILABLE');
      const plansAfter = await pool.query('select count(*)::int count from public.training_plans_v2');
      expect(plansAfter.rows[0].count).toBe(plansBefore.rows[0].count);
      expect(await ownPrivateExerciseByName(userA, draft.name)).toBeNull();
    });
  });
});
