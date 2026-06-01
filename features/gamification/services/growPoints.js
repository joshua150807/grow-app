import { supabase } from '../../../services/supabaseClient';

function isDuplicateError(error) {
  return error?.code === '23505';
}

function normalizeGrowPoints(value) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : 0;
}

export async function awardVideoPoints(userId, videoId) {
  if (!userId || !videoId) {
    return {
      awarded: false,
      reason: 'missing_data',
    };
  }

  const { data: existingView, error: fetchViewError } = await supabase
    .from('video_views')
    .select('id, points_awarded, progress_percent')
    .eq('user_id', userId)
    .eq('video_id', videoId)
    .maybeSingle();

  if (fetchViewError) {
    throw fetchViewError;
  }

  if (existingView?.points_awarded) {
    return {
      awarded: false,
      reason: 'already_awarded',
    };
  }

  if (existingView) {
    const { error: updateViewError } = await supabase
      .from('video_views')
      .update({
        progress_percent: 0.8,
        points_awarded: true,
      })
      .eq('id', existingView.id);

    if (updateViewError) {
      throw updateViewError;
    }
  } else {
    const { error: insertViewError } = await supabase
      .from('video_views')
      .insert({
        user_id: userId,
        video_id: videoId,
        progress_percent: 0.8,
        points_awarded: true,
      });

    if (insertViewError) {
      // Wenn parallel bereits ein View entstanden ist, nicht doppelt belohnen.
      if (isDuplicateError(insertViewError)) {
        return {
          awarded: false,
          reason: 'already_awarded',
        };
      }

      throw insertViewError;
    }
  }

  const { data: profile, error: profileFetchError } = await supabase
    .from('profiles')
    .select('grow_points')
    .eq('id', userId)
    .single();

  if (profileFetchError) {
    throw profileFetchError;
  }

  const currentGrowPoints = normalizeGrowPoints(profile?.grow_points);

  const { error: profileUpdateError } = await supabase
    .from('profiles')
    .update({
      grow_points: currentGrowPoints + 1,
    })
    .eq('id', userId);

  if (profileUpdateError) {
    throw profileUpdateError;
  }

  const { error: logError } = await supabase
    .from('grow_points_log')
    .insert({
      user_id: userId,
      points: 1,
      reason: 'video_watched',
    });

  if (logError) {
    // Die Punkte wurden bereits vergeben. Ein Log-Fehler darf keinen Retry auslösen,
    // der später doppelte Punkte verursachen könnte.
    console.log('Grow-Points-Log konnte nicht gespeichert werden:', logError);
  }

  return {
    awarded: true,
    reason: 'success',
  };
}
