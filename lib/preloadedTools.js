const preloadedToolData = new Map();

export function getPreloadedToolData(key) {
  if (!key) return null;
  return preloadedToolData.has(key) ? preloadedToolData.get(key) : null;
}

export function setPreloadedToolData(key, data) {
  if (!key) return;
  preloadedToolData.set(key, data);
}

export function clearPreloadedToolData(key) {
  if (!key) return;
  preloadedToolData.delete(key);
}

export function clearAllPreloadedToolData() {
  preloadedToolData.clear();
}
