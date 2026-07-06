import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import type { AuthTokenVerifier, AuthUser } from '../src/auth/types.js';
import { AppError } from '../src/errors/appError.js';
import {
  createBetaRegistrationCompletionService,
  type BetaRegistrationCompletionService,
} from '../src/modules/betaRegistration/betaRegistrationService.js';
import type {
  BetaRegistrationCompletionRepository,
} from '../src/modules/betaRegistration/betaRegistrationRepository.js';
import {
  createBetaRegistrationCompletionRepository,
} from '../src/modules/betaRegistration/betaRegistrationRepository.js';

const validUser: AuthUser = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'Grower@Example.com',
  role: 'authenticated',
};

const completedProfile = {
  id: validUser.id,
  username: 'grower',
  grow_points: 0,
  role: 'user',
  created_at: '2026-07-06T10:00:00.000Z',
  updated_at: '2026-07-06T10:00:00.000Z',
};

const authTokenVerifier: AuthTokenVerifier = async (token) => {
  if (token !== 'valid-token') {
    return null;
  }

  return validUser;
};

function buildTestApp(
  betaRegistrationCompletionService: BetaRegistrationCompletionService,
  verifier: AuthTokenVerifier = authTokenVerifier,
) {
  return buildApp({
    authTokenVerifier: verifier,
    betaRegistrationCompletionService,
  });
}

function createMockRepository(
  overrides: Partial<BetaRegistrationCompletionRepository> = {},
): BetaRegistrationCompletionRepository {
  return {
    complete: vi.fn(async () => completedProfile),
    ...overrides,
  };
}

