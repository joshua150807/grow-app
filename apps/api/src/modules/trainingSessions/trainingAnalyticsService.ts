import { z } from 'zod';
import { buildTrainingProgress, trainingAnalyticsDay, trainingAnalyticsFrom, trainingAnalyticsExerciseParamsSchema,
  trainingExerciseProgressQuerySchema, trainingExerciseProgressResponseSchema, trainingProgressQuerySchema,
  trainingProgressResponseSchema, trainingRecordsQuerySchema, trainingRecordsResponseSchema } from '@grow/shared/src/training/analytics.js';
import type { AuthUser } from '../../auth/types.js';
import { AppError } from '../../errors/appError.js';
import { createTrainingAnalyticsRepository, type TrainingAnalyticsRepository } from './trainingAnalyticsRepository.js';

function parse<T extends z.ZodTypeAny>(schema: T, value: unknown): z.output<T> {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError(400, 'TRAINING_SESSION_VALIDATION_ERROR', 'Invalid analytics query.', result.error.flatten());
  return result.data;
}
function response<T extends z.ZodTypeAny>(schema: T, value: unknown): z.output<T> {
  const result = schema.safeParse(value);
  if (!result.success) throw new Error('Internal training analytics contract violation.');
  return result.data;
}
export function createTrainingAnalyticsService(repository: TrainingAnalyticsRepository = createTrainingAnalyticsRepository(), clock = () => new Date()) {
  return {
    async records(user: AuthUser, value: unknown) {
      return response(trainingRecordsResponseSchema, await repository.records(user.id, parse(trainingRecordsQuerySchema, value)));
    },
    async progress(user: AuthUser, value: unknown) {
      const query = parse(trainingProgressQuerySchema, value); const now = clock();
      const days = await repository.days(user.id, query.timeZone, trainingAnalyticsFrom(query, now), now);
      return response(trainingProgressResponseSchema, buildTrainingProgress(days, query, now));
    },
    async exercise(user: AuthUser, params: unknown, value: unknown) {
      const { exerciseId } = parse(trainingAnalyticsExerciseParamsSchema, params);
      const query = parse(trainingExerciseProgressQuerySchema, value); const now = clock();
      const result = await repository.exercise(user.id, exerciseId);
      const from = trainingAnalyticsFrom(query, now);
      const points = result.points.filter(point => point.date <= now.toISOString() && (!from || trainingAnalyticsDay(new Date(point.date), query.timeZone) >= from))
        .sort((a, b) => b.date.localeCompare(a.date) || b.sessionId.localeCompare(a.sessionId));
      return response(trainingExerciseProgressResponseSchema, { exercise: result.exercise,
        points: points.slice(query.page * 50, (query.page + 1) * 50),
        pagination: { page: query.page, limit: 50, hasMore: points.length > (query.page + 1) * 50, total: points.length },
        period: query.period, timeZone: query.timeZone });
    },
  };
}
export type TrainingAnalyticsService = ReturnType<typeof createTrainingAnalyticsService>;
