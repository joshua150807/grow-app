import { describe, expect, it, vi } from 'vitest';
import type { InjectOptions } from 'light-my-request';
import { buildApp } from '../src/app.js';
import { AppError } from '../src/errors/appError.js';
import type { AuthTokenVerifier } from '../src/auth/types.js';
import {
  createProfileService,
} from '../src/modules/profiles/profileService.js';
import type { ProfilesRepository } from '../src/modules/profiles/profilesRepository.js';
import type { ProfilesReadRepository } from '../src/modules/profiles/repositories/profilesReadRepository.js';
import {
  createProfileAvatarService,
  PROFILE_AVATAR_BUCKET,
  PROFILE_AVATAR_READ_URL_EXPIRES_IN_SECONDS,
  type ProfileAvatarService,
} from '../src/modules/profiles/services/profileAvatarService.js';

const userId = '123e4567-e89b-12d3-a456-426614174000';
const fileId = '550e8400-e29b-41d4-a716-446655440000';
const newPath = `${userId}/${fileId}.jpg`;
const oldPath = `${userId}/650e8400-e29b-41d4-a716-446655440000.png`;

const authTokenVerifier: AuthTokenVerifier = async (token) => (
  token === 'valid-token'
    ? { id: userId, email: 'grower@example.com', role: 'authenticated' }
    : null
);

function profileRow(avatarPath: string | null = null) {
  return {
    id: userId,
    username: 'grower',
    bio: 'Keep growing.',
    avatar_path: avatarPath,
    grow_points: 12,
    role: 'user',
    created_at: '2026-07-05T10:00:00.000Z',
    updated_at: '2026-07-05T11:00:00.000Z',
  };
}

function createRepository(avatarPath: string | null = null): ProfilesRepository {
  return {
    getProfileByUserId: vi.fn(async () => profileRow(avatarPath)),
    updateProfileByUserId: vi.fn(),
    updateAvatarPathByUserId: vi.fn(async (_id, nextPath) => profileRow(nextPath)),
  };
}

function createAvatarMock(overrides: Partial<ProfileAvatarService> = {}): ProfileAvatarService {
  return {
    createSignedReadUrl: vi.fn(async (path) => (
      path ? `https://storage.example.test/${encodeURIComponent(path)}` : null
    )),
    createSignedUpload: vi.fn(async (_id, input) => ({
      path: newPath,
      token: 'signed-upload-token',
      mime_type: input.mime_type,
      expires_in: 7200,
    })),
    verifyUploadedObject: vi.fn(async () => undefined),
    deleteObject: vi.fn(async () => undefined),
    ...overrides,
  };
}

function createApp(
  repository: ProfilesRepository,
  avatarService: ProfileAvatarService,
  warn = vi.fn(),
  readRepository?: ProfilesReadRepository,
) {
  return buildApp({
    authTokenVerifier,
    profileService: createProfileService(repository, readRepository, avatarService, warn),
  });
}

function authorizedRequest(
  method: 'GET' | 'POST' | 'DELETE',
  url: string,
  payload?: Record<string, unknown>,
): InjectOptions {
  return {
    method,
    url,
    headers: { authorization: 'Bearer valid-token' },
    ...(payload === undefined ? {} : { payload }),
  };
}

