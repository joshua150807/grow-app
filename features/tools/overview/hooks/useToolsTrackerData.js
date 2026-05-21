import { useEffect, useMemo, useState } from 'react';

import { getHabitStreak, getTodayHabitProgress } from '../../habits/services/habits';
import { getTodayDeepWorkSeconds } from '../../deep-work/services/deepWorkStore';
import { useSteps } from '../../../steps/hooks/useSteps';

function formatDeepWork(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const sec = (seconds % 60).toString().padStart(2, '0');

  return `${m}:${sec}`;
}

function formatSteps(count) {
  if (count >= 1000) {
    return `${Math.floor(count / 1000)}.${String(count % 1000).padStart(3, '0')}`;
  }

  return String(count);
}

export function useToolsTrackerData() {
  const [streak, setStreak] = useState(0);
  const [habitProgress, setHabitProgress] = useState({
    completed: 0,
    total: 0,
  });
  const [deepWorkTime, setDeepWorkTime] = useState(0);

  const steps = useSteps();

  useEffect(() => {
    getHabitStreak().then(setStreak).catch(() => {});
    getTodayHabitProgress().then(setHabitProgress).catch(() => {});
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadDeepWorkToday() {
      const seconds = await getTodayDeepWorkSeconds();

      if (mounted) {
        setDeepWorkTime(seconds);
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
      value: formatSteps(steps),
      label: 'Schritte',
    },
  ], [streak, habitPercent, deepWorkTime, steps]);

  return {
    streak,
    habitProgress,
    deepWorkTime,
    steps,
    trackerItems,
  };
}