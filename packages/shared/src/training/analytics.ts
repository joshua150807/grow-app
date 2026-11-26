import { z } from 'zod';
import { loadTypeSchema } from './enums.js';
import { exerciseIdSchema, isoDateTimeSchema, nameSchema, sessionIdSchema } from './primitives.js';
import { isSetEligibleForPersonalRecord } from './domain.js';

const nonnegative = z.number().finite().nonnegative();
const count = nonnegative.int().safe();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'A valid calendar date is required.');
export const analyticsPeriodSchema = z.enum(['7', '30', '90', 'all']);
export const analyticsTimeZoneSchema = z.string().min(1).max(100).refine(value => {
  if (!/^[A-Za-z][A-Za-z0-9_+/-]*$/.test(value)) return false;
  try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; }
}, 'A supported IANA time zone is required.').transform(value => new Intl.DateTimeFormat('en', { timeZone: value }).resolvedOptions().timeZone);
export const trainingProgressQuerySchema = z.object({
  period: analyticsPeriodSchema.default('30'), timeZone: analyticsTimeZoneSchema.default('UTC'),
}).strict();
const page = z.preprocess(value => typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value,
  z.number().int().safe().min(0).max(1000000)).default(0);
export const trainingRecordsQuerySchema = z.object({
  search: z.string().trim().max(100).default(''), page,
}).strict();
export const trainingExerciseProgressQuerySchema = trainingProgressQuerySchema.extend({ page }).strict();
export const trainingAnalyticsExerciseParamsSchema = z.object({ exerciseId: exerciseIdSchema }).strict();
export type TrainingProgressQuery = z.infer<typeof trainingProgressQuerySchema>;
export type TrainingRecordsQuery = z.infer<typeof trainingRecordsQuerySchema>;
export type TrainingExerciseProgressQuery = z.infer<typeof trainingExerciseProgressQuerySchema>;

export const trainingPerformancePointSchema = z.object({
  sessionId: sessionIdSchema, date: isoDateTimeSchema, sessionName: nameSchema,
  // One database aggregate per recorded load, never fabricated individual sets.
  loads: z.array(z.object({ weightKg: nonnegative.nullable(), reps: count.positive(), volumeKg: nonnegative.nullable() }).strict()),
  volumeKg: nonnegative.nullable(), bestSetVolumeKg: nonnegative.nullable(),
}).strict();
export type TrainingPerformancePoint = z.infer<typeof trainingPerformancePointSchema>;
export const trainingRecordSchema = z.object({
  metric: z.enum(['load', 'reps', 'set_volume', 'session_volume']), value: nonnegative,
  weightKg: nonnegative.nullable(), sessionId: sessionIdSchema, date: isoDateTimeSchema,
  sessionName: nameSchema, ties: count,
}).strict();
export type TrainingRecord = z.infer<typeof trainingRecordSchema>;
export const trainingExerciseRecordsSchema = z.object({
  exerciseId: exerciseIdSchema, name: nameSchema, loadType: loadTypeSchema,
  records: z.array(trainingRecordSchema), sessionCount: count,
}).strict();
const pagination = z.object({ page: count, limit: count.positive(), hasMore: z.boolean(), total: count }).strict();
export const trainingRecordsResponseSchema = z.object({
  exercises: z.array(trainingExerciseRecordsSchema), pagination,
}).strict();
export const trainingExerciseProgressResponseSchema = z.object({
  exercise: trainingExerciseRecordsSchema.nullable(), points: z.array(trainingPerformancePointSchema),
  pagination, period: analyticsPeriodSchema, timeZone: analyticsTimeZoneSchema,
}).strict();
export const trainingProgressBucketSchema = z.object({
  date: day, sessions: count, activeDays: count, measuredSessions: count,
  durationSeconds: nonnegative.nullable(), volumeKg: nonnegative.nullable(),
}).strict();
export type TrainingProgressBucket = z.infer<typeof trainingProgressBucketSchema>;
export const trainingProgressResponseSchema = z.object({
  period: analyticsPeriodSchema, timeZone: analyticsTimeZoneSchema, from: day, through: day,
  completedSessions: count, activeDays: count, measuredSessions: count, unmeasuredSessions: count,
  durationSeconds: nonnegative.nullable(), volumeKg: nonnegative.nullable(),
  weeks: z.array(trainingProgressBucketSchema), months: z.array(trainingProgressBucketSchema),
}).strict();

