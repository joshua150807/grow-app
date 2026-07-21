import {
  ProfileApiError,
  requestProfileV1,
} from '../../../profile/services/profiles';

export class HabitCollectionApiError extends Error {
  constructor(message, { status = null, code = null } = {}) {
    super(message);
    this.name = 'HabitCollectionApiError';
    this.status = status;
    this.code = code;
  }
}

function normalizeCollectionDays(days) {
  if (!Array.isArray(days)) return [];
  return Array.from(
    new Set(
      days
        .map(day => Number(day))
        .filter(day => Number.isInteger(day) && day >= 0 && day <= 6)
    )
  ).sort((a, b) => a - b);
}

function normalizeCollection(payload) {
  if (!payload || typeof payload !== 'object' || !payload.id) {
    return null;
  }

  return {
    id: payload.id,
    user_id: payload.user_id,
    name: typeof payload.name === 'string' ? payload.name : '',
    days: normalizeCollectionDays(payload.days),
    version: Number(payload.version) || 1,
    created_at: payload.created_at,
    updated_at: payload.updated_at,
    members: Array.isArray(payload.members)
      ? payload.members.map(m => ({
          habit_id: m.habit_id,
          name: typeof m.name === 'string' ? m.name : '',
          days: normalizeCollectionDays(m.days),
          position: Number(m.position) || 0,
          linked_tool_id: m.linked_tool_id ?? null,
          linked_tool_title: m.linked_tool_title ?? null,
          linked_tool_route: m.linked_tool_route ?? null,
          created_at: m.created_at ?? null,
        }))
      : [],
  };
}

function normalizeCollections(payload) {
  if (!Array.isArray(payload)) return [];
  return payload.map(normalizeCollection).filter(Boolean);
}

export async function requestCollectionsV1(
  path,
  options = {},
  normalizeResponse = (p) => normalizeCollection(p.collection)
) {
  try {
    return await requestProfileV1(path, options, normalizeResponse);
  } catch (error) {
    if (!(error instanceof ProfileApiError)) throw error;
    throw new HabitCollectionApiError('Habit Collections request failed.', {
      status: error.status,
      code: error.code,
    });
  }
}

export async function listHabitCollections() {
  const collections = await requestCollectionsV1(
    '/v1/habit-collections',
    { method: 'GET' },
    (p) => normalizeCollections(p.collections || [])
  );
  return collections;
}

export async function getHabitCollection(collectionId) {
  if (!collectionId) throw new Error('Collection ID is required.');
  return requestCollectionsV1(
    `/v1/habit-collections/${collectionId}`,
    { method: 'GET' }
  );
}

export async function createHabitCollection(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Collection payload is required.');
  }

  const { name, days, members } = payload;
  const safeName = typeof name === 'string' ? name.trim() : '';
  const safeDays = normalizeCollectionDays(days);

  if (!safeName) throw new Error('Collection name is required.');
  if (safeDays.length === 0) throw new Error('At least one day must be selected.');

  const createPayload = {
    name: safeName,
    days: safeDays,
    members: Array.isArray(members) ? members : [],
  };

  return requestCollectionsV1(
    '/v1/habit-collections',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createPayload),
    }
  );
}

export async function updateHabitCollection(collectionId, payload) {
  if (!collectionId) throw new Error('Collection ID is required.');
  if (!payload || typeof payload !== 'object') {
    throw new Error('Update payload is required.');
  }

  const { name, days, members, expected_version } = payload;
  const safeName = typeof name === 'string' ? name.trim() : '';
  const safeDays = normalizeCollectionDays(days);

  if (!safeName) throw new Error('Collection name is required.');
  if (safeDays.length === 0) throw new Error('At least one day must be selected.');
  if (typeof expected_version !== 'number' || expected_version < 1) {
    throw new Error('Valid expected_version is required.');
  }

  const updatePayload = {
    name: safeName,
    days: safeDays,
    members: Array.isArray(members) ? members : [],
    expected_version,
  };

  return requestCollectionsV1(
    `/v1/habit-collections/${collectionId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatePayload),
    }
  );
}

export async function deleteHabitCollection(collectionId, expectedVersion) {
  if (!collectionId) throw new Error('Collection ID is required.');
  if (typeof expectedVersion !== 'number' || expectedVersion < 1) {
    throw new Error('Valid expected_version is required.');
  }

  const deletePayload = { expected_version: expectedVersion };

  return requestCollectionsV1(
    `/v1/habit-collections/${collectionId}`,
    {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(deletePayload),
    },
    () => null
  );
}
