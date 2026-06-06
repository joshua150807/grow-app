import { useEffect, useRef } from 'react';
import { AppState, Dimensions, Platform } from 'react-native';
import { Stack, usePathname } from 'expo-router';

import { COLORS } from '../../../constants/colors';
import {
  getTrackedToolForPath,
  trackToolDuration,
  trackToolOpen,
} from '../../../features/tools/analytics/services/toolUsageAnalytics';

const SWIPE_BACK_GESTURE_DISTANCE = Math.round(Dimensions.get('window').width / 3);

export default function ToolsLayout() {
  const pathname = usePathname();
  const activeSessionRef = useRef(null);

  useEffect(() => {
    const nextTool = getTrackedToolForPath(pathname);
    const previousSession = activeSessionRef.current;

    if (previousSession?.tool?.id) {
      const durationSeconds = (Date.now() - previousSession.startedAt) / 1000;
      void trackToolDuration(previousSession.tool, durationSeconds);
    }

    if (nextTool?.id) {
      activeSessionRef.current = {
        tool: nextTool,
        startedAt: Date.now(),
      };

      void trackToolOpen(nextTool);
    } else {
      activeSessionRef.current = null;
    }
  }, [pathname]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const activeSession = activeSessionRef.current;

      if (!activeSession?.tool?.id) return;

      if (nextState !== 'active') {
        const durationSeconds = (Date.now() - activeSession.startedAt) / 1000;
        void trackToolDuration(activeSession.tool, durationSeconds);
        activeSessionRef.current = null;
        return;
      }

      activeSessionRef.current = {
        ...activeSession,
        startedAt: Date.now(),
      };
    });

    return () => {
      const activeSession = activeSessionRef.current;

      if (activeSession?.tool?.id) {
        const durationSeconds = (Date.now() - activeSession.startedAt) / 1000;
        void trackToolDuration(activeSession.tool, durationSeconds);
      }

      subscription.remove();
    };
  }, []);

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
    />
  );
}