// Analytics intentionally narrows the older generic PR helper to completed sessions.
export function isTrainingAnalyticsSetEligible(input: Parameters<typeof isSetEligibleForPersonalRecord>[0]) {
  return input.sessionStatus === 'completed' && isSetEligibleForPersonalRecord(input);
}
export function trainingAnalyticsDay(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = (type: string) => parts.find(part => part.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function shiftTrainingDay(date: string, days: number): string {
  const result = new Date(`${date}T12:00:00Z`); result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}
export function trainingAnalyticsFrom(query: TrainingProgressQuery, now: Date): string | null {
  return query.period === 'all' ? null : shiftTrainingDay(trainingAnalyticsDay(now, query.timeZone), 1 - Number(query.period));
}
export function buildTrainingRecords(points: TrainingPerformancePoint[], loadType: z.infer<typeof loadTypeSchema>): TrainingRecord[] {
  // Unknown/no-weight-tracking conditions do not establish comparable performance.
  if (loadType === 'no_weight_tracking') return [];
  const records = new Map<string, TrainingRecord>();
  const offer = (metric: TrainingRecord['metric'], value: number | null, weightKg: number | null, point: TrainingPerformancePoint) => {
    if (value === null || !Number.isFinite(value) || value <= 0) return;
    const key = metric === 'reps' ? `${metric}:${weightKg}` : metric;
    const previous = records.get(key);
    if (!previous || value > previous.value) records.set(key, { metric, value, weightKg, sessionId: point.sessionId, date: point.date, sessionName: point.sessionName, ties: 0 });
    else if (value === previous.value && point.sessionId !== previous.sessionId) previous.ties += 1;
  };
  // Same order as before (date, then sessionId via localeCompare); timestamps are parsed once per
  // point instead of twice per comparison (Fixplan B7).
  const ordered = points.map((point) => ({ point, at: Date.parse(point.date) }))
    .sort((a, b) => a.at - b.at || a.point.sessionId.localeCompare(b.point.sessionId))
    .map(({ point }) => point);
  for (const point of ordered) {
    const loads = point.loads.filter(load => Number.isInteger(load.reps) && load.reps > 0
      && (loadType === 'bodyweight_only' || (load.weightKg !== null && Number.isFinite(load.weightKg) && load.weightKg >= 0)));
    for (const load of loads) {
      if (loadType !== 'bodyweight_only') offer('load', load.weightKg, load.weightKg, point);
      offer('reps', load.reps, loadType === 'bodyweight_only' ? null : load.weightKg, point);
    }
    if (loadType !== 'bodyweight_only' && loads.length) {
      offer('set_volume', point.bestSetVolumeKg, null, point);
      offer('session_volume', point.volumeKg, null, point);
    }
  }
  return [...records.values()];
}

export function buildTrainingProgress(days: TrainingProgressBucket[], query: TrainingProgressQuery, now: Date) {
  const through = trainingAnalyticsDay(now, query.timeZone);
  const from = trainingAnalyticsFrom(query, now) ?? days.map(value => value.date).sort()[0] ?? through;
  const filtered = days.filter(value => value.date >= from && value.date <= through);
  const sum = (values: TrainingProgressBucket[]) => ({
    sessions: values.reduce((n, value) => n + value.sessions, 0), activeDays: values.filter(value => value.sessions > 0).length,
    measuredSessions: values.reduce((n, value) => n + value.measuredSessions, 0),
    durationSeconds: values.some(value => value.durationSeconds !== null) ? values.reduce((n, value) => n + (value.durationSeconds ?? 0), 0) : null,
    volumeKg: values.some(value => value.volumeKg !== null) ? values.reduce((n, value) => n + (value.volumeKg ?? 0), 0) : null,
  });
  const bucketKey = (date: string, weekly: boolean) => weekly
    ? shiftTrainingDay(date, -((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7)) : `${date.slice(0, 7)}-01`;
  const buckets = (weekly: boolean) => {
    const keys = new Set<string>();
    for (let date = from; date <= through; date = shiftTrainingDay(date, 1)) keys.add(bucketKey(date, weekly));
    const groups = new Map<string, TrainingProgressBucket[]>();
    for (const value of filtered) { const key = bucketKey(value.date, weekly); groups.set(key, [...(groups.get(key) ?? []), value]); }
    return [...keys].map(date => ({ date, ...sum(groups.get(date) ?? []) }));
  };
  const total = sum(filtered);
  return { period: query.period, timeZone: query.timeZone, from, through,
    completedSessions: total.sessions, activeDays: total.activeDays, measuredSessions: total.measuredSessions,
    unmeasuredSessions: total.sessions - total.measuredSessions, durationSeconds: total.durationSeconds,
    volumeKg: total.volumeKg, weeks: buckets(true), months: buckets(false) };
}
