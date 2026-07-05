import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { AppError } from '../src/errors/appError.js';
import type { AuthTokenVerifier } from '../src/auth/types.js';
import {
  createProfileService,
  type ProfileService,
} from '../src/modules/profiles/profileService.js';
import type { Profile } from '../src/modules/profiles/domain/profile.js';
import type { ProfilesRepository } from '../src/modules/profiles/profilesRepository.js';
import type { ProfilesReadRepository } from '../src/modules/profiles/repositories/profilesReadRepository.js';

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

function createReadRepository(profile: Profile | null): ProfilesReadRepository {
  return {
    findByUserId: vi.fn(async () => profile),
  };
}

describe('GET /v1/profile/me', () => {
  it('returns 401 without token', async () => {
    const repository: ProfilesRepository = {
      getProfileByUserId: vi.fn(),
      updateProfileByUserId: vi.fn(),
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
      updateProfileByUserId: vi.fn(),
    };
    const readRepository = createReadRepository({
      id: validUser.id,
      username: 'grower',
      growPoints: 12,
      role: 'user',
      createdAt: '2026-07-05T10:00:00.000Z',
      updatedAt: '2026-07-05T11:00:00.000Z',
    });
    const app = buildTestApp(createProfileService(repository, readRepository));

    const response = await app.inject({
      method: 'GET',
      url: '/v1/profile/me',
      headers: {
        authorization: 'Bearer valid-token',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(readRepository.findByUserId).toHaveBeenCalledWith(validUser.id);
    expect(response.json()).toEqual({
      profile: {
        id: validUser.id,
        username: 'grower',
        grow_points: 12,
        role: 'user',
        created_at: '2026-07-05T10:00:00.000Z',
        updated_at: '2026-07-05T11:00:00.000Z',
      },
    });

    await app.close();
  });

  it('returns a defined 404 when profile is missing', async () => {
    const repository: ProfilesRepository = {
      getProfileByUserId: vi.fn(),
      updateProfileByUserId: vi.fn(),
    };
    const readRepository = createReadRepository(null);
    const app = buildTestApp(createProfileService(repository, readRepository));

    const response = await app.inject({
      method: 'GET',
      url: '/v1/profile/me',
      headers: {
        authorization: 'Bearer valid-token',
      },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('PROFILE_NOT_FOUND');
    expect(readRepository.findByUserId).toHaveBeenCalledWith(validUser.id);

    await app.close();
  });

  it('does not accept a foreign user id from query params', async () => {
    const repository: ProfilesRepository = {
      getProfileByUserId: vi.fn(async () => ({
        id: validUser.id,
        username: 'grower',
      })),
      updateProfileByUserId: vi.fn(),
    };
    const readRepository = createReadRepository({
      id: validUser.id,
      username: 'grower',
      growPoints: null,
      role: null,
      createdAt: null,
      updatedAt: null,
    });
    const app = buildTestApp(createProfileService(repository, readRepository));

    const response = await app.inject({
      method: 'GET',
      url: '/v1/profile/me?userId=other-user',
      headers: {
        authorization: 'Bearer valid-token',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(readRepository.findByUserId).toHaveBeenCalledWith(validUser.id);
    expect(readRepository.findByUserId).not.toHaveBeenCalledWith('other-user');
    expect(response.json().profile).not.toHaveProperty('user_id');
    expect(response.json().profile).not.toHaveProperty('display_name');
    expect(response.json().profile).not.toHaveProperty('name');
    expect(response.json().profile).not.toHaveProperty('avatar_url');
    expect(response.json().profile).not.toHaveProperty('bio');

    await app.close();
  });

  it('propagates service errors through the central error handler', async () => {
    const profileService: ProfileService = {
      getCurrentUserProfile: vi.fn(async () => {
        throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profile missing.');
      }),
      updateCurrentUserProfile: vi.fn(),
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

describe('PATCH /v1/profile/me', () => {
  it('returns 401 without token', async () => {
    const repository: ProfilesRepository = {
      getProfileByUserId: vi.fn(),
      updateProfileByUserId: vi.fn(),
    };
    const app = buildTestApp(createProfileService(repository));

    const response = await app.inject({
      method: 'PATCH',
      url: '/v1/profile/me',
      payload: {
        username: 'grower',
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('UNAUTHORIZED');
    expect(repository.updateProfileByUserId).not.toHaveBeenCalled();

    await app.close();
  });

  it('returns 400 for invalid body', async () => {
    const repository: ProfilesRepository = {
      getProfileByUserId: vi.fn(),
      updateProfileByUserId: vi.fn(),
    };
    const app = buildTestApp(createProfileService(repository));

    const response = await app.inject({
      method: 'PATCH',
      url: '/v1/profile/me',
      headers: {
        authorization: 'Bearer valid-token',
      },
      payload: {
        username: 'no spaces allowed',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
    expect(repository.updateProfileByUserId).not.toHaveBeenCalled();

    await app.close();
  });

  it('updates the authenticated users profile', async () => {
    const repository: ProfilesRepository = {
      getProfileByUserId: vi.fn(async () => ({
        id: validUser.id,
        username: 'old_name',
      })),
      updateProfileByUserId: vi.fn(async () => ({
        id: validUser.id,
        username: 'grower',
        role: 'user',
      })),
    };
    const app = buildTestApp(createProfileService(repository));

    const response = await app.inject({
      method: 'PATCH',
      url: '/v1/profile/me?userId=other-user',
      headers: {
        authorization: 'Bearer valid-token',
      },
      payload: {
        username: 'Grower',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(repository.updateProfileByUserId).toHaveBeenCalledWith(validUser.id, {
      username: 'grower',
    });
    expect(repository.updateProfileByUserId).not.toHaveBeenCalledWith('other-user', {
      username: 'grower',
    });
    expect(response.json().profile.username).toBe('grower');

    await app.close();
  });

  it('returns 404 when profile is missing', async () => {
    const repository: ProfilesRepository = {
      getProfileByUserId: vi.fn(async () => null),
      updateProfileByUserId: vi.fn(),
    };
    const app = buildTestApp(createProfileService(repository));

    const response = await app.inject({
      method: 'PATCH',
      url: '/v1/profile/me',
      headers: {
        authorization: 'Bearer valid-token',
      },
      payload: {
        username: 'grower',
      },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('PROFILE_NOT_FOUND');
    expect(repository.updateProfileByUserId).not.toHaveBeenCalled();

    await app.close();
  });

  it('returns 409 when username is already taken', async () => {
    const repository: ProfilesRepository = {
      getProfileByUserId: vi.fn(async () => ({
        id: validUser.id,
        username: 'old_name',
      })),
      updateProfileByUserId: vi.fn(async () => {
        throw {
          code: '23505',
          message: 'duplicate key value violates unique constraint',
          details: 'Key (username)=(grower) already exists.',
        };
      }),
    };
    const app = buildTestApp(createProfileService(repository));

    const response = await app.inject({
      method: 'PATCH',
      url: '/v1/profile/me',
      headers: {
        authorization: 'Bearer valid-token',
      },
      payload: {
        username: 'grower',
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('USERNAME_TAKEN');

    await app.close();
  });
});
