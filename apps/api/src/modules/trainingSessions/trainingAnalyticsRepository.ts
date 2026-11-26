import type pg from 'pg';
import { z } from 'zod';
import { buildTrainingRecords, trainingProgressBucketSchema,
  type TrainingPerformancePoint, type TrainingRecordsQuery } from '@grow/shared/src/training/analytics.js';
import type { LoadType } from '@grow/shared/src/training/enums.js';
import { getPgPool } from '../../db/client.js';
import { measuredSessionDurationSql, plausibleSetSql, reliableTimingSql, setVolumeSql } from './trainingSessionRepository.js';

// Same load-type volume expression as History; analytics narrows to completed work.
const eligible = `s.set_type='work' and s.completed_at is not null and s.reps > 0 and ${plausibleSetSql}
  and (catalog.load_type='bodyweight_only' or (s.weight_kg >= 0 and catalog.load_type in ('total_weight','per_hand','per_side','added_weight_only')))`;
const joins = `from public.training_sessions_v2 t
  join public.training_session_exercises_v2 e on e.session_id=t.id and e.user_id=t.user_id
  join public.training_exercises_v2 catalog on catalog.id=e.exercise_id
  join public.training_session_sets_v2 s on s.session_exercise_id=e.id and s.session_id=t.id and s.user_id=t.user_id`;
