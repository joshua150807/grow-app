import { getDb } from '../../db/client.js';
import {
  createProfileService,
  type ProfileService,
} from './profileService.js';
import {
  createProfilesRepository,
  type ProfilesRepository,
} from './profilesRepository.js';
import { DrizzleProfilesRepository, type ProfilesReadDb } from './repositories/drizzleProfilesRepository.js';
import type { ProfilesReadRepository } from './repositories/profilesReadRepository.js';

export function createLazyProfilesRepository(
  createRepository: () => ProfilesRepository = createProfilesRepository,
): ProfilesRepository {
  let repository: ProfilesRepository | null = null;

  function getRepository(): ProfilesRepository {
    repository ??= createRepository();

    return repository;
  }

  return {
    getProfileByUserId(userId) {
      return getRepository().getProfileByUserId(userId);
    },
    updateProfileByUserId(userId, input) {
      return getRepository().updateProfileByUserId(userId, input);
    },
    updateAvatarPathByUserId(userId, avatarPath) {
      return getRepository().updateAvatarPathByUserId!(userId, avatarPath);
    },
  };
}

export function createLazyDrizzleProfilesReadRepository(
  getDatabase: () => ProfilesReadDb = getDb,
  createRepository: (db: ProfilesReadDb) => ProfilesReadRepository = (db) => (
    new DrizzleProfilesRepository(db)
  ),
): ProfilesReadRepository {
  let repository: ProfilesReadRepository | null = null;

  return {
    findByUserId(userId: string) {
      repository ??= createRepository(getDatabase());

      return repository.findByUserId(userId);
    },
  };
}

export function createRuntimeProfileService(
  warn?: (context: Record<string, unknown>, message: string) => void,
): ProfileService {
  return createProfileService(
    createLazyProfilesRepository(),
    createLazyDrizzleProfilesReadRepository(),
    undefined,
    warn,
  );
}
