import type { AuthUser } from '../../auth/types.js';
import { AppError } from '../../errors/appError.js';
import {
  creatorApplicationRequestSchema,
  creatorApplicationResponseSchema,
  type CreatorApplicationInput,
  type CreatorApplicationResponse,
} from './creatorSchemas.js';
import {
  createCreatorRepository,
  type CreatorApplicationRow,
  type CreatorRepository,
} from './creatorRepository.js';

const OPEN_CREATOR_APPLICATION_STATUSES = new Set(['pending', 'requested']);
const INITIAL_CREATOR_APPLICATION_STATUS = 'pending';

export type CreatorService = {
  createCreatorApplication(
    user: AuthUser,
    input: unknown,
  ): Promise<CreatorApplicationResponse>;
};

function nullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function nullableStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;

  const strings = value.filter((item): item is string => typeof item === 'string');
  return strings.length > 0 ? strings : null;
}

function mapCreatorApplicationRow(
  row: CreatorApplicationRow,
): CreatorApplicationResponse {
  return creatorApplicationResponseSchema.parse({
    id: row.id,
    user_id: row.user_id,
    motivation: row.motivation,
    experience: nullableString(row.experience),
    content_focus: nullableString(row.content_focus),
    social_links: nullableStringArray(row.social_links),
    status: row.status,
    created_at: nullableString(row.created_at),
    updated_at: nullableString(row.updated_at),
  });
}

function isCreatorApplicationConflictError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const candidate = error as {
    code?: unknown;
    message?: unknown;
    details?: unknown;
    hint?: unknown;
  };

  const text = [
    candidate.message,
    candidate.details,
    candidate.hint,
  ]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase();

  return candidate.code === '23505' && text.includes('creator');
}

function throwCreatorApplicationExists(): never {
  throw new AppError(
    409,
    'CREATOR_APPLICATION_EXISTS',
    'An open creator application already exists for this user.',
  );
}

export function createCreatorService(
  creatorRepository: CreatorRepository = createCreatorRepository(),
): CreatorService {
  return {
    async createCreatorApplication(
      user: AuthUser,
      input: unknown,
    ): Promise<CreatorApplicationResponse> {
      const applicationInput: CreatorApplicationInput =
        creatorApplicationRequestSchema.parse(input);

      const latestApplication =
        await creatorRepository.getLatestCreatorApplicationByUserId(user.id);

      if (
        latestApplication &&
        OPEN_CREATOR_APPLICATION_STATUSES.has(latestApplication.status)
      ) {
        throwCreatorApplicationExists();
      }

      try {
        const createdApplication =
          await creatorRepository.createCreatorApplicationForUser(user.id, {
            ...applicationInput,
            status: INITIAL_CREATOR_APPLICATION_STATUS,
          });

        return mapCreatorApplicationRow(createdApplication);
      } catch (error) {
        if (isCreatorApplicationConflictError(error)) {
          throwCreatorApplicationExists();
        }

        throw error;
      }
    },
  };
}
