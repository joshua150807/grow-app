import {
  createTrainingSessionInputSchema,
  lastExerciseNoteResponseSchema,
  trainingExerciseIdParamsSchema,
} from '@grow/shared';
import { z, ZodError } from 'zod';
import type { AuthUser } from '../../auth/types.js';
import { AppError } from '../../errors/appError.js';
import {
  createTrainingSessionRepository,
  type CreateSessionResult,
  type TrainingSessionRepository,
} from './trainingSessionRepository.js';

export type TrainingSessionService = ReturnType<typeof createTrainingSessionService>;

function parse<TSchema extends z.ZodTypeAny>(schema: TSchema, value: unknown): z.output<TSchema> {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new AppError(400, 'TRAINING_SESSION_VALIDATION_ERROR', 'Training session input is invalid.', error.flatten());
    }
    throw error;
  }
}

function requireResult(result: CreateSessionResult) {
  if (result.outcome === 'ok') return result;
  if (result.outcome === 'conflict') {
    throw new AppError(
      409, 'TRAINING_SESSION_CONFLICT', 'Idempotency key is already used with a different session request.',
    );
  }
  if (result.outcome === 'plan_not_found') {
    throw new AppError(404, 'TRAINING_SESSION_PLAN_NOT_FOUND', 'Training plan was not found.');
  }
  if (result.outcome === 'unit_not_found') {
    throw new AppError(400, 'TRAINING_SESSION_UNIT_NOT_AVAILABLE', 'Training unit is not part of this plan.');
  }
  throw new AppError(
    400, 'TRAINING_SESSION_REFERENCE_NOT_AVAILABLE', 'One or more referenced exercises or sets are not available.',
  );
}

export function createTrainingSessionService(
  repository: TrainingSessionRepository = createTrainingSessionRepository(),
) {
  return {
    async create(user: AuthUser, body: unknown) {
      const input = parse(createTrainingSessionInputSchema, body);
      // The repository owns the entire idempotency decision (existing key -> compare a
      // stored request fingerprint, not a partial field-by-field guess) -- the service no
      // longer re-derives conflict/replay semantics from the returned session itself.
      const result = requireResult(await repository.create(user.id, input));
      return { session: result.session, created: result.created };
    },

    async getLastExerciseNote(user: AuthUser, paramsValue: unknown) {
      const { exerciseId } = parse(trainingExerciseIdParamsSchema, paramsValue);
      const found = await repository.findLastExerciseNote(user.id, exerciseId);
      return lastExerciseNoteResponseSchema.parse({
        note: found?.note ?? null,
        completedAt: found?.completedAt ?? null,
      });
    },
  };
}
