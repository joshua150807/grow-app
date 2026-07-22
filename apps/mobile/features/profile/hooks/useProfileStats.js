import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { logger } from '../../../lib/logger';
import {
  getDeviceTimeZone,
  getMyProfileStatsV1,
  normalizeProfileStatsFallback,
} from '../services/profileStats';
import { isProfileApiV1Enabled } from '../services/profiles';

export function useProfileStats(fallbackValues) {
  const enabled = isProfileApiV1Enabled();
  const fallbackStats = useMemo(() => normalizeProfileStatsFallback(fallbackValues), [
    fallbackValues.deepWorkSecondsAllTime,
    fallbackValues.goals,
    fallbackValues.habitStreak,
    fallbackValues.plannedDaysCurrentWeek,
    fallbackValues.todosToday.completed,
    fallbackValues.todosToday.total,
    fallbackValues.trainingSessions,
  ]);
  const [stats, setStats] = useState(fallbackStats);
  const hasServerStatsRef = useRef(false);
  const requestSequenceRef = useRef(0);

  useEffect(() => {
    if (!enabled || !hasServerStatsRef.current) {
      setStats(fallbackStats);
    }
  }, [enabled, fallbackStats]);

  useFocusEffect(
    useCallback(() => {
      if (!enabled) {
        hasServerStatsRef.current = false;
        return undefined;
      }

      let active = true;
      const requestSequence = requestSequenceRef.current + 1;
      requestSequenceRef.current = requestSequence;

      async function loadStats() {
        try {
          const timeZone = getDeviceTimeZone();
          const nextStats = await getMyProfileStatsV1(timeZone);

          if (!active || requestSequence !== requestSequenceRef.current) return;

          hasServerStatsRef.current = true;
          setStats(nextStats);
        } catch (error) {
          logger.debug('[ProfileStats] Load failed:', error?.code ?? 'UNKNOWN');
        }
      }

      loadStats();

      return () => {
        active = false;
      };
    }, [enabled]),
  );

  return stats;
}
