import { z } from 'zod';

export const uuidSchema = z.string().uuid();
export const userIdSchema = uuidSchema;
export const planIdSchema = uuidSchema;
export const planRevisionIdSchema = uuidSchema;
export const unitIdSchema = uuidSchema;
export const exerciseIdSchema = uuidSchema;
export const templateIdSchema = uuidSchema;
export const templateRevisionIdSchema = uuidSchema;
export const templateUnitIdSchema = uuidSchema;
export const systemExerciseKeySchema = z.string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/);
const asciiBoundaryWhitespacePattern = /^[^ \t\n\r\f\v](?:[\s\S]*[^ \t\n\r\f\v])?$/;
export const exerciseEquipmentValueSchema = z.string()
  .min(1)
  .regex(asciiBoundaryWhitespacePattern, {
    message: 'Equipment values must not start or end with ASCII whitespace.',
  });
export const exerciseEquipmentListSchema = z.array(exerciseEquipmentValueSchema)
  .superRefine((values, context) => {
    if (new Set(values).size !== values.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Equipment values must be unique.',
      });
    }
  });
export const sessionIdSchema = uuidSchema;
export const sessionExerciseIdSchema = uuidSchema;
export const sessionSetIdSchema = uuidSchema;
export const clientSessionIdSchema = uuidSchema;
export const clientSetIdSchema = uuidSchema;
export const idempotencyKeySchema = uuidSchema;
export const logicalUnitKeySchema = uuidSchema;
export const logicalTargetExerciseKeySchema = uuidSchema;
export const logicalTargetSetKeySchema = uuidSchema;

export type Uuid = z.infer<typeof uuidSchema>;
export type UserId = z.infer<typeof userIdSchema>;
export type PlanId = z.infer<typeof planIdSchema>;
export type PlanRevisionId = z.infer<typeof planRevisionIdSchema>;
export type UnitId = z.infer<typeof unitIdSchema>;
export type ExerciseId = z.infer<typeof exerciseIdSchema>;
export type TemplateId = z.infer<typeof templateIdSchema>;
export type TemplateRevisionId = z.infer<typeof templateRevisionIdSchema>;
export type TemplateUnitId = z.infer<typeof templateUnitIdSchema>;
export type SystemExerciseKey = z.infer<typeof systemExerciseKeySchema>;
export type ExerciseEquipmentValue = z.infer<typeof exerciseEquipmentValueSchema>;
export type ExerciseEquipmentList = z.infer<typeof exerciseEquipmentListSchema>;
export type SessionId = z.infer<typeof sessionIdSchema>;
export type SessionExerciseId = z.infer<typeof sessionExerciseIdSchema>;
export type SessionSetId = z.infer<typeof sessionSetIdSchema>;
export type ClientSessionId = z.infer<typeof clientSessionIdSchema>;
export type ClientSetId = z.infer<typeof clientSetIdSchema>;
export type IdempotencyKey = z.infer<typeof idempotencyKeySchema>;
export type LogicalUnitKey = z.infer<typeof logicalUnitKeySchema>;
export type LogicalTargetExerciseKey = z.infer<typeof logicalTargetExerciseKeySchema>;
export type LogicalTargetSetKey = z.infer<typeof logicalTargetSetKeySchema>;

export const versionSchema = z.number().int().min(1);
export type Version = z.infer<typeof versionSchema>;

export const orderIndexSchema = z.number().int().nonnegative();
export type OrderIndex = z.infer<typeof orderIndexSchema>;

// Read-side (historical) primitives. They intentionally keep their original, open-ended rules:
// stored sessions are immutable, so a value that was accepted before the input limits below
// existed must stay readable forever (audit F04 -- tightening these would make history
// unreadable). New writes go through the *Input* schemas further down.
export const weightKgSchema = z.number().finite().nonnegative();
export type WeightKg = z.infer<typeof weightKgSchema>;

export const completedRepsSchema = z.number().int().positive();
export type CompletedReps = z.infer<typeof completedRepsSchema>;