describe('POST /v1/auth/beta-registration/complete', () => {
  it('returns 401 when auth is missing', async () => {
    const repository = createMockRepository();
    const app = buildTestApp(createBetaRegistrationCompletionService(repository));

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/beta-registration/complete',
      payload: {
        code: 'ABC123',
        username: 'grower',
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('UNAUTHORIZED');
    expect(repository.complete).not.toHaveBeenCalled();

    await app.close();
  });

  it('returns a registration-state error when auth email is missing', async () => {
    const repository = createMockRepository();
    const verifier: AuthTokenVerifier = async () => ({
      ...validUser,
      email: null,
    });
    const app = buildTestApp(createBetaRegistrationCompletionService(repository), verifier);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/beta-registration/complete',
      headers: {
        authorization: 'Bearer valid-token',
      },
      payload: {
        code: 'ABC123',
        username: 'grower',
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('AUTH_EMAIL_MISSING');
    expect(repository.complete).not.toHaveBeenCalled();

    await app.close();
  });

  it('returns 400 for invalid username', async () => {
    const repository = createMockRepository();
    const app = buildTestApp(createBetaRegistrationCompletionService(repository));

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/beta-registration/complete',
      headers: {
        authorization: 'Bearer valid-token',
      },
      payload: {
        code: 'ABC123',
        username: 'no spaces',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
    expect(repository.complete).not.toHaveBeenCalled();

    await app.close();
  });

  it('returns 400 for empty code', async () => {
    const repository = createMockRepository();
    const app = buildTestApp(createBetaRegistrationCompletionService(repository));

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/beta-registration/complete',
      headers: {
        authorization: 'Bearer valid-token',
      },
      payload: {
        code: '   ',
        username: 'grower',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
    expect(repository.complete).not.toHaveBeenCalled();

    await app.close();
  });

  it('returns 400 when an unknown request field is provided', async () => {
    const repository = createMockRepository();
    const app = buildTestApp(createBetaRegistrationCompletionService(repository));

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/beta-registration/complete',
      headers: {
        authorization: 'Bearer valid-token',
      },
      payload: {
        code: 'ABC123',
        username: 'grower',
        recovery_email: 'attacker@example.com',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
    expect(repository.complete).not.toHaveBeenCalled();

    await app.close();
  });

  it('uses only auth user id and auth email for ownership and recovery email', async () => {
    const repository = createMockRepository();
    const app = buildTestApp(createBetaRegistrationCompletionService(repository));

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/beta-registration/complete?userId=other-user',
      headers: {
        authorization: 'Bearer valid-token',
      },
      payload: {
        code: ' abc123 ',
        username: 'Grower',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(repository.complete).toHaveBeenCalledWith({
      userId: validUser.id,
      code: 'ABC123',
      username: 'grower',
      recoveryEmail: 'grower@example.com',
    });
    expect(repository.complete).not.toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'other-user' }),
    );
    expect(response.json()).toEqual({
      status: 'completed',
      profile: completedProfile,
    });
    expect(response.json().profile).not.toHaveProperty('recovery_email');
    expect(response.json().profile).not.toHaveProperty('user_id');
    expect(response.json().profile).not.toHaveProperty('display_name');
    expect(response.json().profile).not.toHaveProperty('name');
    expect(response.json().profile).not.toHaveProperty('avatar_url');
    expect(response.json().profile).not.toHaveProperty('bio');

    await app.close();
  });

  it.each([
    ['CODE_INVALID', new AppError(409, 'CODE_INVALID', 'Beta code is invalid or unavailable.')],
    ['USERNAME_TAKEN', new AppError(409, 'USERNAME_TAKEN', 'Username is already taken.')],
    ['EMAIL_TAKEN', new AppError(409, 'EMAIL_TAKEN', 'Recovery email is already taken.')],
    [
      'REGISTRATION_STATE_CONFLICT',
      new AppError(409, 'REGISTRATION_STATE_CONFLICT', 'Beta registration state is inconsistent.'),
    ],
    [
      'PROFILE_STATE_CONFLICT',
      new AppError(409, 'PROFILE_STATE_CONFLICT', 'Profile state cannot be completed.'),
    ],
  ])('propagates %s from the completion service', async (code, error) => {
    const service: BetaRegistrationCompletionService = {
      completeRegistration: vi.fn(async () => {
        throw error;
      }),
    };
    const app = buildTestApp(service);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/beta-registration/complete',
      headers: {
        authorization: 'Bearer valid-token',
      },
      payload: {
        code: 'ABC123',
        username: 'grower',
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe(code);

    await app.close();
  });
});

describe('Beta registration repository timestamp mapping', () => {
  function createRepositoryWithInsertedProfile(profileRow: {
    created_at: string | Date | null;
    updated_at: string | Date | null;
  }) {
    const rows = [
      {
        rows: [{
          id: 'code-123',
          code: 'ABC123',
          used_by: null,
          used_at: null,
          created_at: null,
        }],
      },
      { rows: [] },
      { rows: [] },
      { rows: [] },
      {
        rows: [{
          id: validUser.id,
          username: 'grower',
          grow_points: 0,
          role: 'user',
          recovery_email: 'grower@example.com',
          created_at: profileRow.created_at,
          updated_at: profileRow.updated_at,
        }],
      },
      { rows: [] },
    ];
    const tx = {
      execute: vi.fn(async () => rows.shift() ?? { rows: [] }),
    };
    const db = {
      transaction: vi.fn(async (callback) => callback(tx)),
    };

    return createBetaRegistrationCompletionRepository(db as never);
  }

  it('normalizes Date timestamps from raw persistence rows to ISO strings', async () => {
    const repository = createRepositoryWithInsertedProfile({
      created_at: new Date('2026-07-06T10:00:00.000Z'),
      updated_at: new Date('2026-07-06T11:00:00.000Z'),
    });

    await expect(repository.complete({
      userId: validUser.id,
      code: 'ABC123',
      username: 'grower',
      recoveryEmail: 'grower@example.com',
    })).resolves.toMatchObject({
      created_at: '2026-07-06T10:00:00.000Z',
      updated_at: '2026-07-06T11:00:00.000Z',
    });
  });

  it('keeps null timestamps from raw persistence rows as null', async () => {
    const repository = createRepositoryWithInsertedProfile({
      created_at: null,
      updated_at: null,
    });

    await expect(repository.complete({
      userId: validUser.id,
      code: 'ABC123',
      username: 'grower',
      recoveryEmail: 'grower@example.com',
    })).resolves.toMatchObject({
      created_at: null,
      updated_at: null,
    });
  });

  it('keeps string timestamps from raw persistence rows unchanged', async () => {
    const repository = createRepositoryWithInsertedProfile({
      created_at: '2026-07-06T10:00:00.000Z',
      updated_at: '2026-07-06T11:00:00.000Z',
    });

    await expect(repository.complete({
      userId: validUser.id,
      code: 'ABC123',
      username: 'grower',
      recoveryEmail: 'grower@example.com',
    })).resolves.toMatchObject({
      created_at: '2026-07-06T10:00:00.000Z',
      updated_at: '2026-07-06T11:00:00.000Z',
    });
  });
});
