import { AppError } from '../../errors/appError.js';
import type { AuthUser } from '../../auth/types.js';
import {
  profileResponseSchema,
  type ProfileResponse,
} from './profileSchemas.js';
import {
  createProfilesRepository,
  type ProfileRow,
  type ProfilesRepository,
} from './profilesRepository.js';

export type ProfileService = {
  getCurrentUserProfile(user: AuthUser): Promise<ProfileResponse>;
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
    role: nullableString(row.role),
    created_at: nullableString(row.created_at),
    updated_at: nullableString(row.updated_at),
  });
}

export function createProfileService(
  profilesRepository: ProfilesRepository = createProfilesRepository(),
): ProfileService {
  return {
    async getCurrentUserProfile(user: AuthUser): Promise<ProfileResponse> {
      const profile = await profilesRepository.getProfileByUserId(user.id);

      if (!profile) {
        throw new AppError(
          404,
          'PROFILE_NOT_FOUND',
          'Profile for authenticated user was not found.',
        );
      }

      return mapProfileRow(profile);
    },
  };
}