describe('profile avatar storage service', () => {
  it('returns a signed read URL and uses the configured lifetime', async () => {
    const createSignedUrl = vi.fn(async () => ({
      data: { signedUrl: 'https://signed.example/avatar' },
      error: null,
    }));
    const from = vi.fn(() => ({ createSignedUrl }));
    const service = createProfileAvatarService({ storage: { from } } as never);

    await expect(service.createSignedReadUrl(newPath)).resolves.toBe(
      'https://signed.example/avatar',
    );
    expect(from).toHaveBeenCalledWith(PROFILE_AVATAR_BUCKET);
    expect(createSignedUrl).toHaveBeenCalledWith(
      newPath,
      PROFILE_AVATAR_READ_URL_EXPIRES_IN_SECONDS,
    );
  });

  it('degrades signing failures to null and logs a warning', async () => {
    const warn = vi.fn();
    const createSignedUrl = vi.fn(async () => ({ data: null, error: new Error('storage') }));
    const service = createProfileAvatarService({
      storage: { from: vi.fn(() => ({ createSignedUrl })) },
    } as never, warn);

    await expect(service.createSignedReadUrl(newPath)).resolves.toBeNull();
    expect(warn).toHaveBeenCalledOnce();
  });

  it.each([
    ['image/jpeg', 'jpg'],
    ['image/png', 'png'],
    ['image/webp', 'webp'],
  ] as const)('creates a non-upsert upload for %s with server extension %s', async (
    mimeType,
    extension,
  ) => {
    const createSignedUploadUrl = vi.fn(async () => ({
      data: { token: 'token' },
      error: null,
    }));
    const service = createProfileAvatarService({
      storage: { from: vi.fn(() => ({ createSignedUploadUrl })) },
    } as never);

    const upload = await service.createSignedUpload(userId, { mime_type: mimeType });

    expect(upload.path).toMatch(new RegExp(
      `^${userId}/[0-9a-f-]{36}\\.${extension}$`,
    ));
    expect(upload).toMatchObject({
      token: 'token',
      mime_type: mimeType,
      expires_in: 7200,
    });
    expect(createSignedUploadUrl).toHaveBeenCalledWith(upload.path, { upsert: false });
  });

  it('returns AVATAR_UPLOAD_NOT_FOUND when the exact object is absent', async () => {
    const list = vi.fn(async () => ({ data: [], error: null }));
    const service = createProfileAvatarService({
      storage: { from: vi.fn(() => ({ list })) },
    } as never);

    await expect(service.verifyUploadedObject(userId, newPath)).rejects.toMatchObject({
      statusCode: 404,
      code: 'AVATAR_UPLOAD_NOT_FOUND',
    });
  });

  it('deletes an owned valid avatar path', async () => {
    const remove = vi.fn(async () => ({ data: [], error: null }));
    const service = createProfileAvatarService({
      storage: { from: vi.fn(() => ({ remove })) },
    } as never);

    await service.deleteObject(userId, oldPath);

    expect(remove).toHaveBeenCalledWith([oldPath]);
  });

  it.each([
    `223e4567-e89b-12d3-a456-426614174000/${fileId}.jpg`,
    `${userId}/not-a-uuid.jpg`,
    `${userId}/nested/${fileId}.jpg`,
    `${userId}/${fileId}.gif`,
  ])('does not delete an unowned or invalid avatar path: %s', async (path) => {
    const warn = vi.fn();
    const remove = vi.fn(async () => ({ data: [], error: null }));
    const service = createProfileAvatarService({
      storage: { from: vi.fn(() => ({ remove })) },
    } as never, warn);

    await service.deleteObject(userId, path);

    expect(remove).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      { event: 'profile_avatar_delete_skipped', category: 'invalid_ownership' },
      'Profile avatar cleanup was skipped because the stored path is invalid.',
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain(path);
    expect(JSON.stringify(warn.mock.calls)).not.toContain('token');
  });
});

