import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const migrationUrl = new URL(
  '../../../supabase/migrations/20260726190000_training_v2_exercise_catalog_foundation.sql',
  import.meta.url,
);

async function migration() {
  return (await readFile(migrationUrl, 'utf8')).toLowerCase();
}

describe('training V2 exercise catalog foundation migration', () => {
  it('rejects existing system rows before any A1 DDL', async () => {
    const sql = await migration();
    const guard = sql.indexOf("where scope = 'system'");
    const firstDdl = sql.indexOf('alter table public.training_exercises_v2');
    expect(guard).toBeGreaterThanOrEqual(0);
    expect(guard).toBeLessThan(firstDdl);
    expect(sql).toContain('authoritative system-key mapping');
    expect(sql).toContain("errcode = '55000'");
  });

  it('adds the catalog identity and equipment columns without exercise data', async () => {
    const sql = await migration();
    expect(sql).toContain('alter table public.training_exercises_v2');
    expect(sql).toContain('add column system_key text');
    expect(sql).toContain("add column equipment text[] not null default '{}'");
    expect(sql).not.toMatch(/\binsert\s+into\s+public\.training_exercises_v2\b/);
  });

  it('requires canonical system keys only for system exercises', async () => {
    const sql = await migration();
    expect(sql).toContain('training_exercises_v2_scope_system_key_check');
    expect(sql).toContain("scope = 'system' and system_key is not null");
    expect(sql).toContain("scope = 'user' and system_key is null");
    expect(sql).toContain('system_key = btrim(system_key)');
    expect(sql).toContain('char_length(system_key) between 1 and 120');
    expect(sql).toContain("^[a-z0-9]+(?:_[a-z0-9]+)*$");
    expect(sql).toContain('create unique index training_exercises_v2_system_key_idx');
    expect(sql).toContain("where scope = 'system'");
    expect(sql).not.toMatch(/unique\s*\(\s*name\s*\)/);
  });

  it('protects exercise identity while leaving mutable fields outside the trigger condition', async () => {
    const sql = await migration();
    expect(sql).toContain('function public.prevent_training_v2_exercise_identity_update()');
    expect(sql).toContain('new.id is distinct from old.id');
    expect(sql).toContain('new.scope is distinct from old.scope');
    expect(sql).toContain('new.owner_user_id is distinct from old.owner_user_id');
    expect(sql).toContain('new.system_key is distinct from old.system_key');
    expect(sql).toContain("errcode = '55000'");
    expect(sql).toContain('trigger training_exercises_v2_identity_immutable');
    expect(sql).not.toMatch(/new\.(name|status|category|equipment|version)\s+is\s+distinct/);
  });

  it('validates equipment arrays and creates only the justified indexes', async () => {
    const sql = await migration();
    expect(sql).toContain('function public.is_training_v2_clean_text_array(items text[])');
    expect(sql).toContain('count(*) = count(item)');
    expect(sql).toContain(
      "item = btrim(item, ' ' || chr(9) || chr(10) || chr(13) || chr(12) || chr(11))",
    );
    expect(sql).toContain("and item <> ''");
    expect(sql).toContain('count(*) = count(distinct item)');
    expect(sql).toContain('training_exercises_v2_equipment_check');
    expect(sql).toContain('training_exercises_v2_active_system_name_idx');
    expect(sql).toContain('training_exercises_v2_active_user_name_idx');
    expect(sql).toContain('training_exercises_v2_supporting_muscles_gin_idx');
    expect(sql).toContain('training_exercises_v2_equipment_gin_idx');
    expect(sql).not.toContain('pg_trgm');
  });

  it('does not weaken RLS or client grants and does not touch legacy training', async () => {
    const sql = await migration();
    expect(sql).not.toContain('disable row level security');
    expect(sql).not.toContain('create policy');
    expect(sql).not.toMatch(/grant\s+[^;]*\bon\s+table\b[^;]*\bto\s+(public|anon|authenticated)\b/);
    expect(sql).not.toMatch(/\b(training_plans|training_days|training_exercises|training_sessions|training_session_exercises)\b(?!_v2)/);
    expect(sql).toContain('from public, anon, authenticated');
  });
});
