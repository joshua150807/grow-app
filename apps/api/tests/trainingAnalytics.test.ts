import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { createTrainingAnalyticsRepository } from '../src/modules/trainingSessions/trainingAnalyticsRepository.js';
import { createTrainingAnalyticsService } from '../src/modules/trainingSessions/trainingAnalyticsService.js';
import type { TrainingAnalyticsRepository } from '../src/modules/trainingSessions/trainingAnalyticsRepository.js';
import type { TrainingPerformancePoint } from '@grow/shared/src/training/analytics.js';
const user = { id: '11111111-1111-4111-8111-111111111111', email: null, role: 'authenticated' };
const exerciseId = '22222222-2222-4222-8222-222222222222';
const sessionId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
function repository(): TrainingAnalyticsRepository {
  return { records: vi.fn(async () => ({ exercises: [], pagination: { page: 0, limit: 25, hasMore: false, total: 0 } })),
    days: vi.fn(async () => []), exercise: vi.fn(async () => ({ exercise: null, points: [] })) };
}
describe('Training analytics additive owner-scoped API', () => {
  it('authenticates every new route and rejects owner overrides and malformed queries before repository access', async () => {
    const repo = repository(), server = buildApp({ authTokenVerifier: async token => token === 'owner' ? user : null,
      trainingAnalyticsService: createTrainingAnalyticsService(repo) });
    for (const path of ['records', 'progress', `exercises/${exerciseId}`]) {
      expect((await server.inject({ url: `/v1/training/analytics/${path}` })).statusCode).toBe(401);
      expect((await server.inject({ url: `/v1/training/analytics/${path}?userId=foreign`, headers: { authorization: 'Bearer owner' } })).statusCode).toBe(400);
      expect((await server.inject({ url: `/v1/training/analytics/${path}`, headers: { authorization: 'Bearer owner' } })).statusCode).toBe(200);
    }
    expect(repo.records).toHaveBeenCalledWith(user.id, { search: '', page: 0 });
    expect(repo.days).toHaveBeenCalledWith(user.id, 'UTC', expect.any(String), expect.any(Date));
    expect(repo.exercise).toHaveBeenCalledWith(user.id, exerciseId);
    for (const query of ['period=8', 'timeZone=invalid', 'page=-1']) expect((await server.inject({ url: `/v1/training/analytics/progress?${query}`, headers: { authorization: 'Bearer owner' } })).statusCode).toBe(400);
    await server.close();
  });
  it('paginates exercise points independently of the first History page, preserving all-time records across plan changes', async () => {
    const points = Array.from({ length: 75 }, (_, n): TrainingPerformancePoint => ({ sessionId: sessionId(n), date: `2026-01-${String(1 + n % 28).padStart(2, '0')}T10:00:00Z`, sessionName: n % 2 ? 'Plan A' : 'Plan B', loads: [], volumeKg: null, bestSetVolumeKg: null }));
    const repo = repository(); repo.exercise = vi.fn(async () => ({ exercise: { exerciseId, name: 'Press', loadType: 'total_weight' as const, records: [], sessionCount: 75 }, points }));
    const service = createTrainingAnalyticsService(repo, () => new Date('2026-02-02T12:00:00Z'));
    const first = await service.exercise(user, { exerciseId }, { period: 'all' });
    const next = await service.exercise(user, { exerciseId }, { period: 'all', page: '1' });
    expect(first.points).toHaveLength(50); expect(first.pagination.hasMore).toBe(true);
    expect(next.points).toHaveLength(25); expect(next.pagination.hasMore).toBe(false);
    expect(new Set([...first.points, ...next.points].map(point => point.sessionId)).size).toBe(75);
    expect(first.exercise?.sessionCount).toBe(75);
  });
  it('period filters use the user time zone and exclude future observations', async () => {
    const repo = repository();
    repo.exercise = vi.fn(async () => ({ exercise: { exerciseId, name: 'Press', loadType: 'total_weight' as const, records: [], sessionCount: 2 }, points: [
      { sessionId: sessionId(1), date: '2026-01-31T23:30:00Z', sessionName: 'Local February', loads: [], volumeKg: null, bestSetVolumeKg: null },
      { sessionId: sessionId(2), date: '2027-01-01T12:00:00Z', sessionName: 'Future', loads: [], volumeKg: null, bestSetVolumeKg: null },
    ] }));
    const service = createTrainingAnalyticsService(repo, () => new Date('2026-02-07T12:00:00Z'));
    expect((await service.exercise(user, { exerciseId }, { period: '7', timeZone: 'Europe/Berlin' })).points).toHaveLength(1);
    expect((await service.exercise(user, { exerciseId }, { period: '7', timeZone: 'UTC' })).points).toHaveLength(0);
  });
  it('rejects malformed repository responses instead of publishing invented data', async () => {
    const repo = repository(); repo.records = vi.fn(async () => ({ exercises: [{ bad: true }] })) as unknown as TrainingAnalyticsRepository['records'];
    await expect(createTrainingAnalyticsService(repo).records(user, {})).rejects.toThrow();
  });
  it('batches record queries by stable identity, scopes every query and aggregates only valid completed work', async () => {
    const query = vi.fn().mockResolvedValueOnce({ rows: [{ exercise_id: exerciseId, load_type: 'per_hand', name: 'Same name', total: '1' }] })
      .mockResolvedValueOnce({ rows: [{ exercise_id: exerciseId, session_id: sessionId(1), date: '2026-01-01T12:00:00Z', session_name: 'Old plan', weight_kg: '20', reps: 10, volume_kg: '800', best_set_volume_kg: '400' }] });
    const result = await createTrainingAnalyticsRepository({ query } as never).records(user.id, { page: 0, search: '' });
    expect(query).toHaveBeenCalledTimes(2);
    for (const [sql, params] of query.mock.calls) {
      expect(sql).toContain('t.user_id=$1'); expect(sql).toContain("t.status='completed'");
      expect(sql).toContain("s.set_type='work'"); expect(sql).toContain('s.reps > 0'); expect(sql).toContain('s.completed_at is not null');
      expect(params[0]).toBe(user.id); expect(sql).not.toContain('plan_id=');
    }
    expect(result.exercises[0]?.records).toEqual(expect.arrayContaining([expect.objectContaining({ metric: 'load', value: 20 }), expect.objectContaining({ metric: 'session_volume', value: 800 })]));
    expect(query.mock.calls[1]?.[1][1]).toEqual([exerciseId]);
  });
  it('empty history returns honest empty records and nullable measurement totals', async () => {
    const service = createTrainingAnalyticsService(repository(), () => new Date('2026-02-01T12:00:00Z'));
    expect((await service.records(user, {})).exercises).toEqual([]);
    expect(await service.progress(user, {})).toMatchObject({ completedSessions: 0, activeDays: 0, durationSeconds: null, volumeKg: null });
    expect((await service.exercise(user, { exerciseId }, {})).exercise).toBeNull();
  });
});
