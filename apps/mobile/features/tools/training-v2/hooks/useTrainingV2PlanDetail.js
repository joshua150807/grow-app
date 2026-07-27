import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import {
  getTrainingV2Plan,
  resolveTrainingV2ExerciseNames,
} from '../services/trainingV2Api';
import { mapTrainingV2PlanDetail } from '../models/trainingV2ViewModel';

export function useTrainingV2PlanDetail(planId) {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const requestSequenceRef = useRef(0);
  const exerciseCacheRef = useRef(new Map());

  const load = useCallback(async ({ refresh = false } = {}) => {
    const requestSequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestSequence;
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const nextPlan = await getTrainingV2Plan(planId);
      const names = await resolveTrainingV2ExerciseNames(nextPlan, exerciseCacheRef.current);
      if (requestSequence !== requestSequenceRef.current) return;
      setPlan(mapTrainingV2PlanDetail(nextPlan, names));
    } catch (nextError) {
      if (requestSequence !== requestSequenceRef.current) return;
      setError(nextError);
    } finally {
      if (requestSequence !== requestSequenceRef.current) return;
      setLoading(false);
      setRefreshing(false);
    }
  }, [planId]);

  useFocusEffect(useCallback(() => {
    if (planId) void load();
    else {
      setLoading(false);
      setError(new Error('Plan-ID fehlt.'));
    }
    return () => {
      requestSequenceRef.current += 1;
    };
  }, [load, planId]));

  // Applies a plan tree already returned by a mutation (activate/schedule/archive/
  // reactivate/weekly-goal) directly, without an extra GET. The tree's exercise ids
  // are unchanged by those mutations, so the existing name cache is reused as-is.
  const applyServerPlan = useCallback(async (nextPlan) => {
    const names = await resolveTrainingV2ExerciseNames(nextPlan, exerciseCacheRef.current);
    setPlan(mapTrainingV2PlanDetail(nextPlan, names));
  }, []);

  return {
    plan,
    loading,
    refreshing,
    error,
    retry: load,
    refresh: useCallback(() => load({ refresh: true }), [load]),
    applyServerPlan,
  };
}

