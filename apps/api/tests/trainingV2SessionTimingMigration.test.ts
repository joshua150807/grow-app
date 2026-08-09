import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const migrationUrl = new URL(
  '../../../supabase/migrations/20260809100000_training_v2_session_timing.sql',
  import.meta.url,
);

async function migration() {
  return (await readFile(migrationUrl, 'utf8')).toLowerCase();
}

describe('training V2 session timing migration', () => {
  it('only alters training_sessions_v2, adding nullable timing columns and a defaulted pause column', async () => {
    const sql = await migration();
    expect(sql).toContain('alter table public.training_sessions_v2');
    expect(sql).toContain('add column started_at timestamptz');
    expect(sql).toContain('add column ended_at timestamptz');
    expect(sql).toContain('add column paused_duration_seconds integer not null default 0');
    expect(sql).not.toMatch(/\balter\s+table\s+public\.training_(?!sessions_v2\b)/);
  });

  it('never backfills a value into the new columns for existing rows', async () => {
    const sql = await migration();
    expect(sql).not.toMatch(/\bupdate\s+public\.training_sessions_v2\b/);
    expect(sql).not.toMatch(/\bset\s+started_at\s*=/);
    expect(sql).not.toMatch(/\bset\s+ended_at\s*=/);
  });

  it('rejects a negative paused_duration_seconds', async () => {
    const sql = await migration();
    expect(sql).toContain('training_sessions_v2_paused_duration_seconds_check');
    expect(sql).toContain('check (paused_duration_seconds >= 0)');
  });

  it('only ever allows started_at/ended_at to be both null or both present', async () => {
    const sql = await migration();
    expect(sql).toContain('training_sessions_v2_timing_both_or_neither_check');
    expect(sql).toContain('check ((started_at is null) = (ended_at is null))');
  });

  it('rejects ended_at before started_at whenever both are present, but never when either is null', async () => {
    const sql = await migration();
    expect(sql).toContain('training_sessions_v2_timing_order_check');
    expect(sql).toContain('check (started_at is null or ended_at is null or ended_at >= started_at)');
  });

  it('rejects a paused duration larger than the gross started_at..ended_at span', async () => {
    const sql = await migration();
    expect(sql).toContain('training_sessions_v2_paused_duration_bounds_check');
    expect(sql).toContain('paused_duration_seconds <= extract(epoch from (ended_at - started_at))');
  });

  it('does not touch RLS, grants, ownership or the immutability trigger', async () => {
    const sql = await migration();
    expect(sql).not.toMatch(/\b(grant|revoke)\b/);
    expect(sql).not.toContain('create policy');
    expect(sql).not.toContain('disable row level security');
    expect(sql).not.toMatch(/\b(create|drop|alter)\s+(function|trigger)\b/);
    expect(sql).not.toMatch(/\b(drop|truncate)\s+table\b/);
  });
});
