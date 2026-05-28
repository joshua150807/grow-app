import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  getHabits,
  getCompletionsForDate,
  toggleCompletion,
  deleteHabit,
  addHabit,
} from '../../../tools/habits/services/habits';

import { getDateForDayIndex } from '../utils/habitUtils';
import { getPreloadedToolData, setPreloadedToolData } from '../../../../lib/preloadedTools';

export function useHabits(selectedDay) {
  const selectedDate = getDateForDayIndex(selectedDay);
  const completionsCacheKey = `habitCompletions:${selectedDate}`;
  const preloadedHabits = getPreloadedToolData('habits');
  const preloadedCompletedIds = getPreloadedToolData(completionsCacheKey);

  const [habits, setHabits] = useState(() => preloadedHabits ?? []);
  const [completedIds, setCompletedIds] = useState(() => new Set(preloadedCompletedIds ?? []));
  const [loading, setLoading] = useState(!preloadedHabits);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);

  const loadHabits = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
    }
    setLoadError(null);

    try {
      const data = await getHabits();
      setHabits(data);
      setPreloadedToolData('habits', data);
    } catch (e) {
      setLoadError('Gewohnheiten konnten nicht geladen werden.');
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  const loadCompletions = useCallback(async () => {
    try {
      const ids = await getCompletionsForDate(selectedDate);
      setCompletedIds(new Set(ids));
      setPreloadedToolData(completionsCacheKey, ids);
    } catch (e) {
      setActionError('Fortschritt konnte nicht geladen werden.');
    }
  }, [selectedDate, completionsCacheKey]);

  useEffect(() => {
    const cached = getPreloadedToolData('habits');

    if (cached) {
      setHabits(cached);
      setLoading(false);
      loadHabits({ silent: true });
      return;
    }

    loadHabits();
  }, [loadHabits]);

  useEffect(() => {
    const cached = getPreloadedToolData(completionsCacheKey);

    if (cached) {
      setCompletedIds(new Set(cached));
    }

    loadCompletions();
  }, [loadCompletions, completionsCacheKey]);

  const visibleHabits = useMemo(
    () => habits.filter(habit => habit.days.includes(selectedDay)),
    [habits, selectedDay]
  );

  const completedCount = useMemo(
    () => visibleHabits.filter(habit => completedIds.has(habit.id)).length,
    [visibleHabits, completedIds]
  );

  const total = visibleHabits.length;
  const progress = total === 0 ? 0 : completedCount / total;

  const toggle = useCallback(async (id) => {
    const isDone = completedIds.has(id);

    setCompletedIds(prev => {
      const next = new Set(prev);
      isDone ? next.delete(id) : next.add(id);
      return next;
    });

    try {
      await toggleCompletion(id, selectedDate, !isDone);
      setPreloadedToolData(completionsCacheKey, Array.from(
        isDone
          ? new Set(Array.from(completedIds).filter(itemId => itemId !== id))
          : new Set([...Array.from(completedIds), id])
      ));
    } catch (e) {
      setActionError('Änderung konnte nicht gespeichert werden.');

      setCompletedIds(prev => {
        const next = new Set(prev);
        isDone ? next.add(id) : next.delete(id);
        return next;
      });
    }
  }, [selectedDate, completedIds, completionsCacheKey]);

  const remove = useCallback(async (id) => {
    setHabits(prev => {
      const nextHabits = prev.filter(habit => habit.id !== id);
      setPreloadedToolData('habits', nextHabits);
      return nextHabits;
    });

    try {
      await deleteHabit(id);
    } catch (e) {
      setActionError('Gewohnheit konnte nicht gelöscht werden.');
      loadHabits();
    }
  }, [loadHabits]);

  const add = useCallback(async (name, days) => {
    const newHabit = await addHabit(name, days);
    setHabits(prev => {
      const nextHabits = [...prev, newHabit];
      setPreloadedToolData('habits', nextHabits);
      return nextHabits;
    });
  }, []);

  return {
    habits,
    visibleHabits,
    completedIds,
    loading,
    loadError,
    actionError,
    completedCount,
    total,
    progress,
    setActionError,
    loadHabits,
    loadCompletions,
    toggle,
    remove,
    add,
  };
}