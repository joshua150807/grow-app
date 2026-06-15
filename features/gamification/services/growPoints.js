import { supabase } from '../../../services/supabaseClient';

export async function awardVideoPoints(userId, videoId) {
  if (!userId || !videoId) {
    return {
      awarded: false,
      reason: 'missing_data',
    };
  }

  const { data: awarded, error } = await supabase.rpc('award_video_watch_point', {
    input_video_id: String(videoId),
  });

  if (error) {
    throw error;
  }

  return {
    awarded: Boolean(awarded),
    reason: awarded ? 'success' : 'already_awarded',
  };
}
