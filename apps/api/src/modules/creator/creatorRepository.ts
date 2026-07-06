import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminClient } from '../../integrations/supabase/adminClient.js';
import type {
  CreatorApplicationDecisionInput,
  CreatorApplicationInput,
  CreatorApplicationStatusInput,
} from './creatorSchemas.js';

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
  getCreatorApplicationById(applicationId: string): Promise<CreatorApplicationRow | null>;
  getLatestCreatorApplicationByUserId(userId: string): Promise<CreatorApplicationRow | null>;
  listCreatorApplications(input: {
    status?: CreatorApplicationStatusInput;
    limit: number;
    page: number;
  }): Promise<{
    applications: CreatorApplicationRow[];
    hasMore: boolean;
  }>;
  createCreatorApplicationForUser(
    userId: string,
    input: CreateCreatorApplicationInput,
  ): Promise<CreatorApplicationRow>;
  updateCreatorApplicationDecision(
    applicationId: string,
    input: CreatorApplicationDecisionInput & { reviewerId: string },
  ): Promise<CreatorApplicationRow>;
};

const creatorApplicationSelect =
  'id, user_id, motivation, experience, content_focus, social_links, status, rejection_reason, created_at, updated_at';

export function createCreatorRepository(
  supabase: SupabaseClient = getSupabaseAdminClient(),
): CreatorRepository {
  return {
    async getCreatorApplicationById(
      applicationId: string,
    ): Promise<CreatorApplicationRow | null> {
      const { data, error } = await supabase
        .from('creator_applications')
        .select(creatorApplicationSelect)
        .eq('id', applicationId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data;
    },

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

    async listCreatorApplications(input): Promise<{
      applications: CreatorApplicationRow[];
      hasMore: boolean;
    }> {
      const from = input.page * input.limit;
      const to = from + input.limit;

      let query = supabase
        .from('creator_applications')
        .select(creatorApplicationSelect)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (input.status) {
        query = query.eq('status', input.status);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      const applications = data ?? [];

      return {
        applications: applications.slice(0, input.limit),
        hasMore: applications.length > input.limit,
      };
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

    async updateCreatorApplicationDecision(
      applicationId: string,
      input: CreatorApplicationDecisionInput & { reviewerId: string },
    ): Promise<CreatorApplicationRow> {
      const { data, error } = await supabase.rpc('review_creator_application', {
        input_application_id: applicationId,
        input_decision: input.decision,
        input_rejection_reason: input.rejection_reason ?? null,
        input_reviewer_id: input.reviewerId,
      });

      if (error) {
        throw error;
      }

      return data;
    },
  };
}
