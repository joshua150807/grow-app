import { supabase } from '../../../../services/supabaseClient';
import { getJournalCutoffDate } from '../utils/journalUtils';

async function getCurrentUserId() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user?.id ?? null;
}

export async function cleanupOldJournalEntries() {
  const userId = await getCurrentUserId();
  if (!userId) return;

  const cutoffDate = getJournalCutoffDate();

  const { error } = await supabase
    .from('journal_entries')
    .delete()
    .eq('user_id', userId)
    .lt('entry_date', cutoffDate);

  if (error) throw error;
}

export async function getJournalEntries() {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  await cleanupOldJournalEntries();

  const cutoffDate = getJournalCutoffDate();

  const { data, error } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('user_id', userId)
    .gte('entry_date', cutoffDate)
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false });

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

  await cleanupOldJournalEntries();

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