import {
  isProfileApiV1Enabled,
  ProfileApiError,
  requestProfileV1,
} from './profiles';

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function requireNonNegativeInteger(value) {
  if (!isNonNegativeInteger(value)) {
    throw new ProfileApiError('Profile stats API returned an invalid response.', {
      code: 'PROFILE_API_INVALID_RESPONSE',
    });
  }

  return value;
}

export function normalizeProfileStats(payload) {
  const stats = payload?.stats;

  if (!stats || typeof stats !== 'object' || Array.isArray(stats)) {
    throw new ProfileApiError('Profile stats API returned an invalid response.', {
      code: 'PROFILE_API_INVALID_RESPONSE',
    });
  }

  const habitStreak = requireNonNegativeInteger(stats.habit_streak);
  const completed = requireNonNegativeInteger(stats.todos_today?.completed);
  const total = requireNonNegativeInteger(stats.todos_today?.total);
  const todosCompletedAllTime = requireNonNegativeInteger(stats.todos_completed_all_time);
  const deepWorkSecondsAllTime = requireNonNegativeInteger(stats.deep_work_seconds_all_time);
  const trainingSessions = requireNonNegativeInteger(stats.training_sessions);
  const goals = requireNonNegativeInteger(stats.goals);
  const plannedDaysCurrentWeek = requireNonNegativeInteger(stats.planned_days_current_week);

  if (plannedDaysCurrentWeek > 7) {
    throw new ProfileApiError('Profile stats API returned an invalid response.', {
      code: 'PROFILE_API_INVALID_RESPONSE',
    });
  }

  return {
    habitStreak,
    todosToday: {
      completed: Math.min(completed, total),
      total,
    },
    todosCompletedAllTime,
    deepWorkSecondsAllTime,
    trainingSessions,
    goals,
    plannedDaysCurrentWeek,
  };
}

export function normalizeProfileStatsFallback({
  habitStreak = 0,
  todosToday = { completed: 0, total: 0 },
  deepWorkSecondsAllTime = 0,
  trainingSessions = 0,
  goals = 0,
  plannedDaysCurrentWeek = 0,
} = {}) {
  const safeTotal = isNonNegativeInteger(todosToday?.total) ? todosToday.total : 0;
  const safeCompleted = isNonNegativeInteger(todosToday?.completed) ? todosToday.completed : 0;

  return {
    habitStreak: isNonNegativeInteger(habitStreak) ? habitStreak : 0,
    todosToday: {
      completed: Math.min(safeCompleted, safeTotal),
      total: safeTotal,
    },
    deepWorkSecondsAllTime: isNonNegativeInteger(deepWorkSecondsAllTime)
      ? deepWorkSecondsAllTime
      : 0,
    trainingSessions: isNonNegativeInteger(trainingSessions) ? trainingSessions : 0,
    goals: isNonNegativeInteger(goals) ? goals : 0,
    plannedDaysCurrentWeek: isNonNegativeInteger(plannedDaysCurrentWeek)
      && plannedDaysCurrentWeek <= 7
      ? plannedDaysCurrentWeek
      : 0,
  };
}

function validateTimeZone(timeZone) {
  if (typeof timeZone !== 'string' || !timeZone.trim()) {
    throw new ProfileApiError('Device timezone is unavailable.', {
      code: 'PROFILE_TIMEZONE_UNAVAILABLE',
    });
  }

  try {
    Intl.DateTimeFormat(undefined, { timeZone }).format();
  } catch {
    throw new ProfileApiError('Device timezone is invalid.', {
      code: 'PROFILE_TIMEZONE_INVALID',
    });
  }

  return timeZone;
}

export function getDeviceTimeZone() {
  return validateTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
}

export async function getMyProfileStatsV1(timeZone) {
  if (!isProfileApiV1Enabled()) {
    throw new ProfileApiError('Profile API V1 is disabled.', {
      code: 'PROFILE_API_V1_DISABLED',
    });
  }

  const validTimeZone = validateTimeZone(timeZone);

  return requestProfileV1(
    `/v1/profile/me/stats?timezone=${encodeURIComponent(validTimeZone)}`,
    { method: 'GET' },
    normalizeProfileStats,
  );
}
