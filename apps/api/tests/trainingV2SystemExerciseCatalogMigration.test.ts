import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { trainingV2SystemExerciseCatalogFixture } from './fixtures/trainingV2SystemExerciseCatalog.fixture.js';

const migrationUrl = new URL(
  '../../../supabase/migrations/20260726200000_training_v2_system_exercise_catalog.sql',
  import.meta.url,
);

async function migration() {
  return readFile(migrationUrl, 'utf8');
}

describe('training V2 system exercise catalog migration', () => {
  it('pins 90 unique expected keys and UUIDs in an independent literal fixture', () => {
    expect(trainingV2SystemExerciseCatalogFixture).toHaveLength(90);
    expect(new Set(
      trainingV2SystemExerciseCatalogFixture.map((exercise) => exercise.systemKey),
    ).size).toBe(90);
    expect(new Set(
      trainingV2SystemExerciseCatalogFixture.map((exercise) => exercise.id),
    ).size).toBe(90);
  });

  it('contains the complete fixed V1 catalog and documented UUIDv5 strategy', async () => {
    const sql = await migration();
    const rows = sql.match(/^\s*\('[0-9a-f-]{36}','[a-z0-9_]+'/gm) ?? [];

    expect(rows).toHaveLength(90);
    expect((sql.match(/,'strength',/g) ?? [])).toHaveLength(70);
    expect((sql.match(/,'cardio',/g) ?? [])).toHaveLength(6);
    expect((sql.match(/,'mobility',/g) ?? [])).toHaveLength(6);
    expect((sql.match(/,'stretching',/g) ?? [])).toHaveLength(8);
    expect(sql).toContain('UUIDv5 namespace: c4283e2a-b750-48c6-a890-71cede7c2d0b');
    expect(sql).toContain('exact UTF-8 system_key value');
    expect(sql).not.toMatch(/gen_random_uuid|uuid_generate|create extension/i);
    expect(sql).not.toContain('trainingV2SystemExerciseCatalogFixture');
  });

  it('is repeatable and protects immutable catalog identity', async () => {
    const sql = (await migration()).toLowerCase();

    expect(sql).toContain('create or replace function');
    expect(sql).toContain('create temporary table if not exists');
    expect(sql).toContain('on conflict (id) do update');
    expect(sql).toContain('is distinct from');
    expect(sql).toContain('version = training_exercises_v2.version + 1');
    expect(sql).toContain('system_key is already assigned to a different id');
    expect(sql).toContain('id is already assigned to a different system_key');
    expect(sql).toContain('expected identity is not an ownerless system exercise');
    expect(sql).not.toMatch(/set\s+(id|scope|owner_user_id|system_key)\s*=/);
  });

  it('limits canonical taxonomies to system exercises and reuses A1 array validation', async () => {
    const sql = (await migration()).toLowerCase();

    expect(sql).toContain('public.is_training_v2_clean_text_array(items)');
    expect(sql).toContain("scope <> 'system'");
    expect(sql).toContain('training_exercises_v2_system_main_muscle_check');
    expect(sql).toContain('training_exercises_v2_system_supporting_muscles_check');
    expect(sql).toContain('training_exercises_v2_system_equipment_taxonomy_check');
    expect(sql).toContain('immutable');
    expect(sql).toContain("set search_path = ''");
  });

  it('does not add APIs, alternatives, destructive DML, legacy access or client grants', async () => {
    const sql = (await migration()).toLowerCase();

    expect(sql).not.toMatch(/\bdelete\s+from\s+public\.training_exercises_v2\b/);
    expect(sql).not.toContain('training_exercise_alternatives_v2');
    expect(sql).not.toMatch(
      /\b(training_plans|training_days|training_exercises|training_sessions|training_session_exercises)\b(?!_v2)/,
    );
    expect(sql).not.toContain('create policy');
    expect(sql).not.toContain('disable row level security');
    expect(sql).not.toMatch(/grant\s+[^;]*\bon\s+table\b/);
    expect(sql).not.toMatch(/\b(route|fastify|endpoint|handler)\b/);
    expect(sql).not.toContain("scope = 'user'");
  });
});
