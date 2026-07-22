import type { AuthUser } from '../../auth/types.js';
import { AppError } from '../../errors/appError.js';
import { mapHabitCollection } from './habitCollectionMapper.js';
import {
  createHabitCollectionRepository,
  type HabitCollectionRepository,
} from './habitCollectionRepository.js';
import {
  createHabitCollectionRequestSchema,
  deleteHabitCollectionRequestSchema,
  habitCollectionIdSchema,
  updateHabitCollectionRequestSchema,
} from './habitCollectionSchemas.js';

export type HabitCollectionService = ReturnType<typeof createHabitCollectionService>;

function errorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

function errorText(error: unknown): string {
  if (!error || typeof error !== 'object') return '';
  const candidate = error as { message?: unknown; details?: unknown; hint?: unknown };
  return [candidate.message, candidate.details, candidate.hint]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase();
}

function throwMutationError(error: unknown): never {
  const code = errorCode(error);
  const text = errorText(error);
  if (code === 'P0002') {
    throw new AppError(404, 'HABIT_COLLECTION_NOT_FOUND', 'Habit collection was not found.');
  }
  if (code === '40001' || (
    code === '23505'
    && (
      text.includes('active collection')
      || text.includes('habit_collection_memberships_one_active_habit_idx')
    )
  )) {
    throw new AppError(409, 'HABIT_COLLECTION_CONFLICT', 'Habit collection could not be changed because its state has changed.');
  }
  if (code === '22023' || code === '22P02' || code === '23514') {
    throw new AppError(400, 'VALIDATION_ERROR', 'Habit collection input is invalid.');
  }
  throw error;
}

export function createHabitCollectionService(
  repository: HabitCollectionRepository = createHabitCollectionRepository(),
) {
  async function requireCollection(userId: string, collectionId: string) {
    const collection = await repository.find(userId, collectionId);
    if (!collection) {
      throw new AppError(404, 'HABIT_COLLECTION_NOT_FOUND', 'Habit collection was not found.');
    }
    return mapHabitCollection(collection);
  }

  return {
    async list(user: AuthUser) {
      const collections = await repository.list(user.id);
      return collections.map(mapHabitCollection);
    },

    async get(user: AuthUser, collectionIdValue: unknown) {
      const collectionId = habitCollectionIdSchema.parse(collectionIdValue);
      return requireCollection(user.id, collectionId);
    },

    async create(user: AuthUser, body: unknown) {
      const input = createHabitCollectionRequestSchema.parse(body);
      try {
        const collectionId = await repository.create(user.id, input);
        return await requireCollection(user.id, collectionId);
      } catch (error) {
        throwMutationError(error);
      }
    },

    async update(user: AuthUser, collectionIdValue: unknown, body: unknown) {
      const collectionId = habitCollectionIdSchema.parse(collectionIdValue);
      const input = updateHabitCollectionRequestSchema.parse(body);
      try {
        await repository.update(user.id, collectionId, input);
        return await requireCollection(user.id, collectionId);
      } catch (error) {
        throwMutationError(error);
      }
    },

    async delete(user: AuthUser, collectionIdValue: unknown, body: unknown) {
      const collectionId = habitCollectionIdSchema.parse(collectionIdValue);
      const input = deleteHabitCollectionRequestSchema.parse(body);
      try {
        await repository.delete(user.id, collectionId, input.expected_version);
      } catch (error) {
        throwMutationError(error);
      }
    },
  };
}
