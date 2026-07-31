import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { buildApp } from '../src/app.js';
import type { AuthTokenVerifier } from '../src/auth/types.js';
import { createTrainingTemplateRepository } from '../src/modules/trainingTemplates/trainingTemplateRepository.js';
import { createTrainingTemplateSaveRepository } from '../src/modules/trainingTemplates/trainingTemplateSaveRepository.js';
import { createTrainingTemplateService } from '../src/modules/trainingTemplates/trainingTemplateService.js';
import { createTrainingPlanRepository } from '../src/modules/trainingPlans/trainingPlanRepository.js';
import { createTrainingPlanService } from '../src/modules/trainingPlans/trainingPlanService.js';

const expectedDatabaseName = 'grow_api_integration_test';
const expectedPort = '55432';
const userA = '11111111-1111-4111-8111-111111111111';
const userB = '22222222-2222-4222-8222-222222222222';
const verify: AuthTokenVerifier = async (token) => token === 'user-a'
  ? { id: userA, email: null, role: 'authenticated' }
  : token === 'user-b' ? { id: userB, email: null, role: 'authenticated' } : null;
const headersA = { authorization: 'Bearer user-a' };
const headersB = { authorization: 'Bearer user-b' };
const tables = [
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
  ) throw new Error('Training template integration tests only allow the guarded local database.');
  if (process.env.DATABASE_URL === value) throw new Error('TEST_DATABASE_URL must not equal DATABASE_URL.');
  return value;
}

async function dropSchema(pool: Pool) {
  await pool.query(`drop table if exists ${tables.map((table) => `public.${table}`).join(',')} cascade`);
  await pool.query('drop function if exists public.set_training_v2_updated_at()');
  await pool.query('drop function if exists public.prevent_training_v2_revision_update()');
}

