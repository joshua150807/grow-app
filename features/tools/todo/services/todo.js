import { supabase } from '../../../../services/supabaseClient';
import { getCurrentUserId } from '../../../../services/authUser';

export async function getTodos() {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('todos')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function addTodo(title, dueAt) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Nicht eingeloggt');

  const { data, error } = await supabase
    .from('todos')
    .insert({ user_id: userId, title, due_at: dueAt ?? null, completed: false })
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error('Todo konnte nicht gespeichert werden.');
  return data;
}

export async function toggleTodo(id, completed) {
  const { data, error } = await supabase
    .from('todos')
    .update({ completed })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error('Todo konnte nicht aktualisiert werden.');
  return data;
}

export async function deleteTodo(id) {
  const { error } = await supabase
    .from('todos')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function updateTodo(id, title, dueAt) {
  const { data, error } = await supabase
    .from('todos')
    .update({
      title,
      due_at: dueAt ?? null,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error('Todo konnte nicht aktualisiert werden.');
  return data;
}