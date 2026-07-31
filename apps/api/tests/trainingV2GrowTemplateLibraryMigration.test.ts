import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { trainingV2SystemExerciseCatalogFixture } from './fixtures/trainingV2SystemExerciseCatalog.fixture.js';

const migrationUrl = new URL(
  '../../../supabase/migrations/20260730120000_training_v2_grow_template_library.sql',
  import.meta.url,
);

async function migration() {
  return readFile(migrationUrl, 'utf8');
}

function valuesBlock(sql: string, insertMarker: string) {
  const statementStart = sql.indexOf(insertMarker);
  const from = sql.indexOf('from (values', statementStart);
  const end = sql.indexOf(') as v(', from);
  return sql.slice(from, end);
}

function countRows(block: string) {
  return (block.match(/^\s*\(/gm) ?? []).length;
}

// Independent literal pin of the legacy PRESET_PLANS name/description order (see
// apps/mobile/features/tools/training/utils/trainingUtils.js) — duplicated here, not
// imported, so this test still catches accidental drift if the legacy source ever changes.
const LEGACY_TEMPLATE_ORDER = [
  ['Ganzkörper', '3x pro Woche – A/B im Wechsel'],
  ['Upper Lower', '4x pro Woche – Upper/Lower im Wechsel'],
  ['PPL', 'Push Pull Legs – 6x pro Woche'],
  ['Arnold Split', 'Brust/Rücken, Schultern/Arme, Beine – 6x pro Woche'],
  ['Torso Limbs', '4x pro Woche – Torso/Limbs im Wechsel'],
  ['Bro Split', '5x pro Woche – klassischer Muskelgruppen-Split'],
  ['PPL / Upper / Lower', '5x pro Woche – Push/Pull/Legs plus Upper/Lower'],
  ['Upper / Lower / Ganzkörper', '4x pro Woche – Upper/Lower plus Ganzkörper A/B'],
];

// The 20 legacy exercise names with no exact V2 system-exercise match — newly seeded here as
// (system_key, name) pairs, in declaration order.
const NEW_EXERCISE_SYSTEM_KEYS_AND_NAMES = [
  ['close_grip_lat_pulldown', 'Latzug eng'],
  ['shoulder_press', 'Schulterdrücken'],
  ['preacher_curl_machine', 'Preacher Curl Maschine'],
  ['triceps_pushdown', 'Trizeps Pushdowns'],
  ['calf_raise', 'Wadenheben'],
  ['ab_crunch_machine', 'Bauchmaschine'],
  ['incline_bench_press', 'Schrägbankdrücken'],
  ['t_bar_row', 'T-Bar Rows'],
  ['lateral_raise', 'Seitheben'],
  ['hammer_curl', 'Hammer Curls'],
  ['overhead_triceps_extension', 'Overhead Trizeps Extension'],
  ['back_extension_machine', 'Rückenstrecker Maschine'],
  ['shrug', 'Shrugs'],
  ['butterfly_fly', 'Butterfly'],
  ['mid_grip_row_machine', 'Rudermaschine mittlerer Griff'],
  ['medium_grip_row', 'Mittelbreites Rudern'],
  ['cable_fly', 'Kabel Flys'],
  ['cable_curl', 'Kabel Curls'],
  ['dip', 'Dips'],
  ['hip_thrust', 'Hip Thrust'],
];

// The remaining 5 of the 25 legacy display names already had an exact V2 system-exercise
// match before this migration, so they are referenced here only by their real, pre-existing
// id (see trainingV2SystemExerciseCatalog.fixture.ts) — never re-declared with a name.
const PRE_EXISTING_EXERCISE_IDS_AND_NAMES = [
  ['a20a0502-43b7-5c5c-8b5f-25b2c388365f', 'Brustpresse'],
  ['ceb0ef8b-7a92-53ec-a90c-23d9bd41ac34', 'Beinpresse'],
  ['666969a3-77c3-58b6-a4ab-8eefef42e431', 'Beinstrecker'],
  ['aabd760f-36e4-5e04-a54a-fd99c23bbc8f', 'Beinbeuger sitzend'],
  ['2514a37a-c71f-5c2b-b983-184a3f599ebc', 'Reverse Butterfly'],
];

describe('training V2 Grow template library migration', () => {
  it('seeds exactly 8 active Grow templates in the exact legacy PRESET_PLANS name/description order, inserted with no current revision yet', async () => {
    const sql = await migration();
    const block = valuesBlock(sql, 'insert into public.training_templates_v2');
    expect(countRows(block)).toBe(8);

    const rows = [...block.matchAll(/^\s*\('[0-9a-f-]{36}','([^']+)','([^']*)','active'/gm)];
    expect(rows).toHaveLength(8);
    expect(rows.map((row) => [row[1], row[2]])).toEqual(LEGACY_TEMPLATE_ORDER);

    // current_revision_id is inserted as a literal null and only ever backfilled by the
    // guarded update below — never set directly on insert.
    expect(sql).toContain(
      'select v.id::uuid, v.name, v.description, v.status, null, v.created_at, v.created_at',
    );
  });

  it('creates exactly one current revision per template via a backfill guarded to never touch an already-set row', async () => {
    const sql = await migration();
    expect(countRows(valuesBlock(sql, 'insert into public.training_template_revisions_v2'))).toBe(8);

    const updateStart = sql.indexOf('update public.training_templates_v2');
    expect(updateStart).toBeGreaterThan(-1);
    const updateBlock = sql.slice(updateStart, sql.indexOf(';', updateStart) + 1);
    expect(updateBlock).toContain('set current_revision_id = v.revision_id::uuid');
    expect(updateBlock).toContain('where t.id = v.template_id::uuid and t.current_revision_id is null');
    expect(updateBlock.match(/^\('[0-9a-f-]{36}','[0-9a-f-]{36}'\),?$/gm) ?? []).toHaveLength(8);
  });

  it('creates the exact legacy day/exercise/set structure: 26 units, 183 exercise occurrences and 382 target sets', async () => {
    const sql = await migration();
    expect(countRows(valuesBlock(sql, 'insert into public.training_template_units_v2'))).toBe(26);
    expect(countRows(valuesBlock(sql, 'insert into public.training_template_exercises_v2'))).toBe(183);
    expect(countRows(valuesBlock(sql, 'insert into public.training_template_target_sets_v2'))).toBe(382);
  });

  it('adds exactly the 20 new legacy exercises with their documented system_key/name pairs, and no more', async () => {
    const sql = await migration();
    const block = valuesBlock(sql, 'insert into public.training_exercises_v2');
    const rows = [...block.matchAll(/^\s*\('[0-9a-f-]{36}','([a-z0-9_]+)','([^']+)'/gm)];
    expect(rows).toHaveLength(20);
    expect(rows.map((row) => [row[1], row[2]])).toEqual(NEW_EXERCISE_SYSTEM_KEYS_AND_NAMES);
    // Every new row is a plain, ownerless, active system exercise — no scope/owner override.
    expect(block).not.toMatch(/'user'|'draft'/);
  });

  it('covers all 25 legacy display names — 20 newly seeded here plus 5 reused by their real, pre-existing system-exercise id — and every pre-existing id is actually referenced by an exercise occurrence', async () => {
    const sql = await migration();
    const newNames = NEW_EXERCISE_SYSTEM_KEYS_AND_NAMES.map(([, name]) => name);
    const preExistingNames = PRE_EXISTING_EXERCISE_IDS_AND_NAMES.map(([, name]) => name);
    expect(new Set([...newNames, ...preExistingNames]).size).toBe(25);

    const exercisesBlock = valuesBlock(sql, 'insert into public.training_template_exercises_v2');
    for (const [id, name] of PRE_EXISTING_EXERCISE_IDS_AND_NAMES) {
      const fixtureRow = trainingV2SystemExerciseCatalogFixture.find((row) => row.id === id);
      expect(fixtureRow?.name, `${id} must already exist in the system catalog as "${name}"`).toBe(name);
      expect(exercisesBlock).toContain(`'${id}'`);
    }
  });

  it('is a fully idempotent seed: every insert uses on conflict (id) do nothing and nothing else, with no upsert/update-on-conflict anywhere', async () => {
    const sql = await migration();
    const inserts = sql.match(/^insert into public\.\w+/gm) ?? [];
    const onConflictDoNothing = sql.match(/^on conflict \(id\) do nothing;$/gm) ?? [];
    expect(inserts).toHaveLength(6);
    expect(onConflictDoNothing).toHaveLength(6);
    expect(sql).not.toMatch(/on conflict[^;]*do update/i);
  });

  it('uses fixed, deterministic UUIDv5 literal ids throughout — no gen_random_uuid or other runtime id generation', async () => {
    const sql = await migration();
    expect(sql).toContain('UUIDv5 namespace: c4283e2a-b750-48c6-a890-71cede7c2d0b');
    expect(sql).not.toMatch(/gen_random_uuid|uuid_generate/i);
    const idLiterals = sql.match(/'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'/g) ?? [];
    expect(idLiterals.length).toBeGreaterThan(0);
  });

  it('does not use any forbidden extension, destructive DML/DDL, grants, RLS/policy changes or legacy table references', async () => {
    const sql = (await migration()).toLowerCase();
    expect(sql).not.toContain('create extension');
    expect(sql).not.toMatch(/\b(delete\s+from|truncate|drop\s+table|drop\s+column|alter\s+table)\b/);
    expect(sql).not.toContain('create policy');
    expect(sql).not.toContain('disable row level security');
    expect(sql).not.toMatch(/\b(grant|revoke)\b/);
    expect(sql).not.toMatch(/\b(route|fastify|endpoint|handler)\b/);
    expect(sql).not.toMatch(/\b(training_plans|training_days|training_exercises|training_sessions)\b(?!_v2)/);
  });
});
