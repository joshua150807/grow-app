import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { buildApp } from '../src/app.js';
import type { AuthTokenVerifier } from '../src/auth/types.js';
import { createTrainingPlanRepository } from '../src/modules/trainingPlans/trainingPlanRepository.js';
import { createTrainingPlanService } from '../src/modules/trainingPlans/trainingPlanService.js';
import { createTrainingSessionRepository } from '../src/modules/trainingSessions/trainingSessionRepository.js';
import { createTrainingSessionService } from '../src/modules/trainingSessions/trainingSessionService.js';

const expectedDatabaseName = 'grow_api_integration_test';
const expectedPort = '55432';
const userA = '11111111-1111-4111-8111-111111111111';
const userB = '22222222-2222-4222-8222-222222222222';
const verify: AuthTokenVerifier = async (token) => token === 'user-a'
  ? { id: userA, email: null, role: 'authenticated' }
  : token === 'user-b' ? { id: userB, email: null, role: 'authenticated' } : null;
const headersA = { authorization: 'Bearer user-a' };
const headersB = { authorization: 'Bearer user-b' };

const planCoreTables = [
  'training_exercise_alternatives_v2', 'training_template_target_sets_v2',
  'training_template_exercises_v2', 'training_template_units_v2',
  'training_template_revisions_v2', 'training_templates_v2',
  'training_plan_cycle_states_v2', 'training_plan_activations_v2',
  'training_weekly_goal_versions_v2', 'training_plan_target_sets_v2',
  'training_plan_exercises_v2', 'training_plan_units_v2',
  'training_plan_revisions_v2', 'training_plans_v2', 'training_exercises_v2',
];
const sessionTables = [
  'training_session_sets_v2', 'training_session_exercises_v2', 'training_sessions_v2',
];
const allTables = [...sessionTables, ...planCoreTables];

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
  ) throw new Error('Training session integration tests only allow the guarded local database.');
  if (process.env.DATABASE_URL === value) throw new Error('TEST_DATABASE_URL must not equal DATABASE_URL.');
  return value;
}

async function dropSchema(pool: Pool) {
  await pool.query(`drop table if exists ${allTables.map((table) => `public.${table}`).join(',')} cascade`);
  await pool.query('drop function if exists public.prevent_training_v2_session_update() cascade');
  await pool.query('drop function if exists public.set_training_v2_updated_at()');
  await pool.query('drop function if exists public.prevent_training_v2_revision_update()');
  await pool.query('drop function if exists public.is_training_v2_clean_text_array(text[]) cascade');
  await pool.query('drop function if exists public.prevent_training_v2_exercise_identity_update() cascade');
}

type PlanUnit = {
  id: string; orderIndex: number; logicalUnitKey: string; name: string;
  exercises: Array<{ logicalTargetExerciseKey: string; targetSets: Array<{ logicalTargetSetKey: string }> }>;
};

