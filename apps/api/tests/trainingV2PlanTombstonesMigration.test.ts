import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const migrationUrl = new URL(
  '../../../supabase/migrations/20260731130000_training_v2_plan_tombstones.sql',
  import.meta.url,
);

async function migration() {
  return (await readFile(migrationUrl, 'utf8')).toLowerCase();
}

describe('training V2 plan-tombstones migration', () => {
  it('is additive: only alters training_plans_v2, never drops, seeds or touches any other table', async () => {
    const sql = await migration();
    expect(sql).not.toMatch(/\b(drop|truncate)\s+table\b/);
    expect(sql).not.toMatch(/\b(insert\s+into|update|delete\s+from)\s+public\./);
    expect(sql.match(/\balter\s+table\s+public\.([a-z0-9_]+)/g)).toEqual([
      'alter table public.training_plans_v2', 'alter table public.training_plans_v2',
    ]);
  });

  it('adds a nullable deleted_at timestamp, not a new status value', async () => {
    const sql = await migration();
    expect(sql).toContain('add column deleted_at timestamptz');
    expect(sql).not.toMatch(/deleted_at\s+timestamptz\s+not\s+null/);
    expect(sql).not.toMatch(/status\s+in\s*\(/);
    expect(sql).not.toContain("'deleted'");
  });

  it('requires a deleted plan to also be archived, mirroring the existing archive-state check', async () => {
    const sql = await migration();
    expect(sql).toContain('training_plans_v2_deleted_requires_archived_check');
    expect(sql).toContain("check (deleted_at is null or (status = 'archived' and archived_at is not null))");
  });

  it('never touches RLS, grants or the session-core tables', async () => {
    const sql = await migration();
    expect(sql).not.toContain('row level security');
    expect(sql).not.toContain('create policy');
    expect(sql).not.toMatch(/\b(grant|revoke)\b/);
    expect(sql).not.toContain('training_sessions_v2');
    expect(sql).not.toContain('training_session_exercises_v2');
    expect(sql).not.toContain('training_session_sets_v2');
    expect(sql).not.toContain('training_plan_cycle_states_v2');
  });

  it('never re-declares the plan-core migration\'s own tables', async () => {
    const sql = await migration();
    expect(sql).not.toMatch(/\bcreate\s+table\b/);
  });
});
