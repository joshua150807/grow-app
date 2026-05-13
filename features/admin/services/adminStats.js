import { supabase } from '../../../services/supabaseClient';

export async function loadAdminOverviewStats() {
  const { data, error } = await supabase.rpc('get_admin_overview_stats');

  if (error) {
    throw error;
  }

  const stats = Array.isArray(data) ? data[0] : data;

  return {
    totalUsers: Number(stats?.total_users ?? 0),
    totalFeedbacks: Number(stats?.total_feedbacks ?? 0),
    totalViews: Number(stats?.total_views ?? 0),
    totalSaves: Number(stats?.total_saves ?? 0),
    totalRatings: Number(stats?.total_ratings ?? 0),
    usedBetaCodes: Number(stats?.used_beta_codes ?? 0),
    openBetaCodes: Number(stats?.open_beta_codes ?? 0),
    totalBetaCodes: Number(stats?.total_beta_codes ?? 0),
  };
}