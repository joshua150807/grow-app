import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminClient } from '../../integrations/supabase/adminClient.js';
import type { Profile } from './domain/profile.js';
import type { ProfileUpdateInput } from './profileSchemas.js';
import type { ProfilesReadRepository } from './repositories/profilesReadRepository.js';

export type ProfileReadRow = {
  id: string;
  username: string;
  grow_points: number | null;
  role: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type ProfileRow = {
  id: string;
  username?: string | null;
  grow_points?: number | null;
  role?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ProfilesRepository = {
  getProfileByUserId(userId: string): Promise<ProfileRow | null>;
  updateProfileByUserId(userId: string, input: ProfileUpdateInput): Promise<ProfileRow | null>;
};

function mapProfileReadRowToDomain(row: ProfileReadRow): Profile {
  return {
    id: row.id,
    username: row.username,
    growPoints: row.grow_points,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createProfilesRepository(
  supabase: SupabaseClient = getSupabaseAdminClient(),
): ProfilesRepository {
  return {
    async getProfileByUserId(userId: string): Promise<ProfileRow | null> {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, role')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data;
    },

    async updateProfileByUserId(
      userId: string,
      input: ProfileUpdateInput,
    ): Promise<ProfileRow | null> {
      const { data, error } = await supabase
        .from('profiles')
        .update(input)
        .eq('id', userId)
        .select('id, username, grow_points, role, created_at, updated_at')
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data;
    },
  };
}

export function createSupabaseProfilesReadRepository(
  supabase: SupabaseClient = getSupabaseAdminClient(),
): ProfilesReadRepository {
  return {
    async findByUserId(userId: string): Promise<Profile | null> {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, grow_points, role, created_at, updated_at')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data ? mapProfileReadRowToDomain(data) : null;
    },
  };
}
