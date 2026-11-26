import {
  createTrainingSessionInputSchema,
  lastExerciseNoteResponseSchema,
  listTrainingSessionsQuerySchema,
  listTrainingSessionsResponseSchema,
  listTrainingSessionHistoryResponseSchema,
  trainingSessionHistoryResponseSchema,
  trainingSessionStatsResponseSchema,
  trainingExerciseIdParamsSchema,
  trainingSessionIdParamsSchema,
  trainingSessionResponseSchema,
} from '@grow/shared';
// Imported from source (like the repository does), so an API process still running on an older
// packages/shared/dist keeps loading this module.
import { lastExerciseSetsResponseSchema } from '@grow/shared/src/training/sessions.js';
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

// A stored value that the response contract rejects is a server-side defect (e.g. corrupt or
// out-of-contract historical data), never a client validation error. Throwing a plain Error
// lets errorHandler log it and answer 500 INTERNAL_ERROR (audit F06). Only the failing paths
// are kept, never the values, so no user data ends up in the log message.
function respond<TSchema extends z.ZodTypeAny>(schema: TSchema, value: unknown): z.output<TSchema> {
  const result = schema.safeParse(value);
  if (!result.success) {
    const paths = [...new Set(result.error.issues.map((issue) => issue.path.join('.')))].slice(0, 10);
    throw new Error(`Internal training session response contract violation at: ${paths.join(', ')}`);
  }
  return result.data;
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
      return respond(lastExerciseNoteResponseSchema,{
        note: found?.note ?? null,
        completedAt: found?.completedAt ?? null,
      });
    },

    async getLastExerciseSets(user: AuthUser, paramsValue: unknown) {
      const { exerciseId } = parse(trainingExerciseIdParamsSchema, paramsValue);
      const found = await repository.findLastExerciseSets(user.id, exerciseId);
      return respond(lastExerciseSetsResponseSchema, {
        completedAt: found?.completedAt ?? null,
        sets: found?.sets ?? [],
      });
    },

    async list(user: AuthUser, queryValue: unknown) {
      const query = parse(listTrainingSessionsQuerySchema, queryValue);
      const result = await repository.list(user.id, query);
      return respond(listTrainingSessionsResponseSchema,{
        sessions: result.sessions,
        pagination: { page: query.page, limit: query.limit, hasMore: result.hasMore },
      });
    },

    async listHistory(user: AuthUser, queryValue: unknown) {
      const query = parse(listTrainingSessionsQuerySchema, queryValue);
      const result = await repository.listHistory(user.id, query);
      return respond(listTrainingSessionHistoryResponseSchema,{
        sessions: result.sessions,
        pagination: { page: query.page, limit: query.limit, hasMore: result.hasMore },
      });
    },

    async getHistory(user: AuthUser, paramsValue: unknown) {
      const { sessionId } = parse(trainingSessionIdParamsSchema, paramsValue);
      const session = await repository.findHistory(user.id, sessionId);
      if (!session) {
        throw new AppError(404, 'TRAINING_SESSION_NOT_FOUND', 'Training session was not found.');
      }
      return respond(trainingSessionHistoryResponseSchema,{ session });
    },

    async getStats(user: AuthUser) {
      return respond(trainingSessionStatsResponseSchema,await repository.getStats(user.id));
    },

    async get(user: AuthUser, paramsValue: unknown) {
      const { sessionId } = parse(trainingSessionIdParamsSchema, paramsValue);
      const session = await repository.find(user.id, sessionId);
      if (!session) {
        throw new AppError(404, 'TRAINING_SESSION_NOT_FOUND', 'Training session was not found.');
      }
      return respond(trainingSessionResponseSchema,{ session });
    },
  };
}
