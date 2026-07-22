import { describe, expect, it, vi } from 'vitest';
import { createProfilesRepository } from '../src/modules/profiles/profilesRepository.js';

function createSupabaseUpdateMock(data: unknown = null, error: unknown = null) {
  const calls: {
    table?: string;
    input?: unknown;
    eq?: [string, string];
    select?: string;
  } = {};

  const maybeSingle = vi.fn(async () => ({ data, error }));
  const select = vi.fn((selection: string) => {
    calls.select = selection;

    return { maybeSingle };
  });
  const eq = vi.fn((column: string, value: string) => {
    calls.eq = [column, value];

    return { select };
  });
  const update = vi.fn((input: unknown) => {
    calls.input = input;

    return { eq };
  });
  const from = vi.fn((table: string) => {
    calls.table = table;

    return { update };
  });

  return {
    calls,
    supabase: { from },
    methods: { from, update, eq, select, maybeSingle },
  };
}

describe('createProfilesRepository', () => {
  it('updates profiles by authenticated user id and selects the PATCH response fields', async () => {
    const { calls, supabase } = createSupabaseUpdateMock({
      id: 'user-123',
      username: 'grower',
      bio: 'Keep growing.',
      grow_points: 7,
      role: 'user',
      created_at: '2026-07-05T10:00:00.000Z',
      updated_at: '2026-07-05T11:00:00.000Z',
    });
    const repository = createProfilesRepository(supabase as never);

    await expect(repository.updateProfileByUserId('user-123', {
      username: 'grower',
    })).resolves.toEqual({
      id: 'user-123',
      username: 'grower',
      bio: 'Keep growing.',
      grow_points: 7,
      role: 'user',
      created_at: '2026-07-05T10:00:00.000Z',
      updated_at: '2026-07-05T11:00:00.000Z',
    });

    expect(calls.table).toBe('profiles');
    expect(calls.input).toEqual({ username: 'grower' });
    expect(calls.eq).toEqual(['id', 'user-123']);
    expect(calls.select).toBe(
      'id, username, grow_points, role, created_at, updated_at, bio, avatar_path',
    );
  });

  it('updates only avatar_path and selects the complete internal profile row', async () => {
    const path = 'user-123/550e8400-e29b-41d4-a716-446655440000.jpg';
    const { calls, supabase } = createSupabaseUpdateMock({
      id: 'user-123',
      username: 'grower',
      bio: '',
      avatar_path: path,
      grow_points: 7,
      role: 'user',
      created_at: null,
      updated_at: null,
    });
    const repository = createProfilesRepository(supabase as never);

    await expect(repository.updateAvatarPathByUserId!('user-123', path)).resolves.toMatchObject({
      avatar_path: path,
    });
    expect(calls.input).toEqual({ avatar_path: path });
    expect(calls.eq).toEqual(['id', 'user-123']);
    expect(calls.select).toBe(
      'id, username, grow_points, role, created_at, updated_at, bio, avatar_path',
    );
  });
});
