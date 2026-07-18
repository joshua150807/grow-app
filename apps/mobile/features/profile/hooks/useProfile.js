import { useStartupProfile } from '../context/ProfileContext';

const FALLBACK_PROFILE = {
  id: null,
  username: 'Grower',
  bio: '',
  avatarUrl: null,
  growPoints: 0,
  role: 'user',
  createdAt: null,
  updatedAt: null,
};

function normalizeProfile(profile) {
  const growPoints = Number(profile?.growPoints ?? FALLBACK_PROFILE.growPoints);

  return {
    id: profile?.id ?? FALLBACK_PROFILE.id,
    username: profile?.username || FALLBACK_PROFILE.username,
    bio: typeof profile?.bio === 'string' ? profile.bio : FALLBACK_PROFILE.bio,
    avatarUrl: typeof profile?.avatarUrl === 'string' && profile.avatarUrl.trim()
      ? profile.avatarUrl
      : null,
    growPoints: Number.isFinite(growPoints) && growPoints >= 0 ? growPoints : 0,
    role: profile?.role || FALLBACK_PROFILE.role,
    createdAt: profile?.createdAt ?? FALLBACK_PROFILE.createdAt,
    updatedAt: profile?.updatedAt ?? FALLBACK_PROFILE.updatedAt,
  };
}

export function useProfile() {
  const context = useStartupProfile();
  const normalizedProfile = normalizeProfile(context?.profile);
  const role = normalizedProfile.role;
  const isCeo = role === 'ceo' || role === 'admin';

  return {
    profile: normalizedProfile,
    loading: context?.loading ?? false,
    error: context?.error ?? null,
    reloadProfile: context?.reloadProfile,
    ...normalizedProfile,
    isCeo,
    reload: context?.reloadProfile,
  };
}
