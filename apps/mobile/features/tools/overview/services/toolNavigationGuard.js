const TOOL_NAVIGATION_LOCK_MS = 1200;

let toolNavigationLockedUntil = 0;

export function lockToolNavigation(lockMs = TOOL_NAVIGATION_LOCK_MS) {
  const now = Date.now();

  if (now < toolNavigationLockedUntil) {
    return false;
  }

  toolNavigationLockedUntil = now + lockMs;
  return true;
}

export function unlockToolNavigation() {
  toolNavigationLockedUntil = 0;
}

export function unlockToolNavigationSoon(lockMs = TOOL_NAVIGATION_LOCK_MS) {
  const lockedUntilSnapshot = toolNavigationLockedUntil;

  setTimeout(() => {
    if (toolNavigationLockedUntil === lockedUntilSnapshot) {
      unlockToolNavigation();
    }
  }, lockMs);
}
