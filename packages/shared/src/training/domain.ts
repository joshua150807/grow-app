import type { RunRawValues } from './contracts.js';
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
