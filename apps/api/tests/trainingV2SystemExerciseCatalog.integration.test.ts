import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import {
  systemExerciseEquipmentSchema,
  systemExerciseMuscleSchema,
} from '@grow/shared/src/training/enums.js';
import { trainingV2SystemExerciseCatalogFixture } from './fixtures/trainingV2SystemExerciseCatalog.fixture.js';

const expectedDatabaseName = 'grow_api_integration_test';
const expectedPort = '55432';
const namespace = 'c4283e2a-b750-48c6-a890-71cede7c2d0b';
const userId = '11111111-1111-4111-8111-111111111111';
const expectedCategoryCounts = {
  cardio: 6,
  mobility: 6,
  strength: 70,
  stretching: 8,
};
const tableNames = [
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

function guardedUrl(): string {
  const value = process.env.TEST_DATABASE_URL;
  if (!value || process.env.ALLOW_INTEGRATION_DB_RESET !== 'true') {
    throw new Error('Guarded local integration database configuration is required.');
  }
  const url = new URL(value);
  const database = decodeURIComponent(url.pathname.slice(1));
  if (url.hostname !== '127.0.0.1' || url.port !== expectedPort || database !== expectedDatabaseName) {
    throw new Error('Training V2 integration tests only allow the guarded local test database.');
  }
  if (process.env.DATABASE_URL && process.env.DATABASE_URL === value) {
    throw new Error('TEST_DATABASE_URL must not equal DATABASE_URL.');
  }
  return value;
}

function uuidBytes(value: string): Buffer {
  return Buffer.from(value.replaceAll('-', ''), 'hex');
}

function uuidV5(value: string): string {
  const hash = createHash('sha1')
    .update(uuidBytes(namespace))
    .update(Buffer.from(value, 'utf8'))
    .digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}

async function dropV2(pool: Pool) {
  await pool.query(`
    drop table if exists ${tableNames.map((name) => `public.${name}`).join(', ')} cascade;
    drop function if exists public.is_training_v2_system_muscle(text);
    drop function if exists public.is_training_v2_system_equipment(text);
    drop function if exists public.is_training_v2_system_muscle_array(text[]);
    drop function if exists public.is_training_v2_system_equipment_array(text[]);
    drop function if exists public.prevent_training_v2_exercise_identity_update();
    drop function if exists public.is_training_v2_clean_text_array(text[]);
    drop function if exists public.set_training_v2_updated_at();
    drop function if exists public.prevent_training_v2_revision_update();
  `);
}

describe('training V2 authoritative system exercise catalog PostgreSQL integration', () => {
  let pool: Pool;
  let coreSql: string;
  let foundationSql: string;
  let catalogSql: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: guardedUrl() });
    [coreSql, foundationSql, catalogSql] = await Promise.all([
      readFile(
        new URL('../../../supabase/migrations/20260726180000_training_v2_plan_core.sql', import.meta.url),
        'utf8',
      ),
      readFile(
        new URL(
          '../../../supabase/migrations/20260726190000_training_v2_exercise_catalog_foundation.sql',
          import.meta.url,
        ),
        'utf8',
      ),
      readFile(
        new URL(
          '../../../supabase/migrations/20260726200000_training_v2_system_exercise_catalog.sql',
          import.meta.url,
        ),
        'utf8',
      ),
    ]);
    await dropV2(pool);
    await pool.query(`
      create schema if not exists auth;
      do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
      do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
      do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
      drop table if exists auth.users cascade;
      create table auth.users (id uuid primary key);
      drop table if exists public.training_plans, public.training_days, public.training_exercises,
        public.training_sessions, public.training_session_exercises cascade;
      create table public.training_plans (legacy_marker integer);
      create table public.training_days (legacy_marker integer);
      create table public.training_exercises (legacy_marker integer);
      create table public.training_sessions (legacy_marker integer);
      create table public.training_session_exercises (legacy_marker integer);
      insert into public.training_plans values (1);
      insert into public.training_days values (2);
      insert into public.training_exercises values (3);
      insert into public.training_sessions values (4);
      insert into public.training_session_exercises values (5);
      grant usage on schema public to service_role;
    `);
  });

  beforeEach(async () => {
    await dropV2(pool);
    await pool.query('truncate auth.users cascade');
    await pool.query('insert into auth.users (id) values ($1)', [userId]);
    await pool.query(coreSql);
    await pool.query(foundationSql);
  });

  afterAll(async () => {
    if (!pool) return;
    try {
      await dropV2(pool);
      await pool.query(`
        drop table if exists public.training_plans, public.training_days, public.training_exercises,
          public.training_sessions, public.training_session_exercises;
        drop table if exists auth.users cascade;
      `);
    } finally {
      await pool.end();
    }
  });

  async function applyCatalog() {
    await pool.query(catalogSql);
  }

  async function createPlanReference(exerciseId: string) {
    const plan = await pool.query(
      `insert into public.training_plans_v2(user_id,name) values ($1,'Plan') returning id`,
      [userId],
    );
    const planId = String(plan.rows[0].id);
    const revision = await pool.query(`
      insert into public.training_plan_revisions_v2(plan_id,user_id,revision_number)
      values ($1,$2,1) returning id
    `, [planId, userId]);
    const revisionId = String(revision.rows[0].id);
    const unit = await pool.query(`
      insert into public.training_plan_units_v2
        (revision_id,plan_id,user_id,logical_unit_key,name,unit_type,order_index)
      values ($1,$2,$3,$4,'Strength','strength',0) returning id
    `, [revisionId, planId, userId, randomUUID()]);
    await pool.query(`
      insert into public.training_plan_exercises_v2
        (unit_id,revision_id,plan_id,user_id,exercise_id,exercise_scope,
         exercise_owner_user_id,logical_target_exercise_key,order_index)
      values ($1,$2,$3,$4,$5,'system',null,$6,0)
    `, [String(unit.rows[0].id), revisionId, planId, userId, exerciseId, randomUUID()]);
    return planId;
  }

  async function createTemplateReference(exerciseId: string) {
    const template = await pool.query(
      `insert into public.training_templates_v2(name,status)
       values ('Template','active') returning id`,
    );
    const templateId = String(template.rows[0].id);
    const revision = await pool.query(`
      insert into public.training_template_revisions_v2(template_id,revision_number)
      values ($1,1) returning id
    `, [templateId]);
    const revisionId = String(revision.rows[0].id);
    const unit = await pool.query(`
      insert into public.training_template_units_v2
        (revision_id,template_id,logical_unit_key,name,unit_type,order_index)
      values ($1,$2,$3,'Strength','strength',0) returning id
    `, [revisionId, templateId, randomUUID()]);
    await pool.query(`
      insert into public.training_template_exercises_v2
        (unit_id,revision_id,template_id,exercise_id,exercise_scope,
         exercise_owner_user_id,logical_target_exercise_key,order_index)
      values ($1,$2,$3,$4,'system',null,$5,0)
    `, [String(unit.rows[0].id), revisionId, templateId, exerciseId, randomUUID()]);
    return templateId;
  }

  async function expectOnlyConflictAndNoA2Objects(before: Record<string, unknown>) {
    const exercises = await pool.query(
      'select * from public.training_exercises_v2 order by id',
    );
    expect(exercises.rows).toEqual([before]);

    const constraints = await pool.query(`
      select conname
      from pg_constraint
      where conrelid='public.training_exercises_v2'::regclass
        and conname in (
          'training_exercises_v2_system_main_muscle_check',
          'training_exercises_v2_system_supporting_muscles_check',
          'training_exercises_v2_system_equipment_taxonomy_check'
        )
      order by conname
    `);
    expect(constraints.rows).toEqual([]);

    const functions = await pool.query(`
      select
        to_regprocedure('public.is_training_v2_system_muscle(text)') as muscle,
        to_regprocedure('public.is_training_v2_system_equipment(text)') as equipment,
        to_regprocedure('public.is_training_v2_system_muscle_array(text[])') as muscle_array,
        to_regprocedure('public.is_training_v2_system_equipment_array(text[])') as equipment_array
    `);
    expect(functions.rows[0]).toEqual({
      muscle: null,
      equipment: null,
      muscle_array: null,
      equipment_array: null,
    });
  }

  it('applies Core, A1 and A2 with the exact canonical 90-row catalog', async () => {
    await applyCatalog();
    const result = await pool.query(`
      select id,system_key,name,category,load_type,main_muscle,supporting_muscles,equipment,
        is_home,is_gym,is_bodyweight,difficulty,image_reference,execution_instructions,
        common_mistakes,safety_notes,status,scope,owner_user_id
      from public.training_exercises_v2
      order by system_key
    `);

    expect(result.rows).toHaveLength(90);
    expect(new Set(result.rows.map((row) => row.id)).size).toBe(90);
    expect(new Set(result.rows.map((row) => row.system_key)).size).toBe(90);
    expect(new Set(result.rows.map((row) => row.name)).size).toBe(90);
    const actualCatalog = result.rows.map((row) => ({
      id: row.id,
      systemKey: row.system_key,
      name: row.name,
      category: row.category,
      loadType: row.load_type,
      mainMuscle: row.main_muscle,
      supportingMuscles: row.supporting_muscles,
      equipment: row.equipment,
      isHome: row.is_home,
      isGym: row.is_gym,
      isBodyweight: row.is_bodyweight,
    }));
    const expectedCatalog = [...trainingV2SystemExerciseCatalogFixture]
      .sort((left, right) => left.systemKey.localeCompare(right.systemKey));
    expect(actualCatalog).toEqual(expectedCatalog);

    const counts = Object.fromEntries(
      Object.entries(expectedCategoryCounts).map(([category]) => [
        category,
        result.rows.filter((row) => row.category === category).length,
      ]),
    );
    expect(counts).toEqual(expectedCategoryCounts);

    for (const row of result.rows) {
      expect(row.id).toBe(uuidV5(row.system_key));
      expect(row.scope).toBe('system');
      expect(row.owner_user_id).toBeNull();
      expect(row.status).toBe('active');
      expect(row.is_home).toBeTypeOf('boolean');
      expect(row.is_gym).toBeTypeOf('boolean');
      expect(row.is_bodyweight).toBeTypeOf('boolean');
      expect(row.difficulty).toBeNull();
      expect(row.image_reference).toBeNull();
      expect(row.execution_instructions).toBeNull();
      expect(row.common_mistakes).toBeNull();
      expect(row.safety_notes).toBeNull();
      if (row.main_muscle !== null) {
        expect(systemExerciseMuscleSchema.safeParse(row.main_muscle).success).toBe(true);
      }
      for (const value of row.supporting_muscles) {
        expect(systemExerciseMuscleSchema.safeParse(value).success).toBe(true);
      }
      for (const value of row.equipment) {
        expect(systemExerciseEquipmentSchema.safeParse(value).success).toBe(true);
      }
    }
  });

  it('is idempotent, repairs mutable drift once and preserves plan and template references', async () => {
    await applyCatalog();
    const key = 'barbell_back_squat';
    const initial = await pool.query(
      'select id,system_key,name,version,updated_at from public.training_exercises_v2 where system_key=$1',
      [key],
    );
    const planId = await createPlanReference(String(initial.rows[0].id));
    const templateId = await createTemplateReference(String(initial.rows[0].id));

    await applyCatalog();
    const unchanged = await pool.query(
      'select id,system_key,name,version,updated_at from public.training_exercises_v2 where system_key=$1',
      [key],
    );
    expect(unchanged.rows[0]).toEqual(initial.rows[0]);
    expect((await pool.query(
      'select count(*)::int count from public.training_exercises_v2',
    )).rows[0].count).toBe(90);
    expect((await pool.query(
      'select exercise_id from public.training_template_exercises_v2 where template_id=$1',
      [templateId],
    )).rows[0].exercise_id).toBe(initial.rows[0].id);

    const drift = await pool.query(`
      update public.training_exercises_v2
      set name='Drift',status='archived',equipment=array['mat'],
        execution_instructions='Drift'
      where system_key=$1
      returning version,updated_at
    `, [key]);
    await pool.query('select pg_sleep(0.02)');
    await applyCatalog();
    const repaired = await pool.query(`
      select id,system_key,name,status,equipment,execution_instructions,version,updated_at
      from public.training_exercises_v2 where system_key=$1
    `, [key]);
    expect(repaired.rows[0]).toMatchObject({
      id: initial.rows[0].id,
      system_key: key,
      name: initial.rows[0].name,
      status: 'active',
      equipment: ['barbell', 'squat_rack'],
      execution_instructions: null,
      version: 2,
    });
    expect(repaired.rows[0].version).toBe(drift.rows[0].version + 1);
    expect(repaired.rows[0].updated_at.getTime())
      .toBeGreaterThan(drift.rows[0].updated_at.getTime());
    const repairedTimestamp = repaired.rows[0].updated_at;

    await applyCatalog();
    const stable = await pool.query(
      'select version,updated_at from public.training_exercises_v2 where system_key=$1',
      [key],
    );
    expect(stable.rows[0]).toEqual({ version: 2, updated_at: repairedTimestamp });
    expect((await pool.query(
      'select exercise_id from public.training_plan_exercises_v2 where plan_id=$1',
      [planId],
    )).rows[0].exercise_id).toBe(initial.rows[0].id);
    expect((await pool.query(
      'select exercise_id from public.training_template_exercises_v2 where template_id=$1',
      [templateId],
    )).rows[0].exercise_id).toBe(initial.rows[0].id);
  });

  it('rolls back every A2 object on a system-key-to-different-id conflict', async () => {
    await pool.query(`
      insert into public.training_exercises_v2
        (id,scope,owner_user_id,system_key,status,category,load_type,name)
      values ($1,'system',null,'barbell_back_squat','active','strength','total_weight','Conflict')
    `, [randomUUID()]);
    const before = (await pool.query(
      'select * from public.training_exercises_v2',
    )).rows[0];
    await expect(applyCatalog()).rejects.toMatchObject({
      code: '55000',
      message: expect.stringContaining('system_key is already assigned to a different id'),
    });
    await expectOnlyConflictAndNoA2Objects(before);
  });

  it('rolls back every A2 object on an id-to-different-system-key conflict', async () => {
    await pool.query(`
      insert into public.training_exercises_v2
        (id,scope,owner_user_id,system_key,status,category,load_type,name)
      values ($1,'system',null,'different_key','active','strength','total_weight','Conflict')
    `, [uuidV5('barbell_back_squat')]);
    const before = (await pool.query(
      'select * from public.training_exercises_v2',
    )).rows[0];
    await expect(applyCatalog()).rejects.toMatchObject({
      code: '55000',
      message: expect.stringContaining('id is already assigned to a different system_key'),
    });
    await expectOnlyConflictAndNoA2Objects(before);
  });

  it('does not alter a pre-existing user exercise or constrain its free taxonomy values', async () => {
    const id = randomUUID();
    await pool.query(`
      insert into public.training_exercises_v2
        (id,scope,owner_user_id,system_key,status,category,load_type,name,
         main_muscle,supporting_muscles,equipment)
      values ($1,'user',$2,null,'active','strength','total_weight','Private',
        'custom muscle',array['custom support'],array['custom equipment'])
    `, [id, userId]);
    const before = await pool.query(
      'select * from public.training_exercises_v2 where id=$1',
      [id],
    );

    await applyCatalog();

    const after = await pool.query(
      'select * from public.training_exercises_v2 where id=$1',
      [id],
    );
    expect(after.rows[0]).toEqual(before.rows[0]);
  });

  it('rejects noncanonical or structurally invalid system taxonomies', async () => {
    await applyCatalog();
    const id = uuidV5('barbell_back_squat');

    for (const [field, value] of [
      ['main_muscle', 'unknown'],
      ['supporting_muscles', ['unknown']],
      ['supporting_muscles', ['glutes', 'glutes']],
      ['supporting_muscles', ['glutes', null]],
      ['equipment', ['unknown']],
    ] as const) {
      await expect(
        pool.query(`update public.training_exercises_v2 set ${field}=$1 where id=$2`, [value, id]),
        `${field}:${String(value)}`,
      ).rejects.toMatchObject({ code: '23514' });
    }
  });

  it('preserves direct-access boundaries, service rights and all legacy markers', async () => {
    await applyCatalog();
    for (const role of ['authenticated', 'anon']) {
      const client = await pool.connect();
      try {
        await client.query(`set role ${role}`);
        await expect(client.query('select * from public.training_exercises_v2'))
          .rejects.toMatchObject({ code: '42501' });
      } finally {
        await client.query('reset role');
        client.release();
      }
    }

    const serviceClient = await pool.connect();
    try {
      await serviceClient.query('set role service_role');
      await expect(serviceClient.query(
        'select count(*)::int count from public.training_exercises_v2',
      )).resolves.toMatchObject({ rows: [{ count: 90 }] });
    } finally {
      await serviceClient.query('reset role');
      serviceClient.release();
    }

    const legacy = await pool.query(`
      select
        (select legacy_marker from public.training_plans) as plans,
        (select legacy_marker from public.training_days) as days,
        (select legacy_marker from public.training_exercises) as exercises,
        (select legacy_marker from public.training_sessions) as sessions,
        (select legacy_marker from public.training_session_exercises) as session_exercises
    `);
    expect(legacy.rows[0]).toEqual({
      plans: 1, days: 2, exercises: 3, sessions: 4, session_exercises: 5,
    });
  });
});
