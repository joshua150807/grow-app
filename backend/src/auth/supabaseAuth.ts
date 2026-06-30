import { AppError } from '../errors/appError.js';
import { getSupabaseAuthClient } from '../integrations/supabase/authClient.js';
import type { AuthUser } from './types.js';

function normalizeRole(role: unknown): string | null {
  return typeof role === 'string' && role.trim() ? role : null;
}

export async function verifySupabaseAccessToken(token: string): Promise<AuthUser | null> {
  let result;

  try {
    result = await getSupabaseAuthClient().auth.getUser(token);
  } catch (error) {
    throw new AppError(401, 'UNAUTHORIZED', 'Invalid or expired access token.');
  }

  if (result.error || !result.data.user) {
    return null;
  }

  const user = result.data.user;
  const appMetadataRole = normalizeRole(user.app_metadata?.role);
  const userRole = normalizeRole(user.role);

  return {
    id: user.id,
    email: user.email ?? null,
    role: appMetadataRole ?? userRole,
  };
}
