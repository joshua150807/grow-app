import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminClient } from '../../integrations/supabase/adminClient.js';
import type { ProfileUpdateInput } from './profileSchemas.js';

export type ProfileRow = {
  id: string;
  username?: string | null;
  display_name?: string | null;
  name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  role?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ProfilesRepository = {
  getProfileByUserId(userId: string): Promise<ProfileRow | null>;
  updateProfileByUserId(userId: string, input: ProfileUpdateInput): Promise<ProfileRow | null>;
};

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
        .select('id, username, role')
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data;
    },
  };
}
