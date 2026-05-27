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

export function useTrainingPlan() {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const planRef = useRef(plan);
  planRef.current = plan;

  const loadPlan = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
    }

    setError(null);

    try {
      const data = await fetchTrainingPlan();
      setPlan(data);
    } catch (e) {
      console.error('[Training Hook] Load error:', e);
      setError('Trainingsplan konnte nicht geladen werden.');
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  const savePlan = useCallback(async (planName, daysData) => {
    const createdPlan = await createTrainingPlan(planName, daysData);

    try {
      await loadPlan();
    } catch (e) {
      console.error('[Training Hook] Reload after save failed:', e);

      // Fallback, damit SetupView nicht fälschlich einen Fehler zeigt.
      setPlan({
        ...createdPlan,
        days: daysData.map((day, index) => ({
          id: `temp-day-${index}`,
          name: day.name,
          type: day.type || 'gym',
          day_type: day.type || 'gym',
          exercises: day.exercises || [],
        })),
      });
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