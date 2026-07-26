import { z } from 'zod';
import {
  personalPlanStatusSchema,
  trainingUnitTypeSchema,
} from './enums.js';
import {
  exerciseIdSchema,
  ianaTimeZoneSchema,
  isoDateTimeSchema,
  localDateSchema,
  logicalTargetExerciseKeySchema,
  logicalUnitKeySchema,
  nameSchema,
  orderIndexSchema,
  planIdSchema,
  planRevisionIdSchema,
  shortNoteSchema,
  unitIdSchema,
  versionSchema,
} from './primitives.js';
import {
  persistedTargetSetSchema,
  targetSetInputSchema,
} from './contracts.js';

const uniqueBy = <T>(values: T[]) => new Set(values).size === values.length;

export const planTargetExerciseInputSchema = z.object({
  logicalTargetExerciseKey: logicalTargetExerciseKeySchema,
  exerciseId: exerciseIdSchema,
  orderIndex: orderIndexSchema,
  note: shortNoteSchema.nullable(),
  targetSets: z.array(targetSetInputSchema).min(1),
}).strict().superRefine((exercise, context) => {
  if (!uniqueBy(exercise.targetSets.map((set) => set.orderIndex))) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Target-set positions must be unique.', path: ['targetSets'] });
  }
  if (!uniqueBy(exercise.targetSets.map((set) => set.logicalTargetSetKey))) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Target-set logical keys must be unique.', path: ['targetSets'] });
  }
});

export const planUnitInputSchema = z.object({
  logicalUnitKey: logicalUnitKeySchema,
  name: nameSchema,
  unitType: trainingUnitTypeSchema,
  orderIndex: orderIndexSchema,
  exercises: z.array(planTargetExerciseInputSchema),
}).strict().superRefine((unit, context) => {
  if (unit.unitType === 'strength' && unit.exercises.length === 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Strength units require at least one exercise.', path: ['exercises'] });
  }
  if ((unit.unitType === 'run' || unit.unitType === 'rest') && unit.exercises.length > 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Run and rest units cannot contain target exercises.', path: ['exercises'] });
  }
  if (!uniqueBy(unit.exercises.map((exercise) => exercise.orderIndex))) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Exercise positions must be unique.', path: ['exercises'] });
  }
  if (!uniqueBy(unit.exercises.map((exercise) => exercise.logicalTargetExerciseKey))) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Exercise logical keys must be unique.', path: ['exercises'] });
  }
});

const planTreeObjectSchema = z.object({
  name: nameSchema,
  units: z.array(planUnitInputSchema).min(1),
}).strict();

function validatePlanTree(
  plan: z.infer<typeof planTreeObjectSchema>,
  context: z.RefinementCtx,
) {
  if (!uniqueBy(plan.units.map((unit) => unit.orderIndex))) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Unit positions must be unique.', path: ['units'] });
  }
  if (!uniqueBy(plan.units.map((unit) => unit.logicalUnitKey))) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Unit logical keys must be unique.', path: ['units'] });
  }
  const exerciseKeys = plan.units.flatMap((unit) => unit.exercises.map((exercise) => exercise.logicalTargetExerciseKey));
  const setKeys = plan.units.flatMap((unit) => unit.exercises.flatMap((exercise) => (
    exercise.targetSets.map((set) => set.logicalTargetSetKey)
  )));
  if (!uniqueBy(exerciseKeys)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Exercise logical keys must be unique within a plan.', path: ['units'] });
  }
  if (!uniqueBy(setKeys)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Target-set logical keys must be unique within a plan.', path: ['units'] });
  }
}

export const planTreeInputSchema = planTreeObjectSchema.superRefine(validatePlanTree);

export const createTrainingPlanInputSchema = planTreeObjectSchema.extend({
  weeklyGoal: z.number().int().positive(),
  activateImmediately: z.boolean().optional().default(false),
}).strict().superRefine(validatePlanTree);

export const updateTrainingPlanInputSchema = planTreeObjectSchema.extend({
  expectedVersion: versionSchema,
}).strict().superRefine(validatePlanTree);

export const planVersionInputSchema = z.object({
  expectedVersion: versionSchema,
}).strict();

export const scheduleTrainingPlanInputSchema = planVersionInputSchema.extend({
  startDate: localDateSchema,
  timeZone: ianaTimeZoneSchema,
}).strict();

export const updateWeeklyGoalInputSchema = z.object({
  expectedVersion: versionSchema,
  weeklyGoal: z.number().int().positive(),
}).strict();

export const planTargetExerciseSchema = z.object({
  id: z.string().uuid(),
  logicalTargetExerciseKey: logicalTargetExerciseKeySchema,
  exerciseId: exerciseIdSchema,
  orderIndex: orderIndexSchema,
  note: shortNoteSchema.nullable(),
  targetSets: z.array(persistedTargetSetSchema),
}).strict();

export const planUnitSchema = z.object({
  id: unitIdSchema,
  logicalUnitKey: logicalUnitKeySchema,
  name: nameSchema,
  unitType: trainingUnitTypeSchema,
  orderIndex: orderIndexSchema,
  exercises: z.array(planTargetExerciseSchema),
}).strict();

export const planRevisionSchema = z.object({
  id: planRevisionIdSchema,
  revisionNumber: z.number().int().positive(),
  createdAt: isoDateTimeSchema,
  units: z.array(planUnitSchema),
}).strict();

export const trainingPlanSummarySchema = z.object({
  id: planIdSchema,
  name: nameSchema,
  status: personalPlanStatusSchema,
  version: versionSchema,
  currentRevisionId: planRevisionIdSchema.nullable(),
  weeklyGoal: z.number().int().positive().nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  activatedAt: isoDateTimeSchema.nullable(),
  archivedAt: isoDateTimeSchema.nullable(),
}).strict();

export const trainingPlanSchema = trainingPlanSummarySchema.extend({
  revision: planRevisionSchema,
}).strict();

export type PlanTargetExerciseInput = z.infer<typeof planTargetExerciseInputSchema>;
export type PlanUnitInput = z.infer<typeof planUnitInputSchema>;
export type PlanTreeInput = z.infer<typeof planTreeInputSchema>;
export type CreateTrainingPlanInput = z.infer<typeof createTrainingPlanInputSchema>;
export type UpdateTrainingPlanInput = z.infer<typeof updateTrainingPlanInputSchema>;
export type PlanVersionInput = z.infer<typeof planVersionInputSchema>;
export type ScheduleTrainingPlanInput = z.infer<typeof scheduleTrainingPlanInputSchema>;
export type UpdateWeeklyGoalInput = z.infer<typeof updateWeeklyGoalInputSchema>;
export type PlanTargetExercise = z.infer<typeof planTargetExerciseSchema>;
export type PlanUnit = z.infer<typeof planUnitSchema>;
export type PlanRevision = z.infer<typeof planRevisionSchema>;
export type TrainingPlanSummary = z.infer<typeof trainingPlanSummarySchema>;
export type TrainingPlan = z.infer<typeof trainingPlanSchema>;
