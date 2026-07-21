import { getPreloadedToolData, setPreloadedToolData } from '../../../../lib/preloadedTools';

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
  if (key) setPreloadedToolData(key, value);
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
