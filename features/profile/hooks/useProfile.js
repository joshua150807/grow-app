import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { supabase } from '../../../services/supabaseClient';
import { loadProfileData } from '../services/profiles';
import { useStartupProfile } from '../context/ProfileContext';

const FALLBACK_PROFILE = {
  username: 'Grower',
  growPoints: 0,
  role: 'user',
};

export function useProfile() {
  const startupProfileContext = useStartupProfile();
  const startupProfile = startupProfileContext?.profile;
  const reloadStartupProfile = startupProfileContext?.reloadProfile;

  const [profile, setProfile] = useState(startupProfile ?? FALLBACK_PROFILE);

  useEffect(() => {
    if (startupProfile) {
      setProfile(startupProfile);
    }
  }, [startupProfile]);

  const load = useCallback(async () => {
    try {
      // Wenn Profil schon beim App-Start geladen wurde,
      // nutzen wir denselben zentralen Reload.
      if (reloadStartupProfile) {
        const nextProfile = await reloadStartupProfile();

        if (nextProfile) {
          setProfile(nextProfile);
        }

        return;
      }

      // Fallback, falls useProfile irgendwo ohne Provider genutzt wird
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) return;

      const nextProfile = await loadProfileData(user.id);
      setProfile(nextProfile);
    } catch (err) {
      console.log('Fehler beim Laden des Profils:', err);
    }
  }, [reloadStartupProfile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const role = profile?.role ?? FALLBACK_PROFILE.role;
  const isCeo = role === 'ceo' || role === 'admin';

  return {
    username: profile?.username ?? FALLBACK_PROFILE.username,
    growPoints: profile?.growPoints ?? FALLBACK_PROFILE.growPoints,
    role,
    isCeo,
    reload: load,
  };
}