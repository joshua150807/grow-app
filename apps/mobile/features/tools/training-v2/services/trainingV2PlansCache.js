import { supabase } from '../../../../services/supabaseClient';

// Scoped per signed-in user: keeps the last successfully loaded plans list per user id, so a
// fresh hook instance (e.g. a screen torn down and recreated across an interactive iOS
// swipe-back) can start from real data instead of an empty list — without ever risking one
// user's plans appearing for another. Inspired by the equivalent per-user cache in
// features/tools/habits (habitCache.js + useHabitCollections.js), but the owner id is
// tracked via a single auth subscription for the lifetime of the app (not one per hook
// mount): that lets a later mount read it synchronously in its very first render. Following
// the habits pattern exactly (owner id only known after an effect resolves) would
// reintroduce the fullscreen-loading flash this cache exists to prevent.
const plansCacheByUserId = new Map();

let currentOwnerId = null;

supabase.auth.onAuthStateChange((_event, session) => {
  const nextOwnerId = session?.user?.id ?? null;
  if (currentOwnerId && currentOwnerId !== nextOwnerId) {
    plansCacheByUserId.delete(currentOwnerId);
  }
  currentOwnerId = nextOwnerId;
  if (!nextOwnerId) plansCacheByUserId.clear();
});

export function getTrainingV2PlansOwnerId() {
  return currentOwnerId;
}

export function getCachedTrainingV2Plans(userId) {
  return userId ? plansCacheByUserId.get(userId) ?? null : null;
}

export function setCachedTrainingV2Plans(userId, plans) {
  if (userId) plansCacheByUserId.set(userId, plans);
}
