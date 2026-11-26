import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { createTrainingPlanRepository } from '../src/modules/trainingPlans/trainingPlanRepository.js';
import { createTrainingPlanService } from '../src/modules/trainingPlans/trainingPlanService.js';
import type { AuthTokenVerifier } from '../src/auth/types.js';

// Only an externally provisioned, NEW disposable database is accepted. No reset/drop/seed
// of an existing developer DB is supported. The runner must verify its own container ID.
function guardedUrl() {
  const raw = process.env.B11_TEST_DATABASE_URL;
  if (!raw || process.env.B11_ISOLATED_NEW_DATABASE !== 'true') throw Error('New isolated B11 database required');
  const url = new URL(raw);
  if (url.hostname !== '127.0.0.1' || !url.port || url.pathname !== '/grow_b11_replay'
    || raw === process.env.DATABASE_URL || raw === process.env.TEST_DATABASE_URL) throw Error('Unsafe B11 database');
  return raw;
}
const userA = randomUUID(); const userB = randomUUID();
const headers = { authorization: 'Bearer A' };
const verify: AuthTokenVerifier = async (token) => ['A', 'B'].includes(token)
  ? { id: token === 'A' ? userA : userB, email: null, role: 'authenticated' } : null;
const input = () => ({ idempotencyKey: randomUUID(), name: 'B11 plan', weeklyGoal: 3,
  units: [{ logicalUnitKey: randomUUID(), name: 'Rest', unitType: 'rest', orderIndex: 0, exercises: [] }] });

