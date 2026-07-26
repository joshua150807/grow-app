import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Pool } from 'pg';

const expectedDatabaseName = 'grow_api_integration_test';
const expectedPort = '55432';
const userA = '11111111-1111-4111-8111-111111111111';
const userB = '22222222-2222-4222-8222-222222222222';
const tableNames = [
  'training_exercises_v2',
  'training_exercise_alternatives_v2',
  'training_templates_v2',
  'training_template_revisions_v2',
  'training_template_units_v2',
  'training_template_exercises_v2',
  'training_template_target_sets_v2',
  'training_plans_v2',
  'training_plan_revisions_v2',
  'training_plan_units_v2',
  'training_plan_exercises_v2',
  'training_plan_target_sets_v2',
  'training_plan_activations_v2',
  'training_plan_cycle_states_v2',
  'training_weekly_goal_versions_v2',
] as const;

function guardedUrl(): string {
  const value = process.env.TEST_DATABASE_URL;
  if (!value || process.env.ALLOW_INTEGRATION_DB_RESET !== 'true') {
    throw new Error('Guarded local integration database configuration is required.');
  }
  const url = new URL(value);
  const database = decodeURIComponent(url.pathname.slice(1));
  if (url.hostname !== '127.0.0.1' || url.port !== expectedPort || database !== expectedDatabaseName) {
    throw new Error('Training V2 integration tests only allow the guarded local test database.');
  }
  if (process.env.DATABASE_URL && process.env.DATABASE_URL === value) {
    throw new Error('TEST_DATABASE_URL must not equal DATABASE_URL.');
  }
  return value;
}

async function dropV2(pool: Pool) {
  await pool.query(`
    drop table if exists ${tableNames.map((name) => `public.${name}`).join(', ')} cascade;
    drop function if exists public.prevent_training_v2_exercise_identity_update();
    drop function if exists public.is_training_v2_clean_text_array(text[]);
    drop function if exists public.set_training_v2_updated_at();
    drop function if exists public.prevent_training_v2_revision_update();
  `);
}

