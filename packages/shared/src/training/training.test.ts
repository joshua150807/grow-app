import { describe, expect, it } from 'vitest';
import {
  calculateEpleyOneRepMaxKg,
  calculateRunPaceSecondsPerKilometer,
  calculateSetVolumeKg,
  cycleTriggerSchema,
  exerciseCategorySchema,
  exerciseEquipmentListSchema,
  exerciseEquipmentValueSchema,
  exerciseScopeSchema,
  exerciseStatusSchema,
  getEffectiveLoadForVolumeKg,
  getEffectiveRunDurationSeconds,
  idempotencyOperationSchema,
  isRunEligibleForPersonalRecord,
  isSetEligibleForPersonalRecord,
  legacyImportStatusSchema,
  loadTypeSchema,
  persistedSessionStatusSchema,
  personalPlanStatusSchema,
  personalRecordOriginSchema,
  personalRecordTypeSchema,
  planActivationStatusSchema,
  progressionSuggestionStatusSchema,
  repRangeSchema,
  rirSchema,
  runRawValuesSchema,
  sessionCompletionSetInputSchema,
  sessionOriginSchema,
  setCorrectionInputSchema,
  setTypeSchema,
  systemExerciseKeySchema,
  targetSetInputSchema,
  trainingUnitTypeSchema,
  versionSchema,
  weightKgSchema,
  completedRepsSchema,
} from '../index.js';

const uuid = '4e717f5c-4da8-44d1-8e07-c5298662306a';

const enumSchemas = [
  exerciseScopeSchema,
  exerciseStatusSchema,
  exerciseCategorySchema,
  loadTypeSchema,
  personalPlanStatusSchema,
  planActivationStatusSchema,
  trainingUnitTypeSchema,
  setTypeSchema,
  persistedSessionStatusSchema,
  progressionSuggestionStatusSchema,
  legacyImportStatusSchema,
  sessionOriginSchema,
  personalRecordOriginSchema,
  personalRecordTypeSchema,
  cycleTriggerSchema,
  idempotencyOperationSchema,
] as const;

const run = {
  distanceMeters: 5_000,
  measuredDurationSeconds: 2_000,
  movingDurationSeconds: 1_800,
  pausedDurationSeconds: 100,
  manualEffectiveDurationSeconds: 1_500,
  note: null,
};

describe('training enum schemas', () => {
  it('accepts every canonical wire value and rejects unknown values', () => {
    expect(exerciseScopeSchema.options).toEqual(['system', 'user']);
    expect(exerciseStatusSchema.options).toEqual(['active', 'archived', 'unpublished']);
    expect(exerciseCategorySchema.options).toEqual(['strength', 'cardio', 'mobility', 'stretching']);
    expect(loadTypeSchema.options).toEqual([
      'total_weight',
      'per_hand',
      'per_side',
      'added_weight_only',
      'bodyweight_only',
      'no_weight_tracking',
    ]);
    expect(personalPlanStatusSchema.options).toEqual(['draft', 'scheduled', 'active', 'archived']);
    expect(planActivationStatusSchema.options).toEqual(['pending', 'applied', 'cancelled']);
    expect(trainingUnitTypeSchema.options).toEqual(['strength', 'run', 'rest', 'mobility', 'stretching']);
    expect(setTypeSchema.options).toEqual(['warmup', 'work', 'drop']);
    expect(persistedSessionStatusSchema.options).toEqual(['completed', 'incomplete']);
    expect(progressionSuggestionStatusSchema.options).toEqual(['pending', 'accepted', 'rejected', 'expired']);
    expect(legacyImportStatusSchema.options).toEqual(['not_started', 'running', 'completed', 'failed']);
    expect(sessionOriginSchema.options).toEqual(['native_v2', 'legacy_import', 'legacy_top_up']);
    expect(personalRecordOriginSchema.options).toEqual(['native_v2', 'legacy_derived']);
    expect(personalRecordTypeSchema.options).toEqual([
      'highest_weight',
      'estimated_one_rep_max',
      'highest_reps_at_weight',
      'highest_session_volume',
      'highest_bodyweight_reps',
      'highest_added_weight',
      'highest_added_weight_reps',
      'longest_run_distance',
      'longest_run_duration',
      'best_run_pace',
    ]);
    expect(cycleTriggerSchema.options).toEqual([
      'plan_activated',
      'plan_reactivated',
      'session_completed',
      'alternative_unit_completed',
      'rest_completed',
      'rest_skipped',
      'plan_revision_remapped',
    ]);
    expect(idempotencyOperationSchema.options).toEqual([
      'create_plan',
      'create_plan_from_template',
      'complete_session',
      'save_incomplete_session',
      'skip_rest',
      'create_private_exercise',
    ]);

    for (const schema of enumSchemas) {
      for (const value of schema.options) {
        expect(schema.safeParse(value).success).toBe(true);
      }
      expect(schema.safeParse('unknown_value').success).toBe(false);
    }
  });

  it('does not persist the draft-only in_progress session status', () => {
    expect(persistedSessionStatusSchema.safeParse('completed').success).toBe(true);
    expect(persistedSessionStatusSchema.safeParse('incomplete').success).toBe(true);
    expect(persistedSessionStatusSchema.safeParse('in_progress').success).toBe(false);
  });
});

