import { z } from 'zod';
import { persistedSessionStatusSchema, trainingUnitTypeSchema } from './enums.js';
import {
  exerciseIdSchema,
  idempotencyKeySchema,
  isoDateTimeSchema,
  logicalTargetExerciseKeySchema,
  logicalUnitKeySchema,
  nameSchema,
  orderIndexSchema,
  planIdSchema,
  planRevisionIdSchema,
  sessionExerciseIdSchema,
  sessionIdSchema,
  shortNoteSchema,
  unitIdSchema,
} from './primitives.js';
import {
  persistedSessionSetSchema,
  sessionCompletionSetInputSchema,
} from './contracts.js';

const uniqueBy = <T>(values: T[]) => new Set(values).size === values.length;

// One performed exercise within a session-completion request. `exerciseId` is the actual
// ground truth of what was done (mirrors targetSet identity requirements elsewhere) —
// `logicalTargetExerciseKey` is only ever an optional correlation back to the plan's own
// definition, exactly as nullable as sessionCompletionSetInputSchema's own
// logicalTargetSetKey is for an individual set. No client-supplied note here: the persisted
// exercise's note is a snapshot of the plan's own target-exercise note at save time (see
// trainingSessionRepository.ts), not new session input — there is no shared per-session,
// per-exercise note contract to preserve or extend.
export const sessionCompletionExerciseInputSchema = z.object({
  exerciseId: exerciseIdSchema,
  logicalTargetExerciseKey: logicalTargetExerciseKeySchema.nullable(),
  orderIndex: orderIndexSchema,
  sets: z.array(sessionCompletionSetInputSchema).min(1),
}).strict().superRefine((exercise, context) => {
  if (!uniqueBy(exercise.sets.map((set) => set.orderIndex))) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Set positions must be unique.', path: ['sets'] });
  }
  if (!uniqueBy(exercise.sets.map((set) => set.clientSetId))) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Client set ids must be unique.', path: ['sets'] });
  }
  if (exercise.logicalTargetExerciseKey === null) {
    const correlatedSet = exercise.sets.find((set) => set.logicalTargetSetKey !== null);
    if (correlatedSet) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A set cannot correlate to a target set of an exercise that has no logicalTargetExerciseKey.',
        path: ['sets'],
      });
    }
  }
});

// The terminal save request for one completed-or-incomplete training unit. `unitId` names
// the actually-performed plan unit (the server resolves and snapshots its plan/revision/
// exercise data from there — see trainingSessionRepository.ts); no run fields exist here
// because run/rest/mobility/stretching units carry no target exercises to begin with (see
// planUnitInputSchema in plans.ts), so an exercise-less session already covers them.
export const createTrainingSessionInputSchema = z.object({
  planId: planIdSchema,
  unitId: unitIdSchema,
  status: persistedSessionStatusSchema,
  idempotencyKey: idempotencyKeySchema,
  exercises: z.array(sessionCompletionExerciseInputSchema),
}).strict().superRefine((session, context) => {
  if (!uniqueBy(session.exercises.map((exercise) => exercise.orderIndex))) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Exercise positions must be unique.', path: ['exercises'] });
  }
  const correlationKeys = session.exercises
    .map((exercise) => exercise.logicalTargetExerciseKey)
    .filter((key): key is string => key !== null);
  if (!uniqueBy(correlationKeys)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Exercise logical keys must be unique.', path: ['exercises'] });
  }
});
export type SessionCompletionExerciseInput = z.infer<typeof sessionCompletionExerciseInputSchema>;
export type CreateTrainingSessionInput = z.infer<typeof createTrainingSessionInputSchema>;

export const persistedSessionExerciseSchema = z.object({
  id: sessionExerciseIdSchema,
  exerciseId: exerciseIdSchema,
  exerciseName: nameSchema,
  exerciseMainMuscle: z.string().nullable(),
  logicalTargetExerciseKey: logicalTargetExerciseKeySchema.nullable(),
  orderIndex: orderIndexSchema,
  note: shortNoteSchema.nullable(),
  sets: z.array(persistedSessionSetSchema),
}).strict();
export type PersistedSessionExercise = z.infer<typeof persistedSessionExerciseSchema>;

// The full historical snapshot: plan name, revision number, unit name/type and every
// exercise's identity are copied values, independent of whether the source plan/revision/
// unit still exist (see the on-delete-set-null design note in the session-core migration) —
// planId/planRevisionId/sourceUnitId are kept only as best-effort backlinks and go null once
// their source is gone.
export const trainingSessionSchema = z.object({
  id: sessionIdSchema,
  planId: planIdSchema.nullable(),
  planRevisionId: planRevisionIdSchema.nullable(),
  sourceUnitId: unitIdSchema.nullable(),
  planName: nameSchema,
  revisionNumber: z.number().int().positive(),
  logicalUnitKey: logicalUnitKeySchema,
  unitName: nameSchema,
  unitType: trainingUnitTypeSchema,
  status: persistedSessionStatusSchema,
  idempotencyKey: idempotencyKeySchema,
  createdAt: isoDateTimeSchema,
  exercises: z.array(persistedSessionExerciseSchema),
}).strict();
export type TrainingSession = z.infer<typeof trainingSessionSchema>;

// `created` distinguishes a genuinely new terminal record from an idempotent replay that
// returned the pre-existing one (same shape as DeepWorkSessionRepository.insertOrFind) — the
// cycle only ever advances on the `created: true` branch, exactly once per idempotency key.
export const trainingSessionDetailResponseSchema = z.object({
  session: trainingSessionSchema,
  created: z.boolean(),
}).strict();
export type TrainingSessionDetailResponse = z.infer<typeof trainingSessionDetailResponseSchema>;
