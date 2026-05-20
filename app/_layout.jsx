import {
  useEffect,
  useState,
  createContext,
  useContext,
  useCallback,
  useMemo,
} from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { supabase } from '../services/supabaseClient';
import { COLORS } from '../constants/colors';
import { preloadStartupImageAssets } from '../constants/toolAssets';
import { loadProfileData } from '../features/profile/services/profiles';
import { StartupProfileContext } from '../features/profile/context/ProfileContext';

const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

export default function RootLayout() {
  const [session, setSession] = useState(undefined);
  const [startupReady, setStartupReady] = useState(false);
  const [startupProfile, setStartupProfile] = useState(null);

  useEffect(() => {
    // Einmaliger Check beim Start
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
    });

    // Echtzeit-Listener: reagiert auf Login, Logout, Token-Refresh
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const reloadStartupProfile = useCallback(async () => {
    if (!session?.user?.id) {
      setStartupProfile(null);
      return null;
    }

    const profile = await loadProfileData(session.user.id);
    setStartupProfile(profile);

    return profile;
  }, [session?.user?.id]);

  useEffect(() => {
    let cancelled = false;

    async function prepareStartupData() {
      // undefined = Session wurde noch nicht geprüft
      if (session === undefined) return;

      setStartupReady(false);

      try {
        // Lokale Bilder vorbereiten
        const assetPromise = preloadStartupImageAssets();

        // Kein User eingeloggt
        if (!session?.user?.id) {
          setStartupProfile(null);
          await assetPromise;

          if (!cancelled) {
            setStartupReady(true);
          }

          return;
        }

        // User ist eingeloggt:
        // Profil + lokale Bilder parallel vorbereiten
        const [profile] = await Promise.all([
          loadProfileData(session.user.id),
          assetPromise,
        ]);

        if (!cancelled) {
          setStartupProfile(profile);
          setStartupReady(true);
        }
      } catch (err) {
        console.log('Fehler beim Vorbereiten der Startdaten:', err);

        // App trotzdem weiter starten lassen
        if (!cancelled) {
          setStartupReady(true);
        }
      }
    }

    prepareStartupData();

    return () => {
      cancelled = true;
    };
  }, [session]);

  const startupProfileValue = useMemo(
    () => ({
      profile: startupProfile,
      reloadProfile: reloadStartupProfile,
    }),
    [startupProfile, reloadStartupProfile]
  );

  // undefined = noch nicht geprüft
  // startupReady false = Session bekannt, aber Profil/Bilder werden vorbereitet
  if (session === undefined || !startupReady) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View
          style={{
            flex: 1,
            backgroundColor: COLORS.background,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <ActivityIndicator color={COLORS.gold} />
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthContext.Provider value={session}>
        <StartupProfileContext.Provider value={startupProfileValue}>
          <Stack screenOptions={{ headerShown: false }} />
        </StartupProfileContext.Provider>
      </AuthContext.Provider>
    </GestureHandlerRootView>
  );
}