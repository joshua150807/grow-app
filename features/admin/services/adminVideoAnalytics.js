import { supabase } from '../../../services/supabaseClient';

export async function loadAdminVideoAnalytics(limit = 100) {
  const { data, error } = await supabase.rpc('get_admin_video_analytics', {
    limit_count: limit,
  });

  if (error) {
    throw error;
  }

  return (data ?? []).map((item) => ({
    id: item.video_id,
    title: item.title ?? 'Unbenanntes Video',
    thumbnailUrl: item.thumbnail_url ?? null,
    videoUrl: item.video_url ?? null,
    viewsCount: Number(item.views_count ?? 0),
    savesCount: Number(item.saves_count ?? 0),
    ratingsCount: Number(item.ratings_count ?? 0),
    thumbsDownCount: Number(item.thumbs_down_count ?? 0),
    neutralCount: Number(item.neutral_count ?? 0),
    thumbsUpCount: Number(item.thumbs_up_count ?? 0),
    fireCount: Number(item.fire_count ?? 0),
    score: Number(item.score ?? 0),
  }));
}