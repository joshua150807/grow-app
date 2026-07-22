import {
  createIsolatedSupabaseAuthClient,
  supabase,
} from '../../../services/supabaseClient';

export class ProfilePasswordError extends Error {
  constructor(code) {
    super(code);
    this.name = 'ProfilePasswordError';
    this.code = code;
  }
}

export function validatePasswordChange({ currentPassword, newPassword, confirmPassword }) {
  if (!currentPassword || !newPassword || !confirmPassword) return 'PASSWORD_FIELDS_REQUIRED';
  if (newPassword.length < 6) return 'PASSWORD_TOO_SHORT';
  if (newPassword !== confirmPassword) return 'PASSWORD_CONFIRMATION_MISMATCH';
  if (newPassword === currentPassword) return 'PASSWORD_UNCHANGED';
  return null;
}

function isPasswordAccount(user) {
  const provider = user?.app_metadata?.provider;
  const providers = user?.app_metadata?.providers;
  return provider === 'email' || (Array.isArray(providers) && providers.includes('email'));
}

async function readSession(expectedUserId = null) {
  const { data: { session } = {}, error } = await supabase.auth.getSession();

  if (error || !session?.user?.id) throw new ProfilePasswordError('PASSWORD_SESSION_MISSING');
  if (expectedUserId && session.user.id !== expectedUserId) {
    throw new ProfilePasswordError('PASSWORD_AUTH_CHANGED');
  }

  return session;
}

export async function changeCurrentUserPassword(input) {
  const validationError = validatePasswordChange(input);
  if (validationError) throw new ProfilePasswordError(validationError);

  const initialSession = await readSession();
  const expectedUserId = initialSession.user.id;
  const email = initialSession.user.email;

  if (!email) throw new ProfilePasswordError('PASSWORD_EMAIL_MISSING');
  if (!isPasswordAccount(initialSession.user)) {
    throw new ProfilePasswordError('PASSWORD_PROVIDER_UNSUPPORTED');
  }

  let isolatedClient = createIsolatedSupabaseAuthClient();

  try {
    const { data: reauthData, error: reauthError } = await isolatedClient.auth.signInWithPassword({
      email,
      password: input.currentPassword,
    });

    if (reauthError) throw new ProfilePasswordError('PASSWORD_CURRENT_INVALID');
    if (reauthData?.user?.id !== expectedUserId) {
      throw new ProfilePasswordError('PASSWORD_REAUTH_USER_MISMATCH');
    }

    await readSession(expectedUserId);

    const { data: updateData, error: updateError } = await isolatedClient.auth.updateUser({
      password: input.newPassword,
    });

    if (updateError) throw new ProfilePasswordError('PASSWORD_UPDATE_FAILED');
    if (updateData?.user?.id && updateData.user.id !== expectedUserId) {
      throw new ProfilePasswordError('PASSWORD_AUTH_CHANGED');
    }

    await readSession(expectedUserId);
  } finally {
    isolatedClient = null;
  }
}
