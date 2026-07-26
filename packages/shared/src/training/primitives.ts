import { z } from 'zod';

export const uuidSchema = z.string().uuid();
export const userIdSchema = uuidSchema;
export const planIdSchema = uuidSchema;
export const planRevisionIdSchema = uuidSchema;
export const unitIdSchema = uuidSchema;
export const exerciseIdSchema = uuidSchema;
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

export const weightKgSchema = z.number().finite().nonnegative();
export type WeightKg = z.infer<typeof weightKgSchema>;

export const completedRepsSchema = z.number().int().positive();
export type CompletedReps = z.infer<typeof completedRepsSchema>;

export const repRangeSchema = z.object({
  minimum: z.number().int().positive(),
  maximum: z.number().int().positive(),
}).strict().refine(
  ({ minimum, maximum }) => minimum <= maximum,
  { message: 'minimum must not exceed maximum', path: ['maximum'] },
);
export type RepRange = z.infer<typeof repRangeSchema>;

export const rirSchema = z.number().int().min(0).max(10).nullable();
export type Rir = z.infer<typeof rirSchema>;

export const durationSecondsSchema = z.number().int().nonnegative();
export const restSecondsSchema = durationSecondsSchema;
export const distanceMetersSchema = z.number().int().nonnegative();
export type DurationSeconds = z.infer<typeof durationSecondsSchema>;
export type RestSeconds = z.infer<typeof restSecondsSchema>;
export type DistanceMeters = z.infer<typeof distanceMetersSchema>;

export const ianaTimeZoneSchema = z.string().trim().min(1).max(255);
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
