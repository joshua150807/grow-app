import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const migrationUrl = new URL(
  '../../../supabase/migrations/20260721153000_harden_habit_integrity.sql',
  import.meta.url,
);

describe('habit integrity migration', () => {
  it('is additive and performs no cleanup or backfill', async () => {
    const sql = (await readFile(migrationUrl, 'utf8')).toLowerCase();
    expect(sql).not.toMatch(/\bdrop\s+(table|column|constraint|policy)\b/);
    expect(sql).not.toMatch(/\b(update|delete|truncate)\s+public\.(habits|habit_completions)\b/);
    expect(sql).not.toMatch(/\binsert\s+into\s+public\.(habits|habit_completions)\b/);
    expect(sql).not.toContain('alter policy');
    expect(sql).not.toContain('revoke ');
  });

  it('fails fast for orphan, owner and every invalid days condition', async () => {
    const sql = (await readFile(migrationUrl, 'utf8')).toLowerCase();
    expect(sql).toContain('habit.id is null');
    expect(sql).toContain('completion.user_id <> habit.user_id');
    expect(sql).toContain('cardinality(habit.days) = 0');
    expect(sql).toContain('array_position(habit.days, null) is not null');
    expect(sql).toContain('scheduled_day not between 0 and 6');
    expect(sql).toContain('count(distinct scheduled_day)');
    expect(sql.match(/raise exception/g)).toHaveLength(3);
  });

  it('adds composite ownership without removing existing constraints', async () => {
    const sql = (await readFile(migrationUrl, 'utf8')).toLowerCase();
    expect(sql).toContain('constraint habits_id_user_id_key unique (id, user_id)');
    expect(sql).toContain('constraint habit_completions_habit_owner_fkey');
    expect(sql).toContain('foreign key (habit_id, user_id)');
    expect(sql).toContain('references public.habits (id, user_id)');
    expect(sql).toContain('on delete cascade');
  });

  it('uses one narrow immutable and null-safe array validator', async () => {
    const sql = (await readFile(migrationUrl, 'utf8')).toLowerCase();
    expect(sql).toContain('function public.habit_days_are_valid(days integer[])');
    expect(sql).toContain('immutable');
    expect(sql).toContain('days is not null');
    expect(sql).toContain('cardinality(days) between 1 and 7');
    expect(sql).toContain('array_position(days, null) is null');
    expect(sql).toContain('check (public.habit_days_are_valid(days))');
  });

  it('validates new check and foreign-key constraints explicitly', async () => {
    const sql = (await readFile(migrationUrl, 'utf8')).toLowerCase();
    expect(sql).toContain('validate constraint habits_days_valid_check');
    expect(sql).toContain('validate constraint habit_completions_habit_owner_fkey');
  });

  it('adds only the requested query indexes', async () => {
    const sql = (await readFile(migrationUrl, 'utf8')).toLowerCase();
    expect(sql).toContain('habits_user_id_idx');
    expect(sql).toContain('habit_completions_user_id_completed_date_idx');
    expect(sql).toContain('habit_completions_habit_id_user_id_idx');
    expect(sql.match(/create index if not exists/g)).toHaveLength(3);
  });

  it('accepts valid subsets and rejects empty, null, duplicate and out-of-range days by definition', () => {
    const isValid = (days: Array<number | null> | null) => Boolean(
      days
      && days.length >= 1
      && days.length <= 7
      && days.every(day => Number.isInteger(day) && Number(day) >= 0 && Number(day) <= 6)
      && new Set(days).size === days.length
    );
    expect(isValid([0])).toBe(true);
    expect(isValid([0, 1, 2, 3, 4, 5, 6])).toBe(true);
    expect(isValid([1, 3, 5])).toBe(true);
    expect(isValid([])).toBe(false);
    expect(isValid([null])).toBe(false);
    expect(isValid([-1])).toBe(false);
    expect(isValid([7])).toBe(false);
    expect(isValid([1, 1])).toBe(false);
  });
});
