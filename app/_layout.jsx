import {
  useEffect,
  useState,
  createContext,
  useContext,
  useCallback,
  useMemo,
} from 'react';
import { Image, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Pedometer } from 'expo-sensors';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';

import { supabase } from '../services/supabaseClient';
import { COLORS } from '../constants/colors';
import { loadProfileData } from '../features/profile/services/profiles';
import { StartupProfileContext } from '../features/profile/context/ProfileContext';
import { OnboardingProvider } from '../features/onboarding/context/OnboardingContext';
import OnboardingLayer from '../features/onboarding/components/OnboardingLayer';
import RootErrorBoundary from '../components/system/RootErrorBoundary';

SplashScreen.preventAutoHideAsync().catch(() => {});

const AuthContext = createContext(null);
const STARTUP_LOGO = require('../assets/images/grow-loading.png');

function getAuthParamsFromUrl(url) {
  if (!url) return null;

  const queryString = url.includes('?') ? url.split('?')[1]?.split('#')[0] : '';
  const hashString = url.includes('#') ? url.split('#')[1] : '';
  const combined = [queryString, hashString].filter(Boolean).join('&');

  if (!combined) return null;

  const params = new URLSearchParams(combined);
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  const type = params.get('type');

  if (!accessToken || !refreshToken) return null;

  return {
    accessToken,
    refreshToken,
    type,
  };
}

export function useAuth() {
  return useContext(AuthContext);
}

export default function RootLayout() {
  const [session, setSession] = useState(undefined);
  const [startupProfile, setStartupProfile] = useState(null);

  useEffect(() => {
    async function handleRecoveryUrl(url) {
      const authParams = getAuthParamsFromUrl(url);

      if (!authParams) return;

      try {
        const { error } = await supabase.auth.setSession({
          access_token: authParams.accessToken,
          refresh_token: authParams.refreshToken,
        });

        if (error) {
          console.log('Recovery-Link konnte nicht verarbeitet werden:', error);
          return;
        }

        if (authParams.type === 'recovery') {
          router.replace('/reset-password');
        }
      } catch (err) {
        console.log('Recovery-Link Fehler:', err);
      }
    }

    Linking.getInitialURL()
      .then((url) => {
        if (url) {
          handleRecoveryUrl(url);
        }
      })
      .catch((err) => {
        console.log('Initialer Link konnte nicht gelesen werden:', err);
      });

    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleRecoveryUrl(url);
    });

    return () => {
      subscription?.remove?.();
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    // Nur die Session-Prüfung darf das native Startsymbol kurz halten.
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (mounted) {
          setSession(data.session ?? null);
        }
      })
      .catch((err) => {
        console.log('Session konnte beim Start nicht geladen werden:', err);
        if (mounted) {
          setSession(null);
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (mounted) {
        setSession(newSession ?? null);
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe?.();
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

    try {
      const profile = await loadProfileData(session.user.id);
      setStartupProfile(profile);

      return profile;
    } catch (err) {
      console.log('Profil konnte nicht neu geladen werden:', err);
      return null;
    }
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
          <OnboardingProvider isAuthenticated={Boolean(session?.user?.id)}>
            <RootErrorBoundary>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: COLORS.background },
                  animation: 'none',
                }}
              />
              <OnboardingLayer />
            </RootErrorBoundary>
          </OnboardingProvider>
        </StartupProfileContext.Provider>
      </AuthContext.Provider>
    </GestureHandlerRootView>
  );
}
