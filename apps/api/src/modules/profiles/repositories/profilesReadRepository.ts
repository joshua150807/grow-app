import type { Profile } from '../domain/profile.js';

export interface ProfilesReadRepository {
  findByUserId(userId: string): Promise<Profile | null>;
}
