import { supabase } from './supabaseClient';

export async function signInWithUsername(username, password) {
  if (process.env.EXPO_PUBLIC_USERNAME_LOGIN_API_ENABLED !== 'true') {
    // Existing builds keep their original Auth contract until a supported rollout.
    const result = await supabase.rpc('get_auth_email_for_username', { input_username: username });
    if (result.error) throw result.error;
    return supabase.auth.signInWithPassword({ email: result.data || `${username}@growapp.com`, password });
  }
  const base = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/+$/, '');
  const target = new URL(`${base}/v1/auth/username-login`);
  if (target.protocol !== 'https:' || target.username || target.password) {
    throw new Error('Sicherer Login ist nicht konfiguriert.');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    // No retries or fallback to public email resolution on the new-build path.
    const response = await fetch(target.toString(), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }), signal: controller.signal,
    });
    if (response.status === 401) return { error: new Error('Username oder Passwort ist falsch.') };
    if (response.status === 429) throw new Error('Zu viele Loginversuche. Bitte später erneut versuchen.');
    if (!response.ok) throw new Error('Login ist vorübergehend nicht verfügbar.');
    const session = await response.json();
    if (typeof session?.access_token !== 'string' || !session.access_token
      || typeof session?.refresh_token !== 'string' || !session.refresh_token) {
      throw new Error('Ungültige Loginantwort.');
    }
    return supabase.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
  } finally { clearTimeout(timer); }
}
