import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Pool, type PoolClient } from 'pg';
import { createDeepWorkSessionRepository } from '../src/modules/profileStats/deepWorkSessionRepository.js';
import { createProfileStatsRepository } from '../src/modules/profileStats/profileStatsRepository.js';
import { getCalendarBounds } from '../src/modules/profileStats/timezone.js';

const expectedDatabaseName = 'grow_api_integration_test';
const expectedPort = '55432';

function guardedUrl(): string {
  const value = process.env.TEST_DATABASE_URL;
  if (!value || process.env.ALLOW_INTEGRATION_DB_RESET !== 'true') {
    throw new Error('Guarded local integration database configuration is required.');
  }
  const url = new URL(value);
  const database = decodeURIComponent(url.pathname.slice(1));
  if (url.hostname !== '127.0.0.1' || url.port !== expectedPort || database !== expectedDatabaseName) {
    throw new Error('Profile stats integration tests only allow 127.0.0.1:55432/grow_api_integration_test.');
  }
  if (process.env.DATABASE_URL && process.env.DATABASE_URL === value) {
    throw new Error('TEST_DATABASE_URL must not equal DATABASE_URL.');
  }
  return value;
}

async function asAuthenticated<T>(pool: Pool, userId: string, operation: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query('set local role authenticated');
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

describe('profile stats and deep-work PostgreSQL integration', () => {
  let pool: Pool;
  const userA = '11111111-1111-4111-8111-111111111111';
  const userB = '22222222-2222-4222-8222-222222222222';

  beforeAll(async () => {
    pool = new Pool({ connectionString: guardedUrl() });
    await pool.query(`
      drop table if exists public.todo_completion_events, public.deep_work_sessions, public.habit_completions, public.habits,
        public.todos, public.training_sessions, public.goals, public.daily_planner_events cascade;
      drop function if exists public.record_todo_first_completion();
      drop table if exists auth.users cascade;
      create schema if not exists auth;
      do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
      create table auth.users (id uuid primary key);
      create or replace function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      create table public.habits (
        id uuid primary key, user_id uuid not null, days jsonb not null default '[]', created_at timestamptz default now(),
        archived_at timestamptz, is_active boolean, disabled boolean
      );
      create table public.habit_completions (habit_id uuid not null, user_id uuid not null, completed_date date not null);
      create table public.todos (
        id uuid primary key, user_id uuid not null, title text not null, completed boolean not null default false,
        due_at timestamptz, created_at timestamptz default now()
      );
      create table public.training_sessions (id uuid primary key, user_id uuid not null);
      create table public.goals (id uuid primary key, user_id uuid not null, category text, completed boolean default false);
      create table public.daily_planner_events (id uuid primary key, user_id uuid not null, date date not null);
      grant usage on schema auth, public to authenticated;
      grant execute on function auth.uid() to authenticated;
    `);
    const migration = await readFile(
      new URL('../../../supabase/migrations/20260719120000_deep_work_sessions.sql', import.meta.url),
      'utf8',
    );
    await pool.query(migration);
    const todoCompletionMigration = await readFile(
      new URL('../../../supabase/migrations/20260719222502_todo_completion_events.sql', import.meta.url),
      'utf8',
    );
    await pool.query(todoCompletionMigration);
    await pool.query(`grant select, insert, update, delete on public.deep_work_sessions to authenticated`);
    await pool.query(`grant select, insert, update, delete on public.todos, public.todo_completion_events to authenticated`);
  });

  beforeEach(async () => {
    await pool.query(`
      truncate public.todo_completion_events, public.deep_work_sessions, public.habit_completions, public.habits, public.todos,
        public.training_sessions, public.goals, public.daily_planner_events, auth.users cascade
    `);
    await pool.query('insert into auth.users (id) values ($1), ($2)', [userA, userB]);
  });

  afterAll(async () => {
    if (!pool) return;
    try {
      await pool.query(`
        drop table if exists public.todo_completion_events, public.deep_work_sessions, public.habit_completions, public.habits,
          public.todos, public.training_sessions, public.goals, public.daily_planner_events cascade;
        drop function if exists public.record_todo_first_completion();
        drop table if exists auth.users cascade;
        drop function if exists auth.uid();
      `);
    } finally {
      await pool.end();
    }
  });

  it('applies the unchanged migration with the expected metadata, constraints, index, RLS and policies', async () => {
    const columns = await pool.query(`
      select column_name, data_type, is_nullable, column_default from information_schema.columns
      where table_schema = 'public' and table_name = 'deep_work_sessions' order by ordinal_position
    `);
    expect(columns.rows.map((row) => [row.column_name, row.data_type, row.is_nullable])).toEqual([
      ['id', 'uuid', 'NO'], ['user_id', 'uuid', 'NO'], ['client_session_id', 'text', 'NO'],
      ['duration_seconds', 'integer', 'NO'], ['completed_at', 'timestamp with time zone', 'NO'],
      ['created_at', 'timestamp with time zone', 'NO'],
    ]);
    expect(columns.rows[0].column_default).toContain('gen_random_uuid');
    expect(columns.rows[5].column_default).toContain('now()');
    const constraints = await pool.query(`
      select conname, contype, confdeltype from pg_constraint
      where conrelid = 'public.deep_work_sessions'::regclass order by conname
    `);
    expect(constraints.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ contype: 'p' }),
      expect.objectContaining({ contype: 'f', confdeltype: 'c' }),
      expect.objectContaining({ conname: 'deep_work_sessions_duration_seconds_check', contype: 'c' }),
      expect.objectContaining({ conname: 'deep_work_sessions_user_client_session_id_key', contype: 'u' }),
    ]));
    const table = await pool.query(`select relrowsecurity from pg_class where oid = 'public.deep_work_sessions'::regclass`);
    expect(table.rows[0].relrowsecurity).toBe(true);
    const policies = await pool.query(`select policyname, cmd, roles from pg_policies where schemaname='public' and tablename='deep_work_sessions' order by cmd`);
    expect(policies.rows.map((row) => [row.policyname, row.cmd])).toEqual([
      ['Grow deep work sessions insert own', 'INSERT'], ['Grow deep work sessions select own', 'SELECT'],
    ]);
    const index = await pool.query(`select indexdef from pg_indexes where schemaname='public' and indexname='deep_work_sessions_user_completed_at_idx'`);
    expect(index.rows[0].indexdef).toContain('(user_id, completed_at DESC)');
  });

  it('enforces duration, session-id, foreign-key, cascade and per-user uniqueness constraints', async () => {
    const insert = (clientSessionId: string, duration: number, userId = userA) => pool.query(
      `insert into public.deep_work_sessions (user_id, client_session_id, duration_seconds, completed_at) values ($1,$2,$3,now())`,
      [userId, clientSessionId, duration],
    );
    await expect(insert('minimum', 1)).resolves.toBeDefined();
    await expect(insert('maximum', 86_340)).resolves.toBeDefined();
    for (const [id, duration] of [['zero', 0], ['negative', -1], ['too-large', 86_341]] as const) {
      await expect(insert(id, duration)).rejects.toMatchObject({ code: '23514' });
    }
    for (const id of ['', '   ', 'x'.repeat(129)]) {
      await expect(insert(id, 1)).rejects.toMatchObject({ code: '23514' });
    }
    await expect(insert('x'.repeat(128), 1)).resolves.toBeDefined();
    await expect(insert('foreign-key', 1, randomUUID())).rejects.toMatchObject({ code: '23503' });
    await expect(insert('minimum', 1)).rejects.toMatchObject({ code: '23505' });
    await expect(insert('minimum', 1, userB)).resolves.toBeDefined();
    await pool.query('delete from auth.users where id = $1', [userB]);
    const cascaded = await pool.query('select count(*)::int as count from public.deep_work_sessions where user_id=$1', [userB]);
    expect(cascaded.rows[0].count).toBe(0);
  });

  it('enforces SELECT/INSERT ownership and denies UPDATE/DELETE for authenticated users', async () => {
    await pool.query(`insert into public.deep_work_sessions (user_id,client_session_id,duration_seconds,completed_at) values ($1,'a',60,now()),($2,'b',60,now())`, [userA, userB]);
    const rowsA = await asAuthenticated(pool, userA, (client) => client.query('select user_id from public.deep_work_sessions'));
    const rowsB = await asAuthenticated(pool, userB, (client) => client.query('select user_id from public.deep_work_sessions'));
    expect(rowsA.rows.map((row) => row.user_id)).toEqual([userA]);
    expect(rowsB.rows.map((row) => row.user_id)).toEqual([userB]);
    await expect(asAuthenticated(pool, userA, (client) => client.query(
      `insert into public.deep_work_sessions (user_id,client_session_id,duration_seconds,completed_at) values ($1,'own',60,now())`, [userA],
    ))).resolves.toBeDefined();
    await expect(asAuthenticated(pool, userA, (client) => client.query(
      `insert into public.deep_work_sessions (user_id,client_session_id,duration_seconds,completed_at) values ($1,'foreign',60,now())`, [userB],
    ))).rejects.toMatchObject({ code: '42501' });
    const update = await asAuthenticated(pool, userA, (client) => client.query(`update public.deep_work_sessions set duration_seconds=61 where user_id=$1`, [userA]));
    const deletion = await asAuthenticated(pool, userA, (client) => client.query(`delete from public.deep_work_sessions where user_id=$1`, [userA]));
    expect(update.rowCount).toBe(0);
    expect(deletion.rowCount).toBe(0);
    const unchanged = await pool.query(`select duration_seconds from public.deep_work_sessions where user_id=$1 and client_session_id='a'`, [userA]);
    expect(unchanged.rows[0].duration_seconds).toBe(60);
  });

  it('provides database-backed idempotency including parallel retries', async () => {
    const repository = createDeepWorkSessionRepository(pool);
    const input = { client_session_id: 'parallel', duration_seconds: 1500, completed_at: '2026-07-19T18:30:00.000Z' };
    const [first, second] = await Promise.all([
      repository.insertOrFind(userA, input), repository.insertOrFind(userA, input),
    ]);
    expect([first.created, second.created].sort()).toEqual([false, true]);
    expect(first.session.id).toBe(second.session.id);
    const count = await pool.query(`select count(*)::int as count from public.deep_work_sessions where user_id=$1 and client_session_id='parallel'`, [userA]);
    expect(count.rows[0].count).toBe(1);
  });

  it('applies the todo history migration with UUID types, safe constraints, index, RLS and trigger metadata', async () => {
    const columns = await pool.query(`
      select column_name, data_type, is_nullable, column_default from information_schema.columns
      where table_schema='public' and table_name='todo_completion_events' order by ordinal_position
    `);
    expect(columns.rows.map((row) => [row.column_name, row.data_type, row.is_nullable])).toEqual([
      ['id', 'uuid', 'NO'], ['user_id', 'uuid', 'NO'], ['todo_id', 'uuid', 'NO'],
      ['completed_at', 'timestamp with time zone', 'NO'], ['created_at', 'timestamp with time zone', 'NO'],
    ]);
    expect(columns.rows[0].column_default).toContain('gen_random_uuid');
    expect(columns.rows[4].column_default).toContain('now()');
    const constraints = await pool.query(`
      select conname, contype, confdeltype, pg_get_constraintdef(oid) as definition
      from pg_constraint where conrelid='public.todo_completion_events'::regclass order by conname
    `);
    expect(constraints.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ contype: 'p' }),
      expect.objectContaining({ contype: 'f', confdeltype: 'c' }),
      expect.objectContaining({ conname: 'todo_completion_events_user_todo_key', contype: 'u' }),
    ]));
    expect(constraints.rows.some((row) => String(row.definition).includes('public.todos'))).toBe(false);
    const index = await pool.query(`
      select indexdef from pg_indexes where schemaname='public'
      and indexname='todo_completion_events_user_completed_at_idx'
    `);
    expect(index.rows[0].indexdef).toContain('(user_id, completed_at DESC)');
    const table = await pool.query(`select relrowsecurity from pg_class where oid='public.todo_completion_events'::regclass`);
    expect(table.rows[0].relrowsecurity).toBe(true);
    const policies = await pool.query(`select policyname from pg_policies where schemaname='public' and tablename='todo_completion_events'`);
    expect(policies.rows).toEqual([]);
    const routine = await pool.query(`
      select prosecdef, proconfig from pg_proc
      where oid='public.record_todo_first_completion()'::regprocedure
    `);
    expect(routine.rows[0].prosecdef).toBe(true);
    expect(routine.rows[0].proconfig).toContain('search_path=""');
    const trigger = await pool.query(`
      select tgname from pg_trigger where tgrelid='public.todos'::regclass and not tgisinternal
    `);
    expect(trigger.rows).toEqual([{ tgname: 'record_todo_first_completion_trigger' }]);
  });

  it('records the first todo completion once and retains it after reopen, recompletion and todo deletion', async () => {
    const todoId = randomUUID();
    await pool.query(
      `insert into public.todos (id,user_id,title,completed) values ($1,$2,'first',false)`,
      [todoId, userA],
    );
    await pool.query(`update public.todos set completed=true where id=$1`, [todoId]);
    await pool.query(`update public.todos set completed=false where id=$1`, [todoId]);
    await pool.query(`update public.todos set completed=true where id=$1`, [todoId]);
    let events = await pool.query(`select user_id,todo_id from public.todo_completion_events where todo_id=$1`, [todoId]);
    expect(events.rows).toEqual([{ user_id: userA, todo_id: todoId }]);
    await pool.query(`delete from public.todos where id=$1`, [todoId]);
    events = await pool.query(`select user_id,todo_id from public.todo_completion_events where todo_id=$1`, [todoId]);
    expect(events.rows).toEqual([{ user_id: userA, todo_id: todoId }]);
  });

  it('records a todo inserted as completed and isolates the trigger-managed history from clients', async () => {
    const authenticatedTodoId = randomUUID();
    await asAuthenticated(pool, userA, (client) => client.query(
      `insert into public.todos (id,user_id,title,completed) values ($1,$2,'completed insert',true)`,
      [authenticatedTodoId, userA],
    ));
    const todoId = randomUUID();
    await pool.query(
      `insert into public.todos (id,user_id,title,completed) values ($1,$2,'persistent completed insert',true)`,
      [todoId, userA],
    );
    const serviceRows = await pool.query(`select user_id,todo_id from public.todo_completion_events where todo_id=$1`, [todoId]);
    expect(serviceRows.rows).toEqual([{ user_id: userA, todo_id: todoId }]);
    const clientRows = await asAuthenticated(pool, userA, (client) => client.query(`select * from public.todo_completion_events`));
    expect(clientRows.rows).toEqual([]);
    await expect(asAuthenticated(pool, userA, (client) => client.query(
      `insert into public.todo_completion_events (user_id,todo_id,completed_at) values ($1,$2,now())`,
      [userA, randomUUID()],
    ))).rejects.toMatchObject({ code: '42501' });
    const update = await asAuthenticated(pool, userA, (client) => client.query(
      `update public.todo_completion_events set completed_at=now() where todo_id=$1`, [todoId],
    ));
    const deletion = await asAuthenticated(pool, userA, (client) => client.query(
      `delete from public.todo_completion_events where todo_id=$1`, [todoId],
    ));
    expect(update.rowCount).toBe(0);
    expect(deletion.rowCount).toBe(0);
  });

  it('executes all statistics queries with correct ownership and calendar boundaries', async () => {
    const ownHabit = randomUUID();
    const archived = randomUUID();
    const foreignHabit = randomUUID();
    await pool.query(`insert into public.habits (id,user_id,days,archived_at,is_active,disabled) values
      ($1,$4,'[6]',null,true,false),($2,$4,'[6]',now(),true,false),($3,$5,'[6]',null,true,false)`,
    [ownHabit, archived, foreignHabit, userA, userB]);
    await pool.query(`insert into public.habit_completions (habit_id,user_id,completed_date) values
      ($1,$2,'2026-07-19'),($1,$2,'2026-07-19'),($1,$3,'2026-07-19')`, [ownHabit, userA, userB]);
    await pool.query(`insert into public.todos (id,user_id,title,completed,due_at) values
      ($1,$7,'yesterday',true,'2026-07-18T12:00:00Z'),($2,$7,'today done',true,'2026-07-19T12:00:00Z'),
      ($3,$7,'today open',false,'2026-07-19T13:00:00Z'),($4,$7,'tomorrow',false,'2026-07-20T12:00:00Z'),
      ($5,$7,'none',false,null),($6,$8,'foreign',true,'2026-07-19T12:00:00Z')`,
    [randomUUID(),randomUUID(),randomUUID(),randomUUID(),randomUUID(),randomUUID(),userA,userB]);
    await pool.query(`insert into public.deep_work_sessions (user_id,client_session_id,duration_seconds,completed_at) values ($1,'one',60,now()),($1,'two',120,now()),($2,'foreign',999,now())`, [userA,userB]);
    await pool.query(`insert into public.training_sessions (id,user_id) values ($1,$4),($2,$4),($3,$5)`, [randomUUID(),randomUUID(),randomUUID(),userA,userB]);
    await pool.query(`insert into public.goals (id,user_id,category,completed) values ($1,$5,'monthly',false),($2,$5,'yearly',true),($3,$5,'lifetime',false),($4,$6,'monthly',false)`, [randomUUID(),randomUUID(),randomUUID(),randomUUID(),userA,userB]);
    await pool.query(`insert into public.daily_planner_events (id,user_id,date) values ($1,$6,'2026-07-13'),($2,$6,'2026-07-13'),($3,$6,'2026-07-19'),($4,$6,'2026-07-20'),($5,$7,'2026-07-14')`, [randomUUID(),randomUUID(),randomUUID(),randomUUID(),randomUUID(),userA,userB]);
    const source = await createProfileStatsRepository(pool).load(userA, getCalendarBounds(new Date('2026-07-19T12:00:00Z'), 'Europe/Berlin'));
    expect(source.habits).toHaveLength(2);
    expect(source.completions).toHaveLength(2);
    expect(source).toMatchObject({ todosCompleted: 1, todosTotal: 2, todosCompletedAllTime: 2, deepWorkSeconds: 180, trainingSessions: 2, goals: 3 });
    expect(source.plannedDates).toEqual(['2026-07-13', '2026-07-19']);
  });
});
