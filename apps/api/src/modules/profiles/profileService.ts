import { AppError } from '../../errors/appError.js';
import type { AuthUser } from '../../auth/types.js';
import {
  type ProfileReadDto,
} from './mappers/profileMapper.js';
import {
  profileResponseSchema,
  profileUpdateRequestSchema,
  type ProfileUpdateInput,
  type ProfileResponse,
} from './profileSchemas.js';
import {
  createProfilesRepository,
  createSupabaseProfilesReadRepository,
  type ProfileRow,
  type ProfilesRepository,
} from './profilesRepository.js';
import type { ProfilesReadRepository } from './repositories/profilesReadRepository.js';
import { ProfileReadService } from './services/profileReadService.js';

export type ProfileService = {
  getCurrentUserProfile(user: AuthUser): Promise<ProfileReadDto>;
  updateCurrentUserProfile(user: AuthUser, input: unknown): Promise<ProfileResponse>;
};

function nullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function mapProfileRow(row: ProfileRow): ProfileResponse {
  return profileResponseSchema.parse({
    id: row.id,
    user_id: row.id,
    username: nullableString(row.username),
    display_name: nullableString(row.display_name),
    name: nullableString(row.name),
    avatar_url: nullableString(row.avatar_url),
    bio: nullableString(row.bio),
    role: nullableString(row.role),
    created_at: nullableString(row.created_at),
    updated_at: nullableString(row.updated_at),
  });
}

function isUsernameTakenError(error: unknown): boolean {
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

  return candidate.code === '23505' && text.includes('username');
}

async function getExistingProfileOrThrow(
  profilesRepository: ProfilesRepository,
  userId: string,
): Promise<ProfileRow> {
  const profile = await profilesRepository.getProfileByUserId(userId);

  if (!profile) {
    throw new AppError(
      404,
      'PROFILE_NOT_FOUND',
      'Profile for authenticated user was not found.',
    );
  }

  return profile;
}

export function createProfileService(
  profilesRepository: ProfilesRepository = createProfilesRepository(),
  profilesReadRepository?: ProfilesReadRepository,
): ProfileService {
  let profileReadService = profilesReadRepository
    ? new ProfileReadService(profilesReadRepository)
    : null;

  function getProfileReadService(): ProfileReadService {
    profileReadService ??= new ProfileReadService(createSupabaseProfilesReadRepository());

    return profileReadService;
  }

  return {
    async getCurrentUserProfile(user: AuthUser): Promise<ProfileReadDto> {
      const profile = await getProfileReadService().getByUserId(user.id);

      if (!profile) {
        throw new AppError(
          404,
          'PROFILE_NOT_FOUND',
          'Profile for authenticated user was not found.',
        );
      }

      return profile;
    },

    async updateCurrentUserProfile(
      user: AuthUser,
      input: unknown,
    ): Promise<ProfileResponse> {
      const updateInput: ProfileUpdateInput = profileUpdateRequestSchema.parse(input);

      await getExistingProfileOrThrow(profilesRepository, user.id);

      try {
        const updatedProfile = await profilesRepository.updateProfileByUserId(
          user.id,
          updateInput,
        );

        if (!updatedProfile) {
          throw new AppError(
            404,
            'PROFILE_NOT_FOUND',
            'Profile for authenticated user was not found.',
          );
        }

        return mapProfileRow(updatedProfile);
      } catch (error) {
        if (isUsernameTakenError(error)) {
          throw new AppError(409, 'USERNAME_TAKEN', 'Username is already taken.');
        }

        throw error;
      }
    },
  };
}
