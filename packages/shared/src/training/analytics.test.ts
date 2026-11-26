import { describe, expect, it } from 'vitest';
import { buildTrainingProgress, buildTrainingRecords, isTrainingAnalyticsSetEligible, trainingAnalyticsDay, trainingAnalyticsFrom,
  trainingExerciseProgressResponseSchema, trainingProgressBucketSchema, trainingProgressQuerySchema, trainingRecordsQuerySchema, type TrainingPerformancePoint } from './analytics.js';
import { calculateSetVolumeKg } from './domain.js';
const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const point = (value: number, weight = 40, reps = 8, date = '2026-02-01T10:00:00Z'): TrainingPerformancePoint => ({ sessionId: id(value), sessionName: 'Unit', date,
  loads: [{ weightKg: weight, reps, volumeKg: weight * reps }], volumeKg: weight * reps * 3, bestSetVolumeKg: weight * reps });
describe('saved completed training analytics', () => {
  it('finds a new load and comparable repetitions, and resolves equal records to the earliest session deterministically', () => {
    const points = [point(3, 60, 8, '2026-02-03T10:00:00Z'), point(2, 60, 8), point(1, 40, 12)];
    const records = buildTrainingRecords(points, 'total_weight');
    expect(records.find(record => record.metric === 'load')).toMatchObject({ value: 60, sessionId: id(2), ties: 1 });
    expect(records.filter(record => record.metric === 'reps').map(record => [record.weightKg, record.value])).toEqual([[40, 12], [60, 8]]);
    expect(buildTrainingRecords([...points].reverse(), 'total_weight')).toEqual(records);
  });
  it('keeps repetition records at each load and improves only the matching condition', () => {
    const records = buildTrainingRecords([point(1, 40, 8), point(2, 60, 5), point(3, 40, 10)], 'added_weight_only');
    expect(records.filter(record => record.metric === 'reps')).toEqual(expect.arrayContaining([expect.objectContaining({ weightKg: 40, value: 10 }), expect.objectContaining({ weightKg: 60, value: 5 })]));
  });
  it('bodyweight produces repetitions only, never inferred kilograms, and no-weight tracking has no comparable records', () => {
    const data = [{ ...point(1), loads: [{ weightKg: null, reps: 15, volumeKg: null }], volumeKg: null, bestSetVolumeKg: null }];
    expect(buildTrainingRecords(data, 'bodyweight_only')).toEqual([expect.objectContaining({ metric: 'reps', value: 15, weightKg: null })]);
    expect(buildTrainingRecords(data, 'no_weight_tracking')).toEqual([]);
  });
  it.each(['total_weight', 'per_hand', 'per_side', 'added_weight_only', 'bodyweight_only', 'no_weight_tracking'] as const)('retains the existing volume semantics for %s', type => {
    expect(calculateSetVolumeKg(null, 8, type)).toBeNull(); expect(calculateSetVolumeKg(40, null, type)).toBeNull();
    expect(calculateSetVolumeKg(40, 8, type)).toBe(['bodyweight_only', 'no_weight_tracking'].includes(type) ? null : ['per_hand', 'per_side'].includes(type) ? 640 : 320);
  });
  it('does not merge different load types or create inferred 1RM values', () => {
    const own = buildTrainingRecords([point(1, 20)], 'per_hand');
    const other = buildTrainingRecords([point(2, 40)], 'total_weight');
    expect(own.find(record => record.metric === 'load')?.value).toBe(20);
    expect(other.find(record => record.metric === 'load')?.value).toBe(40);
    expect(own.every(record => ['load', 'reps', 'set_volume', 'session_volume'].includes(record.metric))).toBe(true);
  });
  it('excludes warmup, drop, unfinished sets and incomplete sessions without changing generic eligibility', () => {
    for (const setType of ['warmup', 'drop'] as const) expect(isTrainingAnalyticsSetEligible({ setType, completedAt: 'time', sessionStatus: 'completed' })).toBe(false);
    expect(isTrainingAnalyticsSetEligible({ setType: 'work', completedAt: null, sessionStatus: 'completed' })).toBe(false);
    expect(isTrainingAnalyticsSetEligible({ setType: 'work', completedAt: 'time', sessionStatus: 'incomplete' })).toBe(false);
    expect(isTrainingAnalyticsSetEligible({ setType: 'work', completedAt: 'time', sessionStatus: 'completed' })).toBe(true);
  });
  it('keeps missing measurement distinct from real zero duration and handles empty history', () => {
    const query = { period: '7' as const, timeZone: 'UTC' }, now = new Date('2026-03-02T12:00:00Z');
    expect(buildTrainingProgress([], query, now)).toMatchObject({ completedSessions: 0, durationSeconds: null, volumeKg: null });
    const unknown = { date: '2026-03-01', sessions: 1, activeDays: 1, measuredSessions: 0, durationSeconds: null, volumeKg: null };
    expect(buildTrainingProgress([unknown], query, now)).toMatchObject({ completedSessions: 1, unmeasuredSessions: 1, durationSeconds: null });
    expect(buildTrainingProgress([{ ...unknown, measuredSessions: 1, durationSeconds: 0 }], query, now).durationSeconds).toBe(0);
  });
  it('uses calendar days, Monday weeks and real month boundaries, filling only genuine zero frequency buckets', () => {
    const days = ['2026-01-31', '2026-02-01', '2026-02-02'].map(date => ({ date, sessions: 2, activeDays: 1, measuredSessions: 1, durationSeconds: 60, volumeKg: 100 }));
    const value = buildTrainingProgress(days, { period: '30', timeZone: 'Europe/Berlin' }, new Date('2026-02-02T12:00:00Z'));
    expect(value.completedSessions).toBe(6); expect(value.activeDays).toBe(3); expect(value.unmeasuredSessions).toBe(3);
    expect(value.months.map(bucket => bucket.sessions)).toEqual([2, 4]);
    expect(value.weeks.slice(-2).map(bucket => [bucket.date, bucket.sessions])).toEqual([['2026-01-26', 4], ['2026-02-02', 2]]);
  });
  it('handles DST and local midnight without fixed 24-hour window subtraction', () => {
    expect(trainingAnalyticsDay(new Date('2026-03-29T22:30:00Z'), 'Europe/Berlin')).toBe('2026-03-30');
    expect(trainingAnalyticsFrom({ period: '7', timeZone: 'Europe/Berlin' }, new Date('2026-03-29T22:30:00Z'))).toBe('2026-03-24');
    expect(trainingAnalyticsDay(new Date('2026-02-01T00:30:00Z'), 'America/New_York')).toBe('2026-01-31');
  });
  it('validates additive contracts strictly, including malformed API replies and time zones', () => {
    expect(trainingProgressQuerySchema.safeParse({ period: '31' }).success).toBe(false);
    expect(trainingProgressQuerySchema.safeParse({ timeZone: 'not/a/timezone' }).success).toBe(false);
    expect(trainingProgressQuerySchema.safeParse({ timeZone: '+02:00' }).success).toBe(false);
    expect(trainingProgressQuerySchema.parse({ timeZone: 'US/Eastern' }).timeZone).toBe('America/New_York');
    expect(trainingProgressBucketSchema.safeParse({ date: '2026-02-31', sessions: 0, activeDays: 0, measuredSessions: 0, durationSeconds: null, volumeKg: null }).success).toBe(false);
    expect(trainingProgressQuerySchema.safeParse({ userId: id(1) }).success).toBe(false);
    for (const page of ['', '-1', '1.5', true]) expect(trainingRecordsQuerySchema.safeParse({ page }).success).toBe(false);
    expect(trainingExerciseProgressResponseSchema.safeParse({ points: [], exercise: null }).success).toBe(false);
  });
  it('a newly saved point updates load, session volume and repetition records', () => {
    const old = [point(1)];
    expect(buildTrainingRecords(old, 'total_weight').find(record => record.metric === 'load')?.value).toBe(40);
    expect(buildTrainingRecords([...old, point(2, 50, 10)], 'total_weight')).toEqual(expect.arrayContaining([expect.objectContaining({ metric: 'load', value: 50 }), expect.objectContaining({ metric: 'session_volume', value: 1500 })]));
  });
  it('never infers bodyweight kilograms or records from missing/invalid set measurements', () => {
    expect(buildTrainingRecords([point(1)], 'bodyweight_only').every(record => record.metric === 'reps' && record.weightKg === null)).toBe(true);
    for (const load of [{ weightKg: null, reps: 8, volumeKg: null }, { weightKg: -10, reps: 8, volumeKg: null }, { weightKg: 20, reps: 0, volumeKg: null }]) {
      expect(buildTrainingRecords([{ ...point(1), loads: [load] }], 'total_weight')).toEqual([]);
    }
  });
  it('equivalent timestamps use stable session identity rather than ISO spelling to break ties', () => {
    const records = buildTrainingRecords([point(2, 40, 8, '2026-02-01T10:00:00.000Z'), point(1)], 'total_weight');
    expect(records.find(record => record.metric === 'load')).toMatchObject({ sessionId: id(1), ties: 1 });
  });
});
