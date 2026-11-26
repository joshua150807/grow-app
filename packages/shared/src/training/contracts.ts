import { z } from 'zod';
import { persistedSessionStatusSchema, setTypeSchema } from './enums.js';
import {
  actualRestSecondsInputSchema,
  clientSetIdSchema,
  completedRepsInputSchema,
  completedRepsSchema,
  distanceMetersSchema,
  durationSecondsSchema,
  idempotencyKeySchema,
  isoDateTimeSchema,
  logicalTargetSetKeySchema,
  orderIndexSchema,
  plannedRestSecondsInputSchema,
  repRangeInputSchema,
  repRangeSchema,
  restSecondsSchema,
  rirSchema,
  sessionSetIdSchema,
  shortNoteSchema,
  uuidSchema,
  versionSchema,
  weightKgInputSchema,
  weightKgSchema,
} from './primitives.js';

const targetSetFields = {
  logicalTargetSetKey: logicalTargetSetKeySchema,
  orderIndex: orderIndexSchema,
  setType: setTypeSchema,
  targetWeightKg: weightKgSchema.nullable(),
  targetReps: repRangeSchema.nullable(),
  targetRir: rirSchema,
  plannedRestSeconds: restSecondsSchema,
  importedFromLegacyPlan: z.boolean(),
};

// Input and persisted shapes are identical except for the plausibility limits: new writes are
// bounded (Fixplan B2), while persisted/read schemas keep the original open rules so historical
// rows stay readable (audit F04, U3).
export const targetSetInputSchema = z.object({
  ...targetSetFields,
  targetWeightKg: weightKgInputSchema.nullable(),
  targetReps: repRangeInputSchema.nullable(),
  plannedRestSeconds: plannedRestSecondsInputSchema,
}).strict();
export const persistedTargetSetSchema = z.object({
  id: uuidSchema,
  ...targetSetFields,
}).strict();
export type TargetSetInput = z.infer<typeof targetSetInputSchema>;
export type PersistedTargetSet = z.infer<typeof persistedTargetSetSchema>;

const confirmedSessionSetFields = {
  clientSetId: clientSetIdSchema,
  logicalTargetSetKey: logicalTargetSetKeySchema.nullable(),
  orderIndex: orderIndexSchema,
  setType: setTypeSchema,
  weightKg: weightKgSchema.nullable(),
  reps: completedRepsSchema.nullable(),
  rir: rirSchema,
  note: shortNoteSchema.nullable(),
  completedAt: isoDateTimeSchema,
  actualRestSeconds: restSecondsSchema.nullable(),
};

export const sessionCompletionSetInputSchema = z.object({
  ...confirmedSessionSetFields,
  weightKg: weightKgInputSchema.nullable(),
  reps: completedRepsInputSchema.nullable(),
  actualRestSeconds: actualRestSecondsInputSchema.nullable(),
}).strict();
export const persistedSessionSetSchema = z.object({
  id: sessionSetIdSchema,
  ...confirmedSessionSetFields,
  version: versionSchema,
}).strict();
export type SessionCompletionSetInput = z.infer<typeof sessionCompletionSetInputSchema>;
export type PersistedSessionSet = z.infer<typeof persistedSessionSetSchema>;

export const setCorrectionInputSchema = z.object({
  expectedVersion: versionSchema,
  weightKg: weightKgInputSchema.nullable(),
  reps: completedRepsInputSchema.nullable(),
  rir: rirSchema,
  note: shortNoteSchema.nullable(),
  idempotencyKey: idempotencyKeySchema.optional(),
}).strict();
export type SetCorrectionInput = z.infer<typeof setCorrectionInputSchema>;

export const runRawValuesSchema = z.object({
  distanceMeters: distanceMetersSchema,
  measuredDurationSeconds: durationSecondsSchema,
  movingDurationSeconds: durationSecondsSchema.nullable(),
  pausedDurationSeconds: durationSecondsSchema,
  manualEffectiveDurationSeconds: durationSecondsSchema.nullable(),
  note: shortNoteSchema.nullable(),
}).strict();
export type RunRawValues = z.infer<typeof runRawValuesSchema>;

export const persistedSessionSummarySchema = z.object({
  status: persistedSessionStatusSchema,
}).strict();
export type PersistedSessionSummary = z.infer<typeof persistedSessionSummarySchema>;
