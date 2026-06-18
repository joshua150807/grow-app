import { supabase } from '../../../../services/supabaseClient';
import { getTodayIsoDate, normalizeAffirmationText } from '../utils/affirmationUtils';
import { getCurrentUserId } from '../../../../services/authUser';

export async function getAffirmations() {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('affirmations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return data ?? [];
}

export async function createAffirmation({ text, category }) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Nicht eingeloggt.');

  const cleanText = normalizeAffirmationText(text);
  if (!cleanText) return null;

  const { data, error } = await supabase
    .from('affirmations')
    .insert({
      user_id: userId,
      text: cleanText,
      category: category || 'Disziplin',
    })
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function updateAffirmation(id, { text, category }) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Nicht eingeloggt.');
  if (!id) throw new Error('Keine Affirmation-ID vorhanden.');

  const payload = {
    updated_at: new Date().toISOString(),
  };

  if (typeof text === 'string') {
    payload.text = normalizeAffirmationText(text);
  }

  if (typeof category === 'string') {
    payload.category = category;
  }

  const { data, error } = await supabase
    .from('affirmations')
    .update(payload)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    throw new Error('Affirmation konnte nicht aktualisiert werden.');
  }

  return data;
}

export async function setAffirmationRepeated(id, repeated, currentTotalRepetitions = 0) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Nicht eingeloggt.');
  if (!id) throw new Error('Keine Affirmation-ID vorhanden.');

  const payload = {
    last_repeated_date: repeated ? getTodayIsoDate() : null,
    updated_at: new Date().toISOString(),
  };

  if (repeated) {
    payload.total_repetitions = Number(currentTotalRepetitions || 0) + 1;
  }

  const { data, error } = await supabase
    .from('affirmations')
    .update(payload)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    throw new Error('Affirmation konnte nicht aktualisiert werden.');
  }

  return data;
}

export async function deleteAffirmation(id) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Nicht eingeloggt.');

  const { error } = await supabase
    .from('affirmations')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw error;
}
