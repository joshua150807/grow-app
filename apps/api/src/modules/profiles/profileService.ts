import { AppError } from '../../errors/appError.js';
import type { AuthUser } from '../../auth/types.js';
import {
  mapProfileDomainToReadDto,
  type ProfileReadDto,
} from './mappers/profileMapper.js';
import {
  avatarConfirmRequestSchema,
  avatarUploadRequestSchema,
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
import {
  createProfileAvatarService,
  type ProfileAvatarService,
  type SignedAvatarUpload,
} from './services/profileAvatarService.js';

type Warn = (context: Record<string, unknown>, message: string) => void;

export type ProfileService = {
  getCurrentUserProfile(user: AuthUser): Promise<ProfileReadDto>;
  updateCurrentUserProfile(user: AuthUser, input: unknown): Promise<ProfileResponse>;
  createAvatarUpload(user: AuthUser, input: unknown): Promise<SignedAvatarUpload>;
  confirmAvatarUpload(user: AuthUser, input: unknown): Promise<ProfileResponse>;
  deleteAvatar(user: AuthUser): Promise<ProfileResponse>;
};

function nullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function nullableInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

async function mapProfileRow(
  row: ProfileRow,
  profileAvatarService: ProfileAvatarService,
): Promise<ProfileResponse> {
  const avatarPath = nullableString(row.avatar_path);
  const avatarUrl = await profileAvatarService.createSignedReadUrl(avatarPath);

  return profileResponseSchema.parse({
    id: row.id,
    username: row.username,
    bio: nullableString(row.bio) ?? '',
    avatar_url: avatarUrl,
    grow_points: nullableInteger(row.grow_points),
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
  profileAvatarService: ProfileAvatarService = createProfileAvatarService(),
  warn: Warn = (context, message) => console.warn(message, context),
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
      const profile = await getProfileReadService().getDomainByUserId(user.id);

      if (!profile) {
        throw new AppError(
          404,
          'PROFILE_NOT_FOUND',
          'Profile for authenticated user was not found.',
        );
      }

      const avatarUrl = await profileAvatarService.createSignedReadUrl(profile.avatarPath);

      return mapProfileDomainToReadDto(profile, avatarUrl);
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

        return await mapProfileRow(updatedProfile, profileAvatarService);
      } catch (error) {
        if (isUsernameTakenError(error)) {
          throw new AppError(409, 'USERNAME_TAKEN', 'Username is already taken.');
        }

        throw error;
      }
    },

    async createAvatarUpload(user, input) {
      const uploadInput = avatarUploadRequestSchema.parse(input);
      await getExistingProfileOrThrow(profilesRepository, user.id);

      return profileAvatarService.createSignedUpload(user.id, uploadInput);
    },

    async confirmAvatarUpload(user, input) {
      const { path } = avatarConfirmRequestSchema.parse(input);

      if (path.split('/')[0] !== user.id) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Avatar path is invalid.');
      }

      const existingProfile = await getExistingProfileOrThrow(profilesRepository, user.id);
      await profileAvatarService.verifyUploadedObject(user.id, path);

      const updatedProfile = await updateAvatarPathOrThrow(profilesRepository, user.id, path);

      if (!updatedProfile) {
        throw new AppError(
          404,
          'PROFILE_NOT_FOUND',
          'Profile for authenticated user was not found.',
        );
      }

      const response = await mapProfileRow(updatedProfile, profileAvatarService);
      const previousPath = nullableString(existingProfile.avatar_path);

      if (previousPath && previousPath !== path) {
        try {
          await profileAvatarService.deleteObject(user.id, previousPath);
        } catch {
          warn(
            { event: 'profile_avatar_cleanup_failed', category: 'storage_error' },
            'Previous profile avatar could not be deleted',
          );
        }
      }

      return response;
    },

    async deleteAvatar(user) {
      const existingProfile = await getExistingProfileOrThrow(profilesRepository, user.id);
      const previousPath = nullableString(existingProfile.avatar_path);

      if (!previousPath) {
        return mapProfileRow(existingProfile, profileAvatarService);
      }

      const updatedProfile = await updateAvatarPathOrThrow(profilesRepository, user.id, null);

      if (!updatedProfile) {
        throw new AppError(
          404,
          'PROFILE_NOT_FOUND',
          'Profile for authenticated user was not found.',
        );
      }

      const response = await mapProfileRow(updatedProfile, profileAvatarService);

      try {
        await profileAvatarService.deleteObject(user.id, previousPath);
      } catch {
        warn(
          { event: 'profile_avatar_cleanup_failed', category: 'storage_error' },
          'Previous profile avatar could not be deleted',
        );
      }

      return response;
    },
  };
}

async function updateAvatarPathOrThrow(
  profilesRepository: ProfilesRepository,
  userId: string,
  avatarPath: string | null,
): Promise<ProfileRow | null> {
  if (!profilesRepository.updateAvatarPathByUserId) {
    throw new Error('Avatar profile persistence is not configured.');
  }

  return profilesRepository.updateAvatarPathByUserId(userId, avatarPath);
}
