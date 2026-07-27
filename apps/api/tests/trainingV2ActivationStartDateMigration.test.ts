import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const migrationUrl = new URL(
  '../../../supabase/migrations/20260726210000_training_v2_activation_start_date.sql',
  import.meta.url,
);

async function migration() {
  return (await readFile(migrationUrl, 'utf8')).toLowerCase();
}

describe('training V2 activation start-date migration', () => {
  it('adds and backfills only the local activation date', async () => {
    const sql = await migration();
    expect(sql).toContain('alter table public.training_plan_activations_v2');
    expect(sql).toContain('add column start_date date');
    expect(sql).toContain('(effective_at at time zone timezone)::date');
    expect(sql).not.toMatch(/set start_date\s*=[^;]+where status = 'pending'/s);
    expect(sql).not.toMatch(/\b(add|alter)\s+column\s+(effective_at|timezone)\b/);
  });

  it('guards invalid stored timezones before the backfill', async () => {
    const sql = await migration();
    expect(sql).toContain('pg_catalog.pg_timezone_names');
    expect(sql).toContain('invalid stored timezone');
    expect(sql).toContain("errcode = '22023'");
    expect(sql.indexOf('pg_catalog.pg_timezone_names'))
      .toBeLessThan(sql.indexOf('set start_date ='));
  });

  it('requires a local date for pending scheduling without reclassifying activations', async () => {
    const sql = await migration();
    expect(sql).toContain('training_plan_activations_v2_pending_start_date_check');
    expect(sql).toContain("status <> 'pending' or start_date is not null");
    expect(sql).not.toContain('add column activation_type');
    expect(sql).not.toContain('create type');
  });

  it('does not alter RLS, grants, ownership or legacy training data', async () => {
    const sql = await migration();
    expect(sql).not.toContain('disable row level security');
    expect(sql).not.toContain('create policy');
    expect(sql).not.toMatch(/\b(grant|revoke)\b/);
    expect(sql).not.toMatch(/\b(add|drop)\s+constraint\b[^;]*(owner|fkey)/);
    expect(sql).not.toMatch(/\b(training_plans|training_days|training_exercises|training_sessions)\b(?!_v2)/);
  });
});
