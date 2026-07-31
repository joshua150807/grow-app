import {
  createTrainingPlanInputSchema,
  planIdSchema,
  planVersionInputSchema,
  scheduleTrainingPlanInputSchema,
  updateTrainingPlanInputSchema,
  updateWeeklyGoalInputSchema,
} from '@grow/shared';
import { z, ZodError } from 'zod';
import type { AuthUser } from '../../auth/types.js';
import { AppError } from '../../errors/appError.js';
import { localDateTimeToUtc } from '../profileStats/timezone.js';
import {
  createTrainingPlanRepository,
  type MutationResult,
  type TrainingPlanRepository,
} from './trainingPlanRepository.js';

export type TrainingPlanService = ReturnType<typeof createTrainingPlanService>;

function parse<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  value: unknown,
): z.output<TSchema> {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new AppError(
        400,
        'TRAINING_PLAN_VALIDATION_ERROR',
        'Training plan input is invalid.',
        error.flatten(),
      );
    }
    throw error;
  }
}

function requireValidLocalDate(value: string): { year: number; month: number; day: number } {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() + 1 !== month
    || date.getUTCDate() !== day
  ) {
    throw new AppError(400, 'TRAINING_PLAN_VALIDATION_ERROR', 'Scheduled start date is invalid.');
  }
  return { year, month, day };
}

function scheduleInstant(startDate: string, timeZone: string): Date {
  try {
    new Intl.DateTimeFormat('en', { timeZone }).format(new Date());
    return localDateTimeToUtc(requireValidLocalDate(startDate), timeZone);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(400, 'TRAINING_PLAN_VALIDATION_ERROR', 'Time zone is invalid.');
  }
}

function databaseCode(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

function databaseText(error: unknown): string {
  if (!error || typeof error !== 'object') return '';
  const candidate = error as { message?: unknown; constraint?: unknown };
  return [candidate.message, candidate.constraint]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase();
}

function throwRepositoryError(error: unknown): never {
  if (error instanceof Error && error.name === 'TrainingExerciseNotAvailableError') {
    throw new AppError(400, 'TRAINING_EXERCISE_NOT_AVAILABLE', 'One or more exercises are not available.');
  }
  const code = databaseCode(error);
  const text = databaseText(error);
  if (code === '23505' && text.includes('one_scheduled')) {
    throw new AppError(409, 'TRAINING_SCHEDULE_CONFLICT', 'Another training plan is already scheduled.');
  }
  if (code === '23505' && text.includes('one_active')) {
    throw new AppError(409, 'TRAINING_PLAN_STATUS_CONFLICT', 'Another training plan is already active.');
  }
  if (code === '23503' && text.includes('exercise')) {
    throw new AppError(400, 'TRAINING_EXERCISE_NOT_AVAILABLE', 'One or more exercises are not available.');
  }
  if (code === '23505' || code === '23514' || code === '23503' || code === '22P02') {
    throw new AppError(400, 'TRAINING_PLAN_VALIDATION_ERROR', 'Training plan input is invalid.');
  }
  throw error;
}

function requireMutation(result: MutationResult): string {
  if (result.outcome === 'ok') return result.planId;
  if (result.outcome === 'not_found') {
    throw new AppError(404, 'TRAINING_PLAN_NOT_FOUND', 'Training plan was not found.');
  }
  if (result.outcome === 'version_conflict') {
    throw new AppError(409, 'TRAINING_PLAN_VERSION_CONFLICT', 'Training plan version is stale.');
  }
  if (result.outcome === 'schedule_conflict') {
    throw new AppError(409, 'TRAINING_SCHEDULE_CONFLICT', 'Another training plan is already scheduled.');
  }
  throw new AppError(409, 'TRAINING_PLAN_STATUS_CONFLICT', 'Training plan status does not allow this operation.');
}

export function createTrainingPlanService(
  repository: TrainingPlanRepository = createTrainingPlanRepository(),
) {
  async function requirePlan(userId: string, planId: string) {
    const plan = await repository.find(userId, planId);
    if (!plan) throw new AppError(404, 'TRAINING_PLAN_NOT_FOUND', 'Training plan was not found.');
    return plan;
  }

  return {
    list(user: AuthUser) {
      return repository.list(user.id);
    },
    async get(user: AuthUser, idValue: unknown) {
      return requirePlan(user.id, parse(planIdSchema, idValue));
    },
    async create(user: AuthUser, body: unknown) {
      const input = parse(createTrainingPlanInputSchema, body);
      try {
        const id = await repository.create(user.id, input);
        return await requirePlan(user.id, id);
      } catch (error) {
        throwRepositoryError(error);
      }
    },
    async update(user: AuthUser, idValue: unknown, body: unknown) {
      const id = parse(planIdSchema, idValue);
      const input = parse(updateTrainingPlanInputSchema, body);
      try {
        requireMutation(await repository.update(user.id, id, input));
        return await requirePlan(user.id, id);
      } catch (error) {
        if (error instanceof AppError) throw error;
        throwRepositoryError(error);
      }
    },
    async activate(user: AuthUser, idValue: unknown, body: unknown) {
      const id = parse(planIdSchema, idValue);
      const input = parse(planVersionInputSchema, body);
      try {
        requireMutation(await repository.activate(user.id, id, input.expectedVersion, false));
        return await requirePlan(user.id, id);
      } catch (error) {
        if (error instanceof AppError) throw error;
        throwRepositoryError(error);
      }
    },
    async reactivate(user: AuthUser, idValue: unknown, body: unknown) {
      const id = parse(planIdSchema, idValue);
      const input = parse(planVersionInputSchema, body);
      try {
        requireMutation(await repository.activate(user.id, id, input.expectedVersion, true));
        return await requirePlan(user.id, id);
      } catch (error) {
        if (error instanceof AppError) throw error;
        throwRepositoryError(error);
      }
    },
    async schedule(user: AuthUser, idValue: unknown, body: unknown) {
      const id = parse(planIdSchema, idValue);
      const input = parse(scheduleTrainingPlanInputSchema, body);
      try {
        requireMutation(await repository.schedule(
          user.id, id, input.expectedVersion,
          input.startDate, scheduleInstant(input.startDate, input.timeZone), input.timeZone,
        ));
        return await requirePlan(user.id, id);
      } catch (error) {
        if (error instanceof AppError) throw error;
        throwRepositoryError(error);
      }
    },
    async archive(user: AuthUser, idValue: unknown, body: unknown) {
      const id = parse(planIdSchema, idValue);
      const input = parse(planVersionInputSchema, body);
      try {
        requireMutation(await repository.archive(user.id, id, input.expectedVersion));
        return await requirePlan(user.id, id);
      } catch (error) {
        if (error instanceof AppError) throw error;
        throwRepositoryError(error);
      }
    },
    async updateWeeklyGoal(user: AuthUser, idValue: unknown, body: unknown) {
      const id = parse(planIdSchema, idValue);
      const input = parse(updateWeeklyGoalInputSchema, body);
      try {
        requireMutation(await repository.updateWeeklyGoal(
          user.id, id, input.expectedVersion, input.weeklyGoal,
        ));
        return await requirePlan(user.id, id);
      } catch (error) {
        if (error instanceof AppError) throw error;
        throwRepositoryError(error);
      }
    },
    async delete(user: AuthUser, idValue: unknown) {
      const id = parse(planIdSchema, idValue);
      const result = await repository.delete(user.id, id);
      if (result.outcome === 'not_found') {
        throw new AppError(404, 'TRAINING_PLAN_NOT_FOUND', 'Training plan was not found.');
      }
    },
  };
}
