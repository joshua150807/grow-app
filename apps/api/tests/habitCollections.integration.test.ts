import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Pool, type PoolClient } from 'pg';

const expectedDatabaseName = 'grow_api_integration_test';
const expectedPort = '55432';
const userA = '11111111-1111-4111-8111-111111111111';
const userB = '22222222-2222-4222-8222-222222222222';

function guardedUrl(): string {
  const value = process.env.TEST_DATABASE_URL;
  if (!value || process.env.ALLOW_INTEGRATION_DB_RESET !== 'true') {
    throw new Error('Guarded local integration database configuration is required.');
  }
  const url = new URL(value);
  const database = decodeURIComponent(url.pathname.slice(1));
  if (url.hostname !== '127.0.0.1' || url.port !== expectedPort || database !== expectedDatabaseName) {
    throw new Error('Habit collection integration tests only allow the guarded local test database.');
  }
  if (process.env.DATABASE_URL && process.env.DATABASE_URL === value) {
    throw new Error('TEST_DATABASE_URL must not equal DATABASE_URL.');
  }
  return value;
}

async function inRole<T>(pool: Pool, role: 'authenticated' | 'service_role', userId: string, operation: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(`set local role ${role}`);
    await client.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId]);
    const result = await operation(client);
    await client.query('rollback');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