describe('training V2 session-core PostgreSQL integration', () => {
  let pool: Pool;
  let server: ReturnType<typeof buildApp>;
  let systemExerciseId: string;

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
    for (const file of [
      '20260726180000_training_v2_plan_core.sql',
      '20260726190000_training_v2_exercise_catalog_foundation.sql',
      '20260726210000_training_v2_activation_start_date.sql',
      '20260728210635_training_v2_template_provenance.sql',
      '20260729060000_training_v2_private_exercise_name_uniqueness.sql',
      '20260731090000_training_v2_session_core.sql',
      '20260731130000_training_v2_plan_tombstones.sql',
    ]) {
      const sql = await readFile(new URL(`../../../supabase/migrations/${file}`, import.meta.url), 'utf8');
      await pool.query(sql);
    }
    server = buildApp({
      authTokenVerifier: verify,
      trainingPlanService: createTrainingPlanService(createTrainingPlanRepository(pool)),
      trainingSessionService: createTrainingSessionService(createTrainingSessionRepository(pool)),
    });
  });

  beforeEach(async () => {
    await pool.query(`truncate ${allTables.map((table) => `public.${table}`).join(',')} cascade`);
    await pool.query('truncate auth.users cascade');
    await pool.query('insert into auth.users(id) values ($1),($2)', [userA, userB]);
    const result = await pool.query(`
      insert into public.training_exercises_v2(scope,owner_user_id,status,category,load_type,name,system_key)
      values ('system',null,'active','strength','total_weight','Bench Press','bench_press')
      returning id
    `);
    systemExerciseId = String(result.rows[0].id);
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

  function strengthUnit(logicalUnitKey: string, name: string, orderIndex: number) {
    return {
      logicalUnitKey, name, unitType: 'strength', orderIndex,
      exercises: [{
        logicalTargetExerciseKey: randomUUID(), exerciseId: systemExerciseId, orderIndex: 0, note: null,
        targetSets: [{
          logicalTargetSetKey: randomUUID(), orderIndex: 0, setType: 'work', targetWeightKg: 60,
          targetReps: { minimum: 5, maximum: 5 }, targetRir: 2, plannedRestSeconds: 60, importedFromLegacyPlan: false,
        }],
      }],
    };
  }

  function restUnit(logicalUnitKey: string, name: string, orderIndex: number) {
    return { logicalUnitKey, name, unitType: 'rest', orderIndex, exercises: [] };
  }

  function unitAt(plan: { revision: { units: PlanUnit[] } }, orderIndex: number) {
    const unit = plan.revision.units.find((candidate) => candidate.orderIndex === orderIndex);
    if (!unit) throw new Error(`No unit at orderIndex ${orderIndex}`);
    return unit;
  }

  // Two-unit strength/rest plan, created and activated through the real plan API (not raw
  // SQL) so its cycle_states_v2 row is seeded exactly the way production activation seeds it.
  async function createActivePlan(headers: typeof headersA) {
    const response = await server.inject({
      method: 'POST', url: '/v1/training/plans', headers,
      payload: {
        name: 'Full Body', weeklyGoal: 3, activateImmediately: true,
        units: [strengthUnit(randomUUID(), 'Day 1', 0), restUnit(randomUUID(), 'Day 2', 1)],
      },
    });
    expect(response.statusCode).toBe(201);
    const { plan } = response.json();
    expect(plan.status).toBe('active');
    const unit0 = unitAt(plan, 0);
    const unit1 = unitAt(plan, 1);
    return { plan, unit0, unit1 };
  }

  // Three-unit strength/rest/strength plan, used by the revision-remap tests below.
  async function createThreeUnitPlan(headers: typeof headersA) {
    const response = await server.inject({
      method: 'POST', url: '/v1/training/plans', headers,
      payload: {
        name: 'Three Day Split', weeklyGoal: 3, activateImmediately: true,
        units: [
          strengthUnit(randomUUID(), 'A', 0),
          restUnit(randomUUID(), 'B', 1),
          strengthUnit(randomUUID(), 'C', 2),
        ],
      },
    });
    expect(response.statusCode).toBe(201);
    const { plan } = response.json();
    return { plan, unitA: unitAt(plan, 0), unitB: unitAt(plan, 1), unitC: unitAt(plan, 2) };
  }

  function completeUnitPayload(planId: string, unitId: string, idempotencyKey: string, overrides: Record<string, unknown> = {}) {
    return {
      planId, unitId, status: 'completed', idempotencyKey, exercises: [], ...overrides,
    };
  }

  it('creates all session tables with RLS and denies direct anon/authenticated mutations', async () => {
    const relations = await pool.query(`
      select relname, relrowsecurity from pg_class where relname = any($1::text[]) order by relname
    `, [sessionTables]);
    expect(relations.rows).toHaveLength(sessionTables.length);
    expect(relations.rows.every((row) => row.relrowsecurity)).toBe(true);

    const privileges = await pool.query(`
      select bool_or(
        has_table_privilege('anon', format('public.%I', name), 'INSERT')
        or has_table_privilege('anon', format('public.%I', name), 'UPDATE')
        or has_table_privilege('authenticated', format('public.%I', name), 'INSERT')
        or has_table_privilege('authenticated', format('public.%I', name), 'UPDATE')
      ) as any_client_write
      from unnest($1::text[]) as name
    `, [sessionTables]);
    expect(privileges.rows[0].any_client_write).toBe(false);
  });

  it('saves a full historical snapshot and advances the cycle to the actual successor exactly once', async () => {
    const { plan, unit0, unit1 } = await createActivePlan(headersA);
    const idempotencyKey = randomUUID();
    // A byte-for-byte identical payload object is reused for the replay below (not rebuilt
    // with a fresh `new Date().toISOString()`) -- two separately-built "identical" requests
    // must still fingerprint identically, but this test's own job is to prove a genuinely
    // identical replay is accepted, not to also re-verify timestamp-insensitivity (already
    // covered by trainingSessionFingerprint.test.ts).
    const payload = completeUnitPayload(plan.id, unit0.id, idempotencyKey, {
      exercises: [{
        exerciseId: systemExerciseId,
        logicalTargetExerciseKey: unit0.exercises[0].logicalTargetExerciseKey,
        orderIndex: 0,
        note: 'grip felt narrow today',
        sets: [{
          clientSetId: randomUUID(),
          logicalTargetSetKey: unit0.exercises[0].targetSets[0].logicalTargetSetKey,
          orderIndex: 0, setType: 'work', weightKg: 82.5, reps: 9, rir: 1, note: 'felt good',
          completedAt: new Date().toISOString(), actualRestSeconds: 95,
        }],
      }],
    });

    const response = await server.inject({ method: 'POST', url: '/v1/training/sessions', headers: headersA, payload });
    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.created).toBe(true);
    expect(body.session.planName).toBe('Full Body');
    expect(body.session.unitName).toBe('Day 1');
    expect(body.session.sourceUnitId).toBe(unit0.id);
    expect(body.session.exercises).toHaveLength(1);
    expect(body.session.exercises[0].exerciseName).toBe('Bench Press');
    expect(body.session.exercises[0].note).toBe('grip felt narrow today');
    expect(body.session.exercises[0].sets[0]).toMatchObject({ weightKg: 82.5, reps: 9, rir: 1, note: 'felt good', version: 1 });

    const cycle = await pool.query(`
      select next_unit_id, last_trigger, version from public.training_plan_cycle_states_v2
      where plan_id=$1 and user_id=$2`, [plan.id, userA]);
    expect(cycle.rows[0].next_unit_id).toBe(unit1.id);
    expect(cycle.rows[0].last_trigger).toBe('session_completed');
    expect(Number(cycle.rows[0].version)).toBe(2);

    const replay = await server.inject({ method: 'POST', url: '/v1/training/sessions', headers: headersA, payload });
    expect(replay.statusCode).toBe(200);
    expect(replay.json().created).toBe(false);
    expect(replay.json().session.id).toBe(body.session.id);

    const sessionCount = await pool.query('select count(*)::int as count from public.training_sessions_v2 where user_id=$1', [userA]);
    expect(sessionCount.rows[0].count).toBe(1);
    const cycleAfterReplay = await pool.query(`
      select version from public.training_plan_cycle_states_v2 where plan_id=$1 and user_id=$2`, [plan.id, userA]);
    expect(Number(cycleAfterReplay.rows[0].version)).toBe(2);
  });

  // The full "Übungsnotiz-Roundtrip" the iPhone bug report demanded: a session save's exercise
  // note lands in training_session_exercises_v2.note, the last-note endpoint surfaces it back
  // owner-scoped (never leaking to another user), and a later, brand-new session draft for the
  // same exercise never has it silently pre-filled -- the server only ever persists exactly
  // what that later request itself sends, regardless of note history.
  it('persists a session\'s exercise note, surfaces it owner-bound via the last-note endpoint, and never carries it into a later session that sends none', async () => {
    const { plan, unit0 } = await createActivePlan(headersA);

    const first = await server.inject({
      method: 'POST', url: '/v1/training/sessions', headers: headersA,
      payload: completeUnitPayload(plan.id, unit0.id, randomUUID(), {
        exercises: [{
          exerciseId: systemExerciseId,
          logicalTargetExerciseKey: unit0.exercises[0].logicalTargetExerciseKey,
          orderIndex: 0,
          note: 'Griff etwas breiter',
          sets: [{
            clientSetId: randomUUID(),
            logicalTargetSetKey: unit0.exercises[0].targetSets[0].logicalTargetSetKey,
            orderIndex: 0, setType: 'work', weightKg: 60, reps: 5, rir: 2, note: null,
            completedAt: new Date().toISOString(), actualRestSeconds: 180,
          }],
        }],
      }),
    });
    expect(first.statusCode).toBe(201);
    expect(first.json().session.exercises[0].note).toBe('Griff etwas breiter');

    const dbNote = await pool.query(
      'select note from public.training_session_exercises_v2 where session_id=$1', [first.json().session.id],
    );
    expect(dbNote.rows[0].note).toBe('Griff etwas breiter');

    const lastNoteForOwner = await server.inject({
      method: 'GET', url: `/v1/training/exercises/${systemExerciseId}/last-note`, headers: headersA,
    });
    expect(lastNoteForOwner.statusCode).toBe(200);
    expect(lastNoteForOwner.json().note).toBe('Griff etwas breiter');
    expect(lastNoteForOwner.json().completedAt).not.toBeNull();

    // Owner isolation: a different user's identical-exerciseId lookup must never see it.
    const lastNoteForOtherUser = await server.inject({
      method: 'GET', url: `/v1/training/exercises/${systemExerciseId}/last-note`, headers: headersB,
    });
    expect(lastNoteForOtherUser.statusCode).toBe(200);
    expect(lastNoteForOtherUser.json()).toEqual({ note: null, completedAt: null });

    // A legacy client omits exercise.note entirely. The API normalizes that missing field to
    // null and persists null, rather than rejecting the old request or inheriting history.
    const second = await server.inject({
      method: 'POST', url: '/v1/training/sessions', headers: headersA,
      payload: completeUnitPayload(plan.id, unit0.id, randomUUID(), {
        exercises: [{
          exerciseId: systemExerciseId,
          logicalTargetExerciseKey: unit0.exercises[0].logicalTargetExerciseKey,
          orderIndex: 0,
          sets: [{
            clientSetId: randomUUID(),
            logicalTargetSetKey: unit0.exercises[0].targetSets[0].logicalTargetSetKey,
            orderIndex: 0, setType: 'work', weightKg: 62.5, reps: 5, rir: 2, note: null,
            completedAt: new Date().toISOString(), actualRestSeconds: 180,
          }],
        }],
      }),
    });
    expect(second.statusCode).toBe(201);
    expect(second.json().session.exercises[0].note).toBeNull();
    const legacyDbNote = await pool.query(
      'select note from public.training_session_exercises_v2 where session_id=$1', [second.json().session.id],
    );
    expect(legacyDbNote.rows[0].note).toBeNull();

    // The last-note lookup now reflects the newer (null) session's create timestamp winning
    // the ordering, but since it carries no note it falls back to the still-earlier real one.
    const lastNoteAfterSecond = await server.inject({
      method: 'GET', url: `/v1/training/exercises/${systemExerciseId}/last-note`, headers: headersA,
    });
    expect(lastNoteAfterSecond.json().note).toBe('Griff etwas breiter');
  });

  it('rejects a replay with the same idempotency key but a different payload as 409 TRAINING_SESSION_CONFLICT', async () => {
    const { plan, unit0 } = await createActivePlan(headersA);
    const idempotencyKey = randomUUID();

    const first = await server.inject({
      method: 'POST', url: '/v1/training/sessions', headers: headersA,
      payload: completeUnitPayload(plan.id, unit0.id, idempotencyKey, {
        exercises: [{
          exerciseId: systemExerciseId, logicalTargetExerciseKey: unit0.exercises[0].logicalTargetExerciseKey, orderIndex: 0, note: null,
          sets: [{
            clientSetId: randomUUID(), logicalTargetSetKey: unit0.exercises[0].targetSets[0].logicalTargetSetKey,
            orderIndex: 0, setType: 'work', weightKg: 80, reps: 8, rir: 2, note: null,
            completedAt: new Date().toISOString(), actualRestSeconds: 90,
          }],
        }],
      }),
    });
    expect(first.statusCode).toBe(201);

    const conflicting = await server.inject({
      method: 'POST', url: '/v1/training/sessions', headers: headersA,
      // Same key, same unit -- but a materially different payload (weight changed).
      payload: completeUnitPayload(plan.id, unit0.id, idempotencyKey, {
        exercises: [{
          exerciseId: systemExerciseId, logicalTargetExerciseKey: unit0.exercises[0].logicalTargetExerciseKey, orderIndex: 0, note: null,
          sets: [{
            clientSetId: randomUUID(), logicalTargetSetKey: unit0.exercises[0].targetSets[0].logicalTargetSetKey,
            orderIndex: 0, setType: 'work', weightKg: 999, reps: 8, rir: 2, note: null,
            completedAt: new Date().toISOString(), actualRestSeconds: 90,
          }],
        }],
      }),
    });
    expect(conflicting.statusCode).toBe(409);
    expect(conflicting.json().error.code).toBe('TRAINING_SESSION_CONFLICT');

    const sessionCount = await pool.query(
      'select count(*)::int as count from public.training_sessions_v2 where user_id=$1', [userA],
    );
    expect(sessionCount.rows[0].count).toBe(1);
    const cycle = await pool.query(
      'select version from public.training_plan_cycle_states_v2 where plan_id=$1 and user_id=$2', [plan.id, userA],
    );
    expect(Number(cycle.rows[0].version)).toBe(2);
  });

  it('replays successfully with the exact same payload even after the source plan has been deleted', async () => {
    const { plan, unit0 } = await createActivePlan(headersA);
    const idempotencyKey = randomUUID();
    const payload = completeUnitPayload(plan.id, unit0.id, idempotencyKey);

    const first = await server.inject({ method: 'POST', url: '/v1/training/sessions', headers: headersA, payload });
    expect(first.statusCode).toBe(201);
    const sessionId = first.json().session.id;

    const deletion = await server.inject({ method: 'DELETE', url: `/v1/training/plans/${plan.id}`, headers: headersA });
    expect(deletion.statusCode).toBe(204);

    const replay = await server.inject({ method: 'POST', url: '/v1/training/sessions', headers: headersA, payload });
    expect(replay.statusCode).toBe(200);
    expect(replay.json().created).toBe(false);
    expect(replay.json().session.id).toBe(sessionId);
    // A "delete" now tombstones (20260731130000_training_v2_plan_tombstones.sql): the plan
    // row, its revision and its unit all survive, so the backlinks stay populated with the
    // real (now-tombstoned) ids -- unlike the old hard-delete regime, on-delete-set-null never
    // fires for a normal user-initiated deletion anymore, only for a true account cascade.
    expect(replay.json().session.planId).toBe(plan.id);
    expect(replay.json().session.sourceUnitId).toBe(unit0.id);
    expect(replay.json().session.planName).toBe('Full Body');
    expect(replay.json().session.unitName).toBe('Day 1');
  });

  it('saves a never-before-synced completed session for the first time after the source plan has already been deleted', async () => {
    const { plan, unit0 } = await createActivePlan(headersA);

    const deletion = await server.inject({ method: 'DELETE', url: `/v1/training/plans/${plan.id}`, headers: headersA });
    expect(deletion.statusCode).toBe(204);

    const setId = randomUUID();
    const completedAt = new Date().toISOString();
    const payload = completeUnitPayload(plan.id, unit0.id, randomUUID(), {
      exercises: [{
        exerciseId: systemExerciseId,
        logicalTargetExerciseKey: unit0.exercises[0].logicalTargetExerciseKey,
        orderIndex: 0,
        note: null,
        sets: [{
          clientSetId: setId,
          logicalTargetSetKey: unit0.exercises[0].targetSets[0].logicalTargetSetKey,
          orderIndex: 0, setType: 'work', weightKg: 82.5, reps: 9, rir: 1, note: 'felt good',
          completedAt, actualRestSeconds: 95,
        }],
      }],
    });

    const response = await server.inject({ method: 'POST', url: '/v1/training/sessions', headers: headersA, payload });
    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.created).toBe(true);
    // Full, undamaged historical snapshot -- exactly what the pre-tombstone hard delete could
    // never produce for a genuinely new save, since the plan/unit/exercise rows it needed to
    // read were already gone by then.
    expect(body.session.planId).toBe(plan.id);
    expect(body.session.sourceUnitId).toBe(unit0.id);
    expect(body.session.planName).toBe('Full Body');
    expect(body.session.revisionNumber).toBe(1);
    expect(body.session.unitName).toBe('Day 1');
    expect(body.session.unitType).toBe('strength');
    expect(body.session.exercises).toHaveLength(1);
    expect(body.session.exercises[0]).toMatchObject({
      exerciseId: systemExerciseId, exerciseName: 'Bench Press', exerciseMainMuscle: null,
      logicalTargetExerciseKey: unit0.exercises[0].logicalTargetExerciseKey,
    });
    expect(body.session.exercises[0].sets).toEqual([{
      id: expect.any(String), clientSetId: setId,
      logicalTargetSetKey: unit0.exercises[0].targetSets[0].logicalTargetSetKey,
      orderIndex: 0, setType: 'work', weightKg: 82.5, reps: 9, rir: 1, note: 'felt good',
      completedAt, actualRestSeconds: 95, version: 1,
    }]);

    // No cycle to progress: delete() already removed the cycle state, and it must stay gone.
    const cycle = await pool.query(
      'select count(*)::int as count from public.training_plan_cycle_states_v2 where plan_id=$1', [plan.id],
    );
    expect(cycle.rows[0].count).toBe(0);
  });

  it('saves a never-before-synced incomplete session for the first time after the source plan has already been deleted', async () => {
    const { plan, unit0 } = await createActivePlan(headersA);
    const deletion = await server.inject({ method: 'DELETE', url: `/v1/training/plans/${plan.id}`, headers: headersA });
    expect(deletion.statusCode).toBe(204);

    const response = await server.inject({
      method: 'POST', url: '/v1/training/sessions', headers: headersA,
      payload: completeUnitPayload(plan.id, unit0.id, randomUUID(), { status: 'incomplete' }),
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().created).toBe(true);
    expect(response.json().session.status).toBe('incomplete');
    expect(response.json().session.planId).toBe(plan.id);

    const cycle = await pool.query(
      'select count(*)::int as count from public.training_plan_cycle_states_v2 where plan_id=$1', [plan.id],
    );
    expect(cycle.rows[0].count).toBe(0);
  });

  it('keeps replay and payload-conflict semantics correct for sessions saved after deletion', async () => {
    const { plan, unit0 } = await createActivePlan(headersA);
    await server.inject({ method: 'DELETE', url: `/v1/training/plans/${plan.id}`, headers: headersA });
    const idempotencyKey = randomUUID();
    const payload = completeUnitPayload(plan.id, unit0.id, idempotencyKey);

    const first = await server.inject({ method: 'POST', url: '/v1/training/sessions', headers: headersA, payload });
    expect(first.statusCode).toBe(201);

    const replay = await server.inject({ method: 'POST', url: '/v1/training/sessions', headers: headersA, payload });
    expect(replay.statusCode).toBe(200);
    expect(replay.json().created).toBe(false);
    expect(replay.json().session.id).toBe(first.json().session.id);

    const conflicting = await server.inject({
      method: 'POST', url: '/v1/training/sessions', headers: headersA,
      payload: completeUnitPayload(plan.id, unit0.id, idempotencyKey, { status: 'incomplete' }),
    });
    expect(conflicting.statusCode).toBe(409);
    expect(conflicting.json().error.code).toBe('TRAINING_SESSION_CONFLICT');

    const sessionCount = await pool.query(
      'select count(*)::int as count from public.training_sessions_v2 where user_id=$1', [userA],
    );
    expect(sessionCount.rows[0].count).toBe(1);
  });

  it('keeps owner isolation for a session saved against a deleted plan', async () => {
    const { plan, unit0 } = await createActivePlan(headersA);
    await server.inject({ method: 'DELETE', url: `/v1/training/plans/${plan.id}`, headers: headersA });

    const response = await server.inject({
      method: 'POST', url: '/v1/training/sessions', headers: headersB,
      payload: completeUnitPayload(plan.id, unit0.id, randomUUID()),
    });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('TRAINING_SESSION_PLAN_NOT_FOUND');
  });

  it('does not advance the cycle for an incomplete session', async () => {
    const { plan, unit0 } = await createActivePlan(headersA);
    const response = await server.inject({
      method: 'POST', url: '/v1/training/sessions', headers: headersA,
      payload: completeUnitPayload(plan.id, unit0.id, randomUUID(), { status: 'incomplete' }),
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().session.status).toBe('incomplete');

    const cycle = await pool.query(`
      select next_unit_id, last_trigger, version from public.training_plan_cycle_states_v2
      where plan_id=$1 and user_id=$2`, [plan.id, userA]);
    expect(cycle.rows[0].next_unit_id).toBe(unit0.id);
    expect(cycle.rows[0].last_trigger).toBe('plan_activated');
    expect(Number(cycle.rows[0].version)).toBe(1);
  });

  it('wraps the cycle back to the first unit after completing the last one', async () => {
    const { plan, unit0, unit1 } = await createActivePlan(headersA);
    const response = await server.inject({
      method: 'POST', url: '/v1/training/sessions', headers: headersA,
      payload: completeUnitPayload(plan.id, unit1.id, randomUUID()),
    });
    expect(response.statusCode).toBe(201);
    const cycle = await pool.query(`
      select next_unit_id from public.training_plan_cycle_states_v2 where plan_id=$1 and user_id=$2`,
    [plan.id, userA]);
    expect(cycle.rows[0].next_unit_id).toBe(unit0.id);
  });

  it('saves a session against a unit from a superseded revision and remaps a directly surviving successor', async () => {
    const { plan, unitB, unitC } = await createThreeUnitPlan(headersA);

    // A's slot is replaced by a brand-new unit (its logical key is dropped); B and C keep
    // their logical keys. Editing alone (via update()'s own remap) would move the cycle
    // pointer from A to revisedB -- only completing a session against the OLD unit B below
    // (whose rev-1 successor is C) can move it on to revisedC, isolating this test's
    // assertion to this module's own remap code.
    const patch = await server.inject({
      method: 'PATCH', url: `/v1/training/plans/${plan.id}`, headers: headersA,
      payload: {
        name: plan.name, expectedVersion: plan.version,
        units: [
          strengthUnit(randomUUID(), 'A2', 0),
          restUnit(unitB.logicalUnitKey, 'B revised', 1),
          strengthUnit(unitC.logicalUnitKey, 'C', 2),
        ],
      },
    });
    expect(patch.statusCode).toBe(200);
    const revisedPlan = patch.json().plan;
    const revisedC = revisedPlan.revision.units.find((unit: PlanUnit) => unit.logicalUnitKey === unitC.logicalUnitKey);

    const response = await server.inject({
      method: 'POST', url: '/v1/training/sessions', headers: headersA,
      payload: completeUnitPayload(plan.id, unitB.id, randomUUID()),
    });
    expect(response.statusCode).toBe(201);
    // The historical snapshot reflects the OLD (rev 1) unit the session actually references.
    expect(response.json().session.unitName).toBe('B');
    expect(response.json().session.revisionNumber).toBe(1);

    const cycle = await pool.query(`
      select next_unit_id, revision_id from public.training_plan_cycle_states_v2
      where plan_id=$1 and user_id=$2`, [plan.id, userA]);
    expect(cycle.rows[0].next_unit_id).toBe(revisedC.id);
    expect(cycle.rows[0].revision_id).toBe(revisedPlan.revision.id);
  });

  it('remaps to the next surviving logical unit when the direct successor no longer exists in the current revision', async () => {
    const { plan, unitA, unitC } = await createThreeUnitPlan(headersA);

    // A and C keep their logical keys; B's is dropped. Editing alone (update()'s own remap)
    // would leave the cycle pointer on revisedA (its key survives directly) -- only
    // completing a session against the OLD unit A below (whose rev-1 successor B no longer
    // exists) forces the forward-skip to C, isolating this branch specifically.
    const patch = await server.inject({
      method: 'PATCH', url: `/v1/training/plans/${plan.id}`, headers: headersA,
      payload: {
        name: plan.name, expectedVersion: plan.version,
        units: [
          strengthUnit(unitA.logicalUnitKey, 'A', 0),
          strengthUnit(randomUUID(), 'B2', 1),
          strengthUnit(unitC.logicalUnitKey, 'C', 2),
        ],
      },
    });
    expect(patch.statusCode).toBe(200);
    const revisedPlan = patch.json().plan;
    const revisedC = revisedPlan.revision.units.find((unit: PlanUnit) => unit.logicalUnitKey === unitC.logicalUnitKey);

    const response = await server.inject({
      method: 'POST', url: '/v1/training/sessions', headers: headersA,
      payload: completeUnitPayload(plan.id, unitA.id, randomUUID()),
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().session.unitName).toBe('A');
    expect(response.json().session.revisionNumber).toBe(1);

    const cycle = await pool.query(`
      select next_unit_id, revision_id from public.training_plan_cycle_states_v2
      where plan_id=$1 and user_id=$2`, [plan.id, userA]);
    expect(cycle.rows[0].next_unit_id).toBe(revisedC.id);
    expect(cycle.rows[0].revision_id).toBe(revisedPlan.revision.id);
  });

  it('saves a completed session against a plan that was never activated, with no cycle to advance', async () => {
    const draft = await server.inject({
      method: 'POST', url: '/v1/training/plans', headers: headersA,
      payload: { name: 'Draft Plan', weeklyGoal: 3, units: [restUnit(randomUUID(), 'Day 1', 0)] },
    });
    expect(draft.statusCode).toBe(201);
    const { plan } = draft.json();
    expect(plan.status).toBe('draft');

    const response = await server.inject({
      method: 'POST', url: '/v1/training/sessions', headers: headersA,
      payload: completeUnitPayload(plan.id, plan.revision.units[0].id, randomUUID()),
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().created).toBe(true);

    const cycle = await pool.query(
      'select count(*)::int as count from public.training_plan_cycle_states_v2 where plan_id=$1 and user_id=$2',
      [plan.id, userA],
    );
    expect(cycle.rows[0].count).toBe(0);
  });

  it('saves a completed session against an archived plan and still advances its persisted cycle state', async () => {
    const { plan, unit0, unit1 } = await createActivePlan(headersA);

    // getAvailableTrainingV2PlanActions (trainingV2ViewModel.js) never offers a direct
    // "archive" action for an already-active plan (canArchive is false for status 'active');
    // the only real path to an archived-while-was-active plan is activating a *different*
    // plan, which auto-archives the previously active one as a side effect
    // (applyPlanActivation in trainingPlanRepository.ts). That side effect never touches
    // cycle_states_v2 at all, so the first plan's cycle state is expected to persist
    // untouched right through this.
    const other = await server.inject({
      method: 'POST', url: '/v1/training/plans', headers: headersA,
      payload: { name: 'Other Plan', weeklyGoal: 3, activateImmediately: true, units: [restUnit(randomUUID(), 'Day 1', 0)] },
    });
    expect(other.statusCode).toBe(201);
    const archived = await server.inject({ method: 'GET', url: `/v1/training/plans/${plan.id}`, headers: headersA });
    expect(archived.json().plan.status).toBe('archived');

    const response = await server.inject({
      method: 'POST', url: '/v1/training/sessions', headers: headersA,
      payload: completeUnitPayload(plan.id, unit0.id, randomUUID()),
    });
    expect(response.statusCode).toBe(201);

    const cycle = await pool.query(
      'select next_unit_id, last_trigger from public.training_plan_cycle_states_v2 where plan_id=$1 and user_id=$2',
      [plan.id, userA],
    );
    expect(cycle.rows[0].next_unit_id).toBe(unit1.id);
    expect(cycle.rows[0].last_trigger).toBe('session_completed');
  });

  it('rejects a session for a plan the caller does not own as not found', async () => {
    const { plan, unit0 } = await createActivePlan(headersA);
    const response = await server.inject({
      method: 'POST', url: '/v1/training/sessions', headers: headersB,
      payload: completeUnitPayload(plan.id, unit0.id, randomUUID()),
    });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('TRAINING_SESSION_PLAN_NOT_FOUND');
  });

  it('rejects a unit id that does not belong to this plan at all', async () => {
    const { plan } = await createActivePlan(headersA);
    const response = await server.inject({
      method: 'POST', url: '/v1/training/sessions', headers: headersA,
      payload: completeUnitPayload(plan.id, randomUUID(), randomUUID()),
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('TRAINING_SESSION_UNIT_NOT_AVAILABLE');
  });

  it('prevents in-place updates of a recorded session at the database level', async () => {
    const { plan, unit0 } = await createActivePlan(headersA);
    const response = await server.inject({
      method: 'POST', url: '/v1/training/sessions', headers: headersA,
      payload: completeUnitPayload(plan.id, unit0.id, randomUUID()),
    });
    const sessionId = response.json().session.id;
    await expect(pool.query(
      "update public.training_sessions_v2 set status='incomplete' where id=$1", [sessionId],
    )).rejects.toMatchObject({ code: '55000' });
  });
});
