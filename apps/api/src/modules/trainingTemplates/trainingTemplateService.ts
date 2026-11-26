import { trainingTemplateIdParamsSchema } from '@grow/shared';
import { ZodError } from 'zod';
import type { AuthUser } from '../../auth/types.js';
import { AppError } from '../../errors/appError.js';
import {
  createTrainingTemplateRepository,
  type TrainingTemplateRepository,
} from './trainingTemplateRepository.js';
import {
  createTrainingTemplateSaveRepository,
  type TrainingTemplateSaveOutcome,
  type TrainingTemplateSaveRepository,
} from './trainingTemplateSaveRepository.js';

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

function requireOutcome(outcome: TrainingTemplateSaveOutcome) {
  if (outcome.outcome === 'not_found') {
    throw new AppError(404, 'TRAINING_TEMPLATE_NOT_FOUND', 'Training template was not found.');
  }
  return { userPlan: outcome.userPlan };
}

async function runSaveMutation(operation: () => Promise<TrainingTemplateSaveOutcome>) {
  try {
    return requireOutcome(await operation());
  } catch (error) {
    if (error instanceof Error && error.name === 'TrainingExerciseNotAvailableError') {
      throw new AppError(400, 'TRAINING_EXERCISE_NOT_AVAILABLE', 'One or more exercises are not available.');
    }
    throw error;
  }
}

export function createTrainingTemplateService(
  repository: TrainingTemplateRepository = createTrainingTemplateRepository(),
  saveRepository: TrainingTemplateSaveRepository = createTrainingTemplateSaveRepository(),
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

    async save(user: AuthUser, paramsValue: unknown) {
      const { templateId } = parseClientInput(
        () => trainingTemplateIdParamsSchema.parse(paramsValue),
      );
      return runSaveMutation(() => saveRepository.save(user.id, templateId));
    },

    async unsave(user: AuthUser, paramsValue: unknown) {
      const { templateId } = parseClientInput(
        () => trainingTemplateIdParamsSchema.parse(paramsValue),
      );
      return runSaveMutation(() => saveRepository.unsave(user.id, templateId));
    },

    async activate(user: AuthUser, paramsValue: unknown) {
      const { templateId } = parseClientInput(
        () => trainingTemplateIdParamsSchema.parse(paramsValue),
      );
      return runSaveMutation(() => saveRepository.activate(user.id, templateId));
    },
  };
}
