import {
  useEffect,
  useState,
  createContext,
  useContext,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { AppState, Image, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';

import { supabase } from '../services/supabaseClient';
import { COLORS } from '../constants/colors';
import { loadProfileData } from '../features/profile/services/profiles';
import {
  mergeConfirmedProfile,
  StartupProfileContext,
} from '../features/profile/context/ProfileContext';
import { OnboardingProvider } from '../features/onboarding/context/OnboardingContext';
import OnboardingLayer from '../features/onboarding/components/OnboardingLayer';
import RootErrorBoundary from '../components/system/RootErrorBoundary';
import { preloadRatingIconAssets } from '../constants/ratingAssets';
import { logger } from '../lib/logger';
import { claimLegacyDeepWorkData } from '../features/tools/deep-work/services/deepWorkStore';
import { isDeepWorkSyncEnabled } from '../features/tools/deep-work/services/deepWorkSyncConfig';
import { triggerDeepWorkSyncForCurrentUser } from '../features/tools/deep-work/services/deepWorkSyncWorker';

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
  const code = params.get('code');
  const type = params.get('type');
  const error = params.get('error');
  const errorDescription = params.get('error_description');

  if (error) {
    return {
      error,
      errorDescription,
      type,
    };
  }

  if (code) {
    return {
      code,
      type,
    };
  }

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
  const [startupProfileLoading, setStartupProfileLoading] = useState(false);
  const [startupProfileError, setStartupProfileError] = useState(null);
  const activeSessionUserIdRef = useRef(null);

  useEffect(() => {
    let handledInitialUrl = false;

    async function openResetPasswordScreen() {
      // Einen Tick warten, damit der Router beim Kaltstart sicher bereit ist.
      setTimeout(() => {
        router.replace('/reset-password');
      }, 0);
    }

    async function handleRecoveryUrl(url) {
      const authParams = getAuthParamsFromUrl(url);

      if (!authParams) return false;

      if (authParams.error) {
        logger.debug('Recovery-Link enthält einen Fehler:', {
          error: authParams.error,
          description: authParams.errorDescription,
        });
        return true;
      }

      try {
        if (authParams.code) {
          const { error } = await supabase.auth.exchangeCodeForSession(authParams.code);

          if (error) {
            logger.debug('Recovery-Code konnte nicht verarbeitet werden:', error);
            return true;
          }

          await openResetPasswordScreen();
          return true;
        }

        if (authParams.accessToken && authParams.refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: authParams.accessToken,
            refresh_token: authParams.refreshToken,
          });

          if (error) {
            logger.debug('Recovery-Link konnte nicht verarbeitet werden:', error);
            return true;
          }

          if (authParams.type === 'recovery') {
            await openResetPasswordScreen();
          }

          return true;
        }
      } catch (err) {
        logger.debug('Recovery-Link Fehler:', err);
        return true;
      }

      return false;
    }

    Linking.getInitialURL()
      .then(async (url) => {
        if (url) {
          handledInitialUrl = await handleRecoveryUrl(url);
        }
      })
      .catch((err) => {
        logger.debug('Initialer Link konnte nicht gelesen werden:', err);
      });

    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleRecoveryUrl(url);
    });

    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' && !handledInitialUrl) {
        openResetPasswordScreen();
      }
    });

    return () => {
      subscription?.remove?.();
      authSubscription?.unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    // Nur die Session-Prüfung darf das native Startsymbol kurz halten.
    supabase.auth
      .getSession()
      .then(({ data }) => {
        activeSessionUserIdRef.current = data.session?.user?.id ?? null;
        if (mounted) {
          setSession(data.session ?? null);
        }
      })
      .catch((err) => {
        logger.debug('Session konnte beim Start nicht geladen werden:', err);
        if (mounted) {
          setSession(null);
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      activeSessionUserIdRef.current = newSession?.user?.id ?? null;
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

  useEffect(() => {
    const userId = session?.user?.id;
    if (!isDeepWorkSyncEnabled() || !userId) return;

    claimLegacyDeepWorkData(userId)
      .then(() => triggerDeepWorkSyncForCurrentUser())
      .catch((error) => {
        logger.debug('[DeepWorkSync] Bootstrap failed:', error?.code ?? 'UNKNOWN');
      });
  }, [session?.user?.id, session?.access_token]);

  useEffect(() => {
    if (!isDeepWorkSyncEnabled()) return undefined;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') return;
      triggerDeepWorkSyncForCurrentUser().catch((error) => {
        logger.debug('[DeepWorkSync] AppState sync failed:', error?.code ?? 'UNKNOWN');
      });
    });
    return () => subscription?.remove?.();
  }, []);

  useEffect(() => {
    if (session === undefined) return;

    preloadRatingIconAssets().catch((err) => {
      logger.debug('Rating-Icons konnten beim Start nicht vorgeladen werden:', err);
    });
  }, [session]);

  const reloadStartupProfile = useCallback(async () => {
    if (!session?.user?.id) {
      setStartupProfile(null);
      setStartupProfileError(null);
      return null;
    }

    setStartupProfileLoading(true);
    setStartupProfileError(null);

    try {
      const profile = await loadProfileData(session.user.id);
      setStartupProfile(profile);

      return profile;
    } catch (err) {
      logger.error('Profil konnte nicht neu geladen werden:', err);
      setStartupProfileError(err);
      throw err;
    } finally {
      setStartupProfileLoading(false);
    }
  }, [session?.user?.id]);

  const applyStartupProfile = useCallback((profileOrPatch) => {
    const expectedUserId = activeSessionUserIdRef.current;
    if (!expectedUserId) return;

    setStartupProfile((currentProfile) => (
      mergeConfirmedProfile(currentProfile, profileOrPatch, expectedUserId)
    ));
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadProfileInBackground() {
      try {
        if (!session?.user?.id) {
          setStartupProfile(null);
          setStartupProfileError(null);
          return;
        }

        setStartupProfileLoading(true);
        setStartupProfileError(null);
        const profile = await loadProfileData(session.user.id);

        if (!cancelled) {
          setStartupProfile(profile);
        }
      } catch (err) {
        logger.error('Profil konnte im Hintergrund nicht geladen werden:', err);
        if (!cancelled) {
          setStartupProfileError(err);
        }
      } finally {
        if (!cancelled) {
          setStartupProfileLoading(false);
        }
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
      loading: startupProfileLoading,
      error: startupProfileError,
      reloadProfile: reloadStartupProfile,
      applyProfile: applyStartupProfile,
    }),
    [
      startupProfile,
      startupProfileLoading,
      startupProfileError,
      reloadStartupProfile,
      applyStartupProfile,
    ]
  );


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
