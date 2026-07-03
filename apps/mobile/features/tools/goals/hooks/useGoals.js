import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  getGoals,
  addGoal,
  toggleGoal,
  deleteGoal,
  updateGoal,
} from '../services/goals';
import { getPreloadedToolData, setPreloadedToolData } from '../../../../lib/preloadedTools';

export function useGoals(selectedCategory) {
  const cacheKey = `goals:${selectedCategory}`;
  const preloadedGoals = getPreloadedToolData(cacheKey);
  const [goals, setGoals] = useState(() => preloadedGoals ?? []);
  const [loading, setLoading] = useState(!preloadedGoals);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);

  const loadGoals = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
    }
    setLoadError(null);

    try {
      const data = await getGoals(selectedCategory);
      setGoals(data);
      setPreloadedToolData(cacheKey, data);
    } catch (e) {
      setLoadError('Ziele konnten nicht geladen werden.');
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [selectedCategory, cacheKey]);

  useEffect(() => {
    const cached = getPreloadedToolData(cacheKey);

    if (cached) {
      setGoals(cached);
      setLoading(false);
      loadGoals({ silent: true });
      return;
    }

    loadGoals();
  }, [cacheKey, loadGoals]);

  const completedCount = useMemo(
    () => goals.filter(goal => goal.completed).length,
    [goals]
  );

  const total = goals.length;
  const progress = total === 0 ? 0 : completedCount / total;

  const toggle = useCallback(async (id, currentCompleted) => {
    const nextCompleted = !currentCompleted;

    setGoals(prev => {
      const nextGoals = prev.map(goal =>
        goal.id === id ? { ...goal, completed: nextCompleted } : goal
      );
      setPreloadedToolData(cacheKey, nextGoals);
      return nextGoals;
    });

    try {
      await toggleGoal(id, nextCompleted);
    } catch (e) {
      setActionError('Änderung konnte nicht gespeichert werden.');

      setGoals(prev => {
        const nextGoals = prev.map(goal =>
          goal.id === id ? { ...goal, completed: currentCompleted } : goal
        );
        setPreloadedToolData(cacheKey, nextGoals);
        return nextGoals;
      });
    }
  }, [cacheKey]);

  const remove = useCallback(async (id) => {
    setGoals(prev => {
      const nextGoals = prev.filter(goal => goal.id !== id);
      setPreloadedToolData(cacheKey, nextGoals);
      return nextGoals;
    });

    try {
      await deleteGoal(id);
    } catch (e) {
      setActionError('Ziel konnte nicht gelöscht werden.');
      loadGoals();
    }
  }, [loadGoals, cacheKey]);

  const add = useCallback(async (name, category, deadline) => {
    const newGoal = await addGoal(name, category, deadline);
    if (category !== selectedCategory) {
      return;
    }

    setGoals(prev => {
      const nextGoals = [...prev, newGoal];
      setPreloadedToolData(cacheKey, nextGoals);
      return nextGoals;
    });
  }, [cacheKey, selectedCategory]);

  const update = useCallback(async (id, name, deadline) => {
    const cleanName = name.trim();
    const cleanDeadline = deadline?.trim() || null;

    const previousGoals = goals;

    setGoals(prev => {
      const nextGoals = prev.map(goal =>
        goal.id === id
          ? { ...goal, name: cleanName, deadline: cleanDeadline }
          : goal
      );
      setPreloadedToolData(cacheKey, nextGoals);
      return nextGoals;
    });

    try {
      const updatedGoal = await updateGoal(id, cleanName, cleanDeadline);

      setGoals(prev => {
        const nextGoals = prev.map(goal =>
          goal.id === id ? updatedGoal : goal
        );
        setPreloadedToolData(cacheKey, nextGoals);
        return nextGoals;
      });
    } catch (e) {
      setActionError('Ziel konnte nicht aktualisiert werden.');
      setGoals(previousGoals);
      setPreloadedToolData(cacheKey, previousGoals);
      throw e;
    }
  }, [goals, cacheKey]);

  return {
    goals,
    loading,
    loadError,
    actionError,
    setActionError,
    completedCount,
    total,
    progress,
    loadGoals,
    toggle,
    remove,
    add,
    update,
  };
}