describe('profile avatar routes', () => {
  it('returns a signed avatar_url without exposing avatar_path', async () => {
    const repository = createRepository(newPath);
    const avatarService = createAvatarMock({
      createSignedReadUrl: vi.fn(async () => 'https://signed.example/avatar'),
    });
    const readRepository: ProfilesReadRepository = {
      findByUserId: vi.fn(async () => ({
        id: userId,
        username: 'grower',
        bio: '',
        avatarPath: newPath,
        growPoints: 12,
        role: 'user',
        createdAt: null,
        updatedAt: null,
      })),
    };
    const app = createApp(repository, avatarService, vi.fn(), readRepository);
    const response = await app.inject(authorizedRequest('GET', '/v1/profile/me'));

    expect(response.statusCode).toBe(200);
    expect(response.json().profile.avatar_url).toBe('https://signed.example/avatar');
    expect(response.json().profile).not.toHaveProperty('avatar_path');
    expect(response.json().profile).not.toHaveProperty('avatarPath');
    await app.close();
  });

  it('keeps GET successful with avatar_url null when signing fails safely', async () => {
    const repository = createRepository(newPath);
    const avatarService = createAvatarMock({
      createSignedReadUrl: vi.fn(async () => null),
    });
    const readRepository: ProfilesReadRepository = {
      findByUserId: vi.fn(async () => ({
        id: userId,
        username: 'grower',
        bio: 'Available profile data',
        avatarPath: newPath,
        growPoints: 12,
        role: 'user',
        createdAt: null,
        updatedAt: null,
      })),
    };
    const app = createApp(repository, avatarService, vi.fn(), readRepository);
    const response = await app.inject(authorizedRequest('GET', '/v1/profile/me'));

    expect(response.statusCode).toBe(200);
    expect(response.json().profile).toMatchObject({
      username: 'grower',
      bio: 'Available profile data',
      grow_points: 12,
      avatar_url: null,
    });
    await app.close();
  });

  it('requires authentication for avatar endpoints', async () => {
    const repository = createRepository();
    const avatarService = createAvatarMock();
    const app = createApp(repository, avatarService);

    for (const request of [
      { method: 'POST', url: '/v1/profile/me/avatar/upload', payload: { mime_type: 'image/jpeg' } },
      { method: 'POST', url: '/v1/profile/me/avatar/confirm', payload: { path: newPath } },
      { method: 'DELETE', url: '/v1/profile/me/avatar' },
    ] as const) {
      const response = await app.inject(request);
      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe('UNAUTHORIZED');
    }

    await app.close();
  });

  it.each(['image/jpeg', 'image/png', 'image/webp'] as const)(
    'accepts upload MIME type %s',
    async (mimeType) => {
      const repository = createRepository();
      const avatarService = createAvatarMock();
      const app = createApp(repository, avatarService);

      const response = await app.inject(authorizedRequest(
        'POST',
        '/v1/profile/me/avatar/upload',
        { mime_type: mimeType },
      ));

      expect(response.statusCode).toBe(200);
      expect(avatarService.createSignedUpload).toHaveBeenCalledWith(userId, {
        mime_type: mimeType,
      });
      expect(response.json().upload).toMatchObject({
        path: newPath,
        token: 'signed-upload-token',
        mime_type: mimeType,
        expires_in: 7200,
      });

      await app.close();
    },
  );

  it('rejects an unsupported upload MIME type', async () => {
    const repository = createRepository();
    const avatarService = createAvatarMock();
    const app = createApp(repository, avatarService);
    const response = await app.inject(authorizedRequest(
      'POST',
      '/v1/profile/me/avatar/upload',
      { mime_type: 'image/gif' },
    ));

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
    expect(avatarService.createSignedUpload).not.toHaveBeenCalled();
    await app.close();
  });

  it.each([
    `${fileId}/${fileId}.jpg`,
    `${userId}/nested/${fileId}.jpg`,
    `${userId}/not-a-uuid.jpg`,
    `${userId}/${fileId}.gif`,
    `${userId}/../${fileId}.jpg`,
  ])('rejects invalid or foreign confirm path %s', async (path) => {
    const repository = createRepository();
    const avatarService = createAvatarMock();
    const app = createApp(repository, avatarService);
    const response = await app.inject(authorizedRequest(
      'POST',
      '/v1/profile/me/avatar/confirm',
      { path },
    ));

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
    expect(avatarService.verifyUploadedObject).not.toHaveBeenCalled();
    await app.close();
  });

  it('verifies, persists, responds, then deletes the previous object', async () => {
    const order: string[] = [];
    const repository = createRepository(oldPath);
    repository.updateAvatarPathByUserId = vi.fn(async (_id, path) => {
      order.push('database');
      return profileRow(path);
    });
    const avatarService = createAvatarMock({
      verifyUploadedObject: vi.fn(async () => { order.push('verify'); }),
      createSignedReadUrl: vi.fn(async () => {
        order.push('sign');
        return 'https://signed.example/avatar';
      }),
      deleteObject: vi.fn(async () => { order.push('delete'); }),
    });
    const app = createApp(repository, avatarService);
    const response = await app.inject(authorizedRequest(
      'POST',
      '/v1/profile/me/avatar/confirm',
      { path: newPath },
    ));

    expect(response.statusCode).toBe(200);
    expect(order).toEqual(['verify', 'database', 'sign', 'delete']);
    expect(repository.updateAvatarPathByUserId).toHaveBeenCalledWith(userId, newPath);
    expect(avatarService.deleteObject).toHaveBeenCalledWith(userId, oldPath);
    expect(response.json().profile).toMatchObject({
      avatar_url: 'https://signed.example/avatar',
    });
    expect(response.json().profile).not.toHaveProperty('avatar_path');
    await app.close();
  });

  it('returns 404 when the uploaded object is absent', async () => {
    const repository = createRepository();
    const avatarService = createAvatarMock({
      verifyUploadedObject: vi.fn(async () => {
        throw new AppError(404, 'AVATAR_UPLOAD_NOT_FOUND', 'Avatar upload was not found.');
      }),
    });
    const app = createApp(repository, avatarService);
    const response = await app.inject(authorizedRequest(
      'POST',
      '/v1/profile/me/avatar/confirm',
      { path: newPath },
    ));

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('AVATAR_UPLOAD_NOT_FOUND');
    expect(repository.updateAvatarPathByUserId).not.toHaveBeenCalled();
    await app.close();
  });

  it('keeps the new avatar when deleting the previous object fails', async () => {
    const warn = vi.fn();
    const repository = createRepository(oldPath);
    const avatarService = createAvatarMock({
      deleteObject: vi.fn(async () => { throw new Error('remove failed'); }),
    });
    const app = createApp(repository, avatarService, warn);
    const response = await app.inject(authorizedRequest(
      'POST',
      '/v1/profile/me/avatar/confirm',
      { path: newPath },
    ));

    expect(response.statusCode).toBe(200);
    expect(repository.updateAvatarPathByUserId).toHaveBeenCalledWith(userId, newPath);
    expect(warn).toHaveBeenCalledOnce();
    await app.close();
  });

  it('keeps confirm successful when the stored previous path is invalid', async () => {
    const invalidOldPath = `other-user/${fileId}.jpg`;
    const repository = createRepository(invalidOldPath);
    const avatarService = createProfileAvatarService({
      storage: { from: vi.fn(() => { throw new Error('storage must not be reached'); }) },
    } as never, vi.fn());
    avatarService.verifyUploadedObject = vi.fn(async () => undefined);
    avatarService.createSignedReadUrl = vi.fn(async () => null);
    const app = createApp(repository, avatarService);

    const response = await app.inject(authorizedRequest(
      'POST',
      '/v1/profile/me/avatar/confirm',
      { path: newPath },
    ));

    expect(response.statusCode).toBe(200);
    expect(repository.updateAvatarPathByUserId).toHaveBeenCalledWith(userId, newPath);
    await app.close();
  });

  it('does not delete when the previous path equals the confirmed path', async () => {
    const repository = createRepository(newPath);
    const avatarService = createAvatarMock();
    const app = createApp(repository, avatarService);

    const response = await app.inject(authorizedRequest(
      'POST',
      '/v1/profile/me/avatar/confirm',
      { path: newPath },
    ));

    expect(response.statusCode).toBe(200);
    expect(avatarService.deleteObject).not.toHaveBeenCalled();
    await app.close();
  });

  it('resets avatar_path before deleting the old object', async () => {
    const order: string[] = [];
    const repository = createRepository(oldPath);
    repository.updateAvatarPathByUserId = vi.fn(async (_id, path) => {
      order.push('database');
      return profileRow(path);
    });
    const avatarService = createAvatarMock({
      createSignedReadUrl: vi.fn(async () => {
        order.push('map');
        return null;
      }),
      deleteObject: vi.fn(async () => { order.push('delete'); }),
    });
    const app = createApp(repository, avatarService);
    const response = await app.inject(authorizedRequest(
      'DELETE',
      '/v1/profile/me/avatar',
    ));

    expect(response.statusCode).toBe(200);
    expect(order).toEqual(['database', 'map', 'delete']);
    expect(repository.updateAvatarPathByUserId).toHaveBeenCalledWith(userId, null);
    expect(response.json().profile.avatar_url).toBeNull();
    await app.close();
  });

  it('is idempotent when no avatar is set', async () => {
    const repository = createRepository(null);
    const avatarService = createAvatarMock();
    const app = createApp(repository, avatarService);
    const response = await app.inject(authorizedRequest(
      'DELETE',
      '/v1/profile/me/avatar',
    ));

    expect(response.statusCode).toBe(200);
    expect(response.json().profile.avatar_url).toBeNull();
    expect(repository.updateAvatarPathByUserId).not.toHaveBeenCalled();
    expect(avatarService.deleteObject).not.toHaveBeenCalled();
    await app.close();
  });

  it('does not fail reset when old object deletion fails', async () => {
    const warn = vi.fn();
    const repository = createRepository(oldPath);
    const avatarService = createAvatarMock({
      deleteObject: vi.fn(async () => { throw new Error('remove failed'); }),
    });
    const app = createApp(repository, avatarService, warn);
    const response = await app.inject(authorizedRequest(
      'DELETE',
      '/v1/profile/me/avatar',
    ));

    expect(response.statusCode).toBe(200);
    expect(repository.updateAvatarPathByUserId).toHaveBeenCalledWith(userId, null);
    expect(warn).toHaveBeenCalledOnce();
    await app.close();
  });

  it('keeps reset successful when the stored previous path is invalid', async () => {
    const invalidOldPath = `${userId}/nested/${fileId}.jpg`;
    const repository = createRepository(invalidOldPath);
    const warn = vi.fn();
    const avatarService = createProfileAvatarService({
      storage: { from: vi.fn(() => { throw new Error('storage must not be reached'); }) },
    } as never, warn);
    avatarService.createSignedReadUrl = vi.fn(async () => null);
    const app = createApp(repository, avatarService);

    const response = await app.inject(authorizedRequest(
      'DELETE',
      '/v1/profile/me/avatar',
    ));

    expect(response.statusCode).toBe(200);
    expect(repository.updateAvatarPathByUserId).toHaveBeenCalledWith(userId, null);
    expect(response.json().profile.avatar_url).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      { event: 'profile_avatar_delete_skipped', category: 'invalid_ownership' },
      'Profile avatar cleanup was skipped because the stored path is invalid.',
    );
    await app.close();
  });
});
