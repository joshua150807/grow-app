import { supabase } from '../../../../services/supabaseClient';
import { getCurrentUserId } from '../../../../services/authUser';

export async function getLeitfragenAnswers() {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('leitfragen_answers')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function upsertLeitfragenAnswer({ questionKey, answer }) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Nicht eingeloggt');

  const { data, error } = await supabase
    .from('leitfragen_answers')
    .upsert({
      user_id: userId,
      question_key: questionKey,
      answer,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,question_key',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
