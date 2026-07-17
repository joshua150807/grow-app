import { logger } from '../../../../lib/logger';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import {
  getHabitStreak,
  subscribeToHabitCompletionChanges,
} from '../../habits/services/habits';
import { getTodos } from '../../todo/services/todo';
import { getTodayDeepWorkSeconds } from '../../deep-work/services/deepWorkStore';
import { useSteps } from '../../../steps/hooks/useSteps';
import { getPreloadedToolData } from '../../../../lib/preloadedTools';

function formatDeepWork(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const totalSeconds = Math.floor(safeSeconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;
  const paddedMinutes = String(minutes).padStart(2, '0');
  const paddedSeconds = String(remainingSeconds).padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${paddedMinutes}:${paddedSeconds}`;
  }

  return `${paddedMinutes}:${paddedSeconds}`;
}

function formatSteps(count) {
  const safeCount = Math.max(0, Number(count ?? 0) || 0);

  if (safeCount >= 1000) {
    return `${Math.floor(safeCount / 1000)}.${String(safeCount % 1000).padStart(3, '0')}`;
  }

  return String(safeCount);
}

function normalizeTodoProgress(todos) {
  const safeTodos = Array.isArray(todos) ? todos : [];
  const total = safeTodos.length;
  const completed = safeTodos.filter((todo) => Boolean(todo?.completed)).length;

  return {
    completed,
    total,
  };
}

export function useToolsTrackerData() {
  const [streak, setStreak] = useState(0);
  const [todoProgress, setTodoProgress] = useState({
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

  useFocusEffect(
    useCallback(() => {
      let active = true;
      let midnightTimer;

      async function loadHabitStreak() {
        try {
          const nextStreak = await getHabitStreak();

          if (!active) return;

          setStreak(Math.max(0, Number(nextStreak) || 0));
        } catch (error) {
          logger.debug('[ToolsTracker] Failed to load habit streak:', error);

          if (!active) return;

          setStreak(0);
        }
      }

      function scheduleMidnightRefresh() {
        const now = new Date();
        const nextDay = new Date(now);
        nextDay.setHours(24, 0, 1, 0);

        midnightTimer = setTimeout(async () => {
          await loadHabitStreak();
          if (active) scheduleMidnightRefresh();
        }, nextDay.getTime() - now.getTime());
      }

      loadHabitStreak();
      scheduleMidnightRefresh();
      const unsubscribe = subscribeToHabitCompletionChanges(loadHabitStreak);

      return () => {
        active = false;
        clearTimeout(midnightTimer);
        unsubscribe();
      };
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const cachedTodos = getPreloadedToolData('todos');
      const hasCachedTodos = Array.isArray(cachedTodos);

      if (hasCachedTodos) {
        setTodoProgress(normalizeTodoProgress(cachedTodos));
        return () => {
          active = false;
        };
      }

      async function loadTodoProgress() {
        try {
          const todos = await getTodos();

          if (!active) return;

          setTodoProgress(normalizeTodoProgress(todos));
        } catch (error) {
          logger.debug('[ToolsTracker] Failed to load todo progress:', error);

          if (!active) return;

          setTodoProgress({ completed: 0, total: 0 });
        }
      }

      loadTodoProgress();

      return () => {
        active = false;
      };
    }, [])
  );

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

  const todoProgressValue = `${todoProgress.completed}/${todoProgress.total}`;

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
      value: todoProgressValue,
      label: 'To-dos',
    },
    {
      value: deepWorkTime > 0 ? formatDeepWork(deepWorkTime) : '00:00',
      label: 'Deep Work',
    },
    {
      value: stepsValue,
      label: 'Schritte',
    },
  ], [streak, todoProgressValue, deepWorkTime, stepsValue]);

  return {
    streak,
    todoProgress,
    deepWorkTime,
    steps,
    stepsAvailable,
    stepsPermissionStatus,
    stepsError,
    stepsValue,
    trackerItems,
  };
}
