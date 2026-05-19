import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  getGoals,
  addGoal,
  toggleGoal,
  deleteGoal,
  updateGoal,
} from '../services/goals';

export function useGoals(selectedCategory) {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);

  const loadGoals = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const data = await getGoals(selectedCategory);
      setGoals(data);
    } catch (e) {
      setLoadError('Ziele konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  const completedCount = useMemo(
    () => goals.filter(goal => goal.completed).length,
    [goals]
  );

  const total = goals.length;
  const progress = total === 0 ? 0 : completedCount / total;

  const toggle = useCallback(async (id, currentCompleted) => {
    const nextCompleted = !currentCompleted;

    setGoals(prev => prev.map(goal =>
      goal.id === id ? { ...goal, completed: nextCompleted } : goal
    ));

    try {
      await toggleGoal(id, nextCompleted);
    } catch (e) {
      setActionError('Änderung konnte nicht gespeichert werden.');

      setGoals(prev => prev.map(goal =>
        goal.id === id ? { ...goal, completed: currentCompleted } : goal
      ));
    }
  }, []);

  const remove = useCallback(async (id) => {
    setGoals(prev => prev.filter(goal => goal.id !== id));

    try {
      await deleteGoal(id);
    } catch (e) {
      setActionError('Ziel konnte nicht gelöscht werden.');
      loadGoals();
    }
  }, [loadGoals]);

  const add = useCallback(async (name, category, deadline) => {
    const newGoal = await addGoal(name, category, deadline);
    setGoals(prev => [...prev, newGoal]);
  }, []);

  const update = useCallback(async (id, name, deadline) => {
    const cleanName = name.trim();
    const cleanDeadline = deadline?.trim() || null;

    const previousGoals = goals;

    setGoals(prev => prev.map(goal =>
      goal.id === id
        ? { ...goal, name: cleanName, deadline: cleanDeadline }
        : goal
    ));

    try {
      const updatedGoal = await updateGoal(id, cleanName, cleanDeadline);

      setGoals(prev => prev.map(goal =>
        goal.id === id ? updatedGoal : goal
      ));
    } catch (e) {
      setActionError('Ziel konnte nicht aktualisiert werden.');
      setGoals(previousGoals);
      throw e;
    }
  }, [goals]);

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