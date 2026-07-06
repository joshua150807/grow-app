import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { AuthTokenVerifier } from '../src/auth/types.js';

function buildTestApp() {
  const verifier: AuthTokenVerifier = async (token) => {
    if (token !== 'valid-token') {
      return null;
    }

    return {
      id: 'user-123',
      email: 'grower@example.com',
      role: 'authenticated',
    };
  };

  return buildApp({
    authTokenVerifier: verifier,
  });
}

describe('GET /v1/me auth', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const app = buildTestApp();

    const response = await app.inject({
      method: 'GET',
      url: '/v1/me',
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('UNAUTHORIZED');

    await app.close();
  });

  it('returns 401 when Bearer format is invalid', async () => {
    const app = buildTestApp();

    const response = await app.inject({
      method: 'GET',
      url: '/v1/me',
      headers: {
        authorization: 'Token invalid',
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('UNAUTHORIZED');

    await app.close();
  });

  it('returns 401 when token verification fails', async () => {
    const app = buildTestApp();

    const response = await app.inject({
      method: 'GET',
      url: '/v1/me',
      headers: {
        authorization: 'Bearer invalid-token',
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('UNAUTHORIZED');

    await app.close();
  });

  it('returns auth user data for a valid token', async () => {
    const app = buildTestApp();

    const response = await app.inject({
      method: 'GET',
      url: '/v1/me',
      headers: {
        authorization: 'Bearer valid-token',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      user: {
        id: 'user-123',
        email: 'grower@example.com',
        role: 'authenticated',
      },
    });

    await app.close();
  });
});
