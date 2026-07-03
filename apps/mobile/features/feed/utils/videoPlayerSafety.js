import { logger } from '../../../lib/logger';
const STALE_NATIVE_OBJECT_ERRORS = [
  "NativeSharedObjectNotFoundException",
  "Unable to find the native shared object",
  "Calling the 'pause' function has failed",
  "Calling the 'play' function has failed",
];

export function isStaleVideoPlayerError(error) {
  const message = String(error?.message ?? error ?? "");
  return STALE_NATIVE_OBJECT_ERRORS.some((pattern) => message.includes(pattern));
}

export function logVideoPlayerError(label, error) {
  if (isStaleVideoPlayerError(error)) {
    return;
  }

  logger.debug(label, error);
}
