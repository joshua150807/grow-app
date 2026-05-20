import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@deep_work_session';
const HISTORY_KEY = '@deep_work_history';
const DEEP_WORK_HISTORY_RETENTION_DAYS = 7;

function getTodayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date();
  end.setHours(23, 59, 59, 999);

  return {
    startTime: start.getTime(),
    endTime: end.getTime(),
  };
}

export async function saveDeepWorkSession(session) {
  await AsyncStorage.setItem(KEY, JSON.stringify(session));
}

export async function clearDeepWorkSession() {
  await AsyncStorage.removeItem(KEY);
}

export async function getSavedDeepWorkSession() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;

    const session = JSON.parse(raw);

    if (session.phase === 'running') {
      const elapsed = Math.floor((Date.now() - session.updatedAt) / 1000);
      const left = Math.max((session.remaining || 0) - elapsed, 0);

      if (left <= 0) {
        await clearDeepWorkSession();
        return null;
      }

      return {
        ...session,
        remaining: left,
      };
    }

    return session;
  } catch {
    return null;
  }
}

export async function getDeepWorkTimeLeft() {
  try {
    const session = await getSavedDeepWorkSession();
    return session?.remaining || 0;
  } catch {
    return 0;
  }
}

export async function getDeepWorkHistory() {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    if (!raw) return [];

    const history = JSON.parse(raw);
    return Array.isArray(history) ? history : [];
  } catch {
    return [];
  }
}

export async function saveDeepWorkHistory(history) {
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

export async function addCompletedDeepWorkSession(durationSeconds) {
  if (!durationSeconds || durationSeconds <= 0) return;

  const history = await getDeepWorkHistory();

  const newEntry = {
    id: `${Date.now()}`,
    durationSeconds,
    completedAt: new Date().toISOString(),
  };

  const nextHistory = [...history, newEntry];

  await saveDeepWorkHistory(nextHistory);
}

export async function getTodayDeepWorkSeconds() {
  const history = await cleanupDeepWorkHistory();

  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const startTime = start.getTime();
  const endTime = end.getTime();

  return history.reduce((sum, session) => {
    const completedTime = new Date(session.completedAt).getTime();

    if (completedTime >= startTime && completedTime <= endTime) {
      return sum + (session.durationSeconds || 0);
    }

    return sum;
  }, 0);
}

export async function cleanupDeepWorkHistory() {
  const history = await getDeepWorkHistory();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - DEEP_WORK_HISTORY_RETENTION_DAYS);
  cutoff.setHours(0, 0, 0, 0);

  const cutoffTime = cutoff.getTime();

  const cleanedHistory = history.filter((session) => {
    const completedTime = new Date(session.completedAt).getTime();
    return completedTime >= cutoffTime;
  });

  if (cleanedHistory.length !== history.length) {
    await saveDeepWorkHistory(cleanedHistory);
  }

  return cleanedHistory;
}