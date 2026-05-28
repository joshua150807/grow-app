import {
  useEffect,
  useState,
  createContext,
  useContext,
  useCallback,
  useMemo,
} from 'react';
import { Image, View } from 'react-native';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Pedometer } from 'expo-sensors';
import * as SplashScreen from 'expo-splash-screen';

import { supabase } from '../services/supabaseClient';
import { COLORS } from '../constants/colors';
import { preloadStartupImageAssets } from '../constants/toolAssets';
import { loadProfileData } from '../features/profile/services/profiles';
import { StartupProfileContext } from '../features/profile/context/ProfileContext';

SplashScreen.preventAutoHideAsync().catch(() => {});

const AuthContext = createContext(null);
const STARTUP_LOGO = require('../assets/images/grow-loading.jpeg');

export function useAuth() {
  return useContext(AuthContext);
}

export default function RootLayout() {
  const [session, setSession] = useState(undefined);
  const [startupProfile, setStartupProfile] = useState(null);

  useEffect(() => {
    // Lokale Tools-Overview-Bilder sofort anwärmen, aber niemals den Appstart blockieren.
    preloadStartupImageAssets().catch((err) => {
      console.log('Tool-Bilder konnten nicht vorgeladen werden:', err);
    });
  }, []);

  useEffect(() => {
    let mounted = true;

    // Nur die Session-Prüfung darf das native Startsymbol kurz halten.
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session ?? null);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session === undefined) return;

    // Sobald die Session bekannt ist, darf der Feed rendern.
    // Profil/Tool-Daten laufen danach im Hintergrund.
    SplashScreen.hideAsync().catch(() => {});
  }, [session]);

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

    async function loadProfileInBackground() {
      try {
        if (!session?.user?.id) {
          setStartupProfile(null);
          return;
        }

        const profile = await loadProfileData(session.user.id);

        if (!cancelled) {
          setStartupProfile(profile);
        }
      } catch (err) {
        console.log('Profil konnte im Hintergrund nicht geladen werden:', err);
      }
    }

    if (session !== undefined) {
      loadProfileInBackground();
    }

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

  useEffect(() => {
    let cancelled = false;

    async function requestMotionPermissionAfterStartup() {
      try {
        // Start niemals wegen Motion Permission blockieren.
        if (session === undefined) return;
        if (!session?.user?.id) return;

        const available = await Pedometer.isAvailableAsync();
        if (!available || cancelled) return;

        const currentPermission = await Pedometer.getPermissionsAsync();
        if (cancelled) return;

        if (currentPermission.status !== 'granted') {
          await Pedometer.requestPermissionsAsync();
        }
      } catch (err) {
        console.log('Motion Permission konnte beim Start nicht abgefragt werden:', err);
      }
    }

    requestMotionPermissionAfterStartup();

    return () => {
      cancelled = true;
    };
  }, [session]);

  // Nur die Session-Prüfung zeigt noch kurz das Grow-Symbol.
  // Feed, Profil, Tool-Bilder und Tool-Daten blockieren den Appstart nicht.
  if (session === undefined) {
    return (
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: COLORS.background }}>
        <View
          style={{
            flex: 1,
            backgroundColor: COLORS.background,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Image
            source={STARTUP_LOGO}
            style={{
              width: 120,
              height: 120,
              resizeMode: 'contain',
            }}
          />
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <AuthContext.Provider value={session}>
        <StartupProfileContext.Provider value={startupProfileValue}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: COLORS.background },
              animation: 'none',
            }}
          />
        </StartupProfileContext.Provider>
      </AuthContext.Provider>
    </GestureHandlerRootView>
  );
}