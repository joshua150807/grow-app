import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  getHabits,
  getCompletionsForDate,
  toggleCompletion,
  deleteHabit,
  addHabit,
  updateHabit,
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

function normalizeLinkedTool(linkedTool = null) {
  return linkedTool?.id && linkedTool?.title && linkedTool?.route
    ? {
        id: linkedTool.id,
        title: linkedTool.title,
        route: linkedTool.route,
      }
    : null;
}

function getPendingCacheKey(completionsCacheKey) {
  return `${completionsCacheKey}:pending`;
}

function getPendingCompletionMutations(completionsCacheKey) {
  return getPreloadedToolData(getPendingCacheKey(completionsCacheKey)) ?? {};
}

function setPendingCompletionMutation(completionsCacheKey, habitId, isDone) {
  if (!habitId) return;

  setPreloadedToolData(getPendingCacheKey(completionsCacheKey), {
    ...getPendingCompletionMutations(completionsCacheKey),
    [habitId]: Boolean(isDone),
  });
}

function clearPendingCompletionMutation(completionsCacheKey, habitId) {
  if (!habitId) return;

  const current = { ...getPendingCompletionMutations(completionsCacheKey) };
  delete current[habitId];
  setPreloadedToolData(getPendingCacheKey(completionsCacheKey), current);
}

function applyPendingCompletionMutations(ids, completionsCacheKey) {
  const next = new Set(normalizeIds(ids));
  const pending = getPendingCompletionMutations(completionsCacheKey);

  Object.entries(pending).forEach(([habitId, isDone]) => {
    if (isDone) {
      next.add(habitId);
    } else {
      next.delete(habitId);
    }
  });

  return Array.from(next);
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
      const ids = applyPendingCompletionMutations(
        await getCompletionsForDate(selectedDate),
        completionsCacheKey
      );
      if (!mountedRef.current || requestId !== completionsRequestRef.current) return;
      setCompletedIds(new Set(ids));
      setPreloadedToolData(completionsCacheKey, ids);
    } catch (e) {
      if (!mountedRef.current || requestId !== completionsRequestRef.current) return;
      setActionError('Fortschritt konnte nicht geladen werden.');
    }
  }, [selectedDate, completionsCacheKey]);

  const invalidatePendingCompletionsLoad = useCallback(() => {
    completionsRequestRef.current += 1;
  }, []);

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
      setCompletedIds(new Set(applyPendingCompletionMutations(cached, completionsCacheKey)));
    } else {
      setCompletedIds(new Set(applyPendingCompletionMutations([], completionsCacheKey)));
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

    const nextIsDone = !completedIds.has(id);

    // Verhindert, dass ein noch laufender Server-Reload oder ein schneller Re-Open
    // den gerade optimistisch gesetzten Haken mit alten Daten überschreibt.
    invalidatePendingCompletionsLoad();
    setPendingCompletionMutation(completionsCacheKey, id, nextIsDone);

    setCompletedIds(prev => {
      const next = new Set(prev);
      nextIsDone ? next.add(id) : next.delete(id);
      setPreloadedToolData(completionsCacheKey, Array.from(next));
      return next;
    });

    try {
      await toggleCompletion(id, selectedDate, nextIsDone);
      clearPendingCompletionMutation(completionsCacheKey, id);
    } catch (e) {
      clearPendingCompletionMutation(completionsCacheKey, id);

      const cached = new Set(normalizeIds(getPreloadedToolData(completionsCacheKey) ?? []));
      nextIsDone ? cached.delete(id) : cached.add(id);
      setPreloadedToolData(completionsCacheKey, Array.from(cached));

      if (mountedRef.current) {
        setActionError('Änderung konnte nicht gespeichert werden.');
        setCompletedIds(cached);
      }
    } finally {
      pendingActionsRef.current.delete(actionKey);
    }
  }, [selectedDate, completionsCacheKey, completedIds, invalidatePendingCompletionsLoad]);

  const remove = useCallback(async (id) => {
    if (!id) return;

    const actionKey = `delete:${id}`;
    if (pendingActionsRef.current.has(actionKey)) return;
    pendingActionsRef.current.add(actionKey);

    invalidatePendingCompletionsLoad();

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
  }, [loadHabits, loadCompletions, completionsCacheKey, invalidatePendingCompletionsLoad]);

  const add = useCallback(async (name, days, linkedTool = null) => {
    const safeName = typeof name === 'string' ? name.trim() : '';
    const safeDays = normalizeDays(days);
    if (!safeName || safeDays.length === 0) return null;

    const safeLinkedTool = normalizeLinkedTool(linkedTool);
    const actionKey = `add:${safeName}:${safeDays.join(',')}:${safeLinkedTool?.id ?? 'none'}`;
    if (pendingActionsRef.current.has(actionKey)) return null;
    pendingActionsRef.current.add(actionKey);

    try {
      const newHabit = normalizeHabit(await addHabit(safeName, safeDays, safeLinkedTool));
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

  const update = useCallback(async (id, name, days, linkedTool = null) => {
    const safeName = typeof name === 'string' ? name.trim() : '';
    const safeDays = normalizeDays(days);
    if (!id || !safeName || safeDays.length === 0) return null;

    const safeLinkedTool = normalizeLinkedTool(linkedTool);
    const actionKey = `update:${id}`;
    if (pendingActionsRef.current.has(actionKey)) return null;
    pendingActionsRef.current.add(actionKey);

    try {
      const updatedHabit = normalizeHabit(await updateHabit(id, safeName, safeDays, safeLinkedTool));
      if (!updatedHabit) return null;

      if (mountedRef.current) {
        setHabits(prev => {
          const nextHabits = prev.map(habit => (
            habit.id === id ? updatedHabit : habit
          ));
          setPreloadedToolData('habits', nextHabits);
          return nextHabits;
        });
      }

      return updatedHabit;
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
    update,
  };
}
