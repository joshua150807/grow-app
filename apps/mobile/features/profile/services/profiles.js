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
    id: row?.id ?? userId ?? null,
    username: row?.username || fallbackUsername,
    bio: typeof row?.bio === 'string' ? row.bio : '',
    growPoints: normalizeGrowPoints(row?.grow_points),
    role: row?.role || FALLBACK_ROLE,
    createdAt: row?.created_at ?? null,
    updatedAt: row?.updated_at ?? null,
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
    id: profile.id,
    username: profile.username,
    bio: typeof profile.bio === 'string' ? profile.bio : '',
    avatarUrl: typeof profile.avatar_url === 'string' && profile.avatar_url.trim()
      ? profile.avatar_url
      : null,
    growPoints: normalizeGrowPoints(profile?.grow_points),
    role: typeof profile.role === 'string' ? profile.role : FALLBACK_ROLE,
    createdAt: profile.created_at ?? null,
    updatedAt: profile.updated_at ?? null,
  };
}

export async function requestProfileV1(path, options = {}, normalizeResponse = normalizeV1Profile) {
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
    response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...options.headers,
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

  return normalizeResponse(payload);
}

function assertProfileApiV1Enabled() {
  if (!PROFILE_API_V1_ENABLED) {
    throw new ProfileApiError('Profile API V1 is disabled.', {
      code: 'PROFILE_API_V1_DISABLED',
    });
  }
}

function normalizeAvatarUpload(payload) {
  const upload = payload?.upload;

  if (
    !upload ||
    typeof upload.path !== 'string' ||
    typeof upload.token !== 'string' ||
    typeof upload.mime_type !== 'string' ||
    typeof upload.expires_in !== 'number'
  ) {
    throw new ProfileApiError('Profile API returned an invalid avatar upload.', {
      code: 'PROFILE_API_INVALID_RESPONSE',
    });
  }

  return {
    path: upload.path,
    token: upload.token,
    mimeType: upload.mime_type,
    expiresIn: upload.expires_in,
  };
}

export function isProfileApiV1Enabled() {
  return PROFILE_API_V1_ENABLED;
}

export async function getMyProfileV1() {
  assertProfileApiV1Enabled();
  return requestProfileV1('/v1/profile/me', {
    method: 'GET',
  });
}

export async function updateMyProfileV1({ username, bio } = {}) {
  assertProfileApiV1Enabled();
  const body = {};

  if (username !== undefined) {
    body.username = username;
  }

  if (bio !== undefined) {
    body.bio = bio;
  }

  return requestProfileV1('/v1/profile/me', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

export async function createMyAvatarUploadV1(mimeType) {
  assertProfileApiV1Enabled();

  return requestProfileV1('/v1/profile/me/avatar/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ mime_type: mimeType }),
  }, normalizeAvatarUpload);
}

export async function confirmMyAvatarUploadV1(path) {
  assertProfileApiV1Enabled();

  return requestProfileV1('/v1/profile/me/avatar/confirm', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path }),
  });
}

export async function deleteMyAvatarV1() {
  assertProfileApiV1Enabled();

  return requestProfileV1('/v1/profile/me/avatar', {
    method: 'DELETE',
  });
}

async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, grow_points, role')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;

  return data;
}

export async function loadProfileData(userId) {
  if (PROFILE_API_V1_ENABLED) {
    return getMyProfileV1();
  }

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
    .select('id, username, grow_points, role')
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
