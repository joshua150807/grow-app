import { useCallback, useEffect, useRef } from 'react';
import { AppState, Dimensions, Platform } from 'react-native';
import { Stack, usePathname } from 'expo-router';

import { COLORS } from '../../../constants/colors';
import {
  getTrackedToolForPath,
  trackToolDuration,
  trackToolOpen,
} from '../../../features/tools/analytics/services/toolUsageAnalytics';

const SWIPE_BACK_GESTURE_DISTANCE = Math.round(Dimensions.get('window').width / 3);
const TOOL_USAGE_CHECKPOINT_MS = 60 * 1000;

export default function ToolsLayout() {
  const pathname = usePathname();
  const activeSessionRef = useRef(null);
  const appStateRef = useRef(AppState.currentState ?? 'active');

  const flushActiveSession = useCallback(({ continueTracking = false } = {}) => {
    const activeSession = activeSessionRef.current;

    if (!activeSession?.tool?.id || !Number.isFinite(activeSession.startedAt)) {
      return;
    }

    const now = Date.now();
    const durationSeconds = (now - activeSession.startedAt) / 1000;

    activeSessionRef.current = {
      ...activeSession,
      startedAt: continueTracking ? now : null,
    };

    void trackToolDuration(activeSession.tool, durationSeconds);
  }, []);

  useEffect(() => {
    const nextTool = getTrackedToolForPath(pathname);
    const previousSession = activeSessionRef.current;
    const isAppActive = appStateRef.current === 'active';
    const isSameTool =
      previousSession?.tool?.id && nextTool?.id === previousSession.tool.id;

    // Unterseiten desselben Tools bleiben eine zusammenhängende Tool-Session.
    if (isSameTool) {
      if (isAppActive && !Number.isFinite(previousSession.startedAt)) {
        activeSessionRef.current = {
          ...previousSession,
          startedAt: Date.now(),
        };
      }
      return;
    }

    if (previousSession?.tool?.id) {
      flushActiveSession();
    }

    if (nextTool?.id) {
      activeSessionRef.current = {
        tool: nextTool,
        startedAt: isAppActive ? Date.now() : null,
      };

      if (isAppActive) {
        void trackToolOpen(nextTool);
      }
    } else {
      activeSessionRef.current = null;
    }
  }, [flushActiveSession, pathname]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      const activeSession = activeSessionRef.current;
      if (!activeSession?.tool?.id) return;

      if (nextState !== 'active') {
        flushActiveSession();
        return;
      }

      // Nach Background/Lockscreen dieselbe Tool-Session weitertracken.
      if (previousState !== 'active' && !Number.isFinite(activeSession.startedAt)) {
        activeSessionRef.current = {
          ...activeSession,
          startedAt: Date.now(),
        };
      }
    });

    const checkpointInterval = setInterval(() => {
      if (appStateRef.current !== 'active') return;

      const activeSession = activeSessionRef.current;
      if (!activeSession?.tool?.id || !Number.isFinite(activeSession.startedAt)) return;

      // Lange Sessions regelmäßig sichern, damit bei App-Kill nicht alles verloren geht.
      flushActiveSession({ continueTracking: true });
    }, TOOL_USAGE_CHECKPOINT_MS);

    return () => {
      flushActiveSession();
      activeSessionRef.current = null;
      clearInterval(checkpointInterval);
      subscription.remove();
    };
  }, [flushActiveSession]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: COLORS.background,
        },
        animation: Platform.OS === 'ios' ? 'ios_from_right' : 'slide_from_right',
        gestureEnabled: true,
        fullScreenGestureEnabled: false,
        gestureResponseDistance: SWIPE_BACK_GESTURE_DISTANCE,
      }}
    >
      <Stack.Screen name="index" options={{ animation: 'none' }} />
    </Stack>
  );
}
