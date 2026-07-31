import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const migrationUrl = new URL(
  '../../../supabase/migrations/20260731090000_training_v2_session_core.sql',
  import.meta.url,
);

async function migration() {
  return (await readFile(migrationUrl, 'utf8')).toLowerCase();
}

const tables = [
  'training_sessions_v2',
  'training_session_exercises_v2',
  'training_session_sets_v2',
] as const;

describe('training V2 session-core migration', () => {
  it('is additive and does not alter or write legacy or existing V2 plan-core tables', async () => {
    const sql = await migration();
    expect(sql).not.toMatch(/\balter\s+table\s+public\.training_(plans|days|exercises|sessions|session_exercises)\b(?!_v2)/);
    expect(sql).not.toMatch(/\balter\s+table\s+public\.training_(plans|plan|exercises|template)_v2\b/);
    expect(sql).not.toMatch(/\b(drop|truncate)\s+table\b/);
    expect(sql).not.toMatch(/\b(insert\s+into|update|delete\s+from)\s+public\.training_/);
  });

  it('creates exactly the requested session-core tables', async () => {
    const sql = await migration();
    for (const table of tables) {
      expect(sql).toContain(`create table public.${table}`);
    }
    expect(sql.match(/create table public\.training_session[a-z_]*_v2/g)).toHaveLength(tables.length);
  });

  it('never introduces a server-side active/in-progress session status', async () => {
    const sql = await migration();
    expect(sql).toContain("status text not null check (status in ('completed', 'incomplete'))");
    expect(sql).not.toContain("'active'");
    expect(sql).not.toContain('in_progress');
  });

  it('reuses the existing session_completed cycle trigger value without touching cycle_states', async () => {
    const sql = await migration();
    expect(sql).not.toMatch(/\b(alter|create|drop)\s+table\s+public\.training_plan_cycle_states_v2\b/);
    expect(sql).not.toMatch(/\b(insert\s+into|update|delete\s+from)\s+public\.training_plan_cycle_states_v2\b/);
    expect(sql).not.toMatch(/\balter\s+table\s+public\.training_(?!session)/);
  });

  it('snapshots plan/unit/exercise identity as historical data, not just live foreign keys', async () => {
    const sql = await migration();
    expect(sql).toContain('plan_name text not null');
    expect(sql).toContain('revision_number integer not null');
    expect(sql).toContain('unit_name text not null');
    expect(sql).toContain('exercise_name text not null');
    expect(sql).toContain('exercise_main_muscle text');
  });

  it('lets a session outlive its source plan via on delete set null, never cascade', async () => {
    const sql = await migration();
    expect(sql).toContain('plan_id uuid references public.training_plans_v2(id) on delete set null');
    expect(sql).toContain('plan_revision_id uuid references public.training_plan_revisions_v2(id) on delete set null');
    expect(sql).toContain('source_unit_id uuid references public.training_plan_units_v2(id) on delete set null');
    expect(sql).not.toMatch(/plan_id[\s\S]{0,40}on delete cascade/);
  });

  it('enforces ownership-consistent session-internal relationships with composite keys', async () => {
    const sql = await migration();
    expect(sql).toContain('foreign key (session_id, user_id)');
    expect(sql).toContain('references public.training_sessions_v2(id, user_id) on delete cascade');
    expect(sql).toContain('foreign key (session_exercise_id, session_id, user_id)');
    expect(sql).toContain('references public.training_session_exercises_v2(id, session_id, user_id) on delete cascade');
  });

  it('guarantees exactly-once idempotent inserts per user', async () => {
    const sql = await migration();
    expect(sql).toContain('idempotency_key uuid not null');
    expect(sql).toContain('constraint training_sessions_v2_user_idempotency_key_key unique (user_id, idempotency_key)');
  });

  it('stores a fixed-length request fingerprint to detect a reused key with a different payload', async () => {
    const sql = await migration();
    expect(sql).toContain('request_fingerprint text not null check (char_length(request_fingerprint) = 64)');
  });

  it('keeps optional set fields nullable exactly as the shared contract defines them, adding none new', async () => {
    const sql = await migration();
    expect(sql).toContain('rir integer check (rir is null or rir between 0 and 10)');
    expect(sql).toContain('note text');
    expect(sql).toContain('actual_rest_seconds integer check (actual_rest_seconds is null or actual_rest_seconds >= 0)');
    expect(sql).not.toContain('run_distance');
    expect(sql).not.toContain('run_duration');
    expect(sql).not.toContain('pace');
  });

  it('protects recorded sessions from in-place updates', async () => {
    const sql = await migration();
    expect(sql).toContain('function public.prevent_training_v2_session_update()');
    expect(sql.match(/_v2_immutable/g)).toHaveLength(3);
    expect(sql).toContain("errcode = '55000'");
  });

  it('lets only the on-delete-set-null backlink columns go null, never any other change', async () => {
    const sql = await migration();
    expect(sql).toContain("array['plan_id', 'plan_revision_id', 'source_unit_id']");
    expect(sql).toContain("array['source_target_exercise_id']");
    expect(sql).toContain("changed_key = any(allowed_null_columns)");
    expect(sql).toContain("to_jsonb(new) -> changed_key = 'null'::jsonb");
    // training_session_sets_v2 gets no allowed_null_columns entry at all -- it has no
    // nullable backlink column, so any change to it must still unconditionally raise.
    expect(sql).toContain('else array[]::text[]');
  });

  it('enables RLS on every session table and grants no client table access', async () => {
    const sql = await migration();
    for (const table of tables) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
    }
    expect(sql).not.toContain('create policy');
    expect(sql).toContain('from public, anon, authenticated');
    expect(sql).toContain('to service_role');
    expect(sql).not.toMatch(/grant\s+(insert|update|delete|all)[\s\S]{0,300}\bto\s+(anon|authenticated)\b/);
  });
});
