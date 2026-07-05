import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiDatabase } from '../src/db/client.js';
import { profiles } from '../src/db/schema/profiles.js';
import type { ProfilePersistenceRow } from '../src/modules/profiles/mappers/profileMapper.js';
import {
  DrizzleProfilesRepository,
  type ProfilesReadDb,
} from '../src/modules/profiles/repositories/drizzleProfilesRepository.js';

function assertProfilesReadDbCompatibility(db: ApiDatabase): ProfilesReadDb {
  return db;
}

const eqMock = vi.hoisted(() => vi.fn((column: unknown, value: unknown) => ({
  column,
  value,
})));

vi.mock('drizzle-orm', () => ({
  eq: eqMock,
}));

function createProfilesReadDb(rows: ProfilePersistenceRow[]) {
  const calls: {
    selection?: Record<string, unknown>;
    table?: unknown;
    condition?: unknown;
    limit?: number;
  } = {};

  const db: ProfilesReadDb = {
    select(selection) {
      calls.selection = selection;

      return {
        from(table) {
          calls.table = table;

          return {
            where(condition) {
              calls.condition = condition;

              return {
                async limit(limit) {
                  calls.limit = limit;

                  return rows;
                },
              };
            },
          };
        },
      };
    },
  };

  return { db, calls };
}

describe('DrizzleProfilesRepository', () => {
  beforeEach(() => {
    eqMock.mockClear();
  });

  it('returns a mapped domain profile when a row exists', async () => {
    const row: ProfilePersistenceRow = {
      id: 'user-123',
      username: 'grower',
      growPoints: 7,
      role: 'user',
      createdAt: '2026-07-05T10:00:00.000Z',
      updatedAt: '2026-07-05T11:00:00.000Z',
    };
    const { db } = createProfilesReadDb([row]);
    const repository = new DrizzleProfilesRepository(db);

    await expect(repository.findByUserId('user-123')).resolves.toEqual({
      id: 'user-123',
      username: 'grower',
      growPoints: 7,
      role: 'user',
      createdAt: '2026-07-05T10:00:00.000Z',
      updatedAt: '2026-07-05T11:00:00.000Z',
    });
  });

  it('returns null when no row exists', async () => {
    const { db } = createProfilesReadDb([]);
    const repository = new DrizzleProfilesRepository(db);

    await expect(repository.findByUserId('missing-user')).resolves.toBeNull();
  });

  it('filters by the provided user id and limits the query to one row', async () => {
    const { db, calls } = createProfilesReadDb([]);
    const repository = new DrizzleProfilesRepository(db);

    await repository.findByUserId('user-123');

    expect(eqMock).toHaveBeenCalledWith(profiles.id, 'user-123');
    expect(calls.condition).toEqual({
      column: profiles.id,
      value: 'user-123',
    });
    expect(calls.limit).toBe(1);
  });

  it('selects only the intended read fields', async () => {
    const { db, calls } = createProfilesReadDb([]);
    const repository = new DrizzleProfilesRepository(db);

    await repository.findByUserId('user-123');

    expect(Object.keys(calls.selection ?? {}).sort()).toEqual([
      'createdAt',
      'growPoints',
      'id',
      'role',
      'updatedAt',
      'username',
    ]);
    expect(calls.selection).not.toHaveProperty('recoveryEmail');
    expect(calls.selection).not.toHaveProperty('displayName');
    expect(calls.selection).not.toHaveProperty('name');
    expect(calls.selection).not.toHaveProperty('avatarUrl');
    expect(calls.selection).not.toHaveProperty('bio');
    expect(calls.table).toBe(profiles);
  });
});
