import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { buildApp } from '../src/app.js';
import type { AuthTokenVerifier } from '../src/auth/types.js';
import { createTrainingTemplateRepository } from '../src/modules/trainingTemplates/trainingTemplateRepository.js';
import { createTrainingTemplateService } from '../src/modules/trainingTemplates/trainingTemplateService.js';

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
      trainingTemplateService: createTrainingTemplateService(createTrainingTemplateRepository(pool)),
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
