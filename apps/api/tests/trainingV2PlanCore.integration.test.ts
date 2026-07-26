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
    drop function if exists public.set_training_v2_updated_at();
    drop function if exists public.prevent_training_v2_revision_update();
  `);
}

describe('training V2 plan-core PostgreSQL integration', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: guardedUrl() });
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
      grant usage on schema public to service_role;
    `);
    const sql = await readFile(
      new URL('../../../supabase/migrations/20260726180000_training_v2_plan_core.sql', import.meta.url),
      'utf8',
    );
    await pool.query(sql);
  });

  beforeEach(async () => {
    await pool.query(`truncate ${tableNames.map((name) => `public.${name}`).join(', ')} cascade`);
    await pool.query('truncate auth.users cascade');
    await pool.query('insert into auth.users (id) values ($1), ($2)', [userA, userB]);
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

  async function plan(userId: string, status = 'draft') {
    const result = await pool.query(
      'insert into public.training_plans_v2 (user_id,name,status) values ($1,$2,$3) returning id',
      [userId, `Plan ${status}`, status],
    );
    return String(result.rows[0].id);
  }

  async function revision(planId: string, userId: string, revisionNumber = 1) {
    const result = await pool.query(
      `insert into public.training_plan_revisions_v2 (plan_id,user_id,revision_number)
       values ($1,$2,$3) returning id`,
      [planId, userId, revisionNumber],
    );
    return String(result.rows[0].id);
  }

  async function unit(planId: string, revisionId: string, userId: string, orderIndex = 0) {
    const result = await pool.query(
      `insert into public.training_plan_units_v2
        (revision_id,plan_id,user_id,logical_unit_key,name,unit_type,order_index)
       values ($1,$2,$3,$4,'Strength','strength',$5) returning id`,
      [revisionId, planId, userId, randomUUID(), orderIndex],
    );
    return String(result.rows[0].id);
  }

  async function exercise(owner: string | null, scope: 'system' | 'user' = owner ? 'user' : 'system') {
    const result = await pool.query(
      `insert into public.training_exercises_v2
        (scope,owner_user_id,status,category,load_type,name)
       values ($1,$2,'active','strength','total_weight','Squat') returning id`,
      [scope, owner],
    );
    return String(result.rows[0].id);
  }

  it('creates all tables with RLS and denies direct anon/authenticated mutations', async () => {
    const relations = await pool.query(`
      select relname, relrowsecurity from pg_class
      where relname = any($1::text[]) order by relname
    `, [tableNames]);
    expect(relations.rows).toHaveLength(tableNames.length);
    expect(relations.rows.every((row) => row.relrowsecurity)).toBe(true);

    const privileges = await pool.query(`
      select
        bool_or(
          has_table_privilege('anon', format('public.%I', name), 'INSERT')
          or has_table_privilege('anon', format('public.%I', name), 'UPDATE')
          or has_table_privilege('anon', format('public.%I', name), 'DELETE')
        ) as anon_mutates,
        bool_or(
          has_table_privilege('authenticated', format('public.%I', name), 'INSERT')
          or has_table_privilege('authenticated', format('public.%I', name), 'UPDATE')
          or has_table_privilege('authenticated', format('public.%I', name), 'DELETE')
        ) as authenticated_mutates
      from unnest($1::text[]) name
    `, [tableNames]);
    expect(privileges.rows[0]).toEqual({ anon_mutates: false, authenticated_mutates: false });
  });

  it('allows one active and scheduled plan per user while isolating users', async () => {
    await plan(userA, 'active');
    await plan(userA, 'scheduled');
    await plan(userB, 'active');
    await plan(userB, 'scheduled');
    await expect(plan(userA, 'active')).rejects.toMatchObject({ code: '23505' });
    await expect(plan(userA, 'scheduled')).rejects.toMatchObject({ code: '23505' });
  });

  it('enforces exercise scope, owner and private publication rules', async () => {
    await exercise(null, 'system');
    await exercise(userA, 'user');
    await expect(exercise(userA, 'system')).rejects.toMatchObject({ code: '23514' });
    await expect(exercise(null, 'user')).rejects.toMatchObject({ code: '23514' });
    await expect(pool.query(`
      insert into public.training_exercises_v2
        (scope,owner_user_id,status,category,load_type,name)
      values ('user',$1,'unpublished','strength','total_weight','Private')
    `, [userA])).rejects.toMatchObject({ code: '23514' });
  });

  it('rejects invalid versions, positions, weights, rests, RIR and rep ranges', async () => {
    await expect(pool.query(
      `insert into public.training_plans_v2 (user_id,name,version) values ($1,'Bad',0)`,
      [userA],
    )).rejects.toMatchObject({ code: '23514' });
    const planId = await plan(userA);
    const revisionId = await revision(planId, userA);
    await expect(unit(planId, revisionId, userA, -1)).rejects.toMatchObject({ code: '23514' });
    const unitId = await unit(planId, revisionId, userA);
    const exerciseId = await exercise(null);
    const target = await pool.query(`
      insert into public.training_plan_exercises_v2
        (unit_id,revision_id,plan_id,user_id,exercise_id,exercise_scope,exercise_owner_user_id,
         logical_target_exercise_key,order_index)
      values ($1,$2,$3,$4,$5,'system',null,$6,0) returning id
    `, [unitId, revisionId, planId, userA, exerciseId, randomUUID()]);
    for (const [column, value] of [
      ['target_weight_kg', '-1'],
      ['planned_rest_seconds', '-1'],
      ['target_rir', '11'],
    ] as const) {
      await expect(pool.query(`
        insert into public.training_plan_target_sets_v2
          (target_exercise_id,unit_id,revision_id,plan_id,user_id,logical_target_set_key,order_index,set_type,
           ${column})
        values ($1,$2,$3,$4,$5,$6,0,'work',${value})
      `, [target.rows[0].id, unitId, revisionId, planId, userA, randomUUID()]))
        .rejects.toMatchObject({ code: '23514' });
    }
    await expect(pool.query(`
      insert into public.training_plan_target_sets_v2
        (target_exercise_id,unit_id,revision_id,plan_id,user_id,logical_target_set_key,order_index,set_type,
         target_reps_min,target_reps_max)
      values ($1,$2,$3,$4,$5,$6,0,'work',12,8)
    `, [target.rows[0].id, unitId, revisionId, planId, userA, randomUUID()]))
      .rejects.toMatchObject({ code: '23514' });
    await expect(pool.query(`
      insert into public.training_plan_target_sets_v2
        (target_exercise_id,unit_id,revision_id,plan_id,user_id,logical_target_set_key,order_index,set_type,
         target_reps_min)
      values ($1,$2,$3,$4,$5,$6,0,'work',8)
    `, [target.rows[0].id, unitId, revisionId, planId, userA, randomUUID()]))
      .rejects.toMatchObject({ code: '23514' });
  });

  it('rejects duplicate positions and logical keys within the same parent', async () => {
    const planId = await plan(userA);
    const revisionId = await revision(planId, userA);
    const logicalKey = randomUUID();
    await pool.query(`
      insert into public.training_plan_units_v2
        (revision_id,plan_id,user_id,logical_unit_key,name,unit_type,order_index)
      values ($1,$2,$3,$4,'One','strength',0)
    `, [revisionId, planId, userA, logicalKey]);
    await expect(pool.query(`
      insert into public.training_plan_units_v2
        (revision_id,plan_id,user_id,logical_unit_key,name,unit_type,order_index)
      values ($1,$2,$3,$4,'Duplicate position','rest',0)
    `, [revisionId, planId, userA, randomUUID()])).rejects.toMatchObject({ code: '23505' });
    await expect(pool.query(`
      insert into public.training_plan_units_v2
        (revision_id,plan_id,user_id,logical_unit_key,name,unit_type,order_index)
      values ($1,$2,$3,$4,'Duplicate logical','rest',1)
    `, [revisionId, planId, userA, logicalKey])).rejects.toMatchObject({ code: '23505' });
  });

  it('rejects cross-owner plan hierarchy and private exercise references', async () => {
    const planId = await plan(userA);
    await expect(revision(planId, userB)).rejects.toMatchObject({ code: '23503' });
    const revisionId = await revision(planId, userA);
    const unitId = await unit(planId, revisionId, userA);
    const foreignExercise = await exercise(userB);
    await expect(pool.query(`
      insert into public.training_plan_exercises_v2
        (unit_id,revision_id,plan_id,user_id,exercise_id,exercise_scope,exercise_owner_user_id,
         logical_target_exercise_key,order_index)
      values ($1,$2,$3,$4,$5,'user',$6,$7,0)
    `, [unitId, revisionId, planId, userA, foreignExercise, userB, randomUUID()]))
      .rejects.toMatchObject({ code: '23514' });
  });

  it('makes plan revision content immutable after insertion', async () => {
    const planId = await plan(userA);
    const revisionId = await revision(planId, userA);
    const unitId = await unit(planId, revisionId, userA);
    await expect(pool.query(
      `update public.training_plan_units_v2 set name='Changed' where id=$1`,
      [unitId],
    )).rejects.toMatchObject({ code: '55000' });
  });

  it('keeps legacy tables and their marker columns unchanged', async () => {
    const columns = await pool.query(`
      select table_name, column_name from information_schema.columns
      where table_schema='public'
        and table_name = any($1::text[])
        and column_name='legacy_marker'
      order by table_name
    `, [[
      'training_plans', 'training_days', 'training_exercises',
      'training_sessions', 'training_session_exercises',
    ]]);
    expect(columns.rows).toHaveLength(5);
  });
});
