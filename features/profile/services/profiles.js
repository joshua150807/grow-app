import { supabase } from '../../../services/supabaseClient';

export async function loadProfileData(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('username, grow_points, role')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    const fallbackUsername = `user_${userId.slice(0, 6)}`;

    const { data: newProfile, error: insertError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        username: fallbackUsername,
        grow_points: 0,
        role: 'user',
      })
      .select('username, grow_points, role')
      .single();

    if (insertError) throw insertError;

    return {
      username: newProfile.username,
      growPoints: newProfile.grow_points ?? 0,
      role: newProfile.role ?? 'user',
    };
  }

  return {
    username: data.username,
    growPoints: data.grow_points ?? 0,
    role: data.role ?? 'user',
  };
}