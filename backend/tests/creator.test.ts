import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import type { AuthTokenVerifier } from '../src/auth/types.js';
import {
  createCreatorService,
  type CreatorService,
} from '../src/modules/creator/creatorService.js';
import type { CreatorRepository } from '../src/modules/creator/creatorRepository.js';

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

function buildTestApp(creatorService: CreatorService) {
  return buildApp({
    authTokenVerifier,
    creatorService,
  });
}

function createMockRepository(overrides: Partial<CreatorRepository> = {}): CreatorRepository {
  return {
    getLatestCreatorApplicationByUserId: vi.fn(async () => null),
    createCreatorApplicationForUser: vi.fn(),
    ...overrides,
  };
}

const validPayload = {
  motivation: 'I want to create practical growth videos for the Grow community.',
  experience: 'I have created short-form educational content before.',
  content_focus: 'Mindset, discipline and fitness.',
  social_links: ['https://example.com/grower'],
};

describe('POST /v1/creator/applications', () => {
  it('returns 401 without token', async () => {
    const repository = createMockRepository();
    const app = buildTestApp(createCreatorService(repository));

    const response = await app.inject({
      method: 'POST',
      url: '/v1/creator/applications',
      payload: validPayload,
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('UNAUTHORIZED');
    expect(repository.createCreatorApplicationForUser).not.toHaveBeenCalled();

    await app.close();
  });

  it('returns 400 for invalid body', async () => {
    const repository = createMockRepository();
    const app = buildTestApp(createCreatorService(repository));

    const response = await app.inject({
      method: 'POST',
      url: '/v1/creator/applications',
      headers: {
        authorization: 'Bearer valid-token',
      },
      payload: {
        motivation: 'too short',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
    expect(repository.createCreatorApplicationForUser).not.toHaveBeenCalled();

    await app.close();
  });

  it('creates an application for the authenticated user', async () => {
    const repository = createMockRepository({
      getLatestCreatorApplicationByUserId: vi.fn(async () => null),
      createCreatorApplicationForUser: vi.fn(async (userId, input) => ({
        id: 'application-123',
        user_id: userId,
        motivation: input.motivation,
        experience: input.experience ?? null,
        content_focus: input.content_focus ?? null,
        social_links: input.social_links ?? null,
        status: input.status,
        rejection_reason: null,
        created_at: '2026-06-30T12:00:00.000Z',
        updated_at: null,
      })),
    });
    const app = buildTestApp(createCreatorService(repository));

    const response = await app.inject({
      method: 'POST',
      url: '/v1/creator/applications?userId=other-user',
      headers: {
        authorization: 'Bearer valid-token',
      },
      payload: validPayload,
    });

    expect(response.statusCode).toBe(201);
    expect(repository.getLatestCreatorApplicationByUserId).toHaveBeenCalledWith(validUser.id);
    expect(repository.createCreatorApplicationForUser).toHaveBeenCalledWith(validUser.id, {
      ...validPayload,
      status: 'pending',
    });
    expect(repository.createCreatorApplicationForUser).not.toHaveBeenCalledWith(
      'other-user',
      expect.anything(),
    );
    expect(response.json()).toEqual({
      application: {
        id: 'application-123',
        user_id: validUser.id,
        motivation: validPayload.motivation,
        experience: validPayload.experience,
        content_focus: validPayload.content_focus,
        social_links: validPayload.social_links,
        status: 'pending',
        rejection_reason: null,
        created_at: '2026-06-30T12:00:00.000Z',
        updated_at: null,
      },
    });

    await app.close();
  });

  it('returns 409 when an open application already exists', async () => {
    const repository = createMockRepository({
      getLatestCreatorApplicationByUserId: vi.fn(async () => ({
        id: 'application-123',
        user_id: validUser.id,
        motivation: validPayload.motivation,
        status: 'pending',
      })),
    });
    const app = buildTestApp(createCreatorService(repository));

    const response = await app.inject({
      method: 'POST',
      url: '/v1/creator/applications',
      headers: {
        authorization: 'Bearer valid-token',
      },
      payload: validPayload,
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('CREATOR_APPLICATION_EXISTS');
    expect(repository.createCreatorApplicationForUser).not.toHaveBeenCalled();

    await app.close();
  });
});

describe('GET /v1/creator/applications/me', () => {
  it('returns 401 without token', async () => {
    const repository = createMockRepository();
    const app = buildTestApp(createCreatorService(repository));

    const response = await app.inject({
      method: 'GET',
      url: '/v1/creator/applications/me',
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('UNAUTHORIZED');
    expect(repository.getLatestCreatorApplicationByUserId).not.toHaveBeenCalled();

    await app.close();
  });

  it('returns status none when no application exists', async () => {
    const repository = createMockRepository({
      getLatestCreatorApplicationByUserId: vi.fn(async () => null),
    });
    const app = buildTestApp(createCreatorService(repository));

    const response = await app.inject({
      method: 'GET',
      url: '/v1/creator/applications/me',
      headers: {
        authorization: 'Bearer valid-token',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(repository.getLatestCreatorApplicationByUserId).toHaveBeenCalledWith(validUser.id);
    expect(response.json()).toEqual({
      status: 'none',
      application: null,
    });

    await app.close();
  });

  it('returns the authenticated users latest application', async () => {
    const repository = createMockRepository({
      getLatestCreatorApplicationByUserId: vi.fn(async () => ({
        id: 'application-123',
        user_id: validUser.id,
        motivation: validPayload.motivation,
        experience: validPayload.experience,
        content_focus: validPayload.content_focus,
        social_links: validPayload.social_links,
        status: 'rejected',
        rejection_reason: 'Content focus is not specific enough yet.',
        created_at: '2026-06-30T12:00:00.000Z',
        updated_at: '2026-06-30T13:00:00.000Z',
      })),
    });
    const app = buildTestApp(createCreatorService(repository));

    const response = await app.inject({
      method: 'GET',
      url: '/v1/creator/applications/me',
      headers: {
        authorization: 'Bearer valid-token',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'rejected',
      application: {
        id: 'application-123',
        user_id: validUser.id,
        motivation: validPayload.motivation,
        experience: validPayload.experience,
        content_focus: validPayload.content_focus,
        social_links: validPayload.social_links,
        status: 'rejected',
        rejection_reason: 'Content focus is not specific enough yet.',
        created_at: '2026-06-30T12:00:00.000Z',
        updated_at: '2026-06-30T13:00:00.000Z',
      },
    });

    await app.close();
  });

  it('does not accept a foreign user id from query params', async () => {
    const repository = createMockRepository({
      getLatestCreatorApplicationByUserId: vi.fn(async () => null),
    });
    const app = buildTestApp(createCreatorService(repository));

    const response = await app.inject({
      method: 'GET',
      url: '/v1/creator/applications/me?userId=other-user',
      headers: {
        authorization: 'Bearer valid-token',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(repository.getLatestCreatorApplicationByUserId).toHaveBeenCalledWith(validUser.id);
    expect(repository.getLatestCreatorApplicationByUserId).not.toHaveBeenCalledWith('other-user');

    await app.close();
  });
});
