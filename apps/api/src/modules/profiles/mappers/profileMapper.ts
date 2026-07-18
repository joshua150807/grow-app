import type { ProfileRow as DrizzleProfileRow } from '../../../db/schema/profiles.js';
import type { Profile } from '../domain/profile.js';

export type ProfilePersistenceRow = Pick<
  DrizzleProfileRow,
  'id' | 'username' | 'bio' | 'avatarPath' | 'growPoints' | 'role' | 'createdAt' | 'updatedAt'
>;

export type ProfileReadDto = {
  id: string;
  username: string;
  bio: string;
  avatar_url: string | null;
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
    avatarPath: row.avatarPath,
    growPoints: row.growPoints,
    role: row.role,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapProfileDomainToReadDto(
  profile: Profile,
  avatarUrl: string | null = null,
): ProfileReadDto {
  return {
    id: profile.id,
    username: profile.username,
    bio: profile.bio,
    avatar_url: avatarUrl,
    grow_points: profile.growPoints,
    role: profile.role,
    created_at: profile.createdAt,
    updated_at: profile.updatedAt,
  };
}
