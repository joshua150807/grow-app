import { supabase } from '../../../../services/supabaseClient';
import { getCurrentUserId } from '../../../../services/authUser';

export async function getNotes() {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('user_id', userId)
    .order('pinned', { ascending: false })
    .order('updated_at', { ascending: false });

  if (error) throw error;

  return data ?? [];
}

export async function getNoteById(id) {
  const userId = await getCurrentUserId();
  if (!userId || !id) return null;

  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;

  return data ?? null;
}

export async function createNote({ body }) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Nicht eingeloggt.');

  const cleanBody = body?.trimEnd() ?? '';

  if (!cleanBody.trim()) {
    return null;
  }

  const { data, error } = await supabase
    .from('notes')
    .insert({
      user_id: userId,
      body: cleanBody,
    })
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function updateNote(id, { body, pinned }) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Nicht eingeloggt.');
  if (!id) throw new Error('Keine Notiz-ID vorhanden.');

  const payload = {
    updated_at: new Date().toISOString(),
  };

  if (typeof body === 'string') {
    payload.body = body.trimEnd();
  }

  if (typeof pinned === 'boolean') {
    payload.pinned = pinned;
  }

  const { data, error } = await supabase
    .from('notes')
    .update(payload)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    throw new Error('Notiz konnte nicht aktualisiert werden.');
  }

  return data;
}

export async function deleteNote(id) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Nicht eingeloggt.');

  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw error;
}