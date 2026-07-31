import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import {
  getTrainingV2Template,
  resolveTrainingV2ExerciseNames,
} from '../services/trainingV2Api';
import { mapTrainingV2TemplateDetail } from '../models/trainingV2ViewModel';

// Mirrors useTrainingV2PlanDetail exactly, but reads a Grow template instead of a plan — a
// template's revision/units/exercises shape is identical to a plan's (see
// packages/shared/src/training/plans.ts), so the same exercise-name resolution works
// unchanged. Save/Unsave/Activate never return the template itself (see
// templateUserPlanResponseSchema), only the refreshed userPlan projection — so those actions
// go through `retry()` (a real refetch) rather than an applyServerPlan-style local merge.
export function useTrainingV2TemplateDetail(templateId) {
  const [template, setTemplate] = useState(null);
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
      const { template: nextTemplate, userPlan } = await getTrainingV2Template(templateId);
      const names = await resolveTrainingV2ExerciseNames(nextTemplate, exerciseCacheRef.current);
      if (requestSequence !== requestSequenceRef.current) return;
      setTemplate(mapTrainingV2TemplateDetail(nextTemplate, userPlan, names));
    } catch (nextError) {
      if (requestSequence !== requestSequenceRef.current) return;
      setError(nextError);
    } finally {
      if (requestSequence !== requestSequenceRef.current) return;
      setLoading(false);
      setRefreshing(false);
    }
  }, [templateId]);

  useFocusEffect(useCallback(() => {
    if (templateId) void load();
    else {
      setLoading(false);
      setError(new Error('Vorlagen-ID fehlt.'));
    }
    return () => {
      requestSequenceRef.current += 1;
    };
  }, [load, templateId]));

  return {
    template,
    loading,
    refreshing,
    error,
    retry: load,
    refresh: useCallback(() => load({ refresh: true }), [load]),
  };
}