describe('training template read API PostgreSQL integration', () => {
  let pool: Pool;
  let server: ReturnType<typeof buildApp>;
  let systemExercise: string;

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
    const coreMigration = await readFile(
      new URL('../../../supabase/migrations/20260726180000_training_v2_plan_core.sql', import.meta.url),
      'utf8',
    );
    await pool.query(coreMigration);
    const provenanceMigration = await readFile(
      new URL('../../../supabase/migrations/20260728210635_training_v2_template_provenance.sql', import.meta.url),
      'utf8',
    );
    await pool.query(provenanceMigration);
    server = buildApp({
      authTokenVerifier: verify,
      trainingTemplateService: createTrainingTemplateService(
        createTrainingTemplateRepository(pool),
        createTrainingTemplateSaveRepository(pool),
      ),
    });
  });

  beforeEach(async () => {
    await pool.query(`truncate ${tables.map((table) => `public.${table}`).join(',')} cascade`);
    await pool.query('truncate auth.users cascade');
    await pool.query('insert into auth.users(id) values ($1),($2)', [userA, userB]);
    const result = await pool.query(`
      insert into public.training_exercises_v2(scope,owner_user_id,status,category,load_type,name)
      values ('system',null,'active','strength','total_weight','Bench Press')
      returning id
    `);
    systemExercise = String(result.rows[0].id);
  });

  afterAll(async () => {
    if (server) await server.close();
    if (!pool) return;
    try {
      await dropSchema(pool);
      await pool.query('drop table if exists auth.users cascade');
    } finally {
      await pool.end();
    }
  });

  async function createTemplate(options: {
    status?: string;
    imageReference?: string | null;
    defaultWeeklyGoal?: number | null;
    twoUnits?: boolean;
  } = {}) {
    const templateResult = await pool.query(`
      insert into public.training_templates_v2(name,status,image_reference)
      values ($1,$2,$3) returning id
    `, ['Push Pull Legs', options.status ?? 'active', options.imageReference ?? null]);
    const templateId = String(templateResult.rows[0].id);

    const revisionResult = await pool.query(`
      insert into public.training_template_revisions_v2(template_id,revision_number,default_weekly_goal)
      values ($1,1,$2) returning id
    `, [templateId, options.defaultWeeklyGoal === undefined ? 4 : options.defaultWeeklyGoal]);
    const revisionId = String(revisionResult.rows[0].id);
    await pool.query(
      'update public.training_templates_v2 set current_revision_id=$1 where id=$2',
      [revisionId, templateId],
    );

    async function addUnit(name: string, orderIndex: number) {
      const unitResult = await pool.query(`
        insert into public.training_template_units_v2(revision_id,template_id,logical_unit_key,name,unit_type,order_index)
        values ($1,$2,$3,$4,'strength',$5) returning id
      `, [revisionId, templateId, randomUUID(), name, orderIndex]);
      const unitId = String(unitResult.rows[0].id);
      const exerciseResult = await pool.query(`
        insert into public.training_template_exercises_v2(
          unit_id,revision_id,template_id,exercise_id,logical_target_exercise_key,order_index,note
        ) values ($1,$2,$3,$4,$5,0,null) returning id
      `, [unitId, revisionId, templateId, systemExercise, randomUUID()]);
      const exerciseId = String(exerciseResult.rows[0].id);
      await pool.query(`
        insert into public.training_template_target_sets_v2(
          target_exercise_id,unit_id,revision_id,template_id,logical_target_set_key,order_index,
          set_type,target_weight_kg,target_reps_min,target_reps_max,target_rir,planned_rest_seconds
        ) values ($1,$2,$3,$4,$5,0,'work',60,8,10,2,90)
      `, [exerciseId, unitId, revisionId, templateId, randomUUID()]);
      return unitId;
    }

    await addUnit('Push', 0);
    if (options.twoUnits) await addUnit('Pull', 1);

    return templateId;
  }

  async function createTemplateWithoutRevision(status: string) {
    const templateResult = await pool.query(`
      insert into public.training_templates_v2(name,status) values ($1,$2) returning id
    `, ['No Revision Yet', status]);
    return String(templateResult.rows[0].id);
  }

  async function createUserPlan(
    userId: string,
    templateId: string,
    options: { status?: string; saved?: boolean } = {},
  ) {
    const result = await pool.query(`
      insert into public.training_plans_v2(user_id,name,status,source_template_id,saved_at)
      values ($1,'My copy',$2,$3,$4) returning id
    `, [
      userId, options.status ?? 'draft', templateId,
      options.saved ? new Date().toISOString() : null,
    ]);
    return String(result.rows[0].id);
  }

  it('lists only active templates, excluding archived and unpublished ones', async () => {
    const active = await createTemplate({ status: 'active' });
    await createTemplate({ status: 'archived' });
    await createTemplate({ status: 'unpublished' });
    const response = await server.inject({ method: 'GET', url: '/v1/training/templates', headers: headersA });
    expect(response.statusCode).toBe(200);
    const ids = response.json().templates.map((item: { template: { id: string } }) => item.template.id);
    expect(ids).toEqual([active]);
  });

  it('excludes an active template with no current revision from the list, but keeps normal active templates visible', async () => {
    const normalActive = await createTemplate({ status: 'active' });
    const activeWithoutRevision = await createTemplateWithoutRevision('active');
    const response = await server.inject({ method: 'GET', url: '/v1/training/templates', headers: headersA });
    expect(response.statusCode).toBe(200);
    const ids = response.json().templates.map((item: { template: { id: string } }) => item.template.id);
    expect(ids).toEqual([normalActive]);
    expect(ids).not.toContain(activeWithoutRevision);
  });

  it('returns 404 for the detail of an active template with no current revision', async () => {
    const activeWithoutRevision = await createTemplateWithoutRevision('active');
    const response = await server.inject({
      method: 'GET', url: `/v1/training/templates/${activeWithoutRevision}`, headers: headersA,
    });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('TRAINING_TEMPLATE_NOT_FOUND');
  });

  it('maps the full detail including defaultWeeklyGoal, imageReference and stable nested ordering', async () => {
    const templateId = await createTemplate({ imageReference: 'templates/ppl.png', defaultWeeklyGoal: 4, twoUnits: true });
    const response = await server.inject({
      method: 'GET', url: `/v1/training/templates/${templateId}`, headers: headersA,
    });
    expect(response.statusCode).toBe(200);
    const { template, userPlan } = response.json();
    expect(template.imageReference).toBe('templates/ppl.png');
    expect(template.revision.defaultWeeklyGoal).toBe(4);
    expect(template.revision.units.map((unit: { name: string }) => unit.name)).toEqual(['Push', 'Pull']);
    expect(template.revision.units[0].exercises).toHaveLength(1);
    expect(template.revision.units[0].exercises[0].targetSets).toHaveLength(1);
    expect(template.revision.units[0].exercises[0].targetSets[0]).toMatchObject({
      setType: 'work', targetWeightKg: 60, targetReps: { minimum: 8, maximum: 10 }, targetRir: 2,
      plannedRestSeconds: 90,
    });
    expect(userPlan).toEqual({ isSaved: false, isActive: false, userPlanId: null });
  });

  it('returns null userPlanId when the user has no instance of the template', async () => {
    const templateId = await createTemplate();
    const response = await server.inject({
      method: 'GET', url: `/v1/training/templates/${templateId}`, headers: headersA,
    });
    expect(response.json().userPlan).toEqual({ isSaved: false, isActive: false, userPlanId: null });
  });

  it('reports saved, not active for a draft instance with saved_at set', async () => {
    const templateId = await createTemplate();
    const planId = await createUserPlan(userA, templateId, { status: 'draft', saved: true });
    const response = await server.inject({
      method: 'GET', url: `/v1/training/templates/${templateId}`, headers: headersA,
    });
    expect(response.json().userPlan).toEqual({ isSaved: true, isActive: false, userPlanId: planId });
  });

  it('reports active and saved for an active instance with saved_at set', async () => {
    const templateId = await createTemplate();
    const planId = await createUserPlan(userA, templateId, { status: 'active', saved: true });
    const response = await server.inject({
      method: 'GET', url: `/v1/training/templates/${templateId}`, headers: headersA,
    });
    expect(response.json().userPlan).toEqual({ isSaved: true, isActive: true, userPlanId: planId });
  });

  it('reports active but not saved for an active instance with saved_at null', async () => {
    const templateId = await createTemplate();
    const planId = await createUserPlan(userA, templateId, { status: 'active', saved: false });
    const response = await server.inject({
      method: 'GET', url: `/v1/training/templates/${templateId}`, headers: headersA,
    });
    expect(response.json().userPlan).toEqual({ isSaved: false, isActive: true, userPlanId: planId });
  });

  it('reports an existing unsaved and inactive instance with its userPlanId still present', async () => {
    const templateId = await createTemplate();
    const planId = await createUserPlan(userA, templateId, { status: 'draft', saved: false });
    const response = await server.inject({
      method: 'GET', url: `/v1/training/templates/${templateId}`, headers: headersA,
    });
    expect(response.json().userPlan).toEqual({ isSaved: false, isActive: false, userPlanId: planId });
  });

  it('isolates the user projection by authenticated owner', async () => {
    const templateId = await createTemplate();
    await createUserPlan(userB, templateId, { status: 'active', saved: true });
    const responseA = await server.inject({
      method: 'GET', url: `/v1/training/templates/${templateId}`, headers: headersA,
    });
    expect(responseA.json().userPlan).toEqual({ isSaved: false, isActive: false, userPlanId: null });
    const responseB = await server.inject({
      method: 'GET', url: `/v1/training/templates/${templateId}`, headers: headersB,
    });
    expect(responseB.json().userPlan.isSaved).toBe(true);
    expect(responseB.json().userPlan.isActive).toBe(true);
  });

  it('never associates a user\'s own plan (source_template_id null) with any template', async () => {
    const templateId = await createTemplate();
    await pool.query(`
      insert into public.training_plans_v2(user_id,name,status) values ($1,'Own plan','active')
    `, [userA]);
    const response = await server.inject({
      method: 'GET', url: `/v1/training/templates/${templateId}`, headers: headersA,
    });
    expect(response.json().userPlan).toEqual({ isSaved: false, isActive: false, userPlanId: null });
  });

  it('returns 404 for an unknown template id', async () => {
    const response = await server.inject({
      method: 'GET', url: `/v1/training/templates/${randomUUID()}`, headers: headersA,
    });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('TRAINING_TEMPLATE_NOT_FOUND');
  });

  it('returns 404 for an existing but archived template id, without leaking its existence', async () => {
    const templateId = await createTemplate({ status: 'archived' });
    const response = await server.inject({
      method: 'GET', url: `/v1/training/templates/${templateId}`, headers: headersA,
    });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('TRAINING_TEMPLATE_NOT_FOUND');
  });
});

