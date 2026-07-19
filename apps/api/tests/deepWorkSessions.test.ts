import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import type { AuthTokenVerifier } from '../src/auth/types.js';
import { createDeepWorkSessionService } from '../src/modules/profileStats/deepWorkSessionService.js';
import type { DeepWorkSessionRepository } from '../src/modules/profileStats/deepWorkSessionRepository.js';
import { MAX_DEEP_WORK_DURATION_SECONDS } from '../src/modules/profileStats/profileStatsSchemas.js';

const user = { id: '11111111-1111-4111-8111-111111111111', email: null, role: 'authenticated' };
const verify: AuthTokenVerifier = async (token) => token === 'valid' ? user : null;
const input = { client_session_id: 'stable-id', duration_seconds: 1500, completed_at: '2026-07-19T18:30:00.000Z' };
const session = { id: 'session-id', ...input, created_at: '2026-07-19T18:30:01.000Z' };
function setup(result = { session, created: true }) {
  const repository: DeepWorkSessionRepository = { insertOrFind: vi.fn(async () => result) };
  return { repository, value: createDeepWorkSessionService(repository) };
}

describe('POST /v1/profile/me/deep-work/sessions', () => {
  it('requires authentication', async () => {
    const value = setup();
    const app = buildApp({ authTokenVerifier: verify, deepWorkSessionService: value.value });
    const response = await app.inject({ method: 'POST', url: '/v1/profile/me/deep-work/sessions', payload: input });
    expect(response.statusCode).toBe(401);
    expect(value.repository.insertOrFind).not.toHaveBeenCalled();
    await app.close();
  });

  it('creates exactly for the authenticated user with 201', async () => {
    const value = setup();
    const app = buildApp({ authTokenVerifier: verify, deepWorkSessionService: value.value });
    const response = await app.inject({ method: 'POST', url: '/v1/profile/me/deep-work/sessions', headers: { authorization: 'Bearer valid' }, payload: input });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ session, created: true });
    expect(value.repository.insertOrFind).toHaveBeenCalledWith(user.id, input);
    await app.close();
  });

  it('returns 200 and no new row for an identical retry', async () => {
    const value = setup({ session, created: false });
    const app = buildApp({ authTokenVerifier: verify, deepWorkSessionService: value.value });
    const response = await app.inject({ method: 'POST', url: '/v1/profile/me/deep-work/sessions', headers: { authorization: 'Bearer valid' }, payload: input });
    expect(response.statusCode).toBe(200);
    expect(response.json().created).toBe(false);
    await app.close();
  });

  it('treats the same instant with a different ISO offset as an idempotent retry', async () => {
    const value = setup({ session, created: false });
    const app = buildApp({ authTokenVerifier: verify, deepWorkSessionService: value.value });
    const response = await app.inject({
      method: 'POST',
      url: '/v1/profile/me/deep-work/sessions',
      headers: { authorization: 'Bearer valid' },
      payload: { ...input, completed_at: '2026-07-19T20:30:00.000+02:00' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ session, created: false });
    expect(response.json().error?.code).not.toBe('DEEP_WORK_SESSION_CONFLICT');
    expect(value.repository.insertOrFind).toHaveBeenCalledWith(user.id, {
      ...input,
      completed_at: '2026-07-19T20:30:00.000+02:00',
    });
    await app.close();
  });

  it('normalizes a padded session id and uses the same idempotency key on retry', async () => {
    const stored = new Map<string, typeof session>();
    const repository: DeepWorkSessionRepository = {
      insertOrFind: vi.fn(async (_userId, request) => {
        const existing = stored.get(request.client_session_id);
        if (existing) return { session: existing, created: false };
        const created = { ...session, client_session_id: request.client_session_id };
        stored.set(request.client_session_id, created);
        return { session: created, created: true };
      }),
    };
    const app = buildApp({
      authTokenVerifier: verify,
      deepWorkSessionService: createDeepWorkSessionService(repository),
    });
    const first = await app.inject({
      method: 'POST',
      url: '/v1/profile/me/deep-work/sessions',
      headers: { authorization: 'Bearer valid' },
      payload: { ...input, client_session_id: '  stable-client-id  ' },
    });
    const retry = await app.inject({
      method: 'POST',
      url: '/v1/profile/me/deep-work/sessions',
      headers: { authorization: 'Bearer valid' },
      payload: { ...input, client_session_id: 'stable-client-id' },
    });
    expect(first.statusCode).toBe(201);
    expect(first.json().session.client_session_id).toBe('stable-client-id');
    expect(retry.statusCode).toBe(200);
    expect(retry.json()).toEqual({ session: first.json().session, created: false });
    expect(stored.size).toBe(1);
    const normalizedInput = { ...input, client_session_id: 'stable-client-id' };
    expect(repository.insertOrFind).toHaveBeenNthCalledWith(1, user.id, normalizedInput);
    expect(repository.insertOrFind).toHaveBeenNthCalledWith(2, user.id, normalizedInput);
    await app.close();
  });

  it.each([
    [{ ...input, duration_seconds: 0 }], [{ ...input, duration_seconds: -1 }],
    [{ ...input, duration_seconds: MAX_DEEP_WORK_DURATION_SECONDS + 1 }], [{ ...input, duration_seconds: 1.5 }],
    [{ ...input, client_session_id: '' }], [{ ...input, client_session_id: '   ' }],
    [{ ...input, client_session_id: 'x'.repeat(129) }], [{ ...input, completed_at: 'not-a-date' }],
    [{ client_session_id: 'x' }], [{ ...input, user_id: 'foreign-user' }],
  ])('rejects invalid or non-strict payload %j', async (payload) => {
    const value = setup();
    const app = buildApp({ authTokenVerifier: verify, deepWorkSessionService: value.value });
    const response = await app.inject({ method: 'POST', url: '/v1/profile/me/deep-work/sessions', headers: { authorization: 'Bearer valid' }, payload });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
    expect(value.repository.insertOrFind).not.toHaveBeenCalled();
    await app.close();
  });

  it.each([
    { ...session, duration_seconds: 1499 }, { ...session, completed_at: '2026-07-19T18:31:00.000Z' },
  ])('returns controlled 409 for a conflicting idempotency key', async (existing) => {
    const value = setup({ session: existing, created: false });
    const app = buildApp({ authTokenVerifier: verify, deepWorkSessionService: value.value });
    const response = await app.inject({ method: 'POST', url: '/v1/profile/me/deep-work/sessions', headers: { authorization: 'Bearer valid' }, payload: input });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('DEEP_WORK_SESSION_CONFLICT');
    await app.close();
  });
});