describe('habit collections PostgreSQL integration', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: guardedUrl() });
    await pool.query(`
      drop table if exists public.habit_collection_memberships, public.habit_collections,
        public.habit_completions, public.habits cascade;
      drop function if exists public.create_habit_collection(uuid,text,integer[],jsonb);
      drop function if exists public.update_habit_collection(uuid,uuid,integer,text,integer[],jsonb);
      drop function if exists public.delete_habit_collection(uuid,uuid,integer);
      drop function if exists public.enforce_habit_collection_days();
      drop function if exists public.set_habit_collection_updated_at();
      drop function if exists public.habit_days_are_valid(integer[]);
      drop table if exists auth.users cascade;
      create schema if not exists auth;
      do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
      do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
      do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
      create table auth.users (id uuid primary key);
      create or replace function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      create table public.habits (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null references auth.users(id) on delete cascade,
        name text not null,
        days integer[] not null,
        created_at timestamptz default now(),
        linked_tool_id text,
        linked_tool_title text,
        linked_tool_route text
      );
      create table public.habit_completions (
        habit_id uuid not null references public.habits(id) on delete cascade,
        user_id uuid not null references auth.users(id) on delete cascade,
        completed_date date not null,
        unique (habit_id, completed_date)
      );
      grant usage on schema auth, public to anon, authenticated, service_role;
      grant execute on function auth.uid() to anon, authenticated, service_role;
      grant select, insert, update, delete on public.habits, public.habit_completions to authenticated;
    `);
    const hardening = await readFile(
      new URL('../../../supabase/migrations/20260721153000_harden_habit_integrity.sql', import.meta.url),
      'utf8',
    );
    await pool.query(hardening);
    const collections = await readFile(
      new URL('../../../supabase/migrations/20260721190000_add_habit_collections.sql', import.meta.url),
      'utf8',
    );
    await pool.query(collections);
  });

  beforeEach(async () => {
    await pool.query(`truncate public.habit_collection_memberships, public.habit_collections,
      public.habit_completions, public.habits, auth.users cascade`);
    await pool.query('insert into auth.users (id) values ($1), ($2)', [userA, userB]);
  });

  afterAll(async () => {
    if (!pool) return;
    try {
      await pool.query(`
        drop table if exists public.habit_collection_memberships, public.habit_collections,
          public.habit_completions, public.habits cascade;
        drop function if exists public.create_habit_collection(uuid,text,integer[],jsonb);
        drop function if exists public.update_habit_collection(uuid,uuid,integer,text,integer[],jsonb);
        drop function if exists public.delete_habit_collection(uuid,uuid,integer);
        drop function if exists public.enforce_habit_collection_days();
        drop function if exists public.set_habit_collection_updated_at();
        drop function if exists public.habit_days_are_valid(integer[]);
        drop table if exists auth.users cascade;
        drop function if exists auth.uid();
      `);
    } finally {
      await pool.end();
    }
  });

  async function habit(owner: string, name: string, days: number[]) {
    const result = await pool.query(
      `insert into public.habits (user_id,name,days) values ($1,$2,$3) returning id`,
      [owner, name, days],
    );
    return String(result.rows[0].id);
  }

  async function createCollection(owner: string, days: number[], members: unknown[], name = 'Morning') {
    const result = await pool.query(
      `select public.create_habit_collection($1,$2,$3,$4::jsonb) as id`,
      [owner, name, days, JSON.stringify(members)],
    );
    return String(result.rows[0].id);
  }

  it('creates valid schemas, constraints, indexes, RLS and service-only mutation functions', async () => {
    const constraints = await pool.query(`
      select conname, contype from pg_constraint
      where conrelid in ('public.habit_collections'::regclass, 'public.habit_collection_memberships'::regclass)
    `);
    expect(constraints.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ conname: 'habit_collections_name_check', contype: 'c' }),
      expect.objectContaining({ conname: 'habit_collections_days_check', contype: 'c' }),
      expect.objectContaining({ conname: 'habit_collection_memberships_collection_owner_fkey', contype: 'f' }),
      expect.objectContaining({ conname: 'habit_collection_memberships_habit_owner_fkey', contype: 'f' }),
    ]));
    const indexes = await pool.query(`select indexname from pg_indexes where schemaname='public' and indexname like 'habit_collection%'`);
    expect(indexes.rows.map((row) => row.indexname)).toEqual(expect.arrayContaining([
      'habit_collections_user_active_idx',
      'habit_collection_memberships_one_active_habit_idx',
      'habit_collection_memberships_collection_position_idx',
    ]));
    const rls = await pool.query(`select relname, relrowsecurity from pg_class where oid in ('public.habit_collections'::regclass,'public.habit_collection_memberships'::regclass)`);
    expect(rls.rows.every((row) => row.relrowsecurity)).toBe(true);
    const policies = await pool.query(`select tablename,cmd from pg_policies where schemaname='public' and tablename like 'habit_collection%'`);
    expect(policies.rows).toHaveLength(2);
    expect(policies.rows.every((row) => row.cmd === 'SELECT')).toBe(true);
    const execute = await pool.query(`select has_function_privilege('authenticated', 'public.create_habit_collection(uuid,text,integer[],jsonb)', 'EXECUTE') as client, has_function_privilege('service_role', 'public.create_habit_collection(uuid,text,integer[],jsonb)', 'EXECUTE') as service`);
    expect(execute.rows[0]).toEqual({ client: false, service: true });
  });

  it('validates names, days and both composite ownership boundaries', async () => {
    const ownHabit = await habit(userA, 'Own', [1]);
    const foreignHabit = await habit(userB, 'Foreign', [2]);
    await expect(createCollection(userA, [0], [], '  ')).rejects.toMatchObject({ code: '22023' });
    await expect(createCollection(userA, [0], [], 'x'.repeat(61))).rejects.toMatchObject({ code: '22023' });
    await expect(createCollection(userA, [], [])).rejects.toMatchObject({ code: '22023' });
    await expect(createCollection(userA, [0, 0], [])).rejects.toMatchObject({ code: '22023' });
    await expect(createCollection(userA, [7], [])).rejects.toMatchObject({ code: '22023' });
    await expect(createCollection(userA, [0], [{ type: 'existing', habit_id: foreignHabit }])).rejects.toMatchObject({ code: 'P0002' });
    const collection = await createCollection(userA, [0], [{ type: 'existing', habit_id: ownHabit }]);
    await expect(pool.query(
      `insert into public.habit_collection_memberships (user_id,collection_id,habit_id,fallback_days,position) values ($1,$2,$3,'{1}',1)`,
      [userB, collection, foreignHabit],
    )).rejects.toMatchObject({ code: '23503' });
  });

  it('creates mixed ordered children atomically and allows only one active membership', async () => {
    const existing = await habit(userA, 'Existing', [1, 3]);
    const collection = await createCollection(userA, [0, 2], [
      { type: 'new', name: 'New', linked_tool_id: 'tool', linked_tool_title: 'Tool', linked_tool_route: '/tool' },
      { type: 'existing', habit_id: existing },
    ]);
    const memberships = await pool.query(`
      select m.position,m.fallback_days,h.name,h.days,h.linked_tool_id
      from public.habit_collection_memberships m join public.habits h on h.id=m.habit_id
      where m.collection_id=$1 and m.active_until is null order by m.position`, [collection]);
    expect(memberships.rows).toEqual([
      expect.objectContaining({ position: 0, fallback_days: [0, 2], name: 'New', days: [0, 2], linked_tool_id: 'tool' }),
      expect.objectContaining({ position: 1, fallback_days: [1, 3], name: 'Existing', days: [0, 2] }),
    ]);
    await expect(createCollection(userA, [4], [{ type: 'existing', habit_id: existing }])).rejects.toMatchObject({ code: '23505' });
    expect((await pool.query('select count(*)::int count from public.habit_collections')).rows[0].count).toBe(1);
  });

  it('updates days and order without overwriting fallback, restores removals, and rejects stale versions', async () => {
    const first = await habit(userA, 'First', [1]);
    const second = await habit(userA, 'Second', [2]);
    const collection = await createCollection(userA, [0], [
      { type: 'existing', habit_id: first }, { type: 'existing', habit_id: second },
    ]);
    await pool.query(`select public.update_habit_collection($1,$2,1,'Updated','{3,4}',$3::jsonb)`, [
      userA, collection, JSON.stringify([{ type: 'existing', habit_id: second }]),
    ]);
    const habits = await pool.query('select id,days from public.habits where id=any($1::uuid[]) order by id', [[first, second]]);
    expect(habits.rows.find((row) => row.id === first)?.days).toEqual([1]);
    expect(habits.rows.find((row) => row.id === second)?.days).toEqual([3, 4]);
    const history = await pool.query('select habit_id,fallback_days,active_until from public.habit_collection_memberships where collection_id=$1 order by position', [collection]);
    expect(history.rows.find((row) => row.habit_id === second)?.fallback_days).toEqual([2]);
    expect(history.rows.find((row) => row.habit_id === first)?.active_until).not.toBeNull();
    await expect(pool.query(`select public.update_habit_collection($1,$2,1,'Stale','{5}','[]'::jsonb)`, [userA, collection])).rejects.toMatchObject({ code: '40001' });
    expect((await pool.query('select name,version from public.habit_collections where id=$1', [collection])).rows[0]).toEqual({ name: 'Updated', version: 2 });
  });

  it('normalizes legacy child day writes while standalone habits remain editable', async () => {
    const child = await habit(userA, 'Child', [1]);
    const standalone = await habit(userA, 'Standalone', [2]);
    await createCollection(userA, [4, 5], [{ type: 'existing', habit_id: child }]);
    await pool.query(`update public.habits set days='{6}' where id=any($1::uuid[])`, [[child, standalone]]);
    const rows = await pool.query('select id,days from public.habits where id=any($1::uuid[])', [[child, standalone]]);
    expect(rows.rows.find((row) => row.id === child)?.days).toEqual([4, 5]);
    expect(rows.rows.find((row) => row.id === standalone)?.days).toEqual([6]);
    const fallback = await pool.query('select fallback_days from public.habit_collection_memberships where habit_id=$1', [child]);
    expect(fallback.rows[0].fallback_days).toEqual([1]);
  });

  it('soft deletes collections, closes memberships, restores days and never deletes habits or completions', async () => {
    const child = await habit(userA, 'Child', [1, 2]);
    const collection = await createCollection(userA, [5], [{ type: 'existing', habit_id: child }]);
    await pool.query(`insert into public.habit_completions (habit_id,user_id,completed_date) values ($1,$2,'2026-07-21')`, [child, userA]);
    await pool.query('select public.delete_habit_collection($1,$2,1)', [userA, collection]);
    expect((await pool.query('select days from public.habits where id=$1', [child])).rows[0].days).toEqual([1, 2]);
    expect((await pool.query('select count(*)::int count from public.habits where id=$1', [child])).rows[0].count).toBe(1);
    expect((await pool.query('select count(*)::int count from public.habit_completions where habit_id=$1', [child])).rows[0].count).toBe(1);
    expect((await pool.query('select deleted_at,version from public.habit_collections where id=$1', [collection])).rows[0]).toEqual(expect.objectContaining({ version: 2 }));
    expect((await pool.query('select active_until from public.habit_collection_memberships where habit_id=$1', [child])).rows[0].active_until).not.toBeNull();
  });

  it('lets a legacy client delete one child and cascades only that membership', async () => {
    const removed = await habit(userA, 'Removed', [1]);
    const retained = await habit(userA, 'Retained', [2]);
    const collection = await createCollection(userA, [4], [
      { type: 'existing', habit_id: removed },
      { type: 'existing', habit_id: retained },
    ]);
    await pool.query(`insert into public.habit_completions (habit_id,user_id,completed_date) values ($1,$2,'2026-07-21')`, [removed, userA]);
    await inRole(pool, 'authenticated', userA, async (client) => {
      await client.query('delete from public.habits where id=$1 and user_id=$2', [removed, userA]);
      expect((await client.query('select count(*)::int count from public.habits where id=$1', [removed])).rows[0].count).toBe(0);
      expect((await client.query('select count(*)::int count from public.habits where id=$1', [retained])).rows[0].count).toBe(1);
      expect((await client.query('select count(*)::int count from public.habit_collection_memberships where habit_id=$1', [removed])).rows[0].count).toBe(0);
      expect((await client.query('select count(*)::int count from public.habit_completions where habit_id=$1', [removed])).rows[0].count).toBe(0);
      expect((await client.query('select count(*)::int count from public.habit_collection_memberships where collection_id=$1 and habit_id=$2 and active_until is null', [collection, retained])).rows[0].count).toBe(1);
      expect((await client.query('select count(*)::int count from public.habit_collections where id=$1 and deleted_at is null', [collection])).rows[0].count).toBe(1);
    });
  });

  it('isolates RLS reads, denies direct client mutations and permits the service-role RPC', async () => {
    await createCollection(userA, [0], []);
    await createCollection(userB, [1], []);
    const own = await inRole(pool, 'authenticated', userA, (client) => client.query('select user_id from public.habit_collections'));
    expect(own.rows).toEqual([{ user_id: userA }]);
    await expect(inRole(pool, 'authenticated', userA, (client) => client.query(
      `insert into public.habit_collections (user_id,name,days) values ($1,'Direct','{0}')`, [userA],
    ))).rejects.toMatchObject({ code: '42501' });
    const service = await inRole(pool, 'service_role', userA, (client) => client.query(
      `select public.create_habit_collection($1,'Service','{2}','[]'::jsonb) as id`, [userA],
    ));
    expect(service.rows[0].id).toMatch(/[0-9a-f-]{36}/);
  });

  it('rolls back every partial mutation when a later member fails', async () => {
    const first = await habit(userA, 'First', [1]);
    const foreign = await habit(userB, 'Foreign', [2]);
    await expect(createCollection(userA, [5], [
      { type: 'existing', habit_id: first }, { type: 'existing', habit_id: foreign },
    ])).rejects.toMatchObject({ code: 'P0002' });
    expect((await pool.query('select count(*)::int count from public.habit_collections')).rows[0].count).toBe(0);
    expect((await pool.query('select count(*)::int count from public.habit_collection_memberships')).rows[0].count).toBe(0);
    expect((await pool.query('select days from public.habits where id=$1', [first])).rows[0].days).toEqual([1]);
  });

  it('allows a closed historical membership followed by a new active collection', async () => {
    const child = await habit(userA, 'Child', [1]);
    const first = await createCollection(userA, [2], [{ type: 'existing', habit_id: child }]);
    await pool.query('select public.delete_habit_collection($1,$2,1)', [userA, first]);
    const second = await createCollection(userA, [3], [{ type: 'existing', habit_id: child }]);
    expect(second).not.toBe(first);
    const memberships = await pool.query('select active_until from public.habit_collection_memberships where habit_id=$1 order by created_at', [child]);
    expect(memberships.rows).toHaveLength(2);
    expect(memberships.rows.filter((row) => row.active_until === null)).toHaveLength(1);
  });
});
