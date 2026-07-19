import { describe, expect, it, vi } from 'vitest';
import { createProfileStatsRepository } from '../src/modules/profileStats/profileStatsRepository.js';
import { createDeepWorkSessionRepository } from '../src/modules/profileStats/deepWorkSessionRepository.js';

describe('profile stats repository ownership and aggregation queries', () => {
  it('passes the authenticated user id to every statistic query and maps aggregates', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ id: 'h1', days: [0], archived_at: null, is_active: true, disabled: false }] })
      .mockResolvedValueOnce({ rows: [{ habit_id: 'h1', completed_date: '2026-07-20' }] })
      .mockResolvedValueOnce({ rows: [{ completed: '2', total: '3' }] })
      .mockResolvedValueOnce({ rows: [{ total: '5400' }] })
      .mockResolvedValueOnce({ rows: [{ total: '8' }] })
      .mockResolvedValueOnce({ rows: [{ total: '6' }] })
      .mockResolvedValueOnce({ rows: [{ date: '2026-07-20' }, { date: '2026-07-21' }] });
    const repository = createProfileStatsRepository({ query } as never);
    const bounds = {
      earliestStreakKey: '2026-04-22', todayKey: '2026-07-20',
      todayStartUtc: new Date('2026-07-19T22:00:00Z'), tomorrowStartUtc: new Date('2026-07-20T22:00:00Z'),
      weekStartKey: '2026-07-20', weekEndExclusiveKey: '2026-07-27',
    };
    const result = await repository.load('authenticated-user', bounds);
    expect(query).toHaveBeenCalledTimes(7);
    for (const call of query.mock.calls) expect(call[1][0]).toBe('authenticated-user');
    expect(query.mock.calls[1][1]).toEqual(['authenticated-user', '2026-04-22', '2026-07-20']);
    expect(query.mock.calls[2][1]).toEqual(['authenticated-user', bounds.todayStartUtc, bounds.tomorrowStartUtc]);
    expect(query.mock.calls[6][1]).toEqual(['authenticated-user', '2026-07-20', '2026-07-27']);
    expect(result).toMatchObject({ todosCompleted: 2, todosTotal: 3, deepWorkSeconds: 5400, trainingSessions: 8, goals: 6 });
    expect(result.plannedDates).toEqual(['2026-07-20', '2026-07-21']);
    const sql = query.mock.calls.map((call) => call[0]).join('\n');
    expect(sql).toContain('public.training_sessions');
    expect(sql).not.toContain('training_session_exercises');
    expect(sql).not.toContain('training_plans');
    expect(sql).toContain('public.goals');
    expect(sql).not.toContain('completed = false');
  });

  it('uses the authenticated owner for both habits and completions so a foreign completion is not loaded', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ id: 'colliding-habit-id', days: [6], archived_at: null, is_active: true, disabled: false }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ completed: '0', total: '0' }] })
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })
      .mockResolvedValueOnce({ rows: [] });
    const repository = createProfileStatsRepository({ query } as never);
    await repository.load('user-a', {
      earliestStreakKey: '2026-04-21', todayKey: '2026-07-19',
      todayStartUtc: new Date('2026-07-18T22:00:00Z'), tomorrowStartUtc: new Date('2026-07-19T22:00:00Z'),
      weekStartKey: '2026-07-13', weekEndExclusiveKey: '2026-07-20',
    });
    expect(query.mock.calls[0][0]).toContain('from public.habits where user_id = $1');
    expect(query.mock.calls[0][1]).toEqual(['user-a']);
    expect(query.mock.calls[1][0]).toContain('from public.habit_completions');
    expect(query.mock.calls[1][1][0]).toBe('user-a');
    expect(query.mock.calls[1][1]).not.toContain('user-b');
  });
});

describe('deep-work repository database idempotency', () => {
  const input = { client_session_id: 'stable', duration_seconds: 60, completed_at: '2026-07-19T18:30:00.000Z' };
  const row = { id: 'id', ...input, created_at: '2026-07-19T18:30:01.000Z' };

  it('returns a newly inserted row without a preliminary read', async () => {
    const query = vi.fn().mockResolvedValueOnce({ rows: [row] });
    const result = await createDeepWorkSessionRepository({ query } as never).insertOrFind('owner', input);
    expect(result.created).toBe(true);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain('on conflict (user_id, client_session_id) do nothing');
    expect(query.mock.calls[0][1][0]).toBe('owner');
  });

  it('reads the existing owned row after the unique constraint wins a retry race', async () => {
    const query = vi.fn().mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [row] });
    const result = await createDeepWorkSessionRepository({ query } as never).insertOrFind('owner', input);
    expect(result.created).toBe(false);
    expect(query.mock.calls[1][1]).toEqual(['owner', 'stable']);
  });
});
