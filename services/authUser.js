import { supabase } from './supabaseClient';

export async function getCurrentUser() {
  const {
    data: { user } = {},
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  return user ?? null;
}

export async function getCurrentUserId() {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

export async function requireCurrentUserId(message = 'Nicht eingeloggt.') {
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error(message);
  }

  return userId;
}
