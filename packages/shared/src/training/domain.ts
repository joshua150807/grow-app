import type { RunRawValues } from './contracts.js';
import { TRAINING_V2_LIMITS } from './primitives.js';
import type {
  LoadType,
  PersistedSessionStatus,
  PersonalRecordType,
  SetType,
} from './enums.js';

export function getEffectiveRunDurationSeconds(run: RunRawValues): number {
  if (run.manualEffectiveDurationSeconds != null) {
    return run.manualEffectiveDurationSeconds;
  }
  if (run.movingDurationSeconds != null) {
    return run.movingDurationSeconds;
  }
  return Math.max(0, run.measuredDurationSeconds - run.pausedDurationSeconds);
}

export function calculateRunPaceSecondsPerKilometer(run: RunRawValues): number | null {
  const effectiveDurationSeconds = getEffectiveRunDurationSeconds(run);
  if (run.distanceMeters <= 0 || effectiveDurationSeconds <= 0) {
    return null;
  }
  return effectiveDurationSeconds / (run.distanceMeters / 1_000);
}

export function getEffectiveLoadForVolumeKg(
  weightKg: number | null,
  loadType: LoadType,
): number | null {
  if (weightKg === null || !Number.isFinite(weightKg) || weightKg < 0) {
    return null;
  }
  if (loadType === 'bodyweight_only' || loadType === 'no_weight_tracking') {
    return null;
  }
  if (loadType === 'per_hand' || loadType === 'per_side') {
    return weightKg * 2;
  }
  return weightKg;
}

export function calculateSetVolumeKg(
  weightKg: number | null,
  reps: number | null,
  loadType: LoadType,
): number | null {
  const effectiveLoad = getEffectiveLoadForVolumeKg(weightKg, loadType);
  if (effectiveLoad === null || reps === null || !Number.isInteger(reps) || reps <= 0) {
    return null;
  }
  return effectiveLoad * reps;
}

export function calculateEpleyOneRepMaxKg(
  weightKg: number | null,
  reps: number | null,
  loadType: LoadType,
): number | null {
  if (
    weightKg === null
    || reps === null
    || !Number.isFinite(weightKg)
    || weightKg <= 0
    || !Number.isInteger(reps)
    || reps <= 0
    || loadType === 'bodyweight_only'
    || loadType === 'no_weight_tracking'
  ) {
    return null;
  }
  return weightKg * (1 + reps / 30);
}

// Effective duration for a Training V2 session (strength unit, not a run): endedAt - startedAt
// - pausedDurationSeconds, clamped at 0. Returns null whenever startedAt/endedAt is missing --
// a legacy session or one saved by a client build that predates timing -- rather than ever
// estimating from createdAt or a set's own completedAt (see the session contract's own note in
// sessions.ts). No History UI reads this yet; it exists so that UI has one correct place to
// compute it from once it does.
export function getEffectiveTrainingSessionDurationSeconds(session: {
  startedAt: string | null;
  endedAt: string | null;
  pausedDurationSeconds: number;
}): number | null {
  if (session.startedAt === null || session.endedAt === null) {
    return null;
  }
  const startedAtMs = Date.parse(session.startedAt);
  const endedAtMs = Date.parse(session.endedAt);
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(endedAtMs)) {
    return null;
  }
  const grossSeconds = (endedAtMs - startedAtMs) / 1000;
  // Longer than any plausible single session (e.g. a draft resumed the next day): the raw
  // timestamps stay stored, but they are not a reliable measured duration (Fixplan B10).
  if (grossSeconds > TRAINING_V2_LIMITS.maxReliableSessionSeconds) {
    return null;
  }
  return Math.max(0, grossSeconds - session.pausedDurationSeconds);
}

export function isSetEligibleForPersonalRecord(input: {
  setType: SetType;
  completedAt: string | null;
  sessionStatus: PersistedSessionStatus;
}): boolean {
  return input.setType === 'work'
    && input.completedAt !== null
    && (input.sessionStatus === 'completed' || input.sessionStatus === 'incomplete');
}

export function isRunEligibleForPersonalRecord(input: {
  status: PersistedSessionStatus;
  personalRecordType: PersonalRecordType;
  run: RunRawValues;
}): boolean {
  if (input.status !== 'completed') {
    return false;
  }

  const effectiveDuration = getEffectiveRunDurationSeconds(input.run);
  if (input.personalRecordType === 'longest_run_duration') {
    return effectiveDuration > 0;
  }
  if (input.personalRecordType === 'longest_run_distance') {
    return input.run.distanceMeters > 0;
  }
  if (input.personalRecordType === 'best_run_pace') {
    return input.run.distanceMeters > 0 && effectiveDuration > 0;
  }
  return false;
}
