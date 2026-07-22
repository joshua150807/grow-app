import type { AuthUser } from '../../auth/types.js';
import { AppError } from '../../errors/appError.js';
import { createDeepWorkSessionRepository, type DeepWorkSessionRepository } from './deepWorkSessionRepository.js';
import { deepWorkSessionRequestSchema } from './profileStatsSchemas.js';

export type DeepWorkSessionService = ReturnType<typeof createDeepWorkSessionService>;

export function createDeepWorkSessionService(repository: DeepWorkSessionRepository = createDeepWorkSessionRepository()) {
  return {
    async create(user: AuthUser, body: unknown) {
      const input = deepWorkSessionRequestSchema.parse(body);
      const result = await repository.insertOrFind(user.id, input);
      if (!result.created && (
        result.session.duration_seconds !== input.duration_seconds
        || Date.parse(result.session.completed_at) !== Date.parse(input.completed_at)
      )) {
        throw new AppError(409, 'DEEP_WORK_SESSION_CONFLICT', 'Deep-work session id is already used with different data.');
      }
      return result;
    },
  };
}
