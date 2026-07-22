import { describe, expect, it, vi } from 'vitest';
import { createHabitCollectionRepository } from '../src/modules/habitCollections/habitCollectionRepository.js';

const userId = '11111111-1111-4111-8111-111111111111';
const collectionId = '33333333-3333-4333-8333-333333333333';
const habitId = '44444444-4444-4444-8444-444444444444';

function setup(rows: unknown[] = []) {
  const db = { query: vi.fn(async (_sql: string, _params?: unknown[]) => ({ rows })) };
  const rpc = vi.fn(async () => ({ data: collectionId, error: null }));
  const repository = createHabitCollectionRepository(db as never, { rpc } as never);
  return { db, rpc, repository };
}

describe('habit collection repository', () => {
  it('binds list and detail reads to the authenticated user and excludes deleted/history rows', async () => {
    const value = setup();
    await value.repository.list(userId);
    await value.repository.find(userId, collectionId);
    expect(value.db.query).toHaveBeenNthCalledWith(1, expect.stringContaining('collection.user_id = $1'), [userId]);
    expect(value.db.query.mock.calls[0][0]).toContain('collection.deleted_at is null');
    expect(value.db.query.mock.calls[0][0]).toContain('membership.active_until is null');
    expect(value.db.query).toHaveBeenNthCalledWith(2, expect.stringContaining('collection.id = $2'), [userId, collectionId]);
  });

  it('passes only the authenticated owner and normalized create members to the atomic RPC', async () => {
    const value = setup();
    await value.repository.create(userId, {
      name: 'Morning',
      days: [0, 2],
      members: [
        { type: 'existing', habit_id: habitId },
        { type: 'new', name: 'Water' },
      ],
    });
    expect(value.rpc).toHaveBeenCalledWith('create_habit_collection', {
      input_user_id: userId,
      input_name: 'Morning',
      input_days: [0, 2],
      input_members: [
        { type: 'existing', habit_id: habitId },
        {
          type: 'new', name: 'Water', linked_tool_id: null,
          linked_tool_title: null, linked_tool_route: null,
        },
      ],
    });
  });

  it('passes expected version and complete desired state to update', async () => {
    const value = setup();
    await value.repository.update(userId, collectionId, {
      expected_version: 3,
      name: 'Updated',
      days: [1],
      members: [{ type: 'existing', habit_id: habitId }],
    });
    expect(value.rpc).toHaveBeenCalledWith('update_habit_collection', expect.objectContaining({
      input_user_id: userId,
      input_collection_id: collectionId,
      input_expected_version: 3,
      input_members: [{ type: 'existing', habit_id: habitId }],
    }));
  });

  it('passes only owner, collection and version to soft delete', async () => {
    const value = setup();
    await value.repository.delete(userId, collectionId, 4);
    expect(value.rpc).toHaveBeenCalledWith('delete_habit_collection', {
      input_user_id: userId,
      input_collection_id: collectionId,
      input_expected_version: 4,
    });
  });

  it('does not hide RPC errors or accept invalid mutation results', async () => {
    const db = { query: vi.fn(async (_sql: string, _params?: unknown[]) => ({ rows: [] })) };
    const error = { code: '40001', message: 'conflict' };
    const failing = createHabitCollectionRepository(db as never, {
      rpc: vi.fn(async () => ({ data: null, error })),
    } as never);
    await expect(failing.delete(userId, collectionId, 1)).rejects.toBe(error);
    const invalid = createHabitCollectionRepository(db as never, {
      rpc: vi.fn(async () => ({ data: null, error: null })),
    } as never);
    await expect(invalid.create(userId, { name: 'X', days: [0], members: [] }))
      .rejects.toThrow('invalid result');
  });
});
