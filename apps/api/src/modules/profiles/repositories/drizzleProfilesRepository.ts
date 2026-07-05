import { eq } from 'drizzle-orm';
import { profiles } from '../../../db/schema/profiles.js';
import {
  mapProfilePersistenceRowToDomain,
  type ProfilePersistenceRow,
} from '../mappers/profileMapper.js';
import type { ProfilesReadRepository } from './profilesReadRepository.js';

const profileReadSelection = {
  id: profiles.id,
  username: profiles.username,
  growPoints: profiles.growPoints,
  role: profiles.role,
  createdAt: profiles.createdAt,
  updatedAt: profiles.updatedAt,
};

export type ProfilesReadDb = {
  select(selection: typeof profileReadSelection): {
    from(table: typeof profiles): {
      where(condition: unknown): {
        limit(limit: number): Promise<ProfilePersistenceRow[]>;
      };
    };
  };
};

export class DrizzleProfilesRepository implements ProfilesReadRepository {
  constructor(private readonly db: ProfilesReadDb) {}

  async findByUserId(userId: string) {
    const rows = await this.db
      .select(profileReadSelection)
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);

    const row = rows[0];

    return row ? mapProfilePersistenceRowToDomain(row) : null;
  }
}
