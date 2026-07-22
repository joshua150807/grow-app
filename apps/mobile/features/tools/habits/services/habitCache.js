import { getPreloadedToolData, setPreloadedToolData } from '../../../../lib/preloadedTools';

const cacheListeners = new Map();

export function getHabitsCacheKey(userId) {
  return userId ? `habits:${userId}` : null;
}

export function getHabitCompletionsCacheKey(userId, localDate) {
  return userId && localDate ? `habitCompletions:${userId}:${localDate}` : null;
}

export function getHabitPendingCacheKey(userId, localDate) {
  const completionsKey = getHabitCompletionsCacheKey(userId, localDate);
  return completionsKey ? `${completionsKey}:pending` : null;
}

export function getOwnerCache(key) {
  return key ? getPreloadedToolData(key) : null;
}

export function setOwnerCache(key, value) {
  if (!key) return;
  setPreloadedToolData(key, value);
  cacheListeners.get(key)?.forEach(listener => listener(value));
}

export function subscribeToOwnerCache(key, listener) {
  if (!key || typeof listener !== 'function') return () => {};
  const listeners = cacheListeners.get(key) ?? new Set();
  listeners.add(listener);
  cacheListeners.set(key, listeners);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) cacheListeners.delete(key);
  };
}

export function isCurrentOwnerRequest(activeOwnerId, requestOwnerId, currentSequence, responseSequence) {
  return Boolean(
    activeOwnerId
    && requestOwnerId === activeOwnerId
    && responseSequence === currentSequence
  );
}

export function ownsHabit(habits, habitId) {
  return Boolean(habitId && Array.isArray(habits) && habits.some(habit => habit?.id === habitId));
}
