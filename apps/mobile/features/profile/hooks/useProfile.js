import { logger } from '../../../lib/logger';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { supabase } from '../../../services/supabaseClient';
import { loadProfileData } from '../services/profiles';
import { useStartupProfile } from '../context/ProfileContext';

const FALLBACK_PROFILE = {
  username: 'Grower',
  growPoints: 0,
  role: 'user',
};

function normalizeProfile(profile) {
  const growPoints = Number(profile?.growPoints ?? FALLBACK_PROFILE.growPoints);

  return {
    username: profile?.username || FALLBACK_PROFILE.username,
    growPoints: Number.isFinite(growPoints) && growPoints >= 0 ? growPoints : 0,
    role: profile?.role || FALLBACK_PROFILE.role,
  };
}

export function useProfile() {
  const startupProfileContext = useStartupProfile();
  const startupProfile = startupProfileContext?.profile;
  const reloadStartupProfile = startupProfileContext?.reloadProfile;

  const isMountedRef = useRef(true);
  const loadRequestIdRef = useRef(0);

  const [profile, setProfile] = useState(() => normalizeProfile(startupProfile));

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (startupProfile && isMountedRef.current) {
      setProfile(normalizeProfile(startupProfile));
    }
  }, [startupProfile]);

  const load = useCallback(async () => {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;

    try {
      // Wenn Profil schon beim App-Start geladen wurde,
      // nutzen wir denselben zentralen Reload.
      if (reloadStartupProfile) {
        const nextProfile = await reloadStartupProfile();

        if (
          nextProfile &&
          isMountedRef.current &&
          loadRequestIdRef.current === requestId
        ) {
          setProfile(normalizeProfile(nextProfile));
        }

        return;
      }

      // Fallback, falls useProfile irgendwo ohne Provider genutzt wird
      const {
        data: { user } = {},
        error,
      } = await supabase.auth.getUser();

      if (error || !user) return;

      const nextProfile = await loadProfileData(user.id);

      if (isMountedRef.current && loadRequestIdRef.current === requestId) {
        setProfile(normalizeProfile(nextProfile));
      }
    } catch (err) {
      logger.debug('Fehler beim Laden des Profils:', err);
    }
  }, [reloadStartupProfile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const normalizedProfile = normalizeProfile(profile);
  const role = normalizedProfile.role;
  const isCeo = role === 'ceo' || role === 'admin';

  return {
    username: normalizedProfile.username,
    growPoints: normalizedProfile.growPoints,
    role,
    isCeo,
    reload: load,
  };
}
