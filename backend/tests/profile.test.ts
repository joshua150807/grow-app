import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { AppError } from '../src/errors/appError.js';
import type { AuthTokenVerifier } from '../src/auth/types.js';
import {
  createProfileService,
  type ProfileService,
} from '../src/modules/profiles/profileService.js';
import type { ProfilesRepository } from '../src/modules/profiles/profilesRepository.js';

const validUser = {
  id: 'user-123',
  email: 'grower@example.com',
  role: 'authenticated',
};

const authTokenVerifier: AuthTokenVerifier = async (token) => {
  if (token !== 'valid-token') {
    return null;
  }

  return validUser;
};

function buildTestApp(profileService: ProfileService) {
  return buildApp({
    authTokenVerifier,
    profileService,
  });
}

describe('GET /v1/profile/me', () => {
  it('returns 401 without token', async () => {
    const repository: ProfilesRepository = {
      getProfileByUserId: vi.fn(),
    };
    const app = buildTestApp(createProfileService(repository));

    const response = await app.inject({
      method: 'GET',
      url: '/v1/profile/me',
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('UNAUTHORIZED');
    expect(repository.getProfileByUserId).not.toHaveBeenCalled();

    await app.close();
  });

  it('returns the authenticated users profile', async () => {
    const repository: ProfilesRepository = {
      getProfileByUserId: vi.fn(async () => ({
        id: validUser.id,
        username: 'grower',
        role: 'user',
      })),
    };
    const app = buildTestApp(createProfileService(repository));

    const response = await app.inject({
      method: 'GET',
      url: '/v1/profile/me',
      headers: {
        authorization: 'Bearer valid-token',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(repository.getProfileByUserId).toHaveBeenCalledWith(validUser.id);
    expect(response.json()).toEqual({
      profile: {
        id: validUser.id,
        user_id: validUser.id,
        username: 'grower',
        display_name: null,
        name: null,
        avatar_url: null,
        role: 'user',
        created_at: null,
        updated_at: null,
      },
    });

    await app.close();
  });

  it('returns a defined 404 when profile is missing', async () => {
    const repository: ProfilesRepository = {
      getProfileByUserId: vi.fn(async () => null),
    };
    const app = buildTestApp(createProfileService(repository));

    const response = await app.inject({
      method: 'GET',
      url: '/v1/profile/me',
      headers: {
        authorization: 'Bearer valid-token',
      },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('PROFILE_NOT_FOUND');
    expect(repository.getProfileByUserId).toHaveBeenCalledWith(validUser.id);

    await app.close();
  });

  it('does not accept a foreign user id from query params', async () => {
    const repository: ProfilesRepository = {
      getProfileByUserId: vi.fn(async () => ({
        id: validUser.id,
        username: 'grower',
      })),
    };
    const app = buildTestApp(createProfileService(repository));

    const response = await app.inject({
      method: 'GET',
      url: '/v1/profile/me?userId=other-user',
      headers: {
        authorization: 'Bearer valid-token',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(repository.getProfileByUserId).toHaveBeenCalledWith(validUser.id);
    expect(repository.getProfileByUserId).not.toHaveBeenCalledWith('other-user');

    await app.close();
  });

  it('propagates service errors through the central error handler', async () => {
    const profileService: ProfileService = {
      getCurrentUserProfile: vi.fn(async () => {
        throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profile missing.');
      }),
    };
    const app = buildTestApp(profileService);

    const response = await app.inject({
      method: 'GET',
      url: '/v1/profile/me',
      headers: {
        authorization: 'Bearer valid-token',
      },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('PROFILE_NOT_FOUND');

    await app.close();
  });
});