describe('training V2 exercise catalog foundation PostgreSQL integration', () => {
  let pool: Pool;
  let coreSql: string;
  let foundationSql: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: guardedUrl() });
    coreSql = await readFile(
      new URL('../../../supabase/migrations/20260726180000_training_v2_plan_core.sql', import.meta.url),
      'utf8',
    );
    foundationSql = await readFile(
      new URL(
        '../../../supabase/migrations/20260726190000_training_v2_exercise_catalog_foundation.sql',
        import.meta.url,
      ),
      'utf8',
    );
    await dropV2(pool);
    await pool.query(`
      create schema if not exists auth;
      do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
      do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
      do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
      drop table if exists auth.users cascade;
      create table auth.users (id uuid primary key);
      drop table if exists public.training_plans, public.training_days, public.training_exercises,
        public.training_sessions, public.training_session_exercises cascade;
      create table public.training_plans (legacy_marker integer);
      create table public.training_days (legacy_marker integer);
      create table public.training_exercises (legacy_marker integer);
      create table public.training_sessions (legacy_marker integer);
      create table public.training_session_exercises (legacy_marker integer);
      insert into public.training_plans values (1);
      insert into public.training_days values (2);
      insert into public.training_exercises values (3);
      insert into public.training_sessions values (4);
      insert into public.training_session_exercises values (5);
      grant usage on schema public to service_role;
    `);
  });

  beforeEach(async () => {
    await dropV2(pool);
    await pool.query('truncate auth.users cascade');
    await pool.query('insert into auth.users (id) values ($1), ($2)', [userA, userB]);
    await pool.query(coreSql);
  });

  afterAll(async () => {
    if (!pool) return;
    try {
      await dropV2(pool);
      await pool.query(`
        drop table if exists public.training_plans, public.training_days, public.training_exercises,
          public.training_sessions, public.training_session_exercises;
        drop table if exists auth.users cascade;
      `);
    } finally {
      await pool.end();
    }
  });

  async function applyFoundation() {
    await pool.query(foundationSql);
  }

  async function insertCoreExercise(input: {
    id?: string;
    scope: 'system' | 'user';
    ownerUserId: string | null;
    name?: string;
  }) {
    const result = await pool.query(`
      insert into public.training_exercises_v2
        (id,scope,owner_user_id,status,category,load_type,name)
      values ($1,$2,$3,'active','strength','total_weight',$4)
      returning id
    `, [input.id ?? randomUUID(), input.scope, input.ownerUserId, input.name ?? 'Same name']);
    return String(result.rows[0].id);
  }

  async function insertExercise(input: {
    id?: string;
    scope: 'system' | 'user';
    ownerUserId: string | null;
    systemKey: string | null;
    name?: string;
    equipment?: Array<string | null>;
  }) {
    const result = await pool.query(`
      insert into public.training_exercises_v2
        (id,scope,owner_user_id,system_key,status,category,load_type,name,equipment)
      values ($1,$2,$3,$4,'active','strength','total_weight',$5,$6)
      returning id
    `, [
      input.id ?? randomUUID(),
      input.scope,
      input.ownerUserId,
      input.systemKey,
      input.name ?? 'Same name',
      input.equipment ?? [],
    ]);
    return String(result.rows[0].id);
  }

  async function createPlanReference(exerciseId: string, exerciseScope: 'system' | 'user', owner: string | null) {
    const plan = await pool.query(
      `insert into public.training_plans_v2(user_id,name) values ($1,'Plan') returning id`,
      [userA],
    );
    const planId = String(plan.rows[0].id);
    const revision = await pool.query(`
      insert into public.training_plan_revisions_v2(plan_id,user_id,revision_number)
      values ($1,$2,1) returning id
    `, [planId, userA]);
    const revisionId = String(revision.rows[0].id);
    const unit = await pool.query(`
      insert into public.training_plan_units_v2
        (revision_id,plan_id,user_id,logical_unit_key,name,unit_type,order_index)
      values ($1,$2,$3,$4,'Strength','strength',0) returning id
    `, [revisionId, planId, userA, randomUUID()]);
    await pool.query(`
      insert into public.training_plan_exercises_v2
        (unit_id,revision_id,plan_id,user_id,exercise_id,exercise_scope,
         exercise_owner_user_id,logical_target_exercise_key,order_index)
      values ($1,$2,$3,$4,$5,$6,$7,$8,0)
    `, [
      String(unit.rows[0].id), revisionId, planId, userA, exerciseId,
      exerciseScope, owner, randomUUID(),
    ]);
    return planId;
  }

  it('Path A rejects pre-existing system rows before DDL and preserves referenced data', async () => {
    const exerciseId = await insertCoreExercise({
      scope: 'system', ownerUserId: null, name: 'Existing system exercise',
    });
    const planId = await createPlanReference(exerciseId, 'system', null);
    const before = await pool.query(
      'select * from public.training_exercises_v2 where id=$1',
      [exerciseId],
    );

    await expect(pool.query(foundationSql)).rejects.toMatchObject({
      code: '55000',
      message: expect.stringContaining('authoritative system-key mapping'),
    });

    const columns = await pool.query(`
      select column_name from information_schema.columns
      where table_schema='public' and table_name='training_exercises_v2'
        and column_name in ('system_key','equipment')
    `);
    expect(columns.rows).toEqual([]);
    const functionExists = await pool.query(`
      select to_regprocedure('public.is_training_v2_clean_text_array(text[])') is not null as present
    `);
    expect(functionExists.rows[0].present).toBe(false);
    const after = await pool.query(
      'select * from public.training_exercises_v2 where id=$1',
      [exerciseId],
    );
    expect(after.rows[0]).toEqual(before.rows[0]);
    const reference = await pool.query(
      'select exercise_id from public.training_plan_exercises_v2 where plan_id=$1',
      [planId],
    );
    expect(reference.rows[0].exercise_id).toBe(exerciseId);
  });

  it('Path B migrates an existing referenced user row without changing user data', async () => {
    const exerciseId = await insertCoreExercise({
      scope: 'user', ownerUserId: userA, name: 'Existing private exercise',
    });
    const planId = await createPlanReference(exerciseId, 'user', userA);
    const before = await pool.query(
      'select * from public.training_exercises_v2 where id=$1',
      [exerciseId],
    );

    await applyFoundation();

    const after = await pool.query(
      'select * from public.training_exercises_v2 where id=$1',
      [exerciseId],
    );
    const { system_key: systemKey, equipment, ...originalColumns } = after.rows[0];
    expect(originalColumns).toEqual(before.rows[0]);
    expect(systemKey).toBeNull();
    expect(equipment).toEqual([]);
    const reference = await pool.query(
      'select exercise_id from public.training_plan_exercises_v2 where plan_id=$1',
      [planId],
    );
    expect(reference.rows[0].exercise_id).toBe(exerciseId);
  });

  it('enforces exact system-key boundaries, uniqueness and same-name independence', async () => {
    await applyFoundation();
    await insertExercise({
      scope: 'system', ownerUserId: null, systemKey: 'a'.repeat(120), name: 'Shared name',
    });
    await insertExercise({
      scope: 'system', ownerUserId: null, systemKey: 'different_key', name: 'Shared name',
    });
    await insertExercise({
      scope: 'user', ownerUserId: userA, systemKey: null, name: 'Shared name',
    });

    await expect(insertExercise({
      scope: 'system', ownerUserId: null, systemKey: null,
    })).rejects.toMatchObject({ code: '23514' });
    await expect(insertExercise({
      scope: 'user', ownerUserId: userA, systemKey: 'private_squat',
    })).rejects.toMatchObject({ code: '23514' });
    await expect(insertExercise({
      scope: 'system', ownerUserId: null, systemKey: 'different_key',
    })).rejects.toMatchObject({ code: '23505' });

    for (const systemKey of [
      'Upper_Squat', 'upper-squat', ' upper_squat', 'upper_squat ',
      'upper__squat', '_upper_squat', 'upper_squat_', 'ä_squat', 'a'.repeat(121),
    ]) {
      await expect(insertExercise({
        scope: 'system', ownerUserId: null, systemKey,
      }), systemKey).rejects.toMatchObject({ code: '23514' });
    }
  });

  it('keeps identity immutable while allowing controlled catalog updates', async () => {
    await applyFoundation();
    const id = await insertExercise({
      scope: 'system', ownerUserId: null, systemKey: 'identity_test',
    });

    for (const [field, value] of [
      ['id', randomUUID()],
      ['scope', 'user'],
      ['owner_user_id', userA],
      ['system_key', 'changed_key'],
    ] as const) {
      await expect(
        pool.query(`update public.training_exercises_v2 set ${field}=$1 where id=$2`, [value, id]),
        field,
      ).rejects.toMatchObject({ code: '55000' });
    }

    const updated = await pool.query(`
      update public.training_exercises_v2
      set name='Renamed',status='archived',category='mobility',
        equipment=array['mat'],execution_instructions='Controlled',version=version+1
      where id=$1
      returning name,status,category,equipment,execution_instructions,version
    `, [id]);
    expect(updated.rows[0]).toEqual({
      name: 'Renamed',
      status: 'archived',
      category: 'mobility',
      equipment: ['mat'],
      execution_instructions: 'Controlled',
      version: 2,
    });
  });

  it('matches the explicit ASCII equipment whitespace and exact duplicate rules', async () => {
    await applyFoundation();
    await expect(insertExercise({
      scope: 'system',
      ownerUserId: null,
      systemKey: 'clean_equipment',
      equipment: ['barbell', 'bench', 'Barbell', 'bar bell', 'bar\tbell\nrack'],
    })).resolves.toBeTypeOf('string');

    const invalid: Array<[string, Array<string | null>]> = [
      ['empty_equipment', ['']],
      ['null_equipment', [null]],
      ['duplicate_equipment', ['barbell', 'barbell']],
    ];
    const whitespaceNames = ['space', 'tab', 'lf', 'cr', 'ff', 'vt'];
    for (const [index, whitespace] of [' ', '\t', '\n', '\r', '\f', '\v'].entries()) {
      invalid.push(
        [`only_${whitespaceNames[index]}`, [whitespace]],
        [`leading_${whitespaceNames[index]}`, [`${whitespace}barbell`]],
        [`trailing_${whitespaceNames[index]}`, [`barbell${whitespace}`]],
      );
    }
    for (const [systemKey, equipment] of invalid) {
      await expect(insertExercise({
        scope: 'system', ownerUserId: null, systemKey, equipment,
      }), systemKey).rejects.toMatchObject({ code: '23514' });
    }
  });

  it('retains owner integrity for plan references', async () => {
    await applyFoundation();
    const foreignExerciseId = await insertExercise({
      scope: 'user', ownerUserId: userB, systemKey: null, name: 'Foreign',
    });
    const localExerciseId = await insertExercise({
      scope: 'user', ownerUserId: userA, systemKey: null, name: 'Local',
    });
    await expect(createPlanReference(localExerciseId, 'user', userA)).resolves.toBeTypeOf('string');
    await expect(createPlanReference(foreignExerciseId, 'user', userB))
      .rejects.toMatchObject({ code: '23514' });
  });

  it('preserves RLS, grants, justified indexes and legacy tables', async () => {
    await applyFoundation();
    const relation = await pool.query(
      `select relrowsecurity from pg_class where oid='public.training_exercises_v2'::regclass`,
    );
    expect(relation.rows[0].relrowsecurity).toBe(true);
    const policies = await pool.query(`
      select count(*)::int count from pg_policies
      where schemaname='public' and tablename='training_exercises_v2'
    `);
    expect(policies.rows[0].count).toBe(0);

    const client = await pool.connect();
    try {
      await client.query('set role authenticated');
      await expect(client.query('select * from public.training_exercises_v2'))
        .rejects.toMatchObject({ code: '42501' });
    } finally {
      await client.query('reset role');
      client.release();
    }

    const serviceClient = await pool.connect();
    try {
      await serviceClient.query('set role service_role');
      await expect(serviceClient.query('select * from public.training_exercises_v2'))
        .resolves.toMatchObject({ rows: [] });
    } finally {
      await serviceClient.query('reset role');
      serviceClient.release();
    }

    const indexes = await pool.query(`
      select indexname from pg_indexes
      where schemaname='public' and tablename='training_exercises_v2'
    `);
    expect(indexes.rows.map((row) => row.indexname)).toEqual(expect.arrayContaining([
      'training_exercises_v2_system_key_idx',
      'training_exercises_v2_active_system_name_idx',
      'training_exercises_v2_active_user_name_idx',
      'training_exercises_v2_supporting_muscles_gin_idx',
      'training_exercises_v2_equipment_gin_idx',
    ]));

    const legacy = await pool.query(`
      select
        (select legacy_marker from public.training_plans) as plans,
        (select legacy_marker from public.training_days) as days,
        (select legacy_marker from public.training_exercises) as exercises,
        (select legacy_marker from public.training_sessions) as sessions,
        (select legacy_marker from public.training_session_exercises) as session_exercises
    `);
    expect(legacy.rows[0]).toEqual({
      plans: 1, days: 2, exercises: 3, sessions: 4, session_exercises: 5,
    });
  });
});
