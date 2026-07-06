import { supabase } from '../../../services/supabaseClient';

const FALLBACK_ROLE = 'user';
const PROFILE_API_V1_ENABLED = process.env.EXPO_PUBLIC_PROFILE_API_V1_ENABLED === 'true';

export class ProfileApiError extends Error {
  constructor(message, { status = null, code = null } = {}) {
    super(message);
    this.name = 'ProfileApiError';
    this.status = status;
    this.code = code;
  }
}

function normalizeGrowPoints(value) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : 0;
}

function normalizeProfile(row, userId) {
  const fallbackUsername = userId ? `user_${userId.slice(0, 6)}` : 'Grower';

  return {
    username: row?.username || fallbackUsername,
    growPoints: normalizeGrowPoints(row?.grow_points),
    role: row?.role || FALLBACK_ROLE,
  };
}

function getProfileApiBaseUrl() {
  const rawUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

  if (!rawUrl) {
    throw new ProfileApiError('Profile API URL is not configured.', {
      code: 'PROFILE_API_URL_MISSING',
    });
  }

  try {
    const url = new URL(rawUrl);

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('Unsupported API URL protocol.');
    }

    return url.toString().replace(/\/+$/, '');
  } catch {
    throw new ProfileApiError('Profile API URL is invalid.', {
      code: 'PROFILE_API_URL_INVALID',
    });
  }
}

async function readResponseJson(response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new ProfileApiError('Profile API returned invalid JSON.', {
      status: response.status,
      code: 'PROFILE_API_INVALID_JSON',
    });
  }
}

function normalizeV1Profile(payload) {
  const profile = payload?.profile;

  if (
    !profile ||
    typeof profile !== 'object' ||
    typeof profile.username !== 'string' ||
    typeof profile.grow_points !== 'number'
  ) {
    throw new ProfileApiError('Profile API returned an invalid response.', {
      code: 'PROFILE_API_INVALID_RESPONSE',
    });
  }

  return {
    username: profile.username,
    growPoints: normalizeGrowPoints(profile?.grow_points),
  };
}

export function isProfileApiV1Enabled() {
  return PROFILE_API_V1_ENABLED;
}

export async function getMyProfileV1() {
  const baseUrl = getProfileApiBaseUrl();
  const {
    data: { session } = {},
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw new ProfileApiError('Profile API session could not be loaded.', {
      code: 'PROFILE_API_SESSION_ERROR',
    });
  }

  const accessToken = session?.access_token;

  if (!accessToken) {
    throw new ProfileApiError('Profile API session is missing.', {
      code: 'PROFILE_API_SESSION_MISSING',
    });
  }

  let response;

  try {
    response = await fetch(`${baseUrl}/v1/profile/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch {
    throw new ProfileApiError('Profile API request failed.', {
      code: 'PROFILE_API_NETWORK_ERROR',
    });
  }

  const payload = await readResponseJson(response);

  if (!response.ok) {
    throw new ProfileApiError('Profile API request was rejected.', {
      status: response.status,
      code: payload?.code ?? payload?.error?.code ?? 'PROFILE_API_REQUEST_FAILED',
    });
  }

  return normalizeV1Profile(payload);
}

async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('username, grow_points, role')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;

  return data;
}

export async function loadProfileData(userId) {
  if (!userId) {
    return normalizeProfile(null, null);
  }

  const existingProfile = await fetchProfile(userId);

  if (existingProfile) {
    return normalizeProfile(existingProfile, userId);
  }

  const fallbackUsername = `user_${userId.slice(0, 6)}`;

  const { data: newProfile, error: insertError } = await supabase
    .from('profiles')
    .insert({
      id: userId,
      username: fallbackUsername,
      grow_points: 0,
      role: FALLBACK_ROLE,
    })
    .select('username, grow_points, role')
    .single();

  if (insertError) {
    // Falls das Profil parallel durch Trigger/zweiten Request erstellt wurde,
    // nicht hart abbrechen, sondern nochmal laden.
    if (insertError.code === '23505') {
      const retryProfile = await fetchProfile(userId);

      if (retryProfile) {
        return normalizeProfile(retryProfile, userId);
      }
    }

    throw insertError;
  }

  return normalizeProfile(newProfile, userId);
}
