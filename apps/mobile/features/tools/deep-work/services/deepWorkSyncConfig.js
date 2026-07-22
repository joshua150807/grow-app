export function isDeepWorkSyncEnabled() {
  return process.env.EXPO_PUBLIC_DEEP_WORK_SYNC_ENABLED === 'true';
}
