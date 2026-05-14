import { supabase } from '../../../services/supabaseClient';

export async function loadAdminUsersOverview(limit = 200) {
  const { data, error } = await supabase.rpc('get_admin_users_overview', {
    limit_count: limit,
  });

  if (error) {
    throw error;
  }

  return (data ?? []).map((item) => ({
    id: item.user_id,
    username: item.username ?? 'Unbekannter User',
    role: item.role ?? 'user',
    growPoints: Number(item.grow_points ?? 0),
    createdAt: item.created_at ?? null,
    viewsCount: Number(item.views_count ?? 0),
    savesCount: Number(item.saves_count ?? 0),
    ratingsCount: Number(item.ratings_count ?? 0),
    feedbacksCount: Number(item.feedbacks_count ?? 0),
  }));
}