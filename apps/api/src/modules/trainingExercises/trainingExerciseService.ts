import {
  createTrainingExerciseInputSchema,
  listTrainingExercisesQuerySchema,
  listTrainingExercisesResponseSchema,
  trainingExerciseDetailResponseSchema,
  trainingExerciseIdParamsSchema,
} from '@grow/shared';
import { ZodError } from 'zod';
import type { AuthUser } from '../../auth/types.js';
import { AppError } from '../../errors/appError.js';
import {
  createTrainingExerciseRepository,
  type TrainingExerciseRepository,
} from './trainingExerciseRepository.js';

export type TrainingExerciseService = ReturnType<typeof createTrainingExerciseService>;

function validationError(error: ZodError): AppError {
  return new AppError(
    400,
    'TRAINING_EXERCISE_VALIDATION_ERROR',
    'Training exercise request is invalid.',
    error.flatten(),
  );
}

function parseClientInput<T>(parse: () => T): T {
  try {
    return parse();
  } catch (error) {
    if (error instanceof ZodError) throw validationError(error);
    throw error;
  }
}

async function validateInternalContract<T>(operation: () => T | Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error('Internal training exercise contract violation.');
    }
    throw error;
  }
}

export function createTrainingExerciseService(
  repository: TrainingExerciseRepository = createTrainingExerciseRepository(),
) {
  return {
    async list(user: AuthUser, queryValue: unknown) {
      const query = parseClientInput(() => listTrainingExercisesQuerySchema.parse(queryValue));
      const result = await validateInternalContract(() => repository.list(user.id, query));
      return validateInternalContract(() => listTrainingExercisesResponseSchema.parse({
        exercises: result.exercises,
        pagination: {
          page: query.page,
          limit: query.limit,
          hasMore: result.hasMore,
        },
      }));
    },

    async get(user: AuthUser, paramsValue: unknown) {
      const { exerciseId } = parseClientInput(
        () => trainingExerciseIdParamsSchema.parse(paramsValue),
      );
      const exercise = await validateInternalContract(
        () => repository.findVisible(user.id, exerciseId),
      );
      if (!exercise) {
        throw new AppError(
          404,
          'TRAINING_EXERCISE_NOT_FOUND',
          'Training exercise was not found.',
        );
      }
      return validateInternalContract(
        () => trainingExerciseDetailResponseSchema.parse({ exercise }),
      );
    },

    async create(user: AuthUser, bodyValue: unknown) {
      const input = parseClientInput(() => createTrainingExerciseInputSchema.parse(bodyValue));
      const result = await validateInternalContract(() => repository.create(user.id, input));
      if (result.outcome === 'conflict') {
        throw new AppError(
          409,
          'TRAINING_EXERCISE_CONFLICT',
          'You already have an exercise with this name.',
        );
      }
      return validateInternalContract(
        () => trainingExerciseDetailResponseSchema.parse({ exercise: result.exercise }),
      );
    },
  };
}
