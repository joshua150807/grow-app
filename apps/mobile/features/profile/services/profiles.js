import { supabase } from '../../../services/supabaseClient';

const FALLBACK_ROLE = 'user';

function normalizeGrowPoints(value) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : 0;
}

function normalizeProfile(row, userId) {
  const fallbackUsername = userId ? `user_${userId.slice(0, 6)}` : 'Grower';

  return {
    username: row?.username || fallbackUsername,
    growPoints: normalizeGrowPoints(row?.grow_points),
    role: row?.role || FALLBACK_ROLE,
  };
}

async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('username, grow_points, role')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;

  return data;
}

export async function loadProfileData(userId) {
  if (!userId) {
    return normalizeProfile(null, null);
  }

  const existingProfile = await fetchProfile(userId);

  if (existingProfile) {
    return normalizeProfile(existingProfile, userId);
  }

  const fallbackUsername = `user_${userId.slice(0, 6)}`;

  const { data: newProfile, error: insertError } = await supabase
    .from('profiles')
    .insert({
      id: userId,
      username: fallbackUsername,
      grow_points: 0,
      role: FALLBACK_ROLE,
    })
    .select('username, grow_points, role')
    .single();

  if (insertError) {
    // Falls das Profil parallel durch Trigger/zweiten Request erstellt wurde,
    // nicht hart abbrechen, sondern nochmal laden.
    if (insertError.code === '23505') {
      const retryProfile = await fetchProfile(userId);

      if (retryProfile) {
        return normalizeProfile(retryProfile, userId);
      }
    }

    throw insertError;
  }

  return normalizeProfile(newProfile, userId);
}
