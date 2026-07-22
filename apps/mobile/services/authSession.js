import { router } from 'expo-router';

import { supabase } from './supabaseClient';

let logoutPromise = null;

export function logoutCurrentUser({ beforeSignOut } = {}) {
  if (logoutPromise) return logoutPromise;

  beforeSignOut?.();

  const operation = (async () => {
    const { error } = await supabase.auth.signOut();

    if (error) throw error;

    router.replace('/login');
  })();

  logoutPromise = operation;
  operation.then(
    () => { if (logoutPromise === operation) logoutPromise = null; },
    () => { if (logoutPromise === operation) logoutPromise = null; },
  );

  return operation;
}
