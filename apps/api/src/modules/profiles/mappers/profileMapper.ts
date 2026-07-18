import type { ProfileRow as DrizzleProfileRow } from '../../../db/schema/profiles.js';
import type { Profile } from '../domain/profile.js';

export type ProfilePersistenceRow = Pick<
  DrizzleProfileRow,
  'id' | 'username' | 'bio' | 'growPoints' | 'role' | 'createdAt' | 'updatedAt'
>;

export type ProfileReadDto = {
  id: string;
  username: string;
  bio: string;
  grow_points: number | null;
  role: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export function mapProfilePersistenceRowToDomain(row: ProfilePersistenceRow): Profile {
  return {
    id: row.id,
    username: row.username,
    bio: row.bio,
    growPoints: row.growPoints,
    role: row.role,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapProfileDomainToReadDto(profile: Profile): ProfileReadDto {
  return {
    id: profile.id,
    username: profile.username,
    bio: profile.bio,
    grow_points: profile.growPoints,
    role: profile.role,
    created_at: profile.createdAt,
    updated_at: profile.updatedAt,
  };
}
