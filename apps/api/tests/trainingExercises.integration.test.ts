import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import {
  listTrainingExercisesResponseSchema,
  trainingExerciseDetailResponseSchema,
} from '@grow/shared/src/training/exercises.js';
import { buildApp } from '../src/app.js';
import type { AuthTokenVerifier } from '../src/auth/types.js';
import { createTrainingExerciseRepository } from '../src/modules/trainingExercises/trainingExerciseRepository.js';
import { createTrainingExerciseService } from '../src/modules/trainingExercises/trainingExerciseService.js';

const expectedDatabaseName = 'grow_api_integration_test';
const expectedPort = '55432';
const userA = '11111111-1111-4111-8111-111111111111';
const userB = '22222222-2222-4222-8222-222222222222';
const ownId = '33333333-3333-4333-8333-333333333333';
const foreignId = '44444444-4444-4444-8444-444444444444';
const archivedId = '55555555-5555-4555-8555-555555555555';
const percentId = '66666666-6666-4666-8666-666666666666';
const underscoreId = '77777777-7777-4777-8777-777777777777';
const escapeId = '99999999-9999-4999-8999-999999999999';
const verify: AuthTokenVerifier = async (token) => token === 'user-a'
  ? { id: userA, email: null, role: 'authenticated' }
  : token === 'user-b' ? { id: userB, email: null, role: 'authenticated' } : null;
const headersA = { authorization: 'Bearer user-a' };
const v2Tables = [
  'training_exercise_alternatives_v2', 'training_template_target_sets_v2',
  'training_template_exercises_v2', 'training_template_units_v2',
  'training_template_revisions_v2', 'training_templates_v2',
  'training_plan_cycle_states_v2', 'training_plan_activations_v2',
  'training_weekly_goal_versions_v2', 'training_plan_target_sets_v2',
  'training_plan_exercises_v2', 'training_plan_units_v2',
  'training_plan_revisions_v2', 'training_plans_v2', 'training_exercises_v2',
];

function guardedUrl(): string {
  const value = process.env.TEST_DATABASE_URL;
  if (!value || process.env.ALLOW_INTEGRATION_DB_RESET !== 'true') {
    throw new Error('Guarded local integration database configuration is required.');
  }
  const url = new URL(value);
  if (
    url.hostname !== '127.0.0.1'
    || url.port !== expectedPort
    || decodeURIComponent(url.pathname.slice(1)) !== expectedDatabaseName
  ) throw new Error('Training exercise integration tests only allow the guarded local database.');
  if (process.env.DATABASE_URL === value) throw new Error('TEST_DATABASE_URL must not equal DATABASE_URL.');
  return value;
}

async function dropSchema(pool: Pool) {
  await pool.query(`drop table if exists ${v2Tables.map((table) => `public.${table}`).join(',')} cascade`);
  await pool.query('drop function if exists public.is_training_v2_system_muscle(text) cascade');
  await pool.query('drop function if exists public.is_training_v2_system_equipment(text) cascade');
  await pool.query('drop function if exists public.is_training_v2_system_muscle_array(text[]) cascade');
  await pool.query('drop function if exists public.is_training_v2_system_equipment_array(text[]) cascade');
  await pool.query('drop function if exists public.is_training_v2_clean_text_array(text[]) cascade');
  await pool.query('drop function if exists public.prevent_training_v2_exercise_identity_update() cascade');
  await pool.query('drop function if exists public.prevent_training_v2_system_exercise_update() cascade');
  await pool.query('drop function if exists public.set_training_v2_updated_at() cascade');
  await pool.query('drop function if exists public.prevent_training_v2_revision_update() cascade');
}

