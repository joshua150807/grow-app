import { z } from 'zod';
import { persistedSessionStatusSchema, setTypeSchema, trainingUnitTypeSchema } from './enums.js';
import {
  completedRepsSchema,
  durationSecondsSchema,
  exerciseIdSchema,
  idempotencyKeySchema,
  isoDateTimeSchema,
  logicalTargetExerciseKeySchema,
  logicalUnitKeySchema,
  nameSchema,
  orderIndexSchema,
  pgIntegerDurationSecondsInputSchema,
  planIdSchema,
  TRAINING_V2_LIMITS,
  planRevisionIdSchema,
  sessionExerciseIdSchema,
  sessionIdSchema,
  shortNoteSchema,
  unitIdSchema,
  weightKgSchema,
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
// logicalTargetSetKey is for an individual set. `note` is today's client-supplied exercise
// note (the session screen's "Notiz zur Übung" field) — persisted verbatim to
// training_session_exercises_v2.note (see trainingSessionRepository.ts) and never merged with
// or overwritten by any past note; it is what findLastExerciseNote later surfaces as "Letzte
// Notiz" for the next session of the same exerciseId.
export const sessionCompletionExerciseInputSchema = z.object({
  exerciseId: exerciseIdSchema,
  logicalTargetExerciseKey: logicalTargetExerciseKeySchema.nullable(),
  orderIndex: orderIndexSchema,
  note: shortNoteSchema.nullable().default(null),
  sets: z.array(sessionCompletionSetInputSchema).min(1).max(TRAINING_V2_LIMITS.maxSetsPerExercise),
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
//
// startedAt/endedAt/pausedDurationSeconds are all optional and independently default to
// null/0 — an already-installed client build that predates timing (an EAS-updated build can
// lag the API, per AGENTS.md) must keep saving sessions exactly as before, with "duration
// unknown" persisted rather than a request rejection. A client that does send timing must send
// startedAt and endedAt together (see the superRefine below); a lone one of the pair can only
// ever be a bug, never a legitimate partial state.
export const createTrainingSessionInputSchema = z.object({
  planId: planIdSchema,
  unitId: unitIdSchema,
  status: persistedSessionStatusSchema,
  idempotencyKey: idempotencyKeySchema,
  startedAt: isoDateTimeSchema.nullable().default(null),
  endedAt: isoDateTimeSchema.nullable().default(null),
  pausedDurationSeconds: pgIntegerDurationSecondsInputSchema.default(0),
  exercises: z.array(sessionCompletionExerciseInputSchema).max(TRAINING_V2_LIMITS.maxExercisesPerUnit),
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

  if ((session.startedAt === null) !== (session.endedAt === null)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'startedAt and endedAt must both be present or both be null.',
      path: ['endedAt'],
    });
    return;
  }
  if (session.startedAt === null || session.endedAt === null) {
    // Without timing there is no gross duration a pause could be part of (Fixplan D5).
    if (session.pausedDurationSeconds !== 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'pausedDurationSeconds must be 0 when no startedAt/endedAt is sent.',
        path: ['pausedDurationSeconds'],
      });
    }
    return;
  }

  const startedAtMs = Date.parse(session.startedAt);
  const endedAtMs = Date.parse(session.endedAt);
  if (endedAtMs < startedAtMs) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'endedAt must not be before startedAt.', path: ['endedAt'] });
    return;
  }
  const grossDurationSeconds = (endedAtMs - startedAtMs) / 1000;
  if (session.pausedDurationSeconds > grossDurationSeconds) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'pausedDurationSeconds must not exceed the gross duration between startedAt and endedAt.',
      path: ['pausedDurationSeconds'],
    });
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
//
// startedAt/endedAt are both null exactly for a legacy session or one saved by a
// timing-unaware client build — duration is then unknown, never estimated (see
// getEffectiveTrainingSessionDurationSeconds in domain.ts, which returns null in that case
// rather than falling back to createdAt or any set's completedAt).
const trainingSessionSummaryShape = {
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
  startedAt: isoDateTimeSchema.nullable(),
  endedAt: isoDateTimeSchema.nullable(),
  pausedDurationSeconds: durationSecondsSchema,
  createdAt: isoDateTimeSchema,
};

// The list-view projection of a session: every historical identity field, but without the
// nested exercises/sets a history/dashboard list never renders — avoids an n+1 exercises/sets
// fetch per row (see trainingSessionRepository.ts's list()). Mirrors the
// trainingPlanSummarySchema/trainingPlanSchema split in plans.ts.
export const trainingSessionSummarySchema = z.object(trainingSessionSummaryShape).strict();
export type TrainingSessionSummary = z.infer<typeof trainingSessionSummarySchema>;

