import { z } from 'zod';
import {
  personalPlanStatusSchema,
  setTypeSchema,
  trainingTemplateStatusSchema,
  trainingUnitTypeSchema,
} from './enums.js';
import {
  descriptionSchema,
  exerciseIdSchema,
  ianaTimeZoneSchema,
  isoDateTimeSchema,
  localDateSchema,
  logicalTargetExerciseKeySchema,
  logicalTargetSetKeySchema,
  logicalUnitKeySchema,
  nameSchema,
  orderIndexSchema,
  planIdSchema,
  planRevisionIdSchema,
  repRangeSchema,
  restSecondsSchema,
  rirSchema,
  shortNoteSchema,
  templateIdSchema,
  templateRevisionIdSchema,
  templateUnitIdSchema,
  unitIdSchema,
  uuidSchema,
  versionSchema,
  weightKgSchema,
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
  // Set only when this revision's initial content was copied from a Grow template
  // revision (see training_plan_revisions_v2.source_template_revision_id) — null for a
  // hand-authored plan revision. `.default(null)` (not just `.nullable()`): the repository
  // does not populate this field yet, so a missing key must still parse — but the *output*
  // is always normalized to `null`, never left as `undefined` — see the matching note on
  // sourceTemplateId below.
  sourceTemplateRevisionId: templateRevisionIdSchema.nullable().default(null),
  units: z.array(planUnitSchema),
}).strict();

export const trainingPlanScheduleSchema = z.object({
  startDate: localDateSchema,
  timeZone: ianaTimeZoneSchema,
  effectiveAt: isoDateTimeSchema,
}).strict();

const trainingPlanSummaryShape = {
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
  schedule: trainingPlanScheduleSchema.nullable(),
  // Grow-template provenance — always null for a hand-authored own plan. A plan saved from
  // the Grow catalog carries the originating template's id; savedAt only ever exists
  // alongside a sourceTemplateId (see the matching DB check on training_plans_v2).
  //
  // All three use `.default(null)` rather than a bare `.nullable()`: the repository's own
  // trainingPlanSummarySchema.safeParse(...)/trainingPlanSchema.safeParse(...) calls
  // (trainingPlanRepository.ts) do not supply these keys at all yet (no repository change
  // in this step), so a missing key must still parse successfully. A bare `.nullable()`
  // would reject a missing key outright and break every existing plan list/get call the
  // moment this package is rebuilt. `.default(null)` accepts the missing key *and*
  // normalizes the parsed output to `null` — so every caller of this schema only ever sees
  // `null | value`, never `undefined`, regardless of whether the source object supplied an
  // explicit `null` or omitted the key entirely.
  sourceTemplateId: templateIdSchema.nullable().default(null),
  savedAt: isoDateTimeSchema.nullable().default(null),
  // Denormalized at save time from the template's own imageReference, so a plan card can
  // render it without a separate template lookup and without depending on the template
  // still existing or being unchanged later.
  sourceTemplateImageReference: z.string().nullable().default(null),
};

function validateScheduleStatus(
  plan: { status: z.infer<typeof personalPlanStatusSchema>; schedule: unknown },
  context: z.RefinementCtx,
) {
  if ((plan.status === 'scheduled') !== (plan.schedule !== null)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Schedule metadata must exist exactly for scheduled plans.',
      path: ['schedule'],
    });
  }
}

function validateTemplateProvenance(
  plan: {
    sourceTemplateId: string | null;
    savedAt: string | null;
    sourceTemplateImageReference: string | null;
  },
  context: z.RefinementCtx,
) {
  const hasSourceTemplateId = plan.sourceTemplateId !== null;
  if (plan.savedAt !== null && !hasSourceTemplateId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'savedAt requires a sourceTemplateId.',
      path: ['savedAt'],
    });
  }
  if (plan.sourceTemplateImageReference !== null && !hasSourceTemplateId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'sourceTemplateImageReference requires a sourceTemplateId.',
      path: ['sourceTemplateImageReference'],
    });
  }
}

export const trainingPlanSummarySchema = z.object(trainingPlanSummaryShape)
  .strict()
  .superRefine(validateScheduleStatus)
  .superRefine(validateTemplateProvenance);

export const trainingPlanSchema = z.object({
  ...trainingPlanSummaryShape,
  revision: planRevisionSchema,
}).strict().superRefine(validateScheduleStatus).superRefine(validateTemplateProvenance);

export const listTrainingPlansResponseSchema = z.object({
  plans: z.array(trainingPlanSummarySchema),
}).strict();

export const trainingPlanDetailResponseSchema = z.object({
  plan: trainingPlanSchema,
}).strict();

// --- Grow template catalog (read-only shape; no create/update input schemas here — Grow
// templates are not authored through this API in this step, only read). Structurally
// mirrors the plan contracts above, since a template is exactly what a plan looks like
// before any user has copied it. Template target sets have no importedFromLegacyPlan flag
// (training_template_target_sets_v2 has no such column — that field only ever applies to a
// user's own plan history).

export const templateTargetSetSchema = z.object({
  id: uuidSchema,
  logicalTargetSetKey: logicalTargetSetKeySchema,
  orderIndex: orderIndexSchema,
  setType: setTypeSchema,
  targetWeightKg: weightKgSchema.nullable(),
  targetReps: repRangeSchema.nullable(),
  targetRir: rirSchema,
  plannedRestSeconds: restSecondsSchema,
}).strict();

