import { z } from 'zod';
import { persistedSessionStatusSchema, setTypeSchema } from './enums.js';
import {
  clientSetIdSchema,
  completedRepsSchema,
  distanceMetersSchema,
  durationSecondsSchema,
  idempotencyKeySchema,
  isoDateTimeSchema,
  logicalTargetSetKeySchema,
  orderIndexSchema,
  repRangeSchema,
  restSecondsSchema,
  rirSchema,
  sessionSetIdSchema,
  shortNoteSchema,
  uuidSchema,
  versionSchema,
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

export const targetSetInputSchema = z.object(targetSetFields).strict();
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

export const sessionCompletionSetInputSchema = z.object(confirmedSessionSetFields).strict();
export const persistedSessionSetSchema = z.object({
  id: sessionSetIdSchema,
  ...confirmedSessionSetFields,
  version: versionSchema,
}).strict();
export type SessionCompletionSetInput = z.infer<typeof sessionCompletionSetInputSchema>;
export type PersistedSessionSet = z.infer<typeof persistedSessionSetSchema>;

export const setCorrectionInputSchema = z.object({
  expectedVersion: versionSchema,
  weightKg: weightKgSchema.nullable(),
  reps: completedRepsSchema.nullable(),
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
