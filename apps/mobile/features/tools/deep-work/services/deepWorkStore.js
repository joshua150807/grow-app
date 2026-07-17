import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@deep_work_session';
const HISTORY_KEY = '@deep_work_history';
const DEEP_WORK_HISTORY_RETENTION_DAYS = 7;
const MAX_HISTORY_ENTRIES = 250;

function getSafeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeSession(session) {
  if (!session || typeof session !== 'object') return null;

  const phase = session.phase === 'running' || session.phase === 'paused'
    ? session.phase
    : 'paused';
  const remaining = Math.max(getSafeNumber(session.remaining), 0);
  const totalSeconds = Math.max(
    getSafeNumber(session.totalSeconds, remaining),
    remaining
  );
  const updatedAt = getSafeNumber(session.updatedAt, Date.now());
  const endTimestamp = phase === 'running'
    ? getSafeNumber(session.endTimestamp, updatedAt + remaining * 1000)
    : null;

  if (remaining <= 0 && totalSeconds <= 0) return null;

  return {
    phase,
    remaining,
    totalSeconds,
    taskName: typeof session.taskName === 'string' && session.taskName.trim()
      ? session.taskName
      : 'Deep Work',
    category: typeof session.category === 'string' && session.category.trim()
      ? session.category
      : 'Fokus',
    updatedAt,
    endTimestamp,
  };
}

function normalizeHistoryEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;

  const durationSeconds = Math.max(getSafeNumber(entry.durationSeconds), 0);
  const completedTime = new Date(entry.completedAt).getTime();

  if (durationSeconds <= 0 || Number.isNaN(completedTime)) return null;

  return {
    id: entry.id ? String(entry.id) : `${completedTime}`,
    durationSeconds,
    completedAt: new Date(completedTime).toISOString(),
  };
}

export async function saveDeepWorkSession(session) {
  const normalized = normalizeSession(session);

  if (!normalized) {
    await clearDeepWorkSession();
    return;
  }

  await AsyncStorage.setItem(KEY, JSON.stringify(normalized));
}

export async function clearDeepWorkSession() {
  await AsyncStorage.removeItem(KEY);
}

export async function getSavedDeepWorkSession() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;

    const session = normalizeSession(JSON.parse(raw));

    if (!session) {
      await clearDeepWorkSession();
      return null;
    }

    if (session.phase === 'running') {
      const left = Math.max(
        Math.ceil((session.endTimestamp - Date.now()) / 1000),
        0
      );

      if (left <= 0) {
        await addCompletedDeepWorkSession(session.totalSeconds || session.remaining);
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
    try {
      await clearDeepWorkSession();
    } catch {
      // ignore cleanup failure
    }
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
    if (!Array.isArray(history)) return [];

    return history
      .map(normalizeHistoryEntry)
      .filter(Boolean);
  } catch {
    return [];
  }
}

export async function saveDeepWorkHistory(history) {
  const safeHistory = Array.isArray(history)
    ? history.map(normalizeHistoryEntry).filter(Boolean)
    : [];

  const limitedHistory = safeHistory.slice(-MAX_HISTORY_ENTRIES);
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(limitedHistory));
}

export async function addCompletedDeepWorkSession(durationSeconds) {
  const safeDuration = Math.max(getSafeNumber(durationSeconds), 0);
  if (safeDuration <= 0) return;

  const history = await getDeepWorkHistory();

  const newEntry = {
    id: `${Date.now()}-${Math.round(safeDuration)}`,
    durationSeconds: Math.round(safeDuration),
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