describe('B11 actual PostgreSQL create/replay', () => {
  let pool: Pool; let server: ReturnType<typeof buildApp>;
  const newServer = () => buildApp({ authTokenVerifier: verify, trainingPlanService: createTrainingPlanService(createTrainingPlanRepository(pool)) });
  beforeAll(async () => {
    pool = new Pool({ connectionString: guardedUrl(), max: 12 });
    // CREATE statements deliberately fail if this is an already initialized database.
    await pool.query(`create schema auth; create table auth.users(id uuid primary key);
      create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;`);
    for (const migration of [
      '20260726180000_training_v2_plan_core.sql', '20260726190000_training_v2_exercise_catalog_foundation.sql',
      '20260726210000_training_v2_activation_start_date.sql', '20260728210635_training_v2_template_provenance.sql',
      '20260729060000_training_v2_private_exercise_name_uniqueness.sql', '20260731130000_training_v2_plan_tombstones.sql',
      '20261123180000_training_v2_plan_create_replay.sql',
    ]) await pool.query(await readFile(new URL(`../../../supabase/migrations/${migration}`, import.meta.url), 'utf8'));
    await pool.query('insert into auth.users(id) values ($1),($2)', [userA, userB]);
    server = newServer();
  });
  afterAll(async () => { await server?.close(); await pool?.end(); });
  const post = (body: unknown, auth = headers) => server.inject({ method: 'POST', url: '/v1/training/plans', headers: auth, payload: body as Record<string, unknown> });
  const count = async (key: string) => Number((await pool.query(`select count(*) from public.training_plan_create_requests_v2 where user_id=$1 and idempotency_key=$2`, [userA, key])).rows[0].count);

  it('loses an already committed response, restarts the API and replays one plan/tree/goal', async () => {
    const body = input(); let firstId = '';
    await expect((async () => { const response = await post(body); expect(response.statusCode).toBe(201);
      firstId = response.json().plan.id; throw Error('transport lost after committed response'); })()).rejects.toThrow('transport lost');
    await server.close(); server = newServer();
    const replay = await post(structuredClone(body)); expect(replay.statusCode).toBe(201);
    expect(replay.json().plan.id).toBe(firstId);
    expect(await count(body.idempotencyKey)).toBe(1);
    for (const table of ['training_plan_revisions_v2', 'training_plan_units_v2', 'training_weekly_goal_versions_v2']) {
      expect(Number((await pool.query(`select count(*) from public.${table} where plan_id=$1 and user_id=$2`, [firstId, userA])).rows[0].count)).toBe(1);
    }
  });
  it('serializes ten parallel requests with the same key through the database constraint', async () => {
    const body = input(); const replies = await Promise.all(Array.from({ length: 10 }, () => post(body)));
    expect(replies.map((r) => r.statusCode)).toEqual(Array(10).fill(201));
    expect(new Set(replies.map((r) => r.json().plan.id)).size).toBe(1); expect(await count(body.idempotencyKey)).toBe(1);
  });
  it('rejects a concurrent changed payload as 409 without creating another plan', async () => {
    const body = input(); const replies = await Promise.all([post(body), post({ ...body, name: 'Different' })]);
    expect(replies.map((r) => r.statusCode).sort()).toEqual([201, 409]);
    expect(replies.find((r) => r.statusCode === 409)?.json().error.code).toBe('TRAINING_PLAN_CREATE_CONFLICT');
    expect(await count(body.idempotencyKey)).toBe(1);
  });
  it('allows new keys with identical content and scopes identical keys to separate accounts', async () => {
    const body = input(); const one = await post(body);
    const two = await post({ ...body, idempotencyKey: randomUUID() });
    const other = await post(body, { authorization: 'Bearer B' });
    expect([one, two, other].map((r) => r.statusCode)).toEqual([201, 201, 201]);
    expect(new Set([one, two, other].map((r) => r.json().plan.id)).size).toBe(3);
    const foreign = await server.inject({ method: 'GET', url: `/v1/training/plans/${one.json().plan.id}`, headers: { authorization: 'Bearer B' } });
    expect(foreign.statusCode).toBe(404);
  });
  it('rolls a reservation back with an unavailable exercise and permits a later valid retry', async () => {
    const missing = randomUUID(); const body = input();
    const strength = { ...body, units: [{ ...body.units[0], unitType: 'strength', exercises: [{
      exerciseId: missing, logicalTargetExerciseKey: randomUUID(), orderIndex: 0, note: null,
      targetSets: [{ logicalTargetSetKey: randomUUID(), orderIndex: 0, setType: 'work', targetWeightKg: null,
        targetReps: null, targetRir: null, plannedRestSeconds: 0, importedFromLegacyPlan: false }],
    }] }] };
    expect((await post(strength)).statusCode).toBe(400); expect(await count(body.idempotencyKey)).toBe(0);
    await pool.query(`insert into public.training_exercises_v2(id,scope,name,category,load_type,system_key)
      values ($1,'system','B11 exercise','strength','total_weight','b11_exercise')`, [missing]);
    expect((await post(strength)).statusCode).toBe(201); expect(await count(body.idempotencyKey)).toBe(1);
  });
  it('does not reactivate or recreate a plan when the old create is replayed after archive/delete', async () => {
    const body = { ...input(), activateImmediately: true };
    const first = await post(body); const firstId = first.json().plan.id;
    const second = await post({ ...input(), activateImmediately: true }); const secondId = second.json().plan.id;
    const replay = await post(body); expect(replay.json().plan.id).toBe(firstId); expect(replay.json().plan.status).toBe('archived');
    expect((await pool.query('select id from public.training_plans_v2 where user_id=$1 and status=\'active\'', [userA])).rows.map((r) => r.id)).toEqual([secondId]);
    expect((await server.inject({ method: 'DELETE', url: `/v1/training/plans/${firstId}`, headers })).statusCode).toBe(204);
    expect((await post(body)).statusCode).toBe(404); expect(await count(body.idempotencyKey)).toBe(1);
  });
  it('normalizes defaults and object-key ordering for the replay fingerprint', async () => {
    const body = input(); const first = await post(body);
    const replay = await post({ units: body.units, weeklyGoal: 3, name: ' B11 plan ', idempotencyKey: body.idempotencyKey, activateImmediately: false });
    expect(replay.statusCode).toBe(201); expect(replay.json().plan.id).toBe(first.json().plan.id);
  });
  it('keeps legacy requests valid, with no replay guarantee when they supply no key', async () => {
    const { idempotencyKey: _key, ...body } = input(); const first = await post(body); const second = await post(body);
    expect([first.statusCode, second.statusCode]).toEqual([201, 201]); expect(first.json().plan.id).not.toBe(second.json().plan.id);
  });
  it('denies direct authenticated access to the server-only request table', async () => {
    const client = await pool.connect();
    try { await client.query('begin'); await client.query('set local role authenticated');
      await expect(client.query('select * from public.training_plan_create_requests_v2')).rejects.toMatchObject({ code: '42501' });
    } finally { await client.query('rollback'); client.release(); }
  });
  it('enforces the deferred owner/plan FK at commit and leaves no partial reservation', async () => {
    const key = randomUUID(); const client = await pool.connect();
    try { await client.query('begin'); await client.query(`insert into public.training_plan_create_requests_v2
      (user_id,idempotency_key,request_fingerprint) values ($1,$2,$3)`, [userA, key, 'a'.repeat(64)]);
      await expect(client.query('commit')).rejects.toMatchObject({ code: '23503' });
    } finally { await client.query('rollback'); client.release(); }
    expect(await count(key)).toBe(0);
  });
  it('fails closed without the migration instead of retrying an unprotected create', async () => {
    const before = Number((await pool.query('select count(*) from public.training_plans_v2')).rows[0].count);
    await pool.query('alter table public.training_plan_create_requests_v2 rename to b11_requests_unavailable');
    try {
      expect((await post(input())).statusCode).toBe(500);
      expect(Number((await pool.query('select count(*) from public.training_plans_v2')).rows[0].count)).toBe(before);
    } finally { await pool.query('alter table public.b11_requests_unavailable rename to training_plan_create_requests_v2'); }
  });
});
