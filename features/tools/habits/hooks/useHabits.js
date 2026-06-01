import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  getHabits,
  getCompletionsForDate,
  toggleCompletion,
  deleteHabit,
  addHabit,
} from '../../../tools/habits/services/habits';

import { getDateForDayIndex } from '../utils/habitUtils';
import { getPreloadedToolData, setPreloadedToolData } from '../../../../lib/preloadedTools';

function normalizeDays(days) {
  if (!Array.isArray(days)) return [];

  return Array.from(new Set(days
    .map(day => Number(day))
    .filter(day => Number.isInteger(day) && day >= 0 && day <= 6)
  )).sort((a, b) => a - b);
}

function normalizeHabit(habit) {
  if (!habit || !habit.id) return null;

  const days = normalizeDays(habit.days);
  if (days.length === 0) return null;

  return {
    ...habit,
    name: typeof habit.name === 'string' ? habit.name : '',
    days,
  };
}

function normalizeHabits(habits) {
  if (!Array.isArray(habits)) return [];
  return habits.map(normalizeHabit).filter(Boolean);
}

function normalizeIds(ids) {
  if (!Array.isArray(ids)) return [];
  return Array.from(new Set(ids.filter(Boolean)));
}

export function useHabits(selectedDay) {
  const selectedDate = getDateForDayIndex(selectedDay);
  const completionsCacheKey = `habitCompletions:${selectedDate}`;
  const preloadedHabits = getPreloadedToolData('habits');
  const preloadedCompletedIds = getPreloadedToolData(completionsCacheKey);

  const [habits, setHabits] = useState(() => normalizeHabits(preloadedHabits ?? []));
  const [completedIds, setCompletedIds] = useState(() => new Set(normalizeIds(preloadedCompletedIds ?? [])));
  const [loading, setLoading] = useState(!preloadedHabits);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const mountedRef = useRef(true);
  const habitsRequestRef = useRef(0);
  const completionsRequestRef = useRef(0);
  const pendingActionsRef = useRef(new Set());

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      pendingActionsRef.current.clear();
    };
  }, []);

  const loadHabits = useCallback(async ({ silent = false } = {}) => {
    const requestId = habitsRequestRef.current + 1;
    habitsRequestRef.current = requestId;

    if (mountedRef.current) {
      if (!silent) {
        setLoading(true);
      }
      setLoadError(null);
    }

    try {
      const data = normalizeHabits(await getHabits());
      if (!mountedRef.current || requestId !== habitsRequestRef.current) return;
      setHabits(data);
      setPreloadedToolData('habits', data);
    } catch (e) {
      if (!mountedRef.current || requestId !== habitsRequestRef.current) return;
      setLoadError('Gewohnheiten konnten nicht geladen werden.');
    } finally {
      if (mountedRef.current && requestId === habitsRequestRef.current && !silent) {
        setLoading(false);
      }
    }
  }, []);

  const loadCompletions = useCallback(async () => {
    const requestId = completionsRequestRef.current + 1;
    completionsRequestRef.current = requestId;

    try {
      const ids = normalizeIds(await getCompletionsForDate(selectedDate));
      if (!mountedRef.current || requestId !== completionsRequestRef.current) return;
      setCompletedIds(new Set(ids));
      setPreloadedToolData(completionsCacheKey, ids);
    } catch (e) {
      if (!mountedRef.current || requestId !== completionsRequestRef.current) return;
      setActionError('Fortschritt konnte nicht geladen werden.');
    }
  }, [selectedDate, completionsCacheKey]);

  useEffect(() => {
    const cached = getPreloadedToolData('habits');

    if (cached) {
      setHabits(normalizeHabits(cached));
      setLoading(false);
      loadHabits({ silent: true });
      return;
    }

    loadHabits();
  }, [loadHabits]);

  useEffect(() => {
    const cached = getPreloadedToolData(completionsCacheKey);

    if (cached) {
      setCompletedIds(new Set(normalizeIds(cached)));
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
    if (!id) return;

    const actionKey = `toggle:${selectedDate}:${id}`;
    if (pendingActionsRef.current.has(actionKey)) return;
    pendingActionsRef.current.add(actionKey);

    let nextIsDone = false;

    setCompletedIds(prev => {
      const isDone = prev.has(id);
      nextIsDone = !isDone;
      const next = new Set(prev);
      isDone ? next.delete(id) : next.add(id);
      setPreloadedToolData(completionsCacheKey, Array.from(next));
      return next;
    });

    try {
      await toggleCompletion(id, selectedDate, nextIsDone);
    } catch (e) {
      if (mountedRef.current) {
        setActionError('Änderung konnte nicht gespeichert werden.');
        setCompletedIds(prev => {
          const next = new Set(prev);
          nextIsDone ? next.delete(id) : next.add(id);
          setPreloadedToolData(completionsCacheKey, Array.from(next));
          return next;
        });
      }
    } finally {
      pendingActionsRef.current.delete(actionKey);
    }
  }, [selectedDate, completionsCacheKey]);

  const remove = useCallback(async (id) => {
    if (!id) return;

    const actionKey = `delete:${id}`;
    if (pendingActionsRef.current.has(actionKey)) return;
    pendingActionsRef.current.add(actionKey);

    setHabits(prev => {
      const nextHabits = prev.filter(habit => habit.id !== id);
      setPreloadedToolData('habits', nextHabits);
      return nextHabits;
    });

    setCompletedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      setPreloadedToolData(completionsCacheKey, Array.from(next));
      return next;
    });

    try {
      await deleteHabit(id);
    } catch (e) {
      if (mountedRef.current) {
        setActionError('Gewohnheit konnte nicht gelöscht werden.');
        loadHabits();
        loadCompletions();
      }
    } finally {
      pendingActionsRef.current.delete(actionKey);
    }
  }, [loadHabits, loadCompletions, completionsCacheKey]);

  const add = useCallback(async (name, days) => {
    const safeName = typeof name === 'string' ? name.trim() : '';
    const safeDays = normalizeDays(days);
    if (!safeName || safeDays.length === 0) return null;

    const actionKey = `add:${safeName}:${safeDays.join(',')}`;
    if (pendingActionsRef.current.has(actionKey)) return null;
    pendingActionsRef.current.add(actionKey);

    try {
      const newHabit = normalizeHabit(await addHabit(safeName, safeDays));
      if (!newHabit) return null;

      if (mountedRef.current) {
        setHabits(prev => {
          const nextHabits = [...prev, newHabit];
          setPreloadedToolData('habits', nextHabits);
          return nextHabits;
        });
      }

      return newHabit;
    } finally {
      pendingActionsRef.current.delete(actionKey);
    }
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
