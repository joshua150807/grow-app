import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../../../errors/appError.js';
import { getSupabaseAdminClient } from '../../../integrations/supabase/adminClient.js';
import type { AvatarUploadInput } from '../profileSchemas.js';

export const PROFILE_AVATAR_BUCKET = 'profile-avatars';
export const PROFILE_AVATAR_MAX_BYTES = 5_242_880;
export const PROFILE_AVATAR_READ_URL_EXPIRES_IN_SECONDS = 3_600;
export const PROFILE_AVATAR_UPLOAD_EXPIRES_IN_SECONDS = 7_200;

const EXTENSION_BY_MIME_TYPE = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

type AvatarMimeType = keyof typeof EXTENSION_BY_MIME_TYPE;
type Warn = (context: Record<string, unknown>, message: string) => void;

export type SignedAvatarUpload = {
  path: string;
  token: string;
  mime_type: AvatarMimeType;
  expires_in: number;
};

export type ProfileAvatarService = {
  createSignedReadUrl(path: string | null): Promise<string | null>;
  createSignedUpload(userId: string, input: AvatarUploadInput): Promise<SignedAvatarUpload>;
  verifyUploadedObject(userId: string, path: string): Promise<void>;
  deleteObject(userId: string, path: string): Promise<void>;
};

const AVATAR_FILENAME_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpe?g|png|webp)$/i;

function isOwnedAvatarPath(expectedUserId: string, path: string): boolean {
  const segments = path.split('/');

  return segments.length === 2
    && segments[0] === expectedUserId
    && AVATAR_FILENAME_PATTERN.test(segments[1] ?? '');
}

function metadataNumber(metadata: Record<string, unknown> | null, key: string): number | null {
  const value = metadata?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function metadataString(metadata: Record<string, unknown> | null, key: string): string | null {
  const value = metadata?.[key];
  return typeof value === 'string' ? value : null;
}

export function createProfileAvatarService(
  supabase?: SupabaseClient,
  warn: Warn = (context, message) => console.warn(message, context),
): ProfileAvatarService {
  function getBucket() {
    return (supabase ?? getSupabaseAdminClient()).storage.from(PROFILE_AVATAR_BUCKET);
  }

  return {
    async createSignedReadUrl(path) {
      if (!path) return null;

      try {
        const bucket = getBucket();
        const { data, error } = await bucket.createSignedUrl(
          path,
          PROFILE_AVATAR_READ_URL_EXPIRES_IN_SECONDS,
        );

        if (error || !data?.signedUrl) {
          warn(
            { event: 'profile_avatar_read_sign_failed', category: 'storage_error' },
            'Profile avatar read URL could not be signed',
          );
          return null;
        }

        return data.signedUrl;
      } catch {
        warn(
          { event: 'profile_avatar_read_sign_failed', category: 'storage_error' },
          'Profile avatar read URL could not be signed',
        );
        return null;
      }
    },

    async createSignedUpload(userId, input) {
      const mimeType = input.mime_type as AvatarMimeType;
      const extension = EXTENSION_BY_MIME_TYPE[mimeType];
      const path = `${userId}/${randomUUID()}.${extension}`;
      const bucket = getBucket();
      const { data, error } = await bucket.createSignedUploadUrl(path, { upsert: false });

      if (error || !data?.token) {
        throw error ?? new Error('Avatar upload token was not returned.');
      }

      return {
        path,
        token: data.token,
        mime_type: mimeType,
        expires_in: PROFILE_AVATAR_UPLOAD_EXPIRES_IN_SECONDS,
      };
    },

    async verifyUploadedObject(userId, path) {
      const [, filename] = path.split('/');
      const bucket = getBucket();
      const { data, error } = await bucket.list(userId, {
        limit: 2,
        search: filename,
      });

      if (error) throw error;

      const object = data?.find((candidate) => candidate.name === filename);

      if (!object) {
        throw new AppError(404, 'AVATAR_UPLOAD_NOT_FOUND', 'Avatar upload was not found.');
      }

      const metadata = object.metadata as Record<string, unknown> | null;
      const size = metadataNumber(metadata, 'size');
      const mimeType = metadataString(metadata, 'mimetype') ?? metadataString(metadata, 'contentType');

      if (size !== null && size > PROFILE_AVATAR_MAX_BYTES) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Avatar upload is invalid.');
      }

      if (mimeType !== null && !(mimeType in EXTENSION_BY_MIME_TYPE)) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Avatar upload is invalid.');
      }
    },

    async deleteObject(userId, path) {
      if (!isOwnedAvatarPath(userId, path)) {
        warn(
          { event: 'profile_avatar_delete_skipped', category: 'invalid_ownership' },
          'Profile avatar cleanup was skipped because the stored path is invalid.',
        );
        return;
      }

      const bucket = getBucket();
      const { error } = await bucket.remove([path]);
      if (error) throw error;
    },
  };
}
