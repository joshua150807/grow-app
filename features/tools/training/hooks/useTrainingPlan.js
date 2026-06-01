import { useState, useCallback, useEffect, useRef } from 'react';

import {
  fetchTrainingPlan,
  createTrainingPlan,
  addExerciseToDay,
  updateExercise as updateExerciseService,
  deleteExercise as deleteExerciseService,
  deleteTrainingPlan as deleteTrainingPlanService,
  renameTrainingDay as renameTrainingDayService,
  addTrainingDay as addTrainingDayService,
} from '../services/trainingService';
import { getPreloadedToolData, setPreloadedToolData, clearPreloadedToolData } from '../../../../lib/preloadedTools';

export function useTrainingPlan() {
  const preloadedPlan = getPreloadedToolData('trainingPlan');
  const [plan, setPlan] = useState(() => preloadedPlan ?? null);
  const [loading, setLoading] = useState(!preloadedPlan);
  const [error, setError] = useState(null);
  const planRef = useRef(plan);
  const mountedRef = useRef(true);
  planRef.current = plan;

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadPlan = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
    }

    setError(null);

    try {
      const data = await fetchTrainingPlan();
      if (!mountedRef.current) return;

      setPlan(data);
      setPreloadedToolData('trainingPlan', data);
    } catch (e) {
      console.error('[Training Hook] Load error:', e);
      if (!mountedRef.current) return;

      setError('Trainingsplan konnte nicht geladen werden. Deine vorhandenen lokalen Daten bleiben bis zum erneuten Versuch sichtbar.');
    } finally {
      if (!silent) {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    }
  }, []);

  useEffect(() => {
    loadPlan({ silent: Boolean(preloadedPlan) });
  }, [loadPlan]);

  const savePlan = useCallback(async (planName, daysData) => {
    const createdPlan = await createTrainingPlan(planName, daysData);

    try {
      await loadPlan();
    } catch (e) {
      console.error('[Training Hook] Reload after save failed:', e);

      // Fallback, damit SetupView nicht fälschlich einen Fehler zeigt.
      const fallbackPlan = {
        ...createdPlan,
        days: daysData.map((day, index) => ({
          id: `temp-day-${index}`,
          name: day.name,
          type: day.type || 'gym',
          day_type: day.type || 'gym',
          exercises: day.exercises || [],
        })),
      };
      setPlan(fallbackPlan);
      setPreloadedToolData('trainingPlan', fallbackPlan);
    }
  }, [loadPlan]);

  const addExercise = useCallback(async (dayId, exerciseData) => {
    await addExerciseToDay(dayId, exerciseData);
    await loadPlan();
  }, [loadPlan]);

  const updateExercise = useCallback(async (exerciseId, exerciseData) => {
    await updateExerciseService(exerciseId, exerciseData);
    await loadPlan();
  }, [loadPlan]);

  const removeExercise = useCallback(async (exerciseId) => {
    await deleteExerciseService(exerciseId);
    await loadPlan();
  }, [loadPlan]);

  const removePlan = useCallback(async () => {
    const currentPlan = planRef.current;

    if (!currentPlan?.id) return;

    await deleteTrainingPlanService(currentPlan.id);
    setPlan(null);
    clearPreloadedToolData('trainingPlan');
  }, []);

  const renameDay = useCallback(async (dayId, newName) => {
    await renameTrainingDayService(dayId, newName);
    await loadPlan();
  }, [loadPlan]);

  const addDay = useCallback(async (dayName, dayType = 'gym') => {
    const currentPlan = planRef.current;
    if (!currentPlan) return;
    await addTrainingDayService(currentPlan.id, dayName, dayType);
    await loadPlan();
  }, [loadPlan]);

  return {
    plan,
    loading,
    error,
    loadPlan,
    savePlan,
    addExercise,
    updateExercise,
    removeExercise,
    removePlan,
    renameDay,
    addDay,
  };
}