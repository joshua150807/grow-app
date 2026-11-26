import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  listTrainingSessionHistoryResponseSchema,
  listTrainingSessionsResponseSchema,
  trainingSessionHistoryResponseSchema,
  trainingSessionResponseSchema,
  trainingSessionStatsResponseSchema,
} from '@grow/shared';
import { buildApp } from '../src/app.js';
import { createTrainingSessionRepository } from '../src/modules/trainingSessions/trainingSessionRepository.js';
import { createTrainingSessionService } from '../src/modules/trainingSessions/trainingSessionService.js';

const localUrl = process.env.GROW_TRAINING_V2_TEST_DATABASE_URL;
const isolatedMarker = process.env.GROW_TRAINING_V2_TEST_MARKER;
const owner = randomUUID();
const otherOwner = randomUUID();
const tests = describe.skipIf(!localUrl);

function localConnectionString(value: string | undefined): string {
  if (!value) throw new Error('GROW_TRAINING_V2_TEST_DATABASE_URL is required.');
  const url = new URL(value);
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol)
    || url.hostname !== '127.0.0.1'
    || url.port !== (isolatedMarker ? '55439' : '54322')
    || url.pathname !== '/postgres'
    || url.search || url.hash
  ) throw new Error('Use the configured local Grow Supabase test port and postgres database.');
  if (isolatedMarker && !/^[a-f0-9]{32}$/.test(isolatedMarker)) throw new Error('Invalid test database marker.');
  return value;
}

const loadCases = [
  ['total_weight', 40],
  ['per_hand', 80],
  ['per_side', 80],
  ['added_weight_only', 40],
  ['bodyweight_only', 0],
  ['no_weight_tracking', 0],
] as const;

