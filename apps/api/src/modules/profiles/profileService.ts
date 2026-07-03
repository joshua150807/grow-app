import { AppError } from '../../errors/appError.js';
import type { AuthUser } from '../../auth/types.js';
import {
  profileResponseSchema,
  profileUpdateRequestSchema,
  type ProfileUpdateInput,
  type ProfileResponse,
} from './profileSchemas.js';
import {
  createProfilesRepository,
  type ProfileRow,
  type ProfilesRepository,
} from './profilesRepository.js';

export type ProfileService = {
  getCurrentUserProfile(user: AuthUser): Promise<ProfileResponse>;
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
): ProfileService {
  return {
    async getCurrentUserProfile(user: AuthUser): Promise<ProfileResponse> {
      const profile = await getExistingProfileOrThrow(profilesRepository, user.id);

      return mapProfileRow(profile);
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
