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
  const [fetching, setFetching] = useState(false);
  const requestSequenceRef = useRef(0);
  const exerciseCacheRef = useRef(new Map());
  const loadedPlanRef = useRef(null);

  const load = useCallback(async ({ refresh = false } = {}) => {
    const requestSequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestSequence;
    const hasPlan = loadedPlanRef.current?.id === planId;
    setLoading(!hasPlan);
    setRefreshing(refresh && hasPlan);
    setFetching(!refresh && hasPlan);
    setError(null);

    try {
      const nextPlan = await getTrainingV2Plan(planId);
      const names = await resolveTrainingV2ExerciseNames(nextPlan, exerciseCacheRef.current);
      if (requestSequence !== requestSequenceRef.current) return;
      const mapped = mapTrainingV2PlanDetail(nextPlan, names);
      loadedPlanRef.current = mapped;
      setPlan(mapped);
    } catch (nextError) {
      if (requestSequence !== requestSequenceRef.current) return;
      if (nextError.status === 404) { loadedPlanRef.current = null; setPlan(null); }
      setError(nextError);
    } finally {
      if (requestSequence !== requestSequenceRef.current) return;
      setLoading(false);
      setRefreshing(false);
      setFetching(false);
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
    if (nextPlan.id !== planId) return;
    const sequence = ++requestSequenceRef.current;
    const names = await resolveTrainingV2ExerciseNames(nextPlan, exerciseCacheRef.current);
    if (sequence !== requestSequenceRef.current) return;
    const mapped = mapTrainingV2PlanDetail(nextPlan, names);
    loadedPlanRef.current = mapped;
    setPlan(mapped);
    setLoading(false);
    setRefreshing(false);
    setFetching(false);
  }, [planId]);

  const visiblePlan = plan?.id === planId ? plan : null;
  return {
    plan: visiblePlan,
    loading: !visiblePlan && (loading || Boolean(planId && !error)),
    refreshing,
    fetching,
    error,
    retry: load,
    refresh: useCallback(() => load({ refresh: true }), [load]),
    applyServerPlan,
  };
}
