import { createContext, useContext } from 'react';

export const StartupProfileContext = createContext(null);

const PROFILE_FIELDS = [
  'id',
  'username',
  'bio',
  'avatarUrl',
  'growPoints',
  'role',
  'createdAt',
  'updatedAt',
];

export function mergeConfirmedProfile(currentProfile, profileOrPatch, expectedUserId) {
  if (!profileOrPatch || typeof profileOrPatch !== 'object' || !expectedUserId) {
    return currentProfile;
  }

  if (profileOrPatch.id !== undefined && profileOrPatch.id !== expectedUserId) {
    return currentProfile;
  }

  if (currentProfile?.id && currentProfile.id !== expectedUserId) {
    return currentProfile;
  }

  const nextProfile = { ...(currentProfile ?? {}) };
  let changed = false;

  for (const field of PROFILE_FIELDS) {
    if (profileOrPatch[field] !== undefined && nextProfile[field] !== profileOrPatch[field]) {
      nextProfile[field] = profileOrPatch[field];
      changed = true;
    }
  }

  return changed ? nextProfile : currentProfile;
}

export function applyConfirmedProfileResponse(profile, applyProfile, reloadProfile) {
  applyProfile?.(profile);
  const reloadPromise = Promise.resolve()
    .then(() => reloadProfile?.())
    .catch(() => null);

  return { profile, reloadPromise };
}

export function useStartupProfile() {
  return useContext(StartupProfileContext);
}
