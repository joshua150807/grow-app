import { useCallback, useRef, useState } from 'react';

import {
  activateTrainingV2Plan,
  archiveTrainingV2Plan,
  reactivateTrainingV2Plan,
  scheduleTrainingV2Plan,
  updateTrainingV2WeeklyGoal,
} from '../services/trainingV2Api';

export function useTrainingV2PlanActions(planId, onSuccess) {
  const [pending, setPending] = useState(null);
  const [error, setError] = useState(null);
  const [conflict, setConflict] = useState(false);
  const pendingRef = useRef(false);

  const runAction = useCallback(async (kind, task) => {
    if (pendingRef.current) return { ok: false };
    pendingRef.current = true;
    setPending(kind);
    setError(null);

    try {
      const plan = await task();
      // No optimistic updates: only the actual server response is ever applied.
      setConflict(false);
      await onSuccess(plan);
      return { ok: true, plan };
    } catch (caughtError) {
      // Only a stale-version conflict is reload-eligible; other 409s (e.g. another
      // plan already scheduled, or a status that no longer allows the action) are
      // plain errors — reloading would not resolve them.
      if (caughtError?.code === 'TRAINING_PLAN_VERSION_CONFLICT') setConflict(true);
      setError(caughtError);
      return { ok: false, error: caughtError };
    } finally {
      pendingRef.current = false;
      setPending(null);
    }
  }, [onSuccess]);

  const activate = useCallback((expectedVersion) => (
    runAction('activate', () => activateTrainingV2Plan(planId, expectedVersion))
  ), [planId, runAction]);

  const schedule = useCallback((expectedVersion, startDate, timeZone) => (
    runAction('schedule', () => scheduleTrainingV2Plan(planId, expectedVersion, startDate, timeZone))
  ), [planId, runAction]);

  const archive = useCallback((expectedVersion) => (
    runAction('archive', () => archiveTrainingV2Plan(planId, expectedVersion))
  ), [planId, runAction]);

  const reactivate = useCallback((expectedVersion) => (
    runAction('reactivate', () => reactivateTrainingV2Plan(planId, expectedVersion))
  ), [planId, runAction]);

  const updateWeeklyGoal = useCallback((expectedVersion, weeklyGoal) => (
    runAction('weeklyGoal', () => updateTrainingV2WeeklyGoal(planId, expectedVersion, weeklyGoal))
  ), [planId, runAction]);

  const clearError = useCallback(() => {
    setError(null);
    setConflict(false);
  }, []);

  return {
    pending,
    error,
    conflict,
    activate,
    schedule,
    archive,
    reactivate,
    updateWeeklyGoal,
    clearError,
  };
}
