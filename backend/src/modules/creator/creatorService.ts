import type { AuthUser } from '../../auth/types.js';
import { requireAdminOrCeo } from '../../auth/permissions.js';
import { AppError } from '../../errors/appError.js';
import {
  creatorApplicationRequestSchema,
  creatorApplicationResponseSchema,
  listCreatorApplicationsQuerySchema,
  listCreatorApplicationsResponseSchema,
  myCreatorApplicationResponseSchema,
  type CreatorApplicationInput,
  type CreatorApplicationResponse,
  type ListCreatorApplicationsResponse,
  type MyCreatorApplicationResponse,
} from './creatorSchemas.js';
import {
  createCreatorRepository,
  type CreatorApplicationRow,
  type CreatorRepository,
} from './creatorRepository.js';

const OPEN_CREATOR_APPLICATION_STATUSES = new Set(['pending', 'requested']);
const INITIAL_CREATOR_APPLICATION_STATUS = 'pending';
const APPLICATION_STATUS_PRIORITY = new Map([
  ['pending', 0],
  ['requested', 1],
]);

export type CreatorService = {
  getMyCreatorApplication(user: AuthUser): Promise<MyCreatorApplicationResponse>;
  listCreatorApplicationsForAdmin(
    user: AuthUser,
    filters: unknown,
  ): Promise<ListCreatorApplicationsResponse>;
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
    rejection_reason: nullableString(row.rejection_reason),
    created_at: nullableString(row.created_at),
    updated_at: nullableString(row.updated_at),
  });
}

function mapMyCreatorApplicationResponse(
  application: CreatorApplicationRow | null,
): MyCreatorApplicationResponse {
  if (!application) {
    return myCreatorApplicationResponseSchema.parse({
      status: 'none',
      application: null,
    });
  }

  const mappedApplication = mapCreatorApplicationRow(application);

  return myCreatorApplicationResponseSchema.parse({
    status: mappedApplication.status,
    application: mappedApplication,
  });
}

function sortCreatorApplicationsForAdmin(
  applications: CreatorApplicationRow[],
): CreatorApplicationRow[] {
  return [...applications].sort((left, right) => {
    const leftPriority = APPLICATION_STATUS_PRIORITY.get(left.status) ?? 10;
    const rightPriority = APPLICATION_STATUS_PRIORITY.get(right.status) ?? 10;

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    return String(right.created_at ?? '').localeCompare(String(left.created_at ?? ''));
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
    async getMyCreatorApplication(user: AuthUser): Promise<MyCreatorApplicationResponse> {
      const latestApplication =
        await creatorRepository.getLatestCreatorApplicationByUserId(user.id);

      return mapMyCreatorApplicationResponse(latestApplication);
    },

    async listCreatorApplicationsForAdmin(
      user: AuthUser,
      filters: unknown,
    ): Promise<ListCreatorApplicationsResponse> {
      requireAdminOrCeo(user);

      const parsedFilters = listCreatorApplicationsQuerySchema.parse(filters);
      const result = await creatorRepository.listCreatorApplications(parsedFilters);
      const applications = sortCreatorApplicationsForAdmin(result.applications)
        .map(mapCreatorApplicationRow);

      return listCreatorApplicationsResponseSchema.parse({
        applications,
        pagination: {
          limit: parsedFilters.limit,
          page: parsedFilters.page,
          has_more: result.hasMore,
        },
      });
    },

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