type Db = Pick<pg.Pool, 'query'>;
function internal<T extends z.ZodTypeAny>(schema: T, value: unknown): z.output<T> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new Error('Internal training analytics storage contract violation.');
  return parsed.data;
}
export function createTrainingAnalyticsRepository(db: Db = getPgPool()) {
  async function pointsByExercise(userId: string, exerciseIds: string[]) {
    if (exerciseIds.length === 0) return new Map<string, TrainingPerformancePoint[]>();
    // date: epoch milliseconds as float8 instead of a timestamptz the pg driver would parse per
    // row (Fixplan B7 stage 2, profiled ~60 ms per records request at 10k sessions). new Date(ms)
    // truncates fractional milliseconds exactly like the driver's timestamp parsing did.
    // The trailing weight ordinal makes row order -- and so float summation order -- deterministic.
    const result = await db.query<{
      exercise_id: string; session_id: string; date: number | string | Date; session_name: string; weight_kg: string | null;
      reps: number; volume_kg: string | null; best_set_volume_kg: string | null;
    }>(`select e.exercise_id, t.id as session_id,
      (extract(epoch from coalesce(t.ended_at,t.created_at)) * 1000)::float8 as date, t.unit_name as session_name,
      case when catalog.load_type='bodyweight_only' then null else s.weight_kg end as weight_kg,
      max(s.reps) as reps, sum(${setVolumeSql}) as volume_kg, max(${setVolumeSql}) as best_set_volume_kg
      ${joins} where t.user_id=$1 and e.exercise_id=any($2::uuid[]) and t.status='completed' and ${eligible}
      group by e.exercise_id,t.id, case when catalog.load_type='bodyweight_only' then null else s.weight_kg end
      order by coalesce(t.ended_at,t.created_at),t.id,5`, [userId, exerciseIds]);
    // One pass over the rows, grouped per exercise -> per session (Fixplan B7, audit F02): the
    // previous per-exercise `filter(startsWith)` over every session entry was O(exercises x rows)
    // in Node. Insertion order (= SQL order by date, id) and all values are unchanged.
    const byExercise = new Map<string, Map<string, TrainingPerformancePoint>>();
    const numeric = (value: string | null) => value === null ? null : Number(value);
    // Weights have at most 3 decimals and reps are integers, so every exact volume has at most 3
    // decimals; rounding the running sum removes binary float noise (e.g. 3108.3999999999996),
    // which previously depended on row order and could flip record tie counts.
    const round3 = (value: number) => Math.round(value * 1000) / 1000;
    for (const row of result.rows) {
      let sessions = byExercise.get(row.exercise_id);
      if (!sessions) { sessions = new Map(); byExercise.set(row.exercise_id, sessions); }
      const existing = sessions.get(row.session_id) ?? { sessionId: row.session_id, date: new Date(row.date).toISOString(),
        sessionName: row.session_name, loads: [], volumeKg: null, bestSetVolumeKg: null };
      existing.loads.push({ weightKg: numeric(row.weight_kg), reps: Number(row.reps), volumeKg: numeric(row.volume_kg) });
      if (row.volume_kg !== null) existing.volumeKg = round3((existing.volumeKg ?? 0) + Number(row.volume_kg));
      if (row.best_set_volume_kg !== null) existing.bestSetVolumeKg = Math.max(existing.bestSetVolumeKg ?? 0, Number(row.best_set_volume_kg));
      sessions.set(row.session_id, existing);
    }
    const grouped = new Map<string, TrainingPerformancePoint[]>();
    // No per-point Zod parse any more (profiled ~130 ms per records request at 10k sessions): every
    // value here is computed from finite DB numbers above, buildTrainingRecords ignores non-finite
    // values, and both endpoints still validate their complete response against the shared
    // response schemas (records / exercise points) before anything leaves the service.
    for (const exerciseId of exerciseIds) grouped.set(exerciseId, [...(byExercise.get(exerciseId)?.values() ?? [])]
      .map((value) => ({ ...value, loads: value.loads.sort((a, b) => (b.weightKg ?? 0) - (a.weightKg ?? 0)) })));
    return grouped;
  }
  async function identity(userId: string, exerciseId: string) {
    const result = await db.query<{ exercise_id: string; name: string; load_type: LoadType }>(`
      select e.exercise_id, (array_agg(e.exercise_name order by coalesce(t.ended_at,t.created_at) desc,t.id desc))[1] as name,
        catalog.load_type ${joins}
      where t.user_id=$1 and e.exercise_id=$2 and t.status='completed' and ${eligible}
      group by e.exercise_id,catalog.load_type`, [userId, exerciseId]);
    return result.rows[0] ?? null;
  }
  return {
    async exercise(userId: string, exerciseId: string) {
      const found = await identity(userId, exerciseId);
      if (!found) return { exercise: null, points: [] };
      const data = (await pointsByExercise(userId, [exerciseId])).get(exerciseId) ?? [];
      return { exercise: { exerciseId, name: found.name, loadType: found.load_type,
        records: buildTrainingRecords(data, found.load_type), sessionCount: data.length }, points: data };
    },
    async records(userId: string, query: TrainingRecordsQuery) {
      const result = await db.query<{ exercise_id: string; name: string; load_type: LoadType; total: string }>(`
        select e.exercise_id, catalog.load_type,
          (array_agg(e.exercise_name order by coalesce(t.ended_at,t.created_at) desc,t.id desc))[1] as name,
          count(*) over() as total ${joins}
        where t.user_id=$1 and t.status='completed' and ${eligible} and catalog.load_type <> 'no_weight_tracking'
          and position(lower($2) in lower(e.exercise_name)) > 0
        group by e.exercise_id,catalog.load_type order by e.exercise_id limit 25 offset $3`, [userId, query.search, query.page * 25]);
      const grouped = await pointsByExercise(userId, result.rows.map(row => row.exercise_id));
      const exercises = result.rows.map(row => { const data = grouped.get(row.exercise_id) ?? []; return {
        exerciseId: row.exercise_id, name: row.name, loadType: row.load_type,
        records: buildTrainingRecords(data, row.load_type), sessionCount: data.length,
      }; });
      return { exercises, pagination: { page: query.page, limit: 25, hasMore: Number(result.rows[0]?.total ?? 0) > (query.page + 1) * 25, total: Number(result.rows[0]?.total ?? 0) } };
    },
    async days(userId: string, timeZone: string, from: string | null, now: Date) {
      const result = await db.query<{ date: string; sessions: string; measured_sessions: string; duration_seconds: string | null; volume_kg: string | null }>(`
        with volumes as (
          -- Same period filter as the outer query (Fixplan B7, audit F11): only the sessions that
          -- can appear in the result are aggregated, not the user's whole history.
          select t.id, sum(${setVolumeSql}) as volume_kg ${joins}
          where t.user_id=$1 and t.status='completed' and coalesce(t.ended_at,t.created_at) <= $4
            and ($3::date is null or (coalesce(t.ended_at,t.created_at) at time zone $2)::date >= $3::date)
          group by t.id
        )
        select to_char(coalesce(t.ended_at,t.created_at) at time zone $2,'YYYY-MM-DD') as date,
          count(*) as sessions, count(*) filter (where ${reliableTimingSql}) as measured_sessions,
          sum(${measuredSessionDurationSql}) as duration_seconds,
          sum(v.volume_kg) as volume_kg
        from public.training_sessions_v2 t left join volumes v on v.id=t.id
        where t.user_id=$1 and t.status='completed' and coalesce(t.ended_at,t.created_at) <= $4
          and ($3::date is null or (coalesce(t.ended_at,t.created_at) at time zone $2)::date >= $3::date)
        group by date order by date`, [userId, timeZone, from, now.toISOString()]);
      return result.rows.map(row => internal(trainingProgressBucketSchema, { date: row.date, sessions: Number(row.sessions), activeDays: 1,
        measuredSessions: Number(row.measured_sessions), durationSeconds: row.duration_seconds === null ? null : Number(row.duration_seconds),
        volumeKg: row.volume_kg === null ? null : Number(row.volume_kg) }));
    },
  };
}
export type TrainingAnalyticsRepository = ReturnType<typeof createTrainingAnalyticsRepository>;
