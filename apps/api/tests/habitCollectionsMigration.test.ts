import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const migrationUrl = new URL(
  '../../../supabase/migrations/20260721190000_add_habit_collections.sql',
  import.meta.url,
);

async function migration() {
  return (await readFile(migrationUrl, 'utf8')).toLowerCase();
}

describe('habit collections migration', () => {
  it('is additive and leaves completions, profiles, streaks and points untouched', async () => {
    const sql = await migration();
    expect(sql).not.toMatch(/\bdrop\s+(table|column|constraint|policy)\b/);
    expect(sql).not.toMatch(/\btruncate\s+public\./);
    expect(sql).not.toMatch(/\bdelete\s+from\s+public\./);
    expect(sql).not.toMatch(/\b(update|insert\s+into)\s+public\.habit_completions\b/);
    expect(sql).not.toContain('grow_points');
    expect(sql).not.toContain('profiles');
  });

  it('creates the two owner-bound tables with required checks and foreign keys', async () => {
    const sql = await migration();
    expect(sql).toContain('create table public.habit_collections');
    expect(sql).toContain('create table public.habit_collection_memberships');
    expect(sql).toContain('habit_collections_id_user_id_key unique (id, user_id)');
    expect(sql).toContain('char_length(btrim(name)) between 1 and 60');
    expect(sql).toContain('public.habit_days_are_valid(days)');
    expect(sql).toContain('version >= 1');
    expect(sql).toContain('foreign key (collection_id, user_id)');
    expect(sql).toContain('references public.habit_collections(id, user_id)');
    expect(sql).toContain('foreign key (habit_id, user_id)');
    expect(sql).toContain('references public.habits(id, user_id)');
    expect(sql).toContain('public.habit_days_are_valid(fallback_days)');
    expect(sql).toContain('position >= 0');
  });

  it('allows only one active collection per habit while retaining closed history', async () => {
    const sql = await migration();
    expect(sql).toContain('habit_collection_memberships_one_active_habit_idx');
    expect(sql).toContain('(user_id, habit_id)');
    expect(sql).toContain('where active_until is null');
    expect(sql).not.toContain('unique (user_id, habit_id)');
  });

  it('adds only own-row read policies and denies direct authenticated mutations', async () => {
    const sql = await migration();
    expect(sql).toContain('alter table public.habit_collections enable row level security');
    expect(sql).toContain('alter table public.habit_collection_memberships enable row level security');
    expect(sql.match(/for select/g)).toHaveLength(2);
    expect(sql.match(/using \(auth\.uid\(\) = user_id\)/g)).toHaveLength(2);
    expect(sql).not.toMatch(/create policy[\s\S]{0,200}for (insert|update|delete)/);
    expect(sql).toContain('revoke all on table public.habit_collections from anon, authenticated');
    expect(sql).toContain('grant select on table public.habit_collections to authenticated');
  });

  it('limits atomic mutation RPCs to service_role', async () => {
    const sql = await migration();
    expect(sql).toContain('function public.create_habit_collection');
    expect(sql).toContain('function public.update_habit_collection');
    expect(sql).toContain('function public.delete_habit_collection');
    expect(sql.match(/security definer/g)).toHaveLength(3);
    expect(sql.match(/from public, anon, authenticated/g)).toHaveLength(5);
    expect(sql.match(/to service_role/g)?.length ?? 0).toBeGreaterThanOrEqual(5);
  });

  it('removes direct client execution from both narrow trigger functions', async () => {
    const sql = await migration();
    expect(sql).toContain('revoke all on function public.set_habit_collection_updated_at()');
    expect(sql).toContain('revoke all on function public.enforce_habit_collection_days()');
    expect(sql.match(/from public, anon, authenticated/g)?.length ?? 0).toBe(5);
    expect(sql.match(/set search_path = ''/g)?.length ?? 0).toBe(5);
    expect(sql).not.toContain('execute format(');
  });

  it('locks rows, checks ownership and versions, and performs all child changes inside RPCs', async () => {
    const sql = await migration();
    expect(sql).toContain('for update');
    expect(sql).toContain('collection.user_id = input_user_id');
    expect(sql).toContain('habit.user_id = input_user_id');
    expect(sql).toContain('current_version <> input_expected_version');
    expect(sql).toContain("errcode = '40001'");
    expect(sql).toContain('version = version + 1');
    expect(sql).toContain('habit already belongs to an active collection');
  });

  it('stores fallback days once, restores removed children and preserves children on delete', async () => {
    const sql = await migration();
    expect(sql).toContain('existing_habit_days, member_position');
    expect(sql).toContain('set days = current_membership.fallback_days');
    expect(sql).toContain('set active_until = now()');
    expect(sql).not.toMatch(/delete\s+from\s+public\.habits/);
    expect(sql).not.toMatch(/delete\s+from\s+public\.habit_collection_memberships/);
  });

  it('normalizes legacy child day writes without changing standalone habits or fallback days', async () => {
    const sql = await migration();
    expect(sql).toContain('trigger habits_enforce_collection_days');
    expect(sql).toContain('before update of days on public.habits');
    expect(sql).toContain('new.days := collection_days');
    expect(sql).toContain('membership.active_until is null');
    expect(sql).toContain('collection.deleted_at is null');
    const triggerFunction = sql.slice(
      sql.indexOf('create function public.enforce_habit_collection_days'),
      sql.indexOf('create trigger habits_enforce_collection_days'),
    );
    expect(triggerFunction).not.toContain('fallback_days :=');
    expect(triggerFunction).not.toMatch(/update\s+public\.habits/);
  });

  it('adds the requested indexes and narrow updated_at triggers', async () => {
    const sql = await migration();
    for (const name of [
      'habit_collections_user_active_idx',
      'habit_collection_memberships_collection_position_idx',
      'habit_collection_memberships_habit_active_idx',
      'habit_collection_memberships_user_active_idx',
    ]) expect(sql).toContain(name);
    expect(sql).toContain('trigger habit_collections_set_updated_at');
    expect(sql).toContain('trigger habit_collection_memberships_set_updated_at');
  });
});
