import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import type { AuthTokenVerifier } from '../src/auth/types.js';
import { calculateHabitStreak, createProfileStatsService } from '../src/modules/profileStats/profileStatsService.js';
import type { ProfileStatsRepository, StatsSourceData } from '../src/modules/profileStats/profileStatsRepository.js';
import { getCalendarBounds, localDateTimeToUtc } from '../src/modules/profileStats/timezone.js';

const user = { id: '11111111-1111-4111-8111-111111111111', email: 'u@example.com', role: 'authenticated' };
const verify: AuthTokenVerifier = async (token) => token === 'valid' ? user : null;
const empty: StatsSourceData = {
  habits: [], completions: [], todosCompleted: 0, todosTotal: 0, deepWorkSeconds: 0,
  trainingSessions: 0, goals: 0, plannedDates: [],
};
function service(data: Partial<StatsSourceData> = {}, now = new Date('2026-07-19T10:00:00Z')) {
  const repository: ProfileStatsRepository = { load: vi.fn(async () => ({ ...empty, ...data })) };
  return { repository, value: createProfileStatsService(repository, () => now) };
}

describe('profile stats route', () => {
  it('requires authentication', async () => {
    const app = buildApp({ authTokenVerifier: verify, profileStatsService: service().value });
    const response = await app.inject({ method: 'GET', url: '/v1/profile/me/stats?timezone=Europe/Berlin' });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('requires a valid IANA timezone', async () => {
    const app = buildApp({ authTokenVerifier: verify, profileStatsService: service().value });
    for (const url of ['/v1/profile/me/stats', '/v1/profile/me/stats?timezone=Not/AZone']) {
      const response = await app.inject({ method: 'GET', url, headers: { authorization: 'Bearer valid' } });
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('VALIDATION_ERROR');
    }
    await app.close();
  });

  it('returns the exact zero-valued contract and filters by authenticated user', async () => {
    const setup = service();
    const app = buildApp({ authTokenVerifier: verify, profileStatsService: setup.value });
    const response = await app.inject({ method: 'GET', url: '/v1/profile/me/stats?timezone=Europe%2FBerlin', headers: { authorization: 'Bearer valid' } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ stats: {
      habit_streak: 0, todos_today: { completed: 0, total: 0 }, deep_work_seconds_all_time: 0,
      training_sessions: 0, goals: 0, planned_days_current_week: 0,
    } });
    expect(response.json().stats).not.toHaveProperty('grow_points');
    expect(response.json().stats).not.toHaveProperty('grow_coins');
    expect(setup.repository.load).toHaveBeenCalledWith(user.id, expect.any(Object));
    await app.close();
  });

  it('returns aggregate values and deduplicates/caps planner days', async () => {
    const setup = service({ todosCompleted: 2, todosTotal: 3, deepWorkSeconds: 18240, trainingSessions: 8, goals: 6,
      plannedDates: ['2026-07-13', '2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16', '2026-07-17', '2026-07-18', '2026-07-19', '2026-07-20'] });
    const result = await setup.value.get(user, { timezone: 'Europe/Berlin' });
    expect(result).toMatchObject({ todos_today: { completed: 2, total: 3 }, deep_work_seconds_all_time: 18240, training_sessions: 8, goals: 6, planned_days_current_week: 7 });
  });

  it('passes exact UTC+05:45 local-day boundaries for Asia/Kathmandu to the repository', async () => {
    const setup = service({}, new Date('2026-07-19T12:00:00Z'));
    await setup.value.get(user, { timezone: 'Asia/Kathmandu' });
    expect(setup.repository.load).toHaveBeenCalledWith(user.id, expect.objectContaining({
      todayKey: '2026-07-19',
      todayStartUtc: new Date('2026-07-18T18:15:00.000Z'),
      tomorrowStartUtc: new Date('2026-07-19T18:15:00.000Z'),
    }));
    const bounds = vi.mocked(setup.repository.load).mock.calls[0][1];
    expect(bounds.tomorrowStartUtc.getTime() - bounds.todayStartUtc.getTime()).toBe(24 * 3600_000);
  });

  it('does not complete an owned habit when the repository excludes another users completion', async () => {
    const ownedHabit = { id: 'colliding-habit-id', days: [6], archived_at: null, is_active: true, disabled: false };
    const databaseCompletions = [
      { user_id: 'user-b', habit_id: 'colliding-habit-id', completed_date: '2026-07-19' },
    ];
    const ownCompletions = databaseCompletions
      .filter((completion) => completion.user_id === user.id)
      .map(({ habit_id, completed_date }) => ({ habit_id, completed_date }));
    const setup = service({ habits: [ownedHabit], completions: ownCompletions });
    const result = await setup.value.get(user, { timezone: 'Europe/Berlin' });
    expect(result.habit_streak).toBe(0);
    expect(setup.repository.load).toHaveBeenCalledWith(user.id, expect.any(Object));
  });
});

describe('timezone boundaries', () => {
  it('uses local day and Monday-Sunday boundaries across month/year', () => {
    const month = getCalendarBounds(new Date('2026-08-02T12:00:00Z'), 'Europe/Berlin');
    expect(month.weekStartKey).toBe('2026-07-27');
    expect(month.weekEndExclusiveKey).toBe('2026-08-03');
    const year = getCalendarBounds(new Date('2027-01-01T12:00:00Z'), 'Europe/Berlin');
    expect(year.weekStartKey).toBe('2026-12-28');
    expect(year.weekEndExclusiveKey).toBe('2027-01-04');
  });

  it('produces DST-safe Berlin day boundaries', () => {
    const spring = getCalendarBounds(new Date('2026-03-29T12:00:00Z'), 'Europe/Berlin');
    expect(spring.todayStartUtc.toISOString()).toBe('2026-03-28T23:00:00.000Z');
    expect(spring.tomorrowStartUtc.toISOString()).toBe('2026-03-29T22:00:00.000Z');
    expect(spring.tomorrowStartUtc.getTime() - spring.todayStartUtc.getTime()).toBe(23 * 3600_000);
    const autumnStart = localDateTimeToUtc({ year: 2026, month: 10, day: 25 }, 'Europe/Berlin');
    const autumnEnd = localDateTimeToUtc({ year: 2026, month: 10, day: 26 }, 'Europe/Berlin');
    expect(autumnStart.toISOString()).toBe('2026-10-24T22:00:00.000Z');
    expect(autumnEnd.toISOString()).toBe('2026-10-25T23:00:00.000Z');
    expect(autumnEnd.getTime() - autumnStart.getTime()).toBe(25 * 3600_000);
  });
});

describe('habit streak parity', () => {
  const today = { year: 2026, month: 7, day: 19 }; // Sunday, mobile day 6
  const habit = (overrides = {}) => ({ id: 'h1', days: [6, 5, 4], archived_at: null, is_active: true, disabled: false, ...overrides });
  const done = (date: string, id = 'h1') => ({ habit_id: id, completed_date: date });

  it('counts today when complete and deduplicates completions', () => {
    expect(calculateHabitStreak([habit()], [done('2026-07-19'), done('2026-07-19')], today)).toBe(1);
  });
  it('does not let incomplete today break the existing streak and skips unscheduled days', () => {
    expect(calculateHabitStreak([habit()], [done('2026-07-18'), done('2026-07-17')], today)).toBe(2);
  });
  it('stops on an incomplete historical scheduled day', () => {
    expect(calculateHabitStreak([habit()], [done('2026-07-19')], today)).toBe(1);
  });
  it.each([
    { archived_at: '2026-07-01' }, { is_active: false }, { disabled: true },
  ])('ignores inactive habit %j', (override) => {
    expect(calculateHabitStreak([habit(override)], [], today)).toBe(0);
  });
  it('considers no more than 90 days', () => {
    const everyDay = habit({ days: [0, 1, 2, 3, 4, 5, 6] });
    const completions = Array.from({ length: 100 }, (_, index) => {
      const date = new Date(Date.UTC(2026, 6, 19 - index, 12));
      return done(date.toISOString().slice(0, 10));
    });
    expect(calculateHabitStreak([everyDay], completions, today)).toBe(90);
  });

  it('matches mobile weekday normalization for numeric values and numeric strings', () => {
    const monday = { year: 2026, month: 7, day: 20 };
    const mondayHabit = habit({ days: [0, '0', -1, 'invalid'] });
    const sundayHabit = habit({ id: 'h2', days: [6, '6', 7, 'invalid'] });
    expect(calculateHabitStreak([mondayHabit], [done('2026-07-20')], monday)).toBe(1);
    expect(calculateHabitStreak([sundayHabit], [done('2026-07-19', 'h2')], today)).toBe(1);
  });
});
