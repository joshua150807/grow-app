import { z } from 'zod';

export const exerciseScopeSchema = z.enum(['system', 'user']);
export type ExerciseScope = z.infer<typeof exerciseScopeSchema>;

export const exerciseStatusSchema = z.enum(['active', 'archived', 'unpublished']);
export type ExerciseStatus = z.infer<typeof exerciseStatusSchema>;

export const exerciseCategorySchema = z.enum(['strength', 'cardio', 'mobility', 'stretching']);
export type ExerciseCategory = z.infer<typeof exerciseCategorySchema>;

export const loadTypeSchema = z.enum([
  'total_weight',
  'per_hand',
  'per_side',
  'added_weight_only',
  'bodyweight_only',
  'no_weight_tracking',
]);
export type LoadType = z.infer<typeof loadTypeSchema>;

export const systemExerciseMuscleSchema = z.enum([
  'abs',
  'abductors',
  'adductors',
  'biceps',
  'calves',
  'chest',
  'forearms',
  'front_delts',
  'glutes',
  'hamstrings',
  'hip_flexors',
  'lats',
  'lower_back',
  'obliques',
  'quadriceps',
  'rear_delts',
  'side_delts',
  'traps',
  'triceps',
  'upper_back',
]);
export type SystemExerciseMuscle = z.infer<typeof systemExerciseMuscleSchema>;

export const systemExerciseEquipmentSchema = z.enum([
  'barbell',
  'bench',
  'cable',
  'dip_bars',
  'dumbbell',
  'elliptical',
  'ez_bar',
  'kettlebell',
  'landmine',
  'machine',
  'mat',
  'pull_up_bar',
  'plyo_box',
  'rowing_machine',
  'smith_machine',
  'squat_rack',
  'stair_climber',
  'stationary_bike',
  'treadmill',
  'trap_bar',
]);
export type SystemExerciseEquipment = z.infer<typeof systemExerciseEquipmentSchema>;

export const personalPlanStatusSchema = z.enum(['draft', 'scheduled', 'active', 'archived']);
export type PersonalPlanStatus = z.infer<typeof personalPlanStatusSchema>;

export const trainingTemplateStatusSchema = z.enum(['active', 'archived', 'unpublished']);
export type TrainingTemplateStatus = z.infer<typeof trainingTemplateStatusSchema>;

export const planActivationStatusSchema = z.enum(['pending', 'applied', 'cancelled']);
export type PlanActivationStatus = z.infer<typeof planActivationStatusSchema>;

export const trainingUnitTypeSchema = z.enum(['strength', 'run', 'rest', 'mobility', 'stretching']);
export type TrainingUnitType = z.infer<typeof trainingUnitTypeSchema>;

export const setTypeSchema = z.enum(['warmup', 'work', 'drop']);
export type SetType = z.infer<typeof setTypeSchema>;

export const persistedSessionStatusSchema = z.enum(['completed', 'incomplete']);
export type PersistedSessionStatus = z.infer<typeof persistedSessionStatusSchema>;

export const progressionSuggestionStatusSchema = z.enum(['pending', 'accepted', 'rejected', 'expired']);
export type ProgressionSuggestionStatus = z.infer<typeof progressionSuggestionStatusSchema>;

export const legacyImportStatusSchema = z.enum(['not_started', 'running', 'completed', 'failed']);
export type LegacyImportStatus = z.infer<typeof legacyImportStatusSchema>;

export const sessionOriginSchema = z.enum(['native_v2', 'legacy_import', 'legacy_top_up']);
export type SessionOrigin = z.infer<typeof sessionOriginSchema>;

export const personalRecordOriginSchema = z.enum(['native_v2', 'legacy_derived']);
export type PersonalRecordOrigin = z.infer<typeof personalRecordOriginSchema>;

export const personalRecordTypeSchema = z.enum([
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
export type PersonalRecordType = z.infer<typeof personalRecordTypeSchema>;

export const cycleTriggerSchema = z.enum([
  'plan_activated',
  'plan_reactivated',
  'session_completed',
  'alternative_unit_completed',
  'rest_completed',
  'rest_skipped',
  'plan_revision_remapped',
]);
export type CycleTrigger = z.infer<typeof cycleTriggerSchema>;

export const idempotencyOperationSchema = z.enum([
  'create_plan',
  'create_plan_from_template',
  'complete_session',
  'save_incomplete_session',
  'skip_rest',
  'create_private_exercise',
]);
export type IdempotencyOperation = z.infer<typeof idempotencyOperationSchema>;