describe('training template save/unsave/activate PostgreSQL integration', () => {
  let pool: Pool;
  let server: ReturnType<typeof buildApp>;
  let systemExercise: string;

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
    const coreMigration = await readFile(
      new URL('../../../supabase/migrations/20260726180000_training_v2_plan_core.sql', import.meta.url),
      'utf8',
    );
    await pool.query(coreMigration);
    const activationMigration = await readFile(
      new URL('../../../supabase/migrations/20260726210000_training_v2_activation_start_date.sql', import.meta.url),
      'utf8',
    );
    await pool.query(activationMigration);
    const provenanceMigration = await readFile(
      new URL('../../../supabase/migrations/20260728210635_training_v2_template_provenance.sql', import.meta.url),
      'utf8',
    );
    await pool.query(provenanceMigration);
    const tombstonesMigration = await readFile(
      new URL('../../../supabase/migrations/20260731130000_training_v2_plan_tombstones.sql', import.meta.url),
      'utf8',
    );
    await pool.query(tombstonesMigration);
    server = buildApp({
      authTokenVerifier: verify,
      trainingTemplateService: createTrainingTemplateService(
        createTrainingTemplateRepository(pool),
        createTrainingTemplateSaveRepository(pool),
      ),
      trainingPlanService: createTrainingPlanService(createTrainingPlanRepository(pool)),
    });
  });

  beforeEach(async () => {
    await pool.query(`truncate ${tables.map((table) => `public.${table}`).join(',')} cascade`);
    await pool.query('truncate auth.users cascade');
    await pool.query('insert into auth.users(id) values ($1),($2)', [userA, userB]);
    const result = await pool.query(`
      insert into public.training_exercises_v2(scope,owner_user_id,status,category,load_type,name)
      values ('system',null,'active','strength','total_weight','Bench Press')
      returning id
    `);
    systemExercise = String(result.rows[0].id);
  });

  afterAll(async () => {
    if (server) await server.close();
    if (!pool) return;
    try {
      await dropSchema(pool);
      await pool.query('drop table if exists auth.users cascade');
    } finally {
      await pool.end();
    }
  });

  async function createTemplate(options: {
    status?: string;
    imageReference?: string | null;
    defaultWeeklyGoal?: number | null;
  } = {}) {
    const templateResult = await pool.query(`
      insert into public.training_templates_v2(name,status,image_reference)
      values ($1,$2,$3) returning id
    `, ['Push Pull Legs', options.status ?? 'active', options.imageReference ?? 'templates/ppl.png']);
    const templateId = String(templateResult.rows[0].id);

    const revisionResult = await pool.query(`
      insert into public.training_template_revisions_v2(template_id,revision_number,default_weekly_goal)
      values ($1,1,$2) returning id
    `, [templateId, options.defaultWeeklyGoal === undefined ? 4 : options.defaultWeeklyGoal]);
    const revisionId = String(revisionResult.rows[0].id);
    await pool.query(
      'update public.training_templates_v2 set current_revision_id=$1 where id=$2',
      [revisionId, templateId],
    );

    const unitResult = await pool.query(`
      insert into public.training_template_units_v2(revision_id,template_id,logical_unit_key,name,unit_type,order_index)
      values ($1,$2,$3,'Push',$4,0) returning id
    `, [revisionId, templateId, randomUUID(), 'strength']);
    const unitId = String(unitResult.rows[0].id);
    const exerciseResult = await pool.query(`
      insert into public.training_template_exercises_v2(
        unit_id,revision_id,template_id,exercise_id,logical_target_exercise_key,order_index,note
      ) values ($1,$2,$3,$4,$5,0,null) returning id
    `, [unitId, revisionId, templateId, systemExercise, randomUUID()]);
    const exerciseId = String(exerciseResult.rows[0].id);
    await pool.query(`
      insert into public.training_template_target_sets_v2(
        target_exercise_id,unit_id,revision_id,template_id,logical_target_set_key,order_index,
        set_type,target_weight_kg,target_reps_min,target_reps_max,target_rir,planned_rest_seconds
      ) values ($1,$2,$3,$4,$5,0,'work',60,8,10,2,90)
    `, [exerciseId, unitId, revisionId, templateId, randomUUID()]);

    return { templateId, revisionId };
  }

  async function createTemplateWithoutRevision(status: string) {
    const templateResult = await pool.query(`
      insert into public.training_templates_v2(name,status) values ($1,$2) returning id
    `, ['No Revision Yet', status]);
    return String(templateResult.rows[0].id);
  }

  async function planCount() {
    return Number((await pool.query('select count(*)::int count from public.training_plans_v2')).rows[0].count);
  }

  async function weeklyGoalVersionCount(planId: string) {
    return Number((await pool.query(
      'select count(*)::int count from public.training_weekly_goal_versions_v2 where plan_id=$1', [planId],
    )).rows[0].count);
  }

  async function planRow(planId: string) {
    const result = await pool.query(
      'select status,version,saved_at,current_revision_id from public.training_plans_v2 where id=$1', [planId],
    );
    return result.rows[0];
  }

  it('save is idempotent: a second save neither bumps version nor creates a second instance', async () => {
    const { templateId } = await createTemplate();
    const first = await server.inject({
      method: 'PUT', url: `/v1/training/templates/${templateId}/save`, headers: headersA,
    });
    expect(first.statusCode).toBe(200);
    const { userPlanId } = first.json().userPlan;
    expect(first.json().userPlan).toEqual({ isSaved: true, isActive: false, userPlanId });
    const rowAfterFirst = await planRow(userPlanId);
    expect(rowAfterFirst.version).toBe(2);

    const second = await server.inject({
      method: 'PUT', url: `/v1/training/templates/${templateId}/save`, headers: headersA,
    });
    expect(second.statusCode).toBe(200);
    expect(second.json().userPlan).toEqual({ isSaved: true, isActive: false, userPlanId });
    const rowAfterSecond = await planRow(userPlanId);
    expect(rowAfterSecond.version).toBe(2);
    expect(await planCount()).toBe(1);
  });

  it('unsave is idempotent and never deletes, archives or deactivates the instance', async () => {
    const { templateId } = await createTemplate();
    const saved = await server.inject({
      method: 'PUT', url: `/v1/training/templates/${templateId}/save`, headers: headersA,
    });
    const { userPlanId } = saved.json().userPlan;

    const first = await server.inject({
      method: 'DELETE', url: `/v1/training/templates/${templateId}/save`, headers: headersA,
    });
    expect(first.statusCode).toBe(200);
    expect(first.json().userPlan).toEqual({ isSaved: false, isActive: false, userPlanId });
    const rowAfterFirst = await planRow(userPlanId);
    expect(rowAfterFirst.status).toBe('draft');
    expect(rowAfterFirst.saved_at).toBeNull();
    expect(rowAfterFirst.version).toBe(3);

    const second = await server.inject({
      method: 'DELETE', url: `/v1/training/templates/${templateId}/save`, headers: headersA,
    });
    expect(second.statusCode).toBe(200);
    expect(second.json().userPlan).toEqual({ isSaved: false, isActive: false, userPlanId });
    const rowAfterSecond = await planRow(userPlanId);
    expect(rowAfterSecond.version).toBe(3);
    expect(await planCount()).toBe(1);
  });

  it('unsave without any instance returns an idempotent 200 for an active, revision-capable template and creates no plan row', async () => {
    const { templateId } = await createTemplate();
    const response = await server.inject({
      method: 'DELETE', url: `/v1/training/templates/${templateId}/save`, headers: headersA,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ userPlan: { userPlanId: null, isSaved: false, isActive: false } });
    expect(await planCount()).toBe(0);
  });

  it.each(['unknown', 'archived', 'unpublished', 'no-revision'] as const)(
    'unsave without any instance returns 404 for a(n) %s template and creates no plan row',
    async (kind) => {
      const templateId = kind === 'unknown'
        ? randomUUID()
        : kind === 'no-revision'
          ? await createTemplateWithoutRevision('active')
          : (await createTemplate({ status: kind })).templateId;
      const response = await server.inject({
        method: 'DELETE', url: `/v1/training/templates/${templateId}/save`, headers: headersA,
      });
      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe('TRAINING_TEMPLATE_NOT_FOUND');
      expect(await planCount()).toBe(0);
    },
  );

  it('activate is idempotent: reactivating an already-active instance neither bumps version nor resets the cycle', async () => {
    const { templateId } = await createTemplate();
    const activated = await server.inject({
      method: 'POST', url: `/v1/training/templates/${templateId}/activate`, headers: headersA,
    });
    expect(activated.statusCode).toBe(200);
    const { userPlanId } = activated.json().userPlan;
    expect(activated.json().userPlan).toEqual({ isSaved: false, isActive: true, userPlanId });
    const rowAfterFirst = await planRow(userPlanId);
    expect(rowAfterFirst.status).toBe('active');
    expect(rowAfterFirst.saved_at).toBeNull();

    const cycleBefore = await pool.query(
      'select version,advanced_at from public.training_plan_cycle_states_v2 where plan_id=$1', [userPlanId],
    );

    const second = await server.inject({
      method: 'POST', url: `/v1/training/templates/${templateId}/activate`, headers: headersA,
    });
    expect(second.statusCode).toBe(200);
    expect(second.json().userPlan).toEqual({ isSaved: false, isActive: true, userPlanId });
    const rowAfterSecond = await planRow(userPlanId);
    expect(rowAfterSecond.version).toBe(rowAfterFirst.version);
    expect(rowAfterSecond.saved_at).toBeNull();
    const cycleAfter = await pool.query(
      'select version,advanced_at from public.training_plan_cycle_states_v2 where plan_id=$1', [userPlanId],
    );
    expect(cycleAfter.rows[0]).toEqual(cycleBefore.rows[0]);
    expect(await planCount()).toBe(1);
  });

  it('activate never changes saved_at, and save never activates', async () => {
    const { templateId } = await createTemplate();
    const activated = await server.inject({
      method: 'POST', url: `/v1/training/templates/${templateId}/activate`, headers: headersA,
    });
    const { userPlanId } = activated.json().userPlan;
    expect((await planRow(userPlanId)).saved_at).toBeNull();

    const saved = await server.inject({
      method: 'PUT', url: `/v1/training/templates/${templateId}/save`, headers: headersA,
    });
    expect(saved.json().userPlan).toEqual({ isSaved: true, isActive: true, userPlanId });
    expect((await planRow(userPlanId)).status).toBe('active');

    const secondTemplate = await createTemplate();
    const savedOnly = await server.inject({
      method: 'PUT', url: `/v1/training/templates/${secondTemplate.templateId}/save`, headers: headersA,
    });
    expect(savedOnly.json().userPlan.isActive).toBe(false);
    expect((await planRow(savedOnly.json().userPlan.userPlanId)).status).toBe('draft');
  });

  it('reactivates an archived instance with the same planId and current revision, without a new copy', async () => {
    const { templateId } = await createTemplate();
    const activated = await server.inject({
      method: 'POST', url: `/v1/training/templates/${templateId}/activate`, headers: headersA,
    });
    const { userPlanId } = activated.json().userPlan;
    const revisionBefore = (await planRow(userPlanId)).current_revision_id;

    // The plan-level API has no direct "archive my active plan" action — a plan can only leave
    // 'active' as the side effect of activating a different plan (see applyPlanActivation's
    // archive-old-active step, reused unchanged here). That's the only way to reach an archived
    // template-copy for this test.
    const competingPlan = await server.inject({
      method: 'POST', url: '/v1/training/plans', headers: headersA,
      payload: {
        name: 'Competing plan', weeklyGoal: 3, activateImmediately: true,
        units: [{ logicalUnitKey: randomUUID(), name: 'Rest', unitType: 'rest', orderIndex: 0, exercises: [] }],
      },
    });
    expect(competingPlan.statusCode).toBe(201);
    expect((await planRow(userPlanId)).status).toBe('archived');

    const reactivated = await server.inject({
      method: 'POST', url: `/v1/training/templates/${templateId}/activate`, headers: headersA,
    });
    expect(reactivated.statusCode).toBe(200);
    expect(reactivated.json().userPlan.userPlanId).toBe(userPlanId);
    expect(reactivated.json().userPlan.isActive).toBe(true);
    const rowAfter = await planRow(userPlanId);
    expect(rowAfter.status).toBe('active');
    expect(rowAfter.current_revision_id).toBe(revisionBefore);
    expect(await planCount()).toBe(2);
  });

  it('re-save after an edit reuses the existing instance and does not overwrite the user revision', async () => {
    const { templateId } = await createTemplate();
    const saved = await server.inject({
      method: 'PUT', url: `/v1/training/templates/${templateId}/save`, headers: headersA,
    });
    const { userPlanId } = saved.json().userPlan;

    const detailBefore = await server.inject({
      method: 'GET', url: `/v1/training/plans/${userPlanId}`, headers: headersA,
    });
    const originalUnits = detailBefore.json().plan.revision.units;
    expect(originalUnits).toHaveLength(1);
    const sourceTemplateRevisionId = detailBefore.json().plan.revision.sourceTemplateRevisionId;
    expect(sourceTemplateRevisionId).not.toBeNull();

    type PersistedUnit = {
      logicalUnitKey: string; name: string; unitType: string; orderIndex: number;
      exercises: Array<{
        logicalTargetExerciseKey: string; exerciseId: string; orderIndex: number; note: string | null;
        targetSets: Array<{
          logicalTargetSetKey: string; orderIndex: number; setType: string; targetWeightKg: number | null;
          targetReps: unknown; targetRir: number | null; plannedRestSeconds: number;
          importedFromLegacyPlan: boolean;
        }>;
      }>;
    };
    const patch = await server.inject({
      method: 'PATCH', url: `/v1/training/plans/${userPlanId}`, headers: headersA,
      payload: {
        name: 'My Edited Copy',
        expectedVersion: (await planRow(userPlanId)).version,
        units: [
          ...(originalUnits as PersistedUnit[]).map((unit) => ({
            logicalUnitKey: unit.logicalUnitKey, name: unit.name, unitType: unit.unitType, orderIndex: unit.orderIndex,
            exercises: unit.exercises.map((exercise) => ({
              logicalTargetExerciseKey: exercise.logicalTargetExerciseKey, exerciseId: exercise.exerciseId,
              orderIndex: exercise.orderIndex, note: exercise.note,
              targetSets: exercise.targetSets.map((set) => ({
                logicalTargetSetKey: set.logicalTargetSetKey, orderIndex: set.orderIndex, setType: set.setType,
                targetWeightKg: set.targetWeightKg, targetReps: set.targetReps, targetRir: set.targetRir,
                plannedRestSeconds: set.plannedRestSeconds, importedFromLegacyPlan: set.importedFromLegacyPlan,
              })),
            })),
          })),
          {
            logicalUnitKey: randomUUID(), name: 'Pull', unitType: 'rest', orderIndex: 1, exercises: [],
          },
        ],
      },
    });
    expect(patch.statusCode, JSON.stringify(patch.json())).toBe(200);
    expect(patch.json().plan.revision.units).toHaveLength(2);
    expect(patch.json().plan.revision.sourceTemplateRevisionId).toBe(sourceTemplateRevisionId);
    const revisionNumberAfterEdit = patch.json().plan.revision.revisionNumber;
    expect(revisionNumberAfterEdit).toBe(2);

    await server.inject({
      method: 'DELETE', url: `/v1/training/templates/${templateId}/save`, headers: headersA,
    });
    const resaved = await server.inject({
      method: 'PUT', url: `/v1/training/templates/${templateId}/save`, headers: headersA,
    });
    expect(resaved.json().userPlan.userPlanId).toBe(userPlanId);
    const detailAfter = await server.inject({
      method: 'GET', url: `/v1/training/plans/${userPlanId}`, headers: headersA,
    });
    expect(detailAfter.json().plan.revision.revisionNumber).toBe(revisionNumberAfterEdit);
    expect(detailAfter.json().plan.revision.units).toHaveLength(2);
    expect(detailAfter.json().plan.revision.sourceTemplateRevisionId).toBe(sourceTemplateRevisionId);
    expect(await planCount()).toBe(1);
  });

  it('two parallel first-time saves create exactly one complete instance', async () => {
    const { templateId } = await createTemplate();
    const [first, second] = await Promise.all([
      server.inject({ method: 'PUT', url: `/v1/training/templates/${templateId}/save`, headers: headersA }),
      server.inject({ method: 'PUT', url: `/v1/training/templates/${templateId}/save`, headers: headersA }),
    ]);
    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(first.json().userPlan.userPlanId).toBe(second.json().userPlan.userPlanId);
    expect(await planCount()).toBe(1);
    const row = await planRow(first.json().userPlan.userPlanId);
    expect(row.version).toBe(2);
    expect(row.saved_at).not.toBeNull();
    const detail = await server.inject({
      method: 'GET', url: `/v1/training/plans/${first.json().userPlan.userPlanId}`, headers: headersA,
    });
    expect(detail.json().plan.revision.units).toHaveLength(1);
  });

  it('a parallel save and activate for a brand-new instance converge on exactly one active, saved instance', async () => {
    const { templateId } = await createTemplate();
    const [saveResponse, activateResponse] = await Promise.all([
      server.inject({ method: 'PUT', url: `/v1/training/templates/${templateId}/save`, headers: headersA }),
      server.inject({ method: 'POST', url: `/v1/training/templates/${templateId}/activate`, headers: headersA }),
    ]);
    expect(saveResponse.statusCode).toBe(200);
    expect(activateResponse.statusCode).toBe(200);
    const planId = saveResponse.json().userPlan.userPlanId;
    expect(activateResponse.json().userPlan.userPlanId).toBe(planId);
    expect(await planCount()).toBe(1);
    const row = await planRow(planId);
    expect(row.status).toBe('active');
    expect(row.saved_at).not.toBeNull();
    expect(row.version).toBe(3);
  });

  it('two parallel first-time activates converge on exactly one instance with exactly one version bump and one cycle reset', async () => {
    const { templateId } = await createTemplate();
    const [first, second] = await Promise.all([
      server.inject({ method: 'POST', url: `/v1/training/templates/${templateId}/activate`, headers: headersA }),
      server.inject({ method: 'POST', url: `/v1/training/templates/${templateId}/activate`, headers: headersA }),
    ]);
    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    const planId = first.json().userPlan.userPlanId;
    expect(second.json().userPlan.userPlanId).toBe(planId);
    expect(first.json().userPlan).toEqual({ isSaved: false, isActive: true, userPlanId: planId });
    expect(second.json().userPlan).toEqual({ isSaved: false, isActive: true, userPlanId: planId });
    expect(await planCount()).toBe(1);

    const row = await planRow(planId);
    expect(row.status).toBe('active');
    expect(row.saved_at).toBeNull();
    // version 1 from creation, +1 for the single applyPlanActivation call the race winner makes —
    // the loser sees status='active' already and returns without a second activation.
    expect(row.version).toBe(2);

    const cycle = await pool.query(
      'select version from public.training_plan_cycle_states_v2 where plan_id=$1', [planId],
    );
    expect(cycle.rows[0].version).toBe(1);
  });

  it('leaves no plan row behind when the copy fails because a referenced exercise became unavailable', async () => {
    const { templateId } = await createTemplate();
    await pool.query(`update public.training_exercises_v2 set status='archived' where id=$1`, [systemExercise]);
    const response = await server.inject({
      method: 'PUT', url: `/v1/training/templates/${templateId}/save`, headers: headersA,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('TRAINING_EXERCISE_NOT_AVAILABLE');
    expect(await planCount()).toBe(0);
  });

  it('isolates save/unsave/activate by authenticated owner', async () => {
    const { templateId } = await createTemplate();
    const savedA = await server.inject({
      method: 'PUT', url: `/v1/training/templates/${templateId}/save`, headers: headersA,
    });
    const planIdA = savedA.json().userPlan.userPlanId;

    const projectionB = await server.inject({
      method: 'GET', url: `/v1/training/templates/${templateId}`, headers: headersB,
    });
    expect(projectionB.json().userPlan).toEqual({ isSaved: false, isActive: false, userPlanId: null });

    const activatedB = await server.inject({
      method: 'POST', url: `/v1/training/templates/${templateId}/activate`, headers: headersB,
    });
    expect(activatedB.json().userPlan.userPlanId).not.toBe(planIdA);
    expect(await planCount()).toBe(2);

    const foreignRead = await server.inject({
      method: 'GET', url: `/v1/training/plans/${planIdA}`, headers: headersB,
    });
    expect(foreignRead.statusCode).toBe(404);
  });

  it('keeps an active template copy usable after its template is later archived', async () => {
    const { templateId } = await createTemplate();
    const activated = await server.inject({
      method: 'POST', url: `/v1/training/templates/${templateId}/activate`, headers: headersA,
    });
    const { userPlanId } = activated.json().userPlan;

    await pool.query(`update public.training_templates_v2 set status='archived' where id=$1`, [templateId]);

    const resaved = await server.inject({
      method: 'PUT', url: `/v1/training/templates/${templateId}/save`, headers: headersA,
    });
    expect(resaved.statusCode).toBe(200);
    expect(resaved.json().userPlan.userPlanId).toBe(userPlanId);
    expect(resaved.json().userPlan.isSaved).toBe(true);

    const reactivated = await server.inject({
      method: 'POST', url: `/v1/training/templates/${templateId}/activate`, headers: headersA,
    });
    expect(reactivated.statusCode).toBe(200);
    expect(reactivated.json().userPlan.userPlanId).toBe(userPlanId);
  });

  it('still surfaces sourceTemplateImageReference on plan reads after the template is archived', async () => {
    const { templateId } = await createTemplate({ imageReference: 'templates/ppl.png' });
    const saved = await server.inject({
      method: 'PUT', url: `/v1/training/templates/${templateId}/save`, headers: headersA,
    });
    const { userPlanId } = saved.json().userPlan;

    await pool.query(`update public.training_templates_v2 set status='archived' where id=$1`, [templateId]);

    const detail = await server.inject({
      method: 'GET', url: `/v1/training/plans/${userPlanId}`, headers: headersA,
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().plan.sourceTemplateImageReference).toBe('templates/ppl.png');
    expect(detail.json().plan.sourceTemplateId).toBe(templateId);

    const list = await server.inject({ method: 'GET', url: '/v1/training/plans', headers: headersA });
    const summary = list.json().plans.find((plan: { id: string }) => plan.id === userPlanId);
    expect(summary.sourceTemplateImageReference).toBe('templates/ppl.png');
  });

  it.each(['save', 'activate'] as const)(
    'rejects a brand-new %s against an archived, unpublished or revision-less template',
    async (action) => {
      const archived = await createTemplate({ status: 'archived' });
      const unpublished = await createTemplate({ status: 'unpublished' });
      const noRevision = await createTemplateWithoutRevision('active');
      const method = action === 'save' ? 'PUT' : 'POST';
      const suffix = action === 'save' ? 'save' : 'activate';
      for (const templateId of [archived.templateId, unpublished.templateId, noRevision]) {
        const response = await server.inject({
          method, url: `/v1/training/templates/${templateId}/${suffix}`, headers: headersA,
        });
        expect(response.statusCode).toBe(404);
        expect(response.json().error.code).toBe('TRAINING_TEMPLATE_NOT_FOUND');
      }
      expect(await planCount()).toBe(0);
    },
  );

  it('plan reads surface real provenance, save and image fields after a save', async () => {
    const { templateId, revisionId } = await createTemplate({ imageReference: 'templates/ppl.png' });
    const saved = await server.inject({
      method: 'PUT', url: `/v1/training/templates/${templateId}/save`, headers: headersA,
    });
    const { userPlanId } = saved.json().userPlan;

    const list = await server.inject({ method: 'GET', url: '/v1/training/plans', headers: headersA });
    const summary = list.json().plans.find((plan: { id: string }) => plan.id === userPlanId);
    expect(summary.sourceTemplateId).toBe(templateId);
    expect(summary.savedAt).not.toBeNull();
    expect(summary.sourceTemplateImageReference).toBe('templates/ppl.png');

    const detail = await server.inject({ method: 'GET', url: `/v1/training/plans/${userPlanId}`, headers: headersA });
    expect(detail.json().plan.sourceTemplateId).toBe(templateId);
    expect(detail.json().plan.savedAt).not.toBeNull();
    expect(detail.json().plan.sourceTemplateImageReference).toBe('templates/ppl.png');
    expect(detail.json().plan.revision.sourceTemplateRevisionId).toBe(revisionId);
  });

  it('initializes the weekly goal version exactly once, from the template default', async () => {
    const { templateId } = await createTemplate({ defaultWeeklyGoal: 5 });
    const saved = await server.inject({
      method: 'PUT', url: `/v1/training/templates/${templateId}/save`, headers: headersA,
    });
    const { userPlanId } = saved.json().userPlan;
    expect(await weeklyGoalVersionCount(userPlanId)).toBe(1);
    const detail = await server.inject({ method: 'GET', url: `/v1/training/plans/${userPlanId}`, headers: headersA });
    expect(detail.json().plan.weeklyGoal).toBe(5);

    await server.inject({ method: 'DELETE', url: `/v1/training/templates/${templateId}/save`, headers: headersA });
    await server.inject({ method: 'PUT', url: `/v1/training/templates/${templateId}/save`, headers: headersA });
    expect(await weeklyGoalVersionCount(userPlanId)).toBe(1);
  });
});