describe('training primitive schemas', () => {
  it('accepts finite nonnegative weights only', () => {
    expect(weightKgSchema.safeParse(0).success).toBe(true);
    expect(weightKgSchema.safeParse(-1).success).toBe(false);
    expect(weightKgSchema.safeParse(Number.NaN).success).toBe(false);
    expect(weightKgSchema.safeParse(Number.POSITIVE_INFINITY).success).toBe(false);
  });

  it('accepts positive integer completed repetitions only', () => {
    expect(completedRepsSchema.safeParse(1).success).toBe(true);
    expect(completedRepsSchema.safeParse(0).success).toBe(false);
    expect(completedRepsSchema.safeParse(-1).success).toBe(false);
    expect(completedRepsSchema.safeParse(1.5).success).toBe(false);
  });

  it('validates rep ranges in ascending order', () => {
    expect(repRangeSchema.safeParse({ minimum: 8, maximum: 12 }).success).toBe(true);
    expect(repRangeSchema.safeParse({ minimum: 12, maximum: 8 }).success).toBe(false);
  });

  it('accepts RIR boundaries and rejects values outside them', () => {
    expect(rirSchema.safeParse(0).success).toBe(true);
    expect(rirSchema.safeParse(10).success).toBe(true);
    expect(rirSchema.safeParse(-1).success).toBe(false);
    expect(rirSchema.safeParse(11).success).toBe(false);
  });

  it('requires optimistic concurrency versions to start at one', () => {
    expect(versionSchema.safeParse(1).success).toBe(true);
    expect(versionSchema.safeParse(0).success).toBe(false);
  });

  it('accepts canonical system exercise keys only', () => {
    for (const value of ['squat', 'barbell_back_squat', 'press_2', 'a'.repeat(120)]) {
      expect(systemExerciseKeySchema.safeParse(value).success).toBe(true);
    }
    for (const value of [
      '', ' Squat', 'squat ', 'Barbell_Squat', 'barbell-squat',
      'barbell__squat', '_squat', 'squat_', 'ä_squat', 'a'.repeat(121),
    ]) {
      expect(systemExerciseKeySchema.safeParse(value).success, value).toBe(false);
    }
  });

  it('matches PostgreSQL ASCII boundary whitespace and exact duplicate semantics', () => {
    const asciiWhitespace = [' ', '\t', '\n', '\r', '\f', '\v'];

    expect(exerciseEquipmentValueSchema.safeParse('barbell').success).toBe(true);
    expect(exerciseEquipmentValueSchema.safeParse('bar bell').success).toBe(true);
    expect(exerciseEquipmentValueSchema.safeParse('bar\tbell\nrack').success).toBe(true);
    expect(exerciseEquipmentListSchema.safeParse([]).success).toBe(true);
    expect(exerciseEquipmentListSchema.safeParse(['barbell', 'bench']).success).toBe(true);
    expect(exerciseEquipmentListSchema.safeParse(['Barbell', 'barbell']).success).toBe(true);

    expect(exerciseEquipmentValueSchema.safeParse('').success).toBe(false);
    for (const whitespace of asciiWhitespace) {
      for (const value of [whitespace, `${whitespace}barbell`, `barbell${whitespace}`]) {
        expect(exerciseEquipmentValueSchema.safeParse(value).success, JSON.stringify(value)).toBe(false);
      }
    }

    expect(exerciseEquipmentListSchema.safeParse(['barbell', 'barbell']).success).toBe(false);
    expect(exerciseEquipmentListSchema.safeParse(['barbell', null]).success).toBe(false);

    const unchanged = 'bar\tbell';
    const parsed = exerciseEquipmentValueSchema.parse(unchanged);
    expect(parsed).toBe(unchanged);
  });
});