export const trainingSessionSchema = z.object({
  ...trainingSessionSummaryShape,
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

// Coerces a string query param to an integer the same way exercises.ts's own queryInteger
// does (duplicated locally rather than shared/exported — the only two call sites, one per
// module, would otherwise force an unrelated cross-file dependency for four lines of logic).
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

// Read path for the session history/dashboard — list (paginated, newest first) and get-by-id.
// No status/date/plan filters here: not requested for this read path, and every terminal
// session (completed or incomplete) must stay visible in the plain list.
export const listTrainingSessionsQuerySchema = z.object({
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
export type ListTrainingSessionsQuery = z.infer<typeof listTrainingSessionsQuerySchema>;

export const listTrainingSessionsResponseSchema = z.object({
  sessions: z.array(trainingSessionSummarySchema),
  pagination: z.object({
    page: z.number().int().nonnegative(),
    limit: z.number().int().min(1).max(100),
    hasMore: z.boolean(),
  }).strict(),
}).strict();
export type ListTrainingSessionsResponse = z.infer<typeof listTrainingSessionsResponseSchema>;

export const trainingSessionIdParamsSchema = z.object({
  sessionId: sessionIdSchema,
}).strict();
export type TrainingSessionIdParams = z.infer<typeof trainingSessionIdParamsSchema>;

// Get-by-id response — deliberately not trainingSessionDetailResponseSchema, which also
// carries `created` (a create-only concept with no meaning for a plain read).
export const trainingSessionResponseSchema = z.object({
  session: trainingSessionSchema,
}).strict();
export type TrainingSessionResponse = z.infer<typeof trainingSessionResponseSchema>;

// The most recent exercise-level note the user left on this exercise, across every past
// session — read-only lookup for "Letzte Notiz" (shown next to today's note field, never
// copied into it). `null`/`null` for an exercise with no session history yet, or one where
// every past note was empty — that is a valid, non-error result, not a 404.
export const lastExerciseNoteResponseSchema = z.object({
  note: shortNoteSchema.nullable(),
  completedAt: isoDateTimeSchema.nullable(),
}).strict();
export type LastExerciseNoteResponse = z.infer<typeof lastExerciseNoteResponseSchema>;

// The sets of this exercise from the user's most recent saved session that contains it, in
// their logged order — read-only lookup for the grey "last time" placeholders in the session
// screen (never copied into today's inputs). `completedAt: null` + `sets: []` when the exercise
// has no session history yet — a valid result, not a 404.
export const lastExerciseSetsResponseSchema = z.object({
  completedAt: isoDateTimeSchema.nullable(),
  sets: z.array(z.object({
    orderIndex: orderIndexSchema,
    setType: setTypeSchema,
    weightKg: weightKgSchema.nullable(),
    reps: completedRepsSchema.nullable(),
  }).strict()).max(TRAINING_V2_LIMITS.maxSetsPerExercise),
}).strict();
export type LastExerciseSetsResponse = z.infer<typeof lastExerciseSetsResponseSchema>;

export const trainingSessionHistorySummarySchema = trainingSessionSummarySchema.extend({
  exerciseCount: z.number().int().safe().nonnegative(),
  volumeKg: weightKgSchema,
});
export type TrainingSessionHistorySummary = z.infer<typeof trainingSessionHistorySummarySchema>;

export const trainingSessionHistorySchema = trainingSessionSchema.extend({
  volumeKg: weightKgSchema,
});
export type TrainingSessionHistory = z.infer<typeof trainingSessionHistorySchema>;

export const listTrainingSessionHistoryResponseSchema = listTrainingSessionsResponseSchema.extend({
  sessions: z.array(trainingSessionHistorySummarySchema),
});

export const trainingSessionHistoryResponseSchema = trainingSessionResponseSchema.extend({
  session: trainingSessionHistorySchema,
});

export const trainingSessionStatsResponseSchema = z.object({
  totalSessions: z.number().int().safe().nonnegative(),
  // Sum of measured effective durations. Sessions with no timing contribute no measurement.
  totalDurationSeconds: z.number().finite().nonnegative(),
  totalVolumeKg: weightKgSchema,
}).strict();
export type TrainingSessionStatsResponse = z.infer<typeof trainingSessionStatsResponseSchema>;