export const templateTargetExerciseSchema = z.object({
  id: uuidSchema,
  logicalTargetExerciseKey: logicalTargetExerciseKeySchema,
  exerciseId: exerciseIdSchema,
  orderIndex: orderIndexSchema,
  note: shortNoteSchema.nullable(),
  targetSets: z.array(templateTargetSetSchema),
}).strict();

export const templateUnitSchema = z.object({
  id: templateUnitIdSchema,
  logicalUnitKey: logicalUnitKeySchema,
  name: nameSchema,
  unitType: trainingUnitTypeSchema,
  orderIndex: orderIndexSchema,
  exercises: z.array(templateTargetExerciseSchema),
}).strict();

export const templateRevisionSchema = z.object({
  id: templateRevisionIdSchema,
  revisionNumber: z.number().int().positive(),
  createdAt: isoDateTimeSchema,
  defaultWeeklyGoal: z.number().int().positive().nullable(),
  units: z.array(templateUnitSchema),
}).strict();

const trainingTemplateSummaryShape = {
  id: templateIdSchema,
  name: nameSchema,
  description: descriptionSchema.nullable(),
  status: trainingTemplateStatusSchema,
  version: versionSchema,
  currentRevisionId: templateRevisionIdSchema.nullable(),
  imageReference: z.string().nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
};

export const trainingTemplateSummarySchema = z.object(trainingTemplateSummaryShape).strict();

export const trainingTemplateSchema = z.object({
  ...trainingTemplateSummaryShape,
  revision: templateRevisionSchema,
}).strict();

export const trainingTemplateIdParamsSchema = z.object({
  templateId: templateIdSchema,
}).strict();

// How a specific signed-in user relates to a given template — not part of the template's
// own identity, so it stays a separate, composable shape rather than folded into the
// template contracts above. Field is `userPlanId`, never `savedPlanId`: it identifies
// whichever training_plans_v2 row belongs to this user for this template, regardless of
// that plan's own status (draft/scheduled/active/archived).
//
// userPlanId is one-directional evidence, not a biconditional: a plan can exist for this
// user+template (e.g. created straight from the template, never explicitly saved) without
// isSaved being true, and it can be the user's active plan without ever having been saved
// either. So neither isSaved nor isActive being true is required for userPlanId to be set,
// but a userPlanId is required whenever isSaved or isActive is true — either flag claiming a
// user-plan relationship that doesn't have a userPlanId to back it up is the only invalid
// shape.
function validateTemplateUserProjection(
  projection: { isSaved: boolean; isActive: boolean; userPlanId: string | null },
  context: z.RefinementCtx,
) {
  if (projection.isSaved && projection.userPlanId === null) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'isSaved requires a userPlanId.',
      path: ['userPlanId'],
    });
  }
  if (projection.isActive && projection.userPlanId === null) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'isActive requires a userPlanId.',
      path: ['userPlanId'],
    });
  }
}

export const trainingTemplateUserProjectionSchema = z.object({
  isSaved: z.boolean(),
  isActive: z.boolean(),
  userPlanId: planIdSchema.nullable(),
}).strict().superRefine(validateTemplateUserProjection);

// Wire-level composition: the template's own identity (trainingTemplateSummarySchema /
// trainingTemplateSchema) stays user-independent, and the per-user relationship
// (trainingTemplateUserProjectionSchema) stays a sibling rather than being folded into it —
// see the comment on validateTemplateUserProjection above. These are the only two places that
// join the two shapes for a response body.
export const trainingTemplateListItemSchema = z.object({
  template: trainingTemplateSummarySchema,
  userPlan: trainingTemplateUserProjectionSchema,
}).strict();

export const listTrainingTemplatesResponseSchema = z.object({
  templates: z.array(trainingTemplateListItemSchema),
}).strict();

export const trainingTemplateDetailResponseSchema = z.object({
  template: trainingTemplateSchema,
  userPlan: trainingTemplateUserProjectionSchema,
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
export type TrainingPlanSchedule = z.infer<typeof trainingPlanScheduleSchema>;
export type TrainingPlanSummary = z.infer<typeof trainingPlanSummarySchema>;
export type TrainingPlan = z.infer<typeof trainingPlanSchema>;
export type ListTrainingPlansResponse = z.infer<typeof listTrainingPlansResponseSchema>;
export type TrainingPlanDetailResponse = z.infer<typeof trainingPlanDetailResponseSchema>;
export type TemplateTargetSet = z.infer<typeof templateTargetSetSchema>;
export type TemplateTargetExercise = z.infer<typeof templateTargetExerciseSchema>;
export type TemplateUnit = z.infer<typeof templateUnitSchema>;
export type TemplateRevision = z.infer<typeof templateRevisionSchema>;
export type TrainingTemplateSummary = z.infer<typeof trainingTemplateSummarySchema>;
export type TrainingTemplate = z.infer<typeof trainingTemplateSchema>;
export type TrainingTemplateIdParams = z.infer<typeof trainingTemplateIdParamsSchema>;
export type TrainingTemplateUserProjection = z.infer<typeof trainingTemplateUserProjectionSchema>;
export type TrainingTemplateListItem = z.infer<typeof trainingTemplateListItemSchema>;
export type ListTrainingTemplatesResponse = z.infer<typeof listTrainingTemplatesResponseSchema>;
export type TrainingTemplateDetailResponse = z.infer<typeof trainingTemplateDetailResponseSchema>;
