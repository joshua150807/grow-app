import { logger } from '../../../../lib/logger';
import { useEffect, useMemo, useState } from 'react';

import { getHabitStreak, getTodayHabitProgress } from '../../habits/services/habits';
import { getTodayDeepWorkSeconds } from '../../deep-work/services/deepWorkStore';
import { useSteps } from '../../../steps/hooks/useSteps';

function formatDeepWork(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const m = Math.floor(safeSeconds / 60).toString().padStart(2, '0');
  const sec = (safeSeconds % 60).toString().padStart(2, '0');

  return `${m}:${sec}`;
}

function formatSteps(count) {
  const safeCount = Math.max(0, Number(count ?? 0) || 0);

  if (safeCount >= 1000) {
    return `${Math.floor(safeCount / 1000)}.${String(safeCount % 1000).padStart(3, '0')}`;
  }

  return String(safeCount);
}

function normalizeHabitProgress(progress) {
  const completed = Math.max(0, Number(progress?.completed) || 0);
  const total = Math.max(0, Number(progress?.total) || 0);

  return {
    completed: Math.min(completed, total || completed),
    total,
  };
}

export function useToolsTrackerData() {
  const [streak, setStreak] = useState(0);
  const [habitProgress, setHabitProgress] = useState({
    completed: 0,
    total: 0,
  });
  const [deepWorkTime, setDeepWorkTime] = useState(0);

  const {
    steps,
    isAvailable: stepsAvailable,
    permissionStatus: stepsPermissionStatus,
    error: stepsError,
  } = useSteps();

  useEffect(() => {
    let mounted = true;

    async function loadHabitSummary() {
      try {
        const [nextStreak, nextProgress] = await Promise.all([
          getHabitStreak(),
          getTodayHabitProgress(),
        ]);

        if (!mounted) return;

        setStreak(Math.max(0, Number(nextStreak) || 0));
        setHabitProgress(normalizeHabitProgress(nextProgress));
      } catch (error) {
        logger.debug('[ToolsTracker] Failed to load habit summary:', error);

        if (!mounted) return;

        setStreak(0);
        setHabitProgress({ completed: 0, total: 0 });
      }
    }

    loadHabitSummary();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadDeepWorkToday() {
      try {
        const seconds = await getTodayDeepWorkSeconds();

        if (mounted) {
          setDeepWorkTime(Math.max(0, Number(seconds) || 0));
        }
      } catch (error) {
        logger.debug('[ToolsTracker] Failed to load deep work time:', error);

        if (mounted) {
          setDeepWorkTime(0);
        }
      }
    }

    loadDeepWorkToday();

    const interval = setInterval(loadDeepWorkToday, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const habitPercent = habitProgress.total === 0
    ? '–'
    : `${Math.round((habitProgress.completed / habitProgress.total) * 100)}%`;

  const stepsValue = !stepsAvailable
    ? '–'
    : stepsPermissionStatus !== 'granted'
      ? 'Aus'
      : stepsError
        ? '–'
        : formatSteps(steps);

  const trackerItems = useMemo(() => [
    {
      value: String(streak),
      label: 'Tage Streak',
    },
    {
      value: habitPercent,
      label: 'Tagesziele',
    },
    {
      value: deepWorkTime > 0 ? formatDeepWork(deepWorkTime) : '00:00',
      label: 'Deep Work',
    },
    {
      value: stepsValue,
      label: 'Schritte',
    },
  ], [streak, habitPercent, deepWorkTime, stepsValue]);

  return {
    streak,
    habitProgress,
    deepWorkTime,
    steps,
    stepsAvailable,
    stepsPermissionStatus,
    stepsError,
    stepsValue,
    trackerItems,
  };
}
