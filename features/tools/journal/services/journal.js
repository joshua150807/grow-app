import { supabase } from '../../../../services/supabaseClient';
import { getCurrentUserId } from '../../../../services/authUser';

export async function getJournalEntries() {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('user_id', userId)
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getJournalStarterEntries() {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('journal_starter_entries')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function addJournalEntry({
  entryDate,
  gratitude,
  didWell,
  improveTomorrow,
  habitsCompleted,
  missedHabits,
}) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Nicht eingeloggt');

  const { data, error } = await supabase
    .from('journal_entries')
    .insert({
      user_id: userId,
      entry_date: entryDate,
      gratitude,
      did_well: didWell,
      improve_tomorrow: improveTomorrow,
      habits_completed: habitsCompleted,
      missed_habits: habitsCompleted ? null : missedHabits,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateJournalEntry(id, {
  gratitude,
  didWell,
  improveTomorrow,
  habitsCompleted,
  missedHabits,
}) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Nicht eingeloggt');

  const { data, error } = await supabase
    .from('journal_entries')
    .update({
      gratitude,
      did_well: didWell,
      improve_tomorrow: improveTomorrow,
      habits_completed: habitsCompleted,
      missed_habits: habitsCompleted ? null : missedHabits,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    throw new Error('Journal-Eintrag konnte nicht aktualisiert werden. Keine passende Zeile gefunden.');
  }

  return data;
}

export async function upsertJournalStarterEntry({ pageKey, answer }) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Nicht eingeloggt');

  const { data, error } = await supabase
    .from('journal_starter_entries')
    .upsert({
      user_id: userId,
      page_key: pageKey,
      answer,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,page_key',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteJournalEntry(id) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Nicht eingeloggt');

  const { error } = await supabase
    .from('journal_entries')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw error;
}