describe('training set contracts', () => {
  it('accepts a canonical target set with separate target values', () => {
    expect(targetSetInputSchema.safeParse({
      logicalTargetSetKey: uuid,
      orderIndex: 0,
      setType: 'drop',
      targetWeightKg: 80,
      targetReps: { minimum: 8, maximum: 10 },
      targetRir: 2,
      plannedRestSeconds: 120,
      importedFromLegacyPlan: false,
    }).success).toBe(true);
  });

  it('requires completion inputs to contain a confirmed timestamp', () => {
    const result = sessionCompletionSetInputSchema.safeParse({
      clientSetId: uuid,
      logicalTargetSetKey: null,
      orderIndex: 0,
      setType: 'work',
      weightKg: 80,
      reps: 10,
      rir: 2,
      note: 'Controlled.',
      completedAt: '2026-07-26T10:00:00.000Z',
      actualRestSeconds: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects every structural field in set corrections', () => {
    const validCorrection = {
      expectedVersion: 1,
      weightKg: 82.5,
      reps: 9,
      rir: 1,
      note: null,
    };
    const structuralFields = {
      id: uuid,
      sessionId: uuid,
      exerciseId: uuid,
      orderIndex: 0,
      setType: 'work',
      completedAt: '2026-07-26T10:00:00.000Z',
      logicalTargetSetKey: uuid,
      version: 2,
    };

    expect(setCorrectionInputSchema.safeParse(validCorrection).success).toBe(true);
    for (const [field, value] of Object.entries(structuralFields)) {
      expect(
        setCorrectionInputSchema.safeParse({ ...validCorrection, [field]: value }).success,
        field,
      ).toBe(false);
    }
  });
});

describe('running domain rules', () => {
  it('uses manual, then moving, then measured-minus-paused duration', () => {
    expect(getEffectiveRunDurationSeconds(run)).toBe(1_500);
    expect(getEffectiveRunDurationSeconds({
      ...run,
      manualEffectiveDurationSeconds: null,
    })).toBe(1_800);
    expect(getEffectiveRunDurationSeconds({
      ...run,
      manualEffectiveDurationSeconds: null,
      movingDurationSeconds: null,
    })).toBe(1_900);
    expect(getEffectiveRunDurationSeconds({
      ...run,
      manualEffectiveDurationSeconds: null,
      movingDurationSeconds: null,
      measuredDurationSeconds: 50,
      pausedDurationSeconds: 100,
    })).toBe(0);
  });

  it('calculates pace only with positive distance and effective duration', () => {
    expect(calculateRunPaceSecondsPerKilometer(run)).toBe(300);
    expect(calculateRunPaceSecondsPerKilometer({ ...run, distanceMeters: 0 })).toBeNull();
    expect(calculateRunPaceSecondsPerKilometer({
      ...run,
      manualEffectiveDurationSeconds: 0,
    })).toBeNull();
  });

  it('validates canonical raw values without a stored pace field', () => {
    expect(runRawValuesSchema.safeParse(run).success).toBe(true);
    expect(runRawValuesSchema.safeParse({ ...run, pace: '5:00' }).success).toBe(false);
  });

  it('does not allow incomplete runs to create run records', () => {
    expect(isRunEligibleForPersonalRecord({
      status: 'incomplete',
      personalRecordType: 'longest_run_distance',
      run,
    })).toBe(false);
    expect(isRunEligibleForPersonalRecord({
      status: 'completed',
      personalRecordType: 'best_run_pace',
      run,
    })).toBe(true);
  });

  it('requires positive values relevant to each completed run record type', () => {
    const zeroRun = {
      ...run,
      distanceMeters: 0,
      manualEffectiveDurationSeconds: 0,
    };
    expect(isRunEligibleForPersonalRecord({
      status: 'completed',
      personalRecordType: 'longest_run_distance',
      run: zeroRun,
    })).toBe(false);
    expect(isRunEligibleForPersonalRecord({
      status: 'completed',
      personalRecordType: 'longest_run_duration',
      run: zeroRun,
    })).toBe(false);
    expect(isRunEligibleForPersonalRecord({
      status: 'completed',
      personalRecordType: 'best_run_pace',
      run: zeroRun,
    })).toBe(false);
  });
});

describe('strength domain rules', () => {
  it('doubles per-hand and per-side weight only for volume', () => {
    expect(getEffectiveLoadForVolumeKg(20, 'per_hand')).toBe(40);
    expect(getEffectiveLoadForVolumeKg(20, 'per_side')).toBe(40);
    expect(calculateSetVolumeKg(20, 10, 'per_hand')).toBe(400);
    expect(calculateEpleyOneRepMaxKg(20, 10, 'per_hand')).toBeCloseTo(26.6667, 4);
    expect(calculateEpleyOneRepMaxKg(20, 10, 'per_side')).toBeCloseTo(26.6667, 4);
  });

  it('does not invent kilogram volume or one-rep max for bodyweight', () => {
    expect(getEffectiveLoadForVolumeKg(0, 'bodyweight_only')).toBeNull();
    expect(calculateSetVolumeKg(0, 10, 'bodyweight_only')).toBeNull();
    expect(calculateEpleyOneRepMaxKg(80, 10, 'bodyweight_only')).toBeNull();
  });

  it('does not invent kilogram volume for untracked weight', () => {
    expect(getEffectiveLoadForVolumeKg(80, 'no_weight_tracking')).toBeNull();
    expect(calculateSetVolumeKg(80, 10, 'no_weight_tracking')).toBeNull();
    expect(calculateEpleyOneRepMaxKg(80, 10, 'no_weight_tracking')).toBeNull();
  });

  it('keeps Epley encapsulated and uses added weight as entered', () => {
    expect(calculateEpleyOneRepMaxKg(30, 10, 'added_weight_only')).toBe(40);
    expect(calculateEpleyOneRepMaxKg(0, 10, 'total_weight')).toBeNull();
  });

  it('allows only confirmed work sets to create strength records', () => {
    expect(isSetEligibleForPersonalRecord({
      setType: 'work',
      completedAt: '2026-07-26T10:00:00.000Z',
      sessionStatus: 'incomplete',
    })).toBe(true);
    expect(isSetEligibleForPersonalRecord({
      setType: 'warmup',
      completedAt: '2026-07-26T10:00:00.000Z',
      sessionStatus: 'completed',
    })).toBe(false);
    expect(isSetEligibleForPersonalRecord({
      setType: 'drop',
      completedAt: '2026-07-26T10:00:00.000Z',
      sessionStatus: 'completed',
    })).toBe(false);
    expect(isSetEligibleForPersonalRecord({
      setType: 'work',
      completedAt: null,
      sessionStatus: 'completed',
    })).toBe(false);
  });
});
