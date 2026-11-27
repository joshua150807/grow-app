import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { createDefaultMentorActionRegistry } from '../src/modules/mentor/tools/defaultRegistry.js';
import type { MentorActionRegistry } from '../src/modules/mentor/actions/mentorActionRegistry.js';

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
    throw new Error('Mentor tool integration tests only allow the guarded local test database.');
  }
  if (process.env.DATABASE_URL && process.env.DATABASE_URL === value) {
    throw new Error('TEST_DATABASE_URL must not equal DATABASE_URL.');
  }
  return value;
}

const dropObjects = `
  drop table if exists public.deep_work_sessions, public.daily_planner_events, public.goals cascade;
  drop table if exists public.todo_completion_events, public.todos,
    public.habit_completions, public.habits cascade;
  drop function if exists public.record_todo_first_completion();
  drop function if exists public.habit_days_are_valid(integer[]);
`;

describe('mentor habit and todo actions (PostgreSQL)', () => {
  let pool: Pool;
  let registry: MentorActionRegistry;
  // 2026-11-27 23:30 in Berlin is still Friday 27th; UTC is already 22:30.
  const now = new Date('2026-11-27T22:30:00Z');

  const action = (type: string) => {
    const definition = registry.get(type);
    if (!definition) throw new Error(`missing ${type}`);
    return {
      parse: (input: unknown) => definition.inputSchema.parse(input),
      summarize: async (input: unknown, userId = userA) => definition.summarize(definition.inputSchema.parse(input), userId),
      run: async (input: unknown, userId = userA) => definition.execute(userId, definition.inputSchema.parse(input)),
    };
  };

  beforeAll(async () => {
    pool = new Pool({ connectionString: guardedUrl() });
    await pool.query(`
      ${dropObjects}
      drop table if exists auth.users cascade;
      create schema if not exists auth;
      do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
      do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
      do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
      create table auth.users (id uuid primary key);
      create table public.goals (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null references auth.users(id) on delete cascade,
        name text not null,
        category text,
        deadline text,
        completed boolean default false,
        completed_at timestamptz,
        created_at timestamptz not null default now()
      );
      create table public.daily_planner_events (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null references auth.users(id) on delete cascade,
        date date not null,
        start_time text not null,
        end_time text not null,
        title text not null,
        color text,
        created_at timestamptz not null default now()
      );
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
      create table public.todos (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null references auth.users(id) on delete cascade,
        title text not null,
        due_at timestamptz,
        completed boolean default false,
        created_at timestamptz not null default now()
      );
    `);
    await pool.query(await readFile(
      new URL('../../../supabase/migrations/20260721153000_harden_habit_integrity.sql', import.meta.url), 'utf8',
    ));
    await pool.query(await readFile(
      new URL('../../../supabase/migrations/20260719222502_todo_completion_events.sql', import.meta.url), 'utf8',
    ));
    for (const file of [
      '20260802120000_add_daily_planner_event_end_date.sql',
      '20260719120000_deep_work_sessions.sql',
      '20260722120000_harden_deep_work_session_inserts.sql',
    ]) {
      await pool.query(await readFile(new URL(`../../../supabase/migrations/${file}`, import.meta.url), 'utf8'));
    }
    registry = createDefaultMentorActionRegistry({ timeZone: 'Europe/Berlin', now: () => now }, () => pool);
  });

  beforeEach(async () => {
    await pool.query('truncate public.deep_work_sessions, public.daily_planner_events, public.goals cascade');
    await pool.query('truncate public.todo_completion_events, public.todos, public.habit_completions, public.habits, auth.users cascade');
    await pool.query('insert into auth.users (id) values ($1), ($2)', [userA, userB]);
  });

  afterAll(async () => {
    if (!pool) return;
    try {
      await pool.query(`${dropObjects} drop table if exists auth.users cascade;`);
    } finally {
      await pool.end();
    }
  });

  it('registers the expected tools with JSON schemas', () => {
    expect(registry.list().map((definition) => `${definition.kind}:${definition.type}`)).toEqual([
      'read:habits.list', 'write:habit.create', 'write:habit.update', 'write:habit.complete',
      'read:todos.list', 'write:todo.create', 'write:todo.update', 'write:todo.complete',
      'read:goals.list', 'write:goal.create', 'write:goal.update', 'write:goal.complete',
      'read:planner.list', 'write:planner_event.create', 'write:planner_event.update',
      'read:deep_work.stats',
    ]);
    for (const definition of registry.list()) {
      expect(definition.jsonSchema).toMatchObject({ type: 'object' });
    }
  });

  it('creates habits with Grow weekday numbers and rejects duplicates', async () => {
    const create = action('habit.create');
    expect(await create.summarize({ name: ' 10  Seiten lesen ', days: ['fri', 'mon', 'wed'] }))
      .toBe('Gewohnheit „10 Seiten lesen“ anlegen (Mo, Mi, Fr)');
    expect(await create.summarize({ name: 'Wasser', days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] }))
      .toBe('Gewohnheit „Wasser“ anlegen (täglich)');

    const result = await create.run({ name: '10 Seiten lesen', days: ['fri', 'mon', 'wed'] });
    const row = (await pool.query('select user_id, name, days from public.habits where id = $1', [result.resultRef!.habit_id])).rows[0];
    expect(row).toEqual({ user_id: userA, name: '10 Seiten lesen', days: [0, 2, 4] });

    await expect(create.run({ name: '10 seiten LESEN', days: ['mon'] })).rejects.toMatchObject({ code: 'MENTOR_ACTION_CONFLICT' });
    await expect(create.run({ name: '10 Seiten lesen', days: ['mon'] }, userB)).resolves.toBeTruthy();
    expect(() => create.parse({ name: 'x', days: ['mon', 'mon'] })).toThrow();
    expect(() => create.parse({ name: 'x', days: [] })).toThrow();
    expect(() => create.parse({ name: 'x'.repeat(61), days: ['mon'] })).toThrow();
    expect(() => create.parse({ name: 'x', days: ['mon'], user_id: userB })).toThrow();
  });

  it('lists habits with completion stats in the user time zone', async () => {
    const { resultRef } = await action('habit.create').run({ name: 'Lesen', days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] });
    await action('habit.create').run({ name: 'Fremd', days: ['mon'] }, userB);
    await pool.query(
      `insert into public.habit_completions (habit_id, user_id, completed_date)
       values ($1, $2, '2026-11-27'), ($1, $2, '2026-11-26'), ($1, $2, '2026-10-01')`,
      [resultRef!.habit_id, userA],
    );

    const { data } = await action('habits.list').run({}) as { data: any };
    expect(data.today).toBe('2026-11-27');
    expect(data.habits).toHaveLength(1);
    expect(data.habits[0]).toMatchObject({
      name: 'Lesen', days: 'täglich', done_today: true, completed_in_window: 2, scheduled_in_window: 28,
    });
  });

  it('updates and completes only own habits', async () => {
    const { resultRef } = await action('habit.create').run({ name: 'Lesen', days: ['mon'] });
    const habitId = resultRef!.habit_id as string;

    expect(await action('habit.update').summarize({ habit_id: habitId, days: ['mon', 'thu'] }))
      .toBe('Gewohnheit „Lesen“ ändern: Tage Mo, Do');
    await expect(action('habit.update').summarize({ habit_id: habitId, name: 'X' }, userB))
      .rejects.toMatchObject({ code: 'MENTOR_ACTION_TARGET_NOT_FOUND' });
    await expect(action('habit.update').run({ habit_id: habitId, name: 'Hijack' }, userB))
      .rejects.toMatchObject({ code: 'MENTOR_ACTION_TARGET_NOT_FOUND' });

    await action('habit.update').run({ habit_id: habitId, name: 'Lesen am Abend', days: ['mon', 'thu'] });
    expect((await pool.query('select name, days from public.habits where id = $1', [habitId])).rows[0])
      .toEqual({ name: 'Lesen am Abend', days: [0, 3] });

    expect(await action('habit.complete').summarize({ habit_id: habitId }))
      .toBe('„Lesen am Abend“ für heute (27.11.2026) abhaken');
    await action('habit.complete').run({ habit_id: habitId });
    await action('habit.complete').run({ habit_id: habitId });
    await action('habit.complete').run({ habit_id: habitId, day: 'yesterday' });
    const completions = await pool.query(
      `select to_char(completed_date, 'YYYY-MM-DD') as day from public.habit_completions order by completed_date`,
    );
    expect(completions.rows.map((row) => row.day)).toEqual(['2026-11-26', '2026-11-27']);
    await expect(action('habit.complete').run({ habit_id: habitId }, userB))
      .rejects.toMatchObject({ code: 'MENTOR_ACTION_TARGET_NOT_FOUND' });
    expect(() => action('habit.complete').parse({ habit_id: habitId, day: 'last_week' })).toThrow();
  });

  it('creates, lists, updates and completes own todos', async () => {
    const create = action('todo.create');
    expect(await create.summarize({ title: 'Steuer machen', due_at: '2026-11-28T17:00:00Z' }))
      .toBe('To-do „Steuer machen“ anlegen (fällig 28.11.2026, 18:00)');
    const { resultRef } = await create.run({ title: 'Steuer machen', due_at: '2026-11-28T17:00:00Z' });
    await create.run({ title: 'Ohne Datum' });
    await create.run({ title: 'Fremd' }, userB);
    const todoId = resultRef!.todo_id as string;

    const { data } = await action('todos.list').run({}) as { data: any };
    expect(data.todos.map((todo: any) => todo.title)).toEqual(['Steuer machen', 'Ohne Datum']);

    expect(await action('todo.update').summarize({ todo_id: todoId, due_at: null }))
      .toBe('To-do „Steuer machen“ ändern: ohne Fälligkeit');
    await action('todo.update').run({ todo_id: todoId, due_at: null });
    expect((await pool.query('select due_at from public.todos where id = $1', [todoId])).rows[0].due_at).toBeNull();
    await action('todo.update').run({ todo_id: todoId, title: 'Steuererklärung' });
    expect((await pool.query('select title, due_at from public.todos where id = $1', [todoId])).rows[0])
      .toEqual({ title: 'Steuererklärung', due_at: null });

    await expect(action('todo.complete').run({ todo_id: todoId }, userB)).rejects.toMatchObject({ code: 'MENTOR_ACTION_TARGET_NOT_FOUND' });
    await action('todo.complete').run({ todo_id: todoId });
    expect((await pool.query('select completed from public.todos where id = $1', [todoId])).rows[0].completed).toBe(true);
    expect((await pool.query('select user_id from public.todo_completion_events')).rows).toEqual([{ user_id: userA }]);

    expect(() => create.parse({ title: 'x', due_at: 'morgen' })).toThrow();
    expect(() => create.parse({ title: 'x', due_at: '1990-01-01T00:00:00Z' })).toThrow();
    expect(() => action('todo.update').parse({ todo_id: todoId })).toThrow();
  });

  it('creates, updates, completes and lists own goals', async () => {
    const create = action('goal.create');
    expect(await create.summarize({ name: '10 kg abnehmen', category: 'yearly', deadline: '31.12.2026' }))
      .toBe('Jahresziel „10 kg abnehmen“ anlegen (bis 31.12.2026)');
    const { resultRef } = await create.run({ name: '10 kg abnehmen', category: 'yearly', deadline: '31.12.2026' });
    await create.run({ name: 'Fremdes Ziel', category: 'monthly' }, userB);
    const goalId = resultRef!.goal_id as string;

    expect(() => create.parse({ name: 'x', category: 'weekly' })).toThrow();
    expect(() => create.parse({ name: 'x', category: 'yearly', deadline: '31.02.2026' })).toThrow();
    expect(() => create.parse({ name: 'x', category: 'yearly', deadline: '2026-12-31' })).toThrow();

    expect(await action('goal.update').summarize({ goal_id: goalId, deadline: null }))
      .toBe('Ziel „10 kg abnehmen“ ändern: ohne Deadline');
    await action('goal.update').run({ goal_id: goalId, deadline: null, name: '8 kg abnehmen' });
    await expect(action('goal.complete').run({ goal_id: goalId }, userB)).rejects.toMatchObject({ code: 'MENTOR_ACTION_TARGET_NOT_FOUND' });
    await action('goal.complete').run({ goal_id: goalId });

    const { data } = await action('goals.list').run({}) as { data: any };
    expect(data.goals).toHaveLength(1);
    expect(data.goals[0]).toMatchObject({ name: '8 kg abnehmen', category: 'yearly', deadline: null, completed: true });
    expect(data.goals[0].completed_at).not.toBeNull();
  });

  it('creates and moves planner events with all-day and multi-day handling', async () => {
    const create = action('planner_event.create');
    expect(await create.summarize({ title: 'Gym', date: '2026-11-28', start_time: '18:00', end_time: '19:30' }))
      .toBe('Termin „Gym“ eintragen (28.11.2026, 18:00–19:30)');
    expect(await create.summarize({ title: 'Urlaub', date: '2026-12-20', end_date: '2026-12-27', all_day: true }))
      .toBe('Termin „Urlaub“ eintragen (20.12.2026 – 27.12.2026, ganztägig)');
    await expect(create.summarize({ title: 'X', date: '2026-11-28' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(create.summarize({ title: 'X', date: '2026-11-28', start_time: '19:00', end_time: '18:00' }))
      .rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(create.summarize({ title: 'X', date: '2035-01-01', all_day: true })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(() => create.parse({ title: 'X', date: '2026-02-30', all_day: true })).toThrow();
    expect(() => create.parse({ title: 'X', date: '2026-11-28', start_time: '25:00', end_time: '26:00' })).toThrow();

    const gym = await create.run({ title: 'Gym', date: '2026-11-28', start_time: '18:00', end_time: '19:30' });
    const trip = await create.run({ title: 'Urlaub', date: '2026-12-20', end_date: '2026-12-27', all_day: true });
    await create.run({ title: 'Fremd', date: '2026-11-28', all_day: true }, userB);

    const { data } = await action('planner.list').run({ from_date: '2026-11-27', days: 7 }) as { data: any };
    expect(data.events.map((event: any) => [event.title, event.date, event.all_day, event.start_time])).toEqual([
      ['Gym', '2026-11-28', false, '18:00'],
    ]);
    const december = await action('planner.list').run({ from_date: '2026-12-24', days: 2 }) as { data: any };
    expect(december.data.events.map((event: any) => event.title)).toEqual(['Urlaub']);

    const update = action('planner_event.update');
    expect(await update.summarize({ event_id: trip.resultRef!.event_id, date: '2026-12-21' }))
      .toBe('Termin „Urlaub“ ändern: 21.12.2026 – 28.12.2026, ganztägig');
    await update.run({ event_id: trip.resultRef!.event_id, date: '2026-12-21' });
    expect((await pool.query(
      `select to_char(date, 'YYYY-MM-DD') as date, to_char(end_date, 'YYYY-MM-DD') as end_date from public.daily_planner_events where id = $1`,
      [trip.resultRef!.event_id],
    )).rows[0]).toEqual({ date: '2026-12-21', end_date: '2026-12-28' });

    await expect(update.summarize({ event_id: gym.resultRef!.event_id, all_day: false }, userB))
      .rejects.toMatchObject({ code: 'MENTOR_ACTION_TARGET_NOT_FOUND' });
    await update.run({ event_id: gym.resultRef!.event_id, all_day: true, title: 'Gym (flexibel)' });
    await expect(update.summarize({ event_id: gym.resultRef!.event_id, all_day: false }))
      .rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await update.run({ event_id: gym.resultRef!.event_id, start_time: '07:00', end_time: '08:00' });
    expect((await pool.query('select title, start_time, end_time from public.daily_planner_events where id = $1', [gym.resultRef!.event_id])).rows[0])
      .toEqual({ title: 'Gym (flexibel)', start_time: '07:00', end_time: '08:00' });
  });

  it('reads deep work stats per local day and offers no deep work writes', async () => {
    await pool.query(
      `insert into public.deep_work_sessions (user_id, client_session_id, duration_seconds, completed_at) values
       ($1, 'a', 3000, '2026-11-27T21:30:00Z'),
       ($1, 'b', 1800, '2026-11-27T23:30:00Z'),
       ($1, 'c', 600, '2026-09-01T10:00:00Z'),
       ($2, 'd', 9999, '2026-11-27T10:00:00Z')`,
      [userA, userB],
    );
    const { data } = await action('deep_work.stats').run({ days: 30 }) as { data: any };
    expect(data).toMatchObject({ sessions: 1, total_minutes: 50, average_minutes_per_session: 50 });
    expect(data.minutes_per_day).toEqual([{ day: '2026-11-27', minutes: 50 }]);
    expect(registry.list().filter((definition) => definition.type.startsWith('deep_work') && definition.kind === 'write')).toEqual([]);
  });
});