tests('Training V2 history on initialized local PostgreSQL', () => {
  let pool: Pool | undefined;
  let client: PoolClient | undefined;
  let server: ReturnType<typeof buildApp> | undefined;
  const sessionsByLoadType: { id: string; volume: number }[] = [];
  let untimedId: string;
  let foreignId: string;
  let transactionStarted = false;

  async function seedSession(db: PoolClient, userId: string, createdAt: string, timed: boolean) {
    const id = randomUUID();
    await db.query(
      `
      insert into public.training_sessions_v2
        (id,user_id,plan_name,revision_number,logical_unit_key,unit_name,unit_type,status,
         idempotency_key,request_fingerprint,started_at,ended_at,paused_duration_seconds,created_at)
      values ($1,$2,'Integration plan',1,$3,'Integration unit','strength','completed',
        $4,repeat('0',64),$5,$6,$7,$8)
    `,
      [id, userId, randomUUID(), randomUUID(), timed ? '2026-08-01T10:00:00Z' : null,
        timed ? '2026-08-01T10:01:30.500Z' : null, timed ? 10 : 0, createdAt],
    );
    return id;
  }

  beforeAll(async () => {
    pool = new Pool({ connectionString: localConnectionString(localUrl), connectionTimeoutMillis: 3000 });
    const db = await pool.connect();
    client = db;
    const baseline = await db.query<{ ready: boolean }>(`
      select to_regclass('auth.users') is not null
        and case when $1::text is null then
          to_regclass('public.profiles') is not null
          and to_regclass('public.todos') is not null
          and to_regclass('public.habits') is not null
          and to_regclass('public.habit_completions') is not null
        else coalesce(shobj_description(oid, 'pg_database') = ('grow-training-v2-test:' || $1), false)
        end
        and to_regclass('public.training_exercises_v2') is not null
        and to_regclass('public.training_session_exercises_v2') is not null
        and to_regclass('public.training_session_sets_v2') is not null
        and exists (
          select 1 from information_schema.columns
          where table_schema='public' and table_name='training_sessions_v2'
            and column_name='paused_duration_seconds'
        ) as ready
      from pg_catalog.pg_database where datname = current_database()
    `, [isolatedMarker ?? null]);
    if (!baseline.rows[0]?.ready) throw new Error('The selected local Grow baseline or isolated database marker and the Training V2 schema are required.');

    await db.query('begin');
    transactionStarted = true;
    await db.query('insert into auth.users(id) values ($1), ($2)', [owner, otherOwner]);
    untimedId = await seedSession(db, owner, '2026-08-01T09:00:00Z', false);
    foreignId = await seedSession(db, otherOwner, '2026-08-02T12:00:00Z', true);

    async function seedExercise(id: string, userId: string, loadType: typeof loadCases[number][0]) {
      const exerciseId = randomUUID();
      const sessionExerciseId = randomUUID();
      await db.query(`
      insert into public.training_exercises_v2
        (id,scope,owner_user_id,status,category,load_type,name)
      values ($1,'user',$2,'active','strength',$3,'History fixture ' || $3::text)
    `, [exerciseId, userId, loadType]);
      await db.query(`
      insert into public.training_session_exercises_v2
        (id,session_id,user_id,exercise_id,exercise_name,order_index)
      values ($1,$2,$3,$4,'History fixture',0)
    `, [sessionExerciseId, id, userId, exerciseId]);
      await db.query(`
      insert into public.training_session_sets_v2
        (session_exercise_id,session_id,user_id,client_set_id,order_index,set_type,weight_kg,reps,completed_at)
      values ($1,$2,$3,$4,0,'work',10,4,'2026-08-01T10:01:00Z'),
             ($1,$2,$3,$5,1,'work',null,4,'2026-08-01T10:01:00Z'),
             ($1,$2,$3,$6,2,'work',10,null,'2026-08-01T10:01:00Z')
    `, [sessionExerciseId, id, userId, randomUUID(), randomUUID(), randomUUID()]);
    }

    for (const [index, [loadType, volume]] of loadCases.entries()) {
      const id = await seedSession(db, owner, new Date(Date.UTC(2026, 7, 1, 11, index)).toISOString(), true);
      sessionsByLoadType.push({ id, volume });
      await seedExercise(id, owner, loadType);
    }
    await seedExercise(foreignId, otherOwner, 'total_weight');

    // All reads see the uncommitted fixtures. Forbid the repository's write transaction path.
    const repository = createTrainingSessionRepository({
      query: db.query.bind(db),
      connect: vi.fn(async () => { throw new Error('History integration only allows repository reads.'); }),
    });
    server = buildApp({
      authTokenVerifier: async (token) => (
        token === 'owner' || token === 'other'
          ? { id: token === 'owner' ? owner : otherOwner, email: null, role: 'authenticated' }
          : null
      ),
      trainingSessionService: createTrainingSessionService(repository),
    });
  });

  afterAll(async () => {
    try {
      await server?.close();
    } finally {
      try {
        if (transactionStarted) await client?.query('rollback');
      } finally {
        client?.release(true);
        await pool?.end();
      }
    }
  });

  async function get(url: string, token = 'owner') {
    if (!server) throw new Error('Local test server did not initialize.');
    return server.inject({ method: 'GET', url, headers: { authorization: 'Bearer ' + token } });
  }

  it('paginates the owner history newest first, including the untimed session', async () => {
    const expected = [...sessionsByLoadType].reverse().map(({ id }) => id).concat(untimedId);
    const allIds = [];
    for (let page = 0; page < 3; page += 1) {
      const response = await get('/v1/training/session-history?limit=3&page=' + page);
      expect(response.statusCode).toBe(200);
      const data = listTrainingSessionHistoryResponseSchema.parse(response.json());
      expect(data.pagination).toEqual({ page, limit: 3, hasMore: page < 2 });
      allIds.push(...data.sessions.map(({ id }) => id));
    }
    expect(allIds).toEqual(expected);
    const other = await get('/v1/training/session-history', 'other');
    expect(listTrainingSessionHistoryResponseSchema.parse(other.json()).sessions.map(({ id }) => id)).toEqual([foreignId]);
    const foreign = await get('/v1/training/session-history/' + foreignId);
    expect(foreign.statusCode).toBe(404);
    expect(foreign.json().error.code).toBe('TRAINING_SESSION_NOT_FOUND');
    expect((await get('/v1/training/sessions/' + foreignId)).statusCode).toBe(404);
  });

  it('agrees across list, detail and owner totals for all six load types and ignores unmeasured time', async () => {
    const response = await get('/v1/training/session-history');
    const list = listTrainingSessionHistoryResponseSchema.parse(response.json()).sessions;
    for (const { id, volume } of sessionsByLoadType) {
      expect(list.find((entry) => entry.id === id)).toMatchObject({ exerciseCount: 1, volumeKg: volume });
      const detail = await get('/v1/training/session-history/' + id);
      expect(trainingSessionHistoryResponseSchema.parse(detail.json()).session.volumeKg).toBe(volume);
    }
    const untimed = await get('/v1/training/session-history/' + untimedId);
    expect(trainingSessionHistoryResponseSchema.parse(untimed.json()).session).toMatchObject({
      startedAt: null, endedAt: null, pausedDurationSeconds: 0, exercises: [], volumeKg: 0,
    });
    const totals = await get('/v1/training/sessions/stats');
    expect(trainingSessionStatsResponseSchema.parse(totals.json())).toEqual({
      totalSessions: 7, totalDurationSeconds: 483, totalVolumeKg: 240,
    });
    const otherTotals = await get('/v1/training/sessions/stats', 'other');
    expect(trainingSessionStatsResponseSchema.parse(otherTotals.json())).toEqual({
      totalSessions: 1, totalDurationSeconds: 80.5, totalVolumeKg: 40,
    });
  });

  it('serves the original strict list and detail contracts from the same PostgreSQL rows', async () => {
    const list = await get('/v1/training/sessions');
    expect(list.statusCode).toBe(200);
    const legacy = listTrainingSessionsResponseSchema.parse(list.json());
    expect(legacy.sessions).toHaveLength(7);
    const detail = await get('/v1/training/sessions/' + sessionsByLoadType[0].id);
    expect(detail.statusCode).toBe(200);
    const { session } = trainingSessionResponseSchema.parse(detail.json());
    expect(session.exercises[0].sets).toHaveLength(3);
  });
});
