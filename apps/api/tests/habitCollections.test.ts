import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import type { AuthTokenVerifier } from '../src/auth/types.js';
import { createHabitCollectionService } from '../src/modules/habitCollections/habitCollectionService.js';
import type {
  HabitCollectionRecord,
  HabitCollectionRepository,
} from '../src/modules/habitCollections/habitCollectionRepository.js';

const user = { id: '11111111-1111-4111-8111-111111111111', email: null, role: 'authenticated' };
const otherUser = { id: '22222222-2222-4222-8222-222222222222', email: null, role: 'authenticated' };
const collectionId = '33333333-3333-4333-8333-333333333333';
const habitId = '44444444-4444-4444-8444-444444444444';
const verify: AuthTokenVerifier = async (token) => token === 'user' ? user : token === 'other' ? otherUser : null;
const record: HabitCollectionRecord = {
  id: collectionId,
  name: 'Morning',
  days: [0, 2, 4],
  version: 1,
  created_at: '2026-07-21T10:00:00.000Z',
  updated_at: '2026-07-21T10:00:00.000Z',
  members: [{
    habit_id: habitId,
    name: 'Water',
    days: [0, 2, 4],
    position: 0,
    linked_tool_id: null,
    linked_tool_title: null,
    linked_tool_route: null,
    created_at: '2026-07-21T10:00:00.000Z',
  }],
};

function repository(overrides: Partial<HabitCollectionRepository> = {}): HabitCollectionRepository {
  return {
    list: vi.fn(async () => []),
    find: vi.fn(async () => record),
    create: vi.fn(async () => collectionId),
    update: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
    ...overrides,
  };
}

function app(repo: HabitCollectionRepository) {
  return buildApp({
    authTokenVerifier: verify,
    habitCollectionService: createHabitCollectionService(repo),
  });
}

const headers = { authorization: 'Bearer user' };
const emptyInput = { name: 'Morning', days: [0, 2, 4], members: [] };

