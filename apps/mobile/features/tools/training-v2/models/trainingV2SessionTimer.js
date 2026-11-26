// Absolute-timestamp rest timer math (mirrors the existing training module's own
// TrainingSessionActiveScreen pauseEndsAt approach): every function takes/returns a plain
// endsAt epoch-ms value instead of counting down a local interval, so backgrounding the app
// and returning later always recovers the correct remaining time from a single AppState
// 'active' resync instead of drifting.

export function startRestTimerEndsAt(nowMs, plannedSeconds) {
  return nowMs + plannedSeconds * 1000;
}

// Adjust by ±30s, never allowing the remaining time to go negative — dropping straight to 0
// (finished) is the floor rather than letting the countdown go negative and confusing a
// "-0:05" display.
export function adjustRestTimerEndsAt(endsAt, deltaSeconds, nowMs) {
  return Math.max(nowMs, endsAt + deltaSeconds * 1000);
}

export function remainingRestSeconds(endsAt, nowMs) {
  return Math.max(0, Math.ceil((endsAt - nowMs) / 1000));
}

export function isRestTimerFinished(endsAt, nowMs) {
  return remainingRestSeconds(endsAt, nowMs) === 0;
}

// The real elapsed rest, from the moment the set was marked completed to whenever the timer
// was dismissed (naturally finishing or skipped) — this is what actualRestSeconds records,
// deliberately independent of the *planned* duration so a skip or a ±30s adjustment is
// reflected accurately.
export function elapsedRestSeconds(completedAtIso, dismissedAtMs) {
  const completedAtMs = new Date(completedAtIso).getTime();
  return Math.max(0, Math.round((dismissedAtMs - completedAtMs) / 1000));
}

export function formatRestTimer(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
