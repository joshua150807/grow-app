const store = new Map();
const timestamps = new Map();

const DEFAULT_MAX_AGE_MS = 10 * 60 * 1000;

export function setPreloadedToolData(key, data) {
  if (!key) return;
  store.set(key, data);
  timestamps.set(key, Date.now());
}

export function getPreloadedToolData(key, maxAgeMs = DEFAULT_MAX_AGE_MS) {
  if (!key || !store.has(key)) return null;

  const savedAt = timestamps.get(key) || 0;
  if (maxAgeMs && Date.now() - savedAt > maxAgeMs) {
    store.delete(key);
    timestamps.delete(key);
    return null;
  }

  return store.get(key);
}

export function clearPreloadedToolData(key) {
  if (!key) return;
  store.delete(key);
  timestamps.delete(key);
}

export function clearAllPreloadedToolData() {
  store.clear();
  timestamps.clear();
}