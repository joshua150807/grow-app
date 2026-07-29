import { trainingTemplateIdParamsSchema } from '@grow/shared/src/training/plans.js';
import { ZodError } from 'zod';
import type { AuthUser } from '../../auth/types.js';
import { AppError } from '../../errors/appError.js';
import {
  createTrainingTemplateRepository,
  type TrainingTemplateRepository,
} from './trainingTemplateRepository.js';

export type TrainingTemplateService = ReturnType<typeof createTrainingTemplateService>;

function validationError(error: ZodError): AppError {
  return new AppError(
    400,
    'TRAINING_TEMPLATE_VALIDATION_ERROR',
    'Training template request is invalid.',
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

export function createTrainingTemplateService(
  repository: TrainingTemplateRepository = createTrainingTemplateRepository(),
) {
  return {
    list(user: AuthUser) {
      return repository.list(user.id);
    },

    async get(user: AuthUser, paramsValue: unknown) {
      const { templateId } = parseClientInput(
        () => trainingTemplateIdParamsSchema.parse(paramsValue),
      );
      const result = await repository.find(user.id, templateId);
      if (!result) {
        throw new AppError(404, 'TRAINING_TEMPLATE_NOT_FOUND', 'Training template was not found.');
      }
      return result;
    },
  };
}