// Product-confirmed plausibility limits for NEW input (Release-Blocker-Fixplan D1-D5, 2026-11-26).
// The database carries looser technical guards (10x) so these can never turn into 500s.
export const TRAINING_V2_LIMITS = Object.freeze({
  maxWeightKg: 1_500,
  weightDecimals: 3,
  maxReps: 1_000,
  minWeeklyGoal: 1,
  maxWeeklyGoal: 7,
  maxActualRestSeconds: 86_400,
  maxPlannedRestSeconds: 3_600,
  // Largest value PostgreSQL `integer` columns can hold; any int input above it is a 400, never a 500.
  maxPgInteger: 2_147_483_647,
  // A session longer than this is kept with its raw timestamps but not treated as a reliable measured duration.
  maxReliableSessionSeconds: 6 * 60 * 60,
  // Device clocks drift; timestamps further than this into the future are rejected (audit F14).
  maxClockSkewSeconds: 10 * 60,
  // Request size caps (Fixplan B11). Largest Grow template today: 5 units, 11 exercises/unit,
  // 3 sets/exercise; largest iPhone fixture plan unit: 9 exercises. A session mirrors one unit.
  maxPlanUnits: 14,
  maxExercisesPerUnit: 30,
  maxSetsPerExercise: 30,
});

// True when `value` has at most `decimals` decimal places (tolerant of binary float noise, e.g. 22.75, 0.125).
export function hasAtMostDecimals(value: number, decimals: number): boolean {
  const factor = 10 ** decimals;
  const scaled = value * factor;
  return Math.abs(scaled - Math.round(scaled)) < 1e-6;
}

export const weightKgInputSchema = weightKgSchema
  .max(TRAINING_V2_LIMITS.maxWeightKg)
  .refine((value) => hasAtMostDecimals(value, TRAINING_V2_LIMITS.weightDecimals), {
    message: `weightKg must have at most ${TRAINING_V2_LIMITS.weightDecimals} decimal places`,
  });

export const completedRepsInputSchema = completedRepsSchema.max(TRAINING_V2_LIMITS.maxReps);

export const repRangeSchema = z.object({
  minimum: z.number().int().positive(),
  maximum: z.number().int().positive(),
}).strict().refine(
  ({ minimum, maximum }) => minimum <= maximum,
  { message: 'minimum must not exceed maximum', path: ['maximum'] },
);
export type RepRange = z.infer<typeof repRangeSchema>;

export const repRangeInputSchema = z.object({
  minimum: completedRepsInputSchema,
  maximum: completedRepsInputSchema,
}).strict().refine(
  ({ minimum, maximum }) => minimum <= maximum,
  { message: 'minimum must not exceed maximum', path: ['maximum'] },
);

export const rirSchema = z.number().int().min(0).max(10).nullable();
export type Rir = z.infer<typeof rirSchema>;

export const durationSecondsSchema = z.number().int().nonnegative();
export const restSecondsSchema = durationSecondsSchema;
export const distanceMetersSchema = z.number().int().nonnegative();
export type DurationSeconds = z.infer<typeof durationSecondsSchema>;
export type RestSeconds = z.infer<typeof restSecondsSchema>;
export type DistanceMeters = z.infer<typeof distanceMetersSchema>;

export const actualRestSecondsInputSchema = restSecondsSchema.max(TRAINING_V2_LIMITS.maxActualRestSeconds);
export const plannedRestSecondsInputSchema = restSecondsSchema.max(TRAINING_V2_LIMITS.maxPlannedRestSeconds);
export const pgIntegerDurationSecondsInputSchema = durationSecondsSchema.max(TRAINING_V2_LIMITS.maxPgInteger);
export const weeklyGoalInputSchema = z.number().int()
  .min(TRAINING_V2_LIMITS.minWeeklyGoal)
  .max(TRAINING_V2_LIMITS.maxWeeklyGoal);

export const ianaTimeZoneSchema = z.string()
  .min(1)
  .max(255)
  .refine((value) => {
    if (value !== value.trim()) return false;
    try {
      new Intl.DateTimeFormat('en', { timeZone: value }).format(new Date(0));
      return true;
    } catch {
      return false;
    }
  }, { message: 'Time zone must be a valid IANA time zone.' });
export type IanaTimeZone = z.infer<typeof ianaTimeZoneSchema>;

export const isoDateTimeSchema = z.string().datetime({ offset: true });
export type IsoDateTime = z.infer<typeof isoDateTimeSchema>;

export const localDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export type LocalDate = z.infer<typeof localDateSchema>;

export const nameSchema = z.string().trim().min(1).max(120);
export const shortNoteSchema = z.string().trim().max(1_000);
export const descriptionSchema = z.string().trim().max(5_000);
export type Name = z.infer<typeof nameSchema>;
export type ShortNote = z.infer<typeof shortNoteSchema>;
export type Description = z.infer<typeof descriptionSchema>;
