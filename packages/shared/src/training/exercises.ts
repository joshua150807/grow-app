import { z } from 'zod';
import {
  exerciseCategorySchema,
  exerciseScopeSchema,
  exerciseStatusSchema,
  loadTypeSchema,
  uiMuscleGroupSchema,
} from './enums.js';
import {
  exerciseEquipmentListSchema,
  exerciseEquipmentValueSchema,
  exerciseIdSchema,
  isoDateTimeSchema,
  nameSchema,
  systemExerciseKeySchema,
  versionSchema,
} from './primitives.js';

const queryInteger = (minimum: number, maximum?: number) => z.preprocess(
  (value) => {
    if (typeof value !== 'string') return value;
    if (!/^\d+$/.test(value)) return value;
    return Number(value);
  },
  maximum === undefined
    ? z.number().int().safe().min(minimum)
    : z.number().int().safe().min(minimum).max(maximum),
);

export const trainingExerciseSchema = z.object({
  id: exerciseIdSchema,
  systemKey: systemExerciseKeySchema.nullable(),
  scope: exerciseScopeSchema,
  status: exerciseStatusSchema,
  category: exerciseCategorySchema,
  loadType: loadTypeSchema,
  name: nameSchema,
  mainMuscle: z.string().nullable(),
  supportingMuscles: z.array(z.string()),
  difficulty: z.string().nullable(),
  equipment: exerciseEquipmentListSchema,
  isHome: z.boolean(),
  isGym: z.boolean(),
  isBodyweight: z.boolean(),
  imageReference: z.string().nullable(),
  executionInstructions: z.string().nullable(),
  commonMistakes: z.string().nullable(),
  safetyNotes: z.string().nullable(),
  version: versionSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
}).strict();
export type TrainingExercise = z.infer<typeof trainingExerciseSchema>;

export const listTrainingExercisesQuerySchema = z.object({
  search: z.string().trim().min(1).max(120).optional(),
  category: exerciseCategorySchema.optional(),
  loadType: loadTypeSchema.optional(),
  muscle: z.string().trim().min(1).max(50).optional(),
  equipment: exerciseEquipmentValueSchema.optional(),
  environment: z.enum(['home', 'gym']).optional(),
  scope: exerciseScopeSchema.optional(),
  limit: queryInteger(1, 100).default(50),
  page: queryInteger(0).default(0),
}).strict().superRefine(({ limit, page }, context) => {
  if (!Number.isSafeInteger(page * limit)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Pagination offset must be a safe integer.',
      path: ['page'],
    });
  }
});
export type ListTrainingExercisesQuery = z.infer<typeof listTrainingExercisesQuerySchema>;

export const trainingExerciseIdParamsSchema = z.object({
  exerciseId: exerciseIdSchema,
}).strict();
export type TrainingExerciseIdParams = z.infer<typeof trainingExerciseIdParamsSchema>;

export const listTrainingExercisesResponseSchema = z.object({
  exercises: z.array(trainingExerciseSchema),
  pagination: z.object({
    page: z.number().int().nonnegative(),
    limit: z.number().int().min(1).max(100),
    hasMore: z.boolean(),
  }).strict(),
}).strict();
export type ListTrainingExercisesResponse = z.infer<typeof listTrainingExercisesResponseSchema>;

// Batch lookup by id, used by plan views to resolve every referenced exercise in one
// request instead of one GET per exercise. Ids the caller cannot see (inactive, foreign
// private exercises, unknown ids) are simply absent from the response.
export const TRAINING_EXERCISE_LOOKUP_MAX_IDS = 100;
export const lookupTrainingExercisesQuerySchema = z.object({
  ids: z.preprocess(
    (value) => (typeof value === 'string' ? value.split(',').filter((id) => id.length > 0) : value),
    z.array(exerciseIdSchema).min(1).max(TRAINING_EXERCISE_LOOKUP_MAX_IDS),
  ),
}).strict();
export type LookupTrainingExercisesQuery = z.infer<typeof lookupTrainingExercisesQuerySchema>;

export const lookupTrainingExercisesResponseSchema = z.object({
  exercises: z.array(trainingExerciseSchema),
}).strict();
export type LookupTrainingExercisesResponse = z.infer<typeof lookupTrainingExercisesResponseSchema>;

export const trainingExerciseDetailResponseSchema = z.object({
  exercise: trainingExerciseSchema,
}).strict();
export type TrainingExerciseDetailResponse = z.infer<typeof trainingExerciseDetailResponseSchema>;

// Private (scope='user') exercises only. Creates a user's own, freely-named exercise;
// it can never create or modify a system exercise. `category` defaults to 'strength' for
// callers that don't derive it from context (see the mobile picker, which maps the
// triggering unit's type — strength/mobility/stretching are the only unit types that can
// ever reach the picker — directly onto this same category enum).
export const createTrainingExerciseInputSchema = z.object({
  name: nameSchema,
  mainMuscle: uiMuscleGroupSchema.default('other'),
  category: exerciseCategorySchema.default('strength'),
}).strict();
export type CreateTrainingExerciseInput = z.infer<typeof createTrainingExerciseInputSchema>;
