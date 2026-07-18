import { describe, expect, it, vi } from 'vitest';
import type { ProfilesReadDb } from '../src/modules/profiles/repositories/drizzleProfilesRepository.js';
import type { ProfilesRepository } from '../src/modules/profiles/profilesRepository.js';
import type { ProfilesReadRepository } from '../src/modules/profiles/repositories/profilesReadRepository.js';
import {
  createLazyDrizzleProfilesReadRepository,
  createLazyProfilesRepository,
} from '../src/modules/profiles/profileRuntime.js';

function createUnusedProfilesReadDb(): ProfilesReadDb {
  return {
    select() {
      throw new Error('The fake database should not be queried directly.');
    },
  };
}

describe('profile runtime composition', () => {
  it('creates the PATCH Supabase repository lazily and reuses it', async () => {
    const repository: ProfilesRepository = {
      getProfileByUserId: vi.fn(async (userId: string) => ({
        id: userId,
        username: 'grower',
        bio: '',
      })),
      updateProfileByUserId: vi.fn(async (userId: string) => ({
        id: userId,
        username: 'updated_grower',
      })),
    };
    const createRepository = vi.fn(() => repository);

    const lazyRepository = createLazyProfilesRepository(createRepository);

    expect(createRepository).not.toHaveBeenCalled();

    await lazyRepository.getProfileByUserId('user-123');
    await lazyRepository.updateProfileByUserId('user-123', { username: 'updated_grower' });

    expect(createRepository).toHaveBeenCalledTimes(1);
    expect(repository.getProfileByUserId).toHaveBeenCalledWith('user-123');
    expect(repository.updateProfileByUserId).toHaveBeenCalledWith('user-123', {
      username: 'updated_grower',
    });
  });

  it('creates the Drizzle read repository lazily on first read and reuses it', async () => {
    const db = createUnusedProfilesReadDb();
    const getDatabase = vi.fn(() => db);
    const repository: ProfilesReadRepository = {
      findByUserId: vi.fn(async (userId: string) => ({
        id: userId,
        username: 'grower',
        bio: '',
        growPoints: 1,
        role: 'user',
        createdAt: null,
        updatedAt: null,
      })),
    };
    const createRepository = vi.fn(() => repository);

    const lazyRepository = createLazyDrizzleProfilesReadRepository(
      getDatabase,
      createRepository,
    );

    expect(getDatabase).not.toHaveBeenCalled();
    expect(createRepository).not.toHaveBeenCalled();

    await expect(lazyRepository.findByUserId('user-123')).resolves.toMatchObject({
      id: 'user-123',
    });
    await lazyRepository.findByUserId('user-456');

    expect(getDatabase).toHaveBeenCalledTimes(1);
    expect(createRepository).toHaveBeenCalledTimes(1);
    expect(createRepository).toHaveBeenCalledWith(db);
    expect(repository.findByUserId).toHaveBeenNthCalledWith(1, 'user-123');
    expect(repository.findByUserId).toHaveBeenNthCalledWith(2, 'user-456');
  });
});