describe('habit collection API', () => {
  it.each([
    ['GET', '/v1/habit-collections'],
    ['GET', `/v1/habit-collections/${collectionId}`],
    ['POST', '/v1/habit-collections'],
    ['PATCH', `/v1/habit-collections/${collectionId}`],
    ['DELETE', `/v1/habit-collections/${collectionId}`],
  ])('requires auth for %s %s', async (method, url) => {
    const value = repository();
    const server = app(value);
    const response = await server.inject({ method: method as 'GET' | 'POST' | 'PATCH' | 'DELETE', url });
    expect(response.statusCode).toBe(401);
    expect(value.list).not.toHaveBeenCalled();
    expect(value.find).not.toHaveBeenCalled();
    await server.close();
  });

  it('keeps an unknown database error as a controlled 500 without leaking SQL details', async () => {
    const value = repository({
      create: vi.fn(async () => {
        throw { code: 'XX000', message: 'relation internal_secret_table not found', details: 'select * from private' };
      }),
    });
    const server = app(value);
    const response = await server.inject({ method: 'POST', url: '/v1/habit-collections', headers, payload: emptyInput });
    expect(response.statusCode).toBe(500);
    expect(response.json().error).toEqual(expect.objectContaining({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error.',
    }));
    expect(response.body).not.toContain('internal_secret_table');
    expect(response.body).not.toContain('private');
    await server.close();
  });

  it('returns an empty owner-bound list', async () => {
    const value = repository();
    const server = app(value);
    const response = await server.inject({ method: 'GET', url: '/v1/habit-collections', headers });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ collections: [] });
    expect(value.list).toHaveBeenCalledWith(user.id);
    await server.close();
  });

  it('returns ordered normalized detail without fallback_days', async () => {
    const value = repository();
    const server = app(value);
    const response = await server.inject({ method: 'GET', url: `/v1/habit-collections/${collectionId}`, headers });
    expect(response.statusCode).toBe(200);
    expect(response.json().collection).toEqual(record);
    expect(response.body).not.toContain('fallback_days');
    expect(value.find).toHaveBeenCalledWith(user.id, collectionId);
    await server.close();
  });

  it('returns 404 without disclosing foreign or deleted collections', async () => {
    const value = repository({ find: vi.fn(async () => null) });
    const server = app(value);
    const response = await server.inject({ method: 'GET', url: `/v1/habit-collections/${collectionId}`, headers });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('HABIT_COLLECTION_NOT_FOUND');
    await server.close();
  });

  it.each([
    ['empty', emptyInput],
    ['existing', { ...emptyInput, members: [{ type: 'existing', habit_id: habitId }] }],
    ['new', { ...emptyInput, members: [{ type: 'new', name: 'Water' }] }],
    ['mixed ordered', { ...emptyInput, members: [{ type: 'new', name: 'Water' }, { type: 'existing', habit_id: habitId }] }],
  ])('creates a %s collection atomically with 201', async (_label, payload) => {
    const value = repository();
    const server = app(value);
    const response = await server.inject({ method: 'POST', url: '/v1/habit-collections', headers, payload });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ collection: record });
    expect(value.create).toHaveBeenCalledWith(user.id, payload);
    expect(value.find).toHaveBeenCalledWith(user.id, collectionId);
    await server.close();
  });

  it.each([
    [{ ...emptyInput, name: '' }],
    [{ ...emptyInput, name: 'x'.repeat(61) }],
    [{ ...emptyInput, days: [] }],
    [{ ...emptyInput, days: [0, 0] }],
    [{ ...emptyInput, days: [7] }],
    [{ ...emptyInput, members: [{ type: 'existing', habit_id: habitId }, { type: 'existing', habit_id: habitId }] }],
    [{ ...emptyInput, user_id: otherUser.id }],
  ])('rejects invalid strict create payload %#', async (payload) => {
    const value = repository();
    const server = app(value);
    const response = await server.inject({ method: 'POST', url: '/v1/habit-collections', headers, payload });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
    expect(value.create).not.toHaveBeenCalled();
    await server.close();
  });

  it.each([
    ['name', { expected_version: 1, name: 'Evening', days: [0, 2, 4], members: [] }],
    ['days', { expected_version: 1, name: 'Morning', days: [1, 3], members: [] }],
    ['add and reorder', { expected_version: 1, name: 'Morning', days: [0], members: [{ type: 'new', name: 'Read' }, { type: 'existing', habit_id: habitId }] }],
    ['remove', { expected_version: 1, name: 'Morning', days: [0], members: [] }],
  ])('updates %s from the complete desired state', async (_label, payload) => {
    const value = repository();
    const server = app(value);
    const response = await server.inject({ method: 'PATCH', url: `/v1/habit-collections/${collectionId}`, headers, payload });
    expect(response.statusCode).toBe(200);
    expect(value.update).toHaveBeenCalledWith(user.id, collectionId, payload);
    await server.close();
  });

  it.each([
    [{ code: '40001', message: 'Habit collection version conflict' }, 409, 'HABIT_COLLECTION_CONFLICT'],
    [{ code: '23505', message: 'Habit already belongs to an active collection' }, 409, 'HABIT_COLLECTION_CONFLICT'],
    [{ code: 'P0002', message: 'Habit not found' }, 404, 'HABIT_COLLECTION_NOT_FOUND'],
  ])('maps mutation errors without leaking cross-user state', async (error, status, code) => {
    const value = repository({ create: vi.fn(async () => { throw error; }) });
    const server = app(value);
    const response = await server.inject({ method: 'POST', url: '/v1/habit-collections', headers, payload: emptyInput });
    expect(response.statusCode).toBe(status);
    expect(response.json().error.code).toBe(code);
    await server.close();
  });

  it('soft deletes with expected_version and returns 204', async () => {
    const value = repository();
    const server = app(value);
    const response = await server.inject({
      method: 'DELETE', url: `/v1/habit-collections/${collectionId}`, headers, payload: { expected_version: 1 },
    });
    expect(response.statusCode).toBe(204);
    expect(value.delete).toHaveBeenCalledWith(user.id, collectionId, 1);
    await server.close();
  });

  it('keeps a successfully deleted collection unavailable as 404', async () => {
    let deleted = false;
    const value = repository({
      find: vi.fn(async () => deleted ? null : record),
      delete: vi.fn(async () => { deleted = true; }),
    });
    const server = app(value);
    const deletion = await server.inject({
      method: 'DELETE', url: `/v1/habit-collections/${collectionId}`, headers, payload: { expected_version: 1 },
    });
    const detail = await server.inject({ method: 'GET', url: `/v1/habit-collections/${collectionId}`, headers });
    expect(deletion.statusCode).toBe(204);
    expect(detail.statusCode).toBe(404);
    expect(detail.json().error.code).toBe('HABIT_COLLECTION_NOT_FOUND');
    await server.close();
  });

  it('never trusts a body user_id for update or delete', async () => {
    const value = repository();
    const server = app(value);
    const update = await server.inject({
      method: 'PATCH', url: `/v1/habit-collections/${collectionId}`, headers,
      payload: { expected_version: 1, name: 'Morning', days: [0], members: [], user_id: otherUser.id },
    });
    const deletion = await server.inject({
      method: 'DELETE', url: `/v1/habit-collections/${collectionId}`, headers,
      payload: { expected_version: 1, user_id: otherUser.id },
    });
    expect(update.statusCode).toBe(400);
    expect(deletion.statusCode).toBe(400);
    expect(value.update).not.toHaveBeenCalled();
    expect(value.delete).not.toHaveBeenCalled();
    await server.close();
  });
});