describe('training exercise read API PostgreSQL integration', () => {
  let pool: Pool;
  let server: ReturnType<typeof buildApp>;
  let systemId: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: guardedUrl() });
    await dropSchema(pool);
    await pool.query(`
      create schema if not exists auth;
      do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
      do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
      do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
      drop table if exists auth.users cascade;
      create table auth.users(id uuid primary key);
    `);
    for (const migrationName of [
      '20260726180000_training_v2_plan_core.sql',
      '20260726190000_training_v2_exercise_catalog_foundation.sql',
      '20260726200000_training_v2_system_exercise_catalog.sql',
    ]) {
      const migration = await readFile(
        new URL(`../../../supabase/migrations/${migrationName}`, import.meta.url),
        'utf8',
      );
      await pool.query(migration);
    }
    systemId = String((await pool.query(`
      select id from public.training_exercises_v2
      where scope = 'system' order by lower(name),id limit 1
    `)).rows[0].id);
    await pool.query(`
      create table if not exists public.exercises_legacy_b1_marker(value text primary key);
      truncate public.exercises_legacy_b1_marker;
      insert into public.exercises_legacy_b1_marker values ('untouched');
    `);
    server = buildApp({
      authTokenVerifier: verify,
      trainingExerciseService: createTrainingExerciseService(createTrainingExerciseRepository(pool)),
    });
  });

  beforeEach(async () => {
    await pool.query(`delete from public.training_exercises_v2 where scope = 'user'`);
    await pool.query(`update public.training_exercises_v2 set status = 'active' where scope = 'system'`);
    await pool.query('delete from auth.users');
    await pool.query('insert into auth.users(id) values ($1),($2)', [userA, userB]);
    await pool.query(`
      insert into public.training_exercises_v2(
        id,scope,owner_user_id,status,category,load_type,name,main_muscle,
        supporting_muscles,difficulty,equipment,is_home,is_gym,is_bodyweight
      ) values
        ($1,'user',$7,'active','strength','per_hand','case name','custom_main',
          array['custom_support'],'custom',array['custom_band'],true,false,false),
        ($2,'user',$8,'active','strength','per_hand','Foreign Alpha','chest',
          array['triceps'],null,array['custom_band'],true,false,false),
        ($3,'user',$7,'archived','mobility','no_weight_tracking','Own Archived',null,
          array[]::text[],null,array[]::text[],true,true,true),
        ($4,'user',$7,'active','strength','total_weight','Case Name 50%','chest',
          array[]::text[],null,array['barbell'],false,true,false),
        ($5,'user',$7,'active','strength','total_weight','Own_Alpha','chest',
          array[]::text[],null,array['barbell'],false,true,false),
        ($6,'user',$7,'active','strength','total_weight','Slash\\Percent%Under_','chest',
          array[]::text[],null,array['barbell'],false,true,false)
    `, [ownId, foreignId, archivedId, percentId, underscoreId, escapeId, userA, userB]);
  });

  afterAll(async () => {
    if (server) await server.close();
    if (!pool) return;
    try {
      await pool.query('drop table if exists public.exercises_legacy_b1_marker');
      await dropSchema(pool);
      await pool.query('drop table if exists auth.users cascade');
    } finally {
      await pool.end();
    }
  });

  async function list(query = '') {
    return server.inject({
      method: 'GET',
      url: `/v1/training/exercises${query ? `?${query}` : ''}`,
      headers: headersA,
    });
  }

  it('returns the complete 90-row system catalog plus only the active exercise owned by the caller', async () => {
    const response = await list('limit=100');
    expect(response.statusCode).toBe(200);
    const body = listTrainingExercisesResponseSchema.parse(response.json());
    expect(body.exercises.filter((entry) => entry.scope === 'system')).toHaveLength(90);
    expect(body.exercises.filter((entry) => entry.scope === 'user').map((entry) => entry.id).sort())
      .toEqual([ownId, percentId, underscoreId, escapeId].sort());
    expect(body.exercises.some((entry) => entry.id === foreignId || entry.id === archivedId)).toBe(false);
    const expectedOrder = await pool.query(`
      select id from public.training_exercises_v2
      where status = 'active'
        and (
          (scope = 'system' and owner_user_id is null)
          or (scope = 'user' and owner_user_id = $1)
        )
      order by lower(name),id
    `, [userA]);
    expect(body.exercises.map(({ id }) => id))
      .toEqual(expectedOrder.rows.map((row) => String(row.id)));
    expect(body.pagination).toEqual({ page: 0, limit: 100, hasMore: false });
  });

  it('searches only names case-insensitively and treats percent and underscore literally', async () => {
    const start = listTrainingExercisesResponseSchema.parse((await list('search=case')).json());
    expect(start.exercises.map(({ id }) => id)).toEqual([ownId, percentId]);
    const middle = listTrainingExercisesResponseSchema.parse((await list('search=alpha')).json());
    expect(middle.exercises.map(({ id }) => id)).toEqual([underscoreId]);
    const caseInsensitive = listTrainingExercisesResponseSchema.parse((await list('search=CASE%20NAME')).json());
    expect(caseInsensitive.exercises.map(({ id }) => id)).toEqual([ownId, percentId]);
    const percent = listTrainingExercisesResponseSchema.parse((await list('search=%25')).json());
    expect(percent.exercises.map(({ id }) => id)).toEqual([percentId, escapeId]);
    const underscore = listTrainingExercisesResponseSchema.parse((await list('search=_')).json());
    expect(underscore.exercises.map(({ id }) => id)).toEqual([underscoreId, escapeId]);
    const escape = listTrainingExercisesResponseSchema.parse((await list('search=%5C')).json());
    expect(escape.exercises.map(({ id }) => id)).toEqual([escapeId]);
    const combinedLiterals = listTrainingExercisesResponseSchema.parse(
      (await list('search=%5CPercent%25Under_')).json(),
    );
    expect(combinedLiterals.exercises.map(({ id }) => id)).toEqual([escapeId]);
    const nonName = listTrainingExercisesResponseSchema.parse((await list('search=custom_band')).json());
    expect(nonName.exercises).toEqual([]);
  });

  it('combines category, load, muscle, equipment, environment and scope filters with AND', async () => {
    const response = await list(
      'category=strength&loadType=per_hand&muscle=custom_support'
      + '&equipment=custom_band&environment=home&scope=user',
    );
    const body = listTrainingExercisesResponseSchema.parse(response.json());
    expect(body.exercises.map(({ id }) => id)).toEqual([ownId]);

    const supporting = listTrainingExercisesResponseSchema.parse(
      (await list('scope=system&muscle=triceps&environment=gym&limit=100')).json(),
    );
    expect(supporting.exercises.length).toBeGreaterThan(0);
    expect(supporting.exercises.every((entry) => (
      entry.scope === 'system'
      && entry.isGym
      && (entry.mainMuscle === 'triceps' || entry.supportingMuscles.includes('triceps'))
    ))).toBe(true);
  });

  it('executes every list filter independently without admitting visible non-matches', async () => {
    const category = listTrainingExercisesResponseSchema.parse(
      (await list('category=cardio&limit=100')).json(),
    ).exercises;
    expect(category.length).toBeGreaterThan(0);
    expect(category.every((entry) => entry.category === 'cardio')).toBe(true);
    expect(category.some((entry) => entry.id === ownId)).toBe(false);

    const loadType = listTrainingExercisesResponseSchema.parse(
      (await list('loadType=per_hand&limit=100')).json(),
    ).exercises;
    expect(loadType.length).toBeGreaterThan(0);
    expect(loadType.every((entry) => entry.loadType === 'per_hand')).toBe(true);
    expect(loadType.some((entry) => entry.id === percentId)).toBe(false);

    const mainMuscle = listTrainingExercisesResponseSchema.parse(
      (await list('muscle=custom_main')).json(),
    ).exercises;
    expect(mainMuscle.map(({ id }) => id)).toEqual([ownId]);

    const supportingMuscle = listTrainingExercisesResponseSchema.parse(
      (await list('muscle=custom_support')).json(),
    ).exercises;
    expect(supportingMuscle.map(({ id }) => id)).toEqual([ownId]);

    const equipment = listTrainingExercisesResponseSchema.parse(
      (await list('equipment=custom_band')).json(),
    ).exercises;
    expect(equipment.map(({ id }) => id)).toEqual([ownId]);

    const home = listTrainingExercisesResponseSchema.parse(
      (await list('environment=home&scope=user')).json(),
    ).exercises;
    expect(home.map(({ id }) => id)).toEqual([ownId]);

    const gym = listTrainingExercisesResponseSchema.parse(
      (await list('environment=gym&scope=user')).json(),
    ).exercises;
    expect(gym.map(({ id }) => id)).toEqual([percentId, underscoreId, escapeId]);
    expect(gym.some((entry) => entry.id === ownId)).toBe(false);

    const system = listTrainingExercisesResponseSchema.parse(
      (await list('scope=system&limit=100')).json(),
    ).exercises;
    expect(system).toHaveLength(90);
    expect(system.every((entry) => entry.scope === 'system')).toBe(true);

    const owned = listTrainingExercisesResponseSchema.parse(
      (await list('scope=user&limit=100')).json(),
    ).exercises;
    expect(owned.map(({ id }) => id)).toEqual([ownId, percentId, underscoreId, escapeId]);
    expect(owned.some((entry) => entry.id === foreignId)).toBe(false);
  });

  it('paginates deterministically with limit plus one and no total count', async () => {
    const first = listTrainingExercisesResponseSchema.parse(
      (await list('scope=user&limit=2&page=0')).json(),
    );
    const second = listTrainingExercisesResponseSchema.parse(
      (await list('scope=user&limit=2&page=1')).json(),
    );
    expect(first.pagination).toEqual({ page: 0, limit: 2, hasMore: true });
    expect(second.pagination).toEqual({ page: 1, limit: 2, hasMore: false });
    expect([...first.exercises, ...second.exercises].map(({ id }) => id))
      .toEqual([ownId, percentId, underscoreId, escapeId]);
    expect(new Set([...first.exercises, ...second.exercises].map(({ id }) => id)).size).toBe(4);
  });

  it('returns system and owned details while foreign, inactive and absent IDs share one 404 contract', async () => {
    for (const id of [systemId, ownId]) {
      const response = await server.inject({
        method: 'GET', url: `/v1/training/exercises/${id}`, headers: headersA,
      });
      expect(response.statusCode).toBe(200);
      expect(trainingExerciseDetailResponseSchema.parse(response.json()).exercise.id).toBe(id);
    }
    await pool.query(
      `update public.training_exercises_v2 set status = 'unpublished' where id = $1`,
      [systemId],
    );
    const errors = [];
    for (const id of [
      foreignId, archivedId, systemId, '88888888-8888-4888-8888-888888888888',
    ]) {
      const response = await server.inject({
        method: 'GET', url: `/v1/training/exercises/${id}`, headers: headersA,
      });
      expect(response.statusCode).toBe(404);
      errors.push({
        code: response.json().error.code,
        message: response.json().error.message,
        details: response.json().error.details,
      });
    }
    expect(errors[1]).toEqual(errors[0]);
    expect(errors[2]).toEqual(errors[0]);
    expect(errors[3]).toEqual(errors[0]);
  });

  it('does not read or mutate legacy marker data', async () => {
    expect((await list('search=untouched')).json().exercises).toEqual([]);
    expect((await pool.query('select value from public.exercises_legacy_b1_marker')).rows)
      .toEqual([{ value: 'untouched' }]);
  });
});
