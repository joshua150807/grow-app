import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const migrationUrl = new URL(
  '../../../supabase/migrations/20260726180000_training_v2_plan_core.sql',
  import.meta.url,
);

async function migration() {
  return (await readFile(migrationUrl, 'utf8')).toLowerCase();
}

const tables = [
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

describe('training V2 plan-core migration', () => {
  it('is additive and does not alter or write legacy training tables', async () => {
    const sql = await migration();
    expect(sql).not.toMatch(/\balter\s+table\s+public\.training_(plans|days|exercises|sessions|session_exercises)\b/);
    expect(sql).not.toMatch(/\b(drop|truncate)\s+table\b/);
    expect(sql).not.toMatch(/\b(insert\s+into|update|delete\s+from)\s+public\.training_(plans|days|exercises|sessions|session_exercises)\b/);
  });

  it('creates exactly the requested V2 plan-core tables', async () => {
    const sql = await migration();
    for (const table of tables) {
      expect(sql).toContain(`create table public.${table}`);
    }
    expect(sql.match(/create table public\.training_[a-z_]+_v2/g)).toHaveLength(tables.length);
  });

  it('uses canonical shared wire values and excludes persisted session structures', async () => {
    const sql = await migration();
    for (const value of [
      'total_weight', 'per_hand', 'per_side', 'added_weight_only',
      'bodyweight_only', 'no_weight_tracking', 'plan_revision_remapped',
    ]) expect(sql).toContain(`'${value}'`);
    expect(sql).not.toContain('in_progress');
    expect(sql).not.toContain('training_sessions_v2');
    expect(sql).not.toContain('personal_record');
  });

  it('enforces owner-consistent plan and exercise relationships with composite keys', async () => {
    const sql = await migration();
    expect(sql).toContain('unique nulls not distinct (id, scope, owner_user_id)');
    expect(sql).toContain('foreign key (plan_id, user_id)');
    expect(sql).toContain('foreign key (revision_id, plan_id, user_id)');
    expect(sql).toContain('foreign key (unit_id, revision_id, plan_id, user_id)');
    expect(sql).toContain('foreign key (target_exercise_id, unit_id, revision_id, plan_id, user_id)');
    expect(sql).toContain('foreign key (exercise_id, exercise_scope, exercise_owner_user_id)');
    expect(sql).toContain("exercise_owner_user_id = user_id");
  });

  it('enforces one active, scheduled and pending activation per user', async () => {
    const sql = await migration();
    expect(sql).toContain('training_plans_v2_one_active_per_user_idx');
    expect(sql).toContain("where status = 'active'");
    expect(sql).toContain('training_plans_v2_one_scheduled_per_user_idx');
    expect(sql).toContain("where status = 'scheduled'");
    expect(sql).toContain('training_plan_activations_v2_one_pending_per_user_idx');
    expect(sql).toContain("where status = 'pending'");
  });

  it('protects revisions and their content from in-place updates', async () => {
    const sql = await migration();
    expect(sql).toContain('function public.prevent_training_v2_revision_update()');
    expect(sql.match(/_v2_immutable/g)).toHaveLength(8);
    expect(sql).toContain("errcode = '55000'");
  });

  it('stores target repetitions as a complete range or null', async () => {
    const sql = await migration();
    expect(sql.match(/target_reps_min is null and target_reps_max is null/g)).toHaveLength(2);
    expect(sql.match(/target_reps_min <= target_reps_max/g)).toHaveLength(2);
  });

  it('enables RLS on every V2 plan-core table and grants no client table access', async () => {
    const sql = await migration();
    for (const table of tables) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
    }
    expect(sql).not.toContain('create policy');
    expect(sql).toContain('from public, anon, authenticated');
    expect(sql).toContain('to service_role');
    expect(sql).not.toMatch(/grant\s+(insert|update|delete|all)[\s\S]{0,300}\bto\s+(anon|authenticated)\b/);
  });

  it('defines a self-contained updated-at trigger instead of using legacy functions', async () => {
    const sql = await migration();
    expect(sql).toContain('function public.set_training_v2_updated_at()');
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain('trigger training_exercises_v2_set_updated_at');
    expect(sql).toContain('trigger training_templates_v2_set_updated_at');
    expect(sql).toContain('trigger training_plans_v2_set_updated_at');
  });
});
