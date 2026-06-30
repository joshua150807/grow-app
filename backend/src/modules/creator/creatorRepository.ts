import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminClient } from '../../integrations/supabase/adminClient.js';
import type { CreatorApplicationInput } from './creatorSchemas.js';

export type CreatorApplicationStatus =
  | 'pending'
  | 'requested'
  | 'approved'
  | 'rejected'
  | 'suspended';

export type CreatorApplicationRow = {
  id: string;
  user_id: string;
  motivation: string;
  experience?: string | null;
  content_focus?: string | null;
  social_links?: string[] | null;
  status: CreatorApplicationStatus | string;
  rejection_reason?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type CreateCreatorApplicationInput = CreatorApplicationInput & {
  status: CreatorApplicationStatus;
};

export type CreatorRepository = {
  getLatestCreatorApplicationByUserId(userId: string): Promise<CreatorApplicationRow | null>;
  createCreatorApplicationForUser(
    userId: string,
    input: CreateCreatorApplicationInput,
  ): Promise<CreatorApplicationRow>;
};

const creatorApplicationSelect =
  'id, user_id, motivation, experience, content_focus, social_links, status, rejection_reason, created_at, updated_at';

export function createCreatorRepository(
  supabase: SupabaseClient = getSupabaseAdminClient(),
): CreatorRepository {
  return {
    async getLatestCreatorApplicationByUserId(
      userId: string,
    ): Promise<CreatorApplicationRow | null> {
      const { data, error } = await supabase
        .from('creator_applications')
        .select(creatorApplicationSelect)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data;
    },

    async createCreatorApplicationForUser(
      userId: string,
      input: CreateCreatorApplicationInput,
    ): Promise<CreatorApplicationRow> {
      const { data, error } = await supabase
        .from('creator_applications')
        .insert({
          user_id: userId,
          motivation: input.motivation,
          experience: input.experience ?? null,
          content_focus: input.content_focus ?? null,
          social_links: input.social_links ?? null,
          status: input.status,
        })
        .select(creatorApplicationSelect)
        .single();

      if (error) {
        throw error;
      }

      return data;
    },
  };
}
