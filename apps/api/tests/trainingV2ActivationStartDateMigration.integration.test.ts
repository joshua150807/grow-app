import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Pool, type PoolClient } from 'pg';

const expectedDatabaseName = 'grow_api_integration_test';
const expectedPort = '55432';
const userId = '11111111-1111-4111-8111-111111111111';
const otherUserId = '22222222-2222-4222-8222-222222222222';
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
  ) throw new Error('Activation migration tests only allow the guarded local database.');
  if (process.env.DATABASE_URL === value) throw new Error('TEST_DATABASE_URL must not equal DATABASE_URL.');
  return value;
}

async function dropSchema(db: Pick<Pool | PoolClient, 'query'>) {
  await db.query(`drop table if exists ${tables.map((table) => `public.${table}`).join(',')} cascade`);
  await db.query('drop function if exists public.set_training_v2_updated_at() cascade');
  await db.query('drop function if exists public.prevent_training_v2_revision_update() cascade');
}

describe('training V2 activation start-date migration PostgreSQL integration', () => {
  let pool: Pool;
  let core: string;
  let migration: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: guardedUrl() });
    core = await readFile(
      new URL('../../../supabase/migrations/20260726180000_training_v2_plan_core.sql', import.meta.url),
      'utf8',
    );
    migration = await readFile(
      new URL('../../../supabase/migrations/20260726210000_training_v2_activation_start_date.sql', import.meta.url),
      'utf8',
    );
  });

  beforeEach(async () => {
    await dropSchema(pool);
    await pool.query(`
      create schema if not exists auth;
      do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
      do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
      do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
      drop table if exists auth.users cascade;
      create table auth.users(id uuid primary key);
      insert into auth.users values ('${userId}'),('${otherUserId}');
      create table if not exists public.training_legacy_c1_marker(value text primary key);
      truncate public.training_legacy_c1_marker;
      insert into public.training_legacy_c1_marker values ('untouched');
    `);
    await pool.query(core);
  });

  afterAll(async () => {
    if (!pool) return;
    try {
      await pool.query('drop table if exists public.training_legacy_c1_marker');
      await dropSchema(pool);
      await pool.query('drop table if exists auth.users cascade');
    } finally {
      await pool.end();
    }
  });

  async function activation(
    db: Pick<Pool | PoolClient, 'query'>,
    options: {
      effectiveAt: string;
      timezone: string;
      status?: 'pending' | 'applied' | 'cancelled';
      ownerUserId?: string;
    },
  ) {
    const ownerUserId = options.ownerUserId ?? userId;
    const plan = await db.query<{ id: string }>(`
      insert into public.training_plans_v2(user_id,name,status)
      values ($1,'Migration plan','scheduled') returning id
    `, [ownerUserId]);
    const revision = await db.query<{ id: string }>(`
      insert into public.training_plan_revisions_v2(plan_id,user_id,revision_number)
      values ($1,$2,1) returning id
    `, [plan.rows[0].id, ownerUserId]);
    await db.query(
      'update public.training_plans_v2 set current_revision_id=$1 where id=$2',
      [revision.rows[0].id, plan.rows[0].id],
    );
    const status = options.status ?? 'pending';
    return db.query<{ id: string }>(`
      insert into public.training_plan_activations_v2(
        plan_id,revision_id,user_id,effective_at,timezone,status,
        expected_plan_version,applied_at,cancelled_at
      ) values (
        $1,$2,$3,$4,$5,$6,1,
        case when $6='applied' then now() else null end,
        case when $6='cancelled' then now() else null end
      )
      returning id
    `, [
      plan.rows[0].id, revision.rows[0].id, ownerUserId,
      options.effectiveAt, options.timezone, status,
    ]);
  }

  it('backfills the exact local date at a DST boundary and preserves schema protections', async () => {
    const inserted = await activation(pool, {
      effectiveAt: '2026-10-24T22:00:00.000Z',
      timezone: 'Europe/Berlin',
    });
    const before = await pool.query(`
      select relrowsecurity,relacl::text
      from pg_class where oid='public.training_plan_activations_v2'::regclass
    `);
    const foreignKeysBefore = await pool.query(`
      select count(*)::int count from pg_constraint
      where conrelid='public.training_plan_activations_v2'::regclass and contype='f'
    `);
    await pool.query(migration);
    const row = await pool.query(
      'select start_date::text from public.training_plan_activations_v2 where id=$1',
      [inserted.rows[0].id],
    );
    expect(row.rows[0].start_date).toBe('2026-10-25');
    expect((await pool.query(`
      select relrowsecurity,relacl::text
      from pg_class where oid='public.training_plan_activations_v2'::regclass
    `)).rows).toEqual(before.rows);
    expect((await pool.query(`
      select count(*)::int count from pg_constraint
      where conrelid='public.training_plan_activations_v2'::regclass and contype='f'
    `)).rows).toEqual(foreignKeysBefore.rows);
    expect((await pool.query('select value from public.training_legacy_c1_marker')).rows)
      .toEqual([{ value: 'untouched' }]);
  });

  it('allows a non-pending immediate activation marker to keep a null local date', async () => {
    await pool.query(migration);
    const inserted = await activation(pool, {
      effectiveAt: '2026-07-27T10:00:00.000Z',
      timezone: 'Europe/Berlin',
      status: 'applied',
    });
    expect((await pool.query(
      'select start_date from public.training_plan_activations_v2 where id=$1',
      [inserted.rows[0].id],
    )).rows[0].start_date).toBeNull();
  });

  it('backfills historical planned applied and cancelled activations', async () => {
    const applied = await activation(pool, {
      effectiveAt: '2026-03-28T23:00:00.000Z',
      timezone: 'Europe/Berlin',
      status: 'applied',
    });
    const cancelled = await activation(pool, {
      effectiveAt: '2026-11-01T04:00:00.000Z',
      timezone: 'America/New_York',
      status: 'cancelled',
      ownerUserId: otherUserId,
    });
    await pool.query(migration);
    const rows = await pool.query(`
      select id,start_date::text from public.training_plan_activations_v2
      where id=any($1::uuid[]) order by id
    `, [[applied.rows[0].id, cancelled.rows[0].id]]);
    expect(Object.fromEntries(rows.rows.map((row) => [row.id, row.start_date]))).toEqual({
      [applied.rows[0].id]: '2026-03-29',
      [cancelled.rows[0].id]: '2026-11-01',
    });
  });

  it('rejects pending rows without a local date after migration', async () => {
    await pool.query(migration);
    await expect(activation(pool, {
      effectiveAt: '2026-07-26T22:00:00.000Z',
      timezone: 'Europe/Berlin',
    })).rejects.toMatchObject({ code: '23514' });
  });

  it('rolls back the whole migration for an invalid stored timezone', async () => {
    await activation(pool, {
      effectiveAt: '2026-07-27T00:00:00.000Z',
      timezone: 'Invalid/Stored_Zone',
    });
    const client = await pool.connect();
    try {
      await expect(client.query(migration)).rejects.toMatchObject({ code: '22023' });
      await client.query('rollback');
      const column = await client.query(`
        select 1 from information_schema.columns
        where table_schema='public' and table_name='training_plan_activations_v2'
          and column_name='start_date'
      `);
      expect(column.rows).toEqual([]);
    } finally {
      client.release();
    }
  });

  it('preserves owner integrity for activation relationships', async () => {
    await pool.query(migration);
    await activation(pool, {
      effectiveAt: '2026-07-27T10:00:00.000Z',
      timezone: 'Europe/Berlin',
      status: 'applied',
    });
    const source = (await pool.query(`
      select plan_id,revision_id from public.training_plan_activations_v2 limit 1
    `)).rows[0];
    await expect(pool.query(`
      insert into public.training_plan_activations_v2(
        plan_id,revision_id,user_id,start_date,effective_at,timezone,status,expected_plan_version
      ) values ($1,$2,$3,'2026-07-28','2026-07-27T22:00:00Z','Europe/Berlin','pending',2)
    `, [source.plan_id, source.revision_id, otherUserId])).rejects.toMatchObject({ code: '23503' });
  });
});
