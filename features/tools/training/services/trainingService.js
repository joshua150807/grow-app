import { supabase } from '../../../../services/supabaseClient';
import { resolveMuscleGroup } from '../utils/muscleGroupUtils';

function safeText(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function parseOptionalNumber(value) {
  const text = safeText(value).replace(',', '.');
  if (!text) return null;

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalInteger(value) {
  const text = safeText(value);
  if (!text) return null;

  const parsed = parseInt(text, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePositiveInteger(value) {
  const parsed = parseOptionalInteger(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeDayType(value) {
  if (value === 'run') return 'run';
  if (value === 'rest') return 'rest';
  return 'gym';
}

function getDefaultDayName(type, index) {
  if (type === 'run') return `Laufen ${index + 1}`;
  if (type === 'rest') return `Rest ${index + 1}`;
  return `Tag ${index + 1}`;
}

function normalizeDaysData(daysData) {
  const days = Array.isArray(daysData) ? daysData : [];

  return days.map((day, index) => {
    const type = normalizeDayType(day?.type);
    const exercises = Array.isArray(day?.exercises) ? day.exercises : [];

    return {
      type,
      name: safeText(day?.name, getDefaultDayName(type, index)),
      exercises: type === 'gym'
        ? exercises
            .map((exercise) => ({
              name: safeText(exercise?.name),
              muscle_group: resolveMuscleGroup(exercise?.muscle_group ?? exercise?.muscleGroup, exercise?.name),
              weight: parseOptionalNumber(exercise?.weight),
              sets: parsePositiveInteger(exercise?.sets),
              reps: parsePositiveInteger(exercise?.reps),
              note: safeText(exercise?.note) || null,
            }))
            .filter((exercise) => exercise.name.length > 0)
        : [],
    };
  });
}

function validateTrainingDays(days) {
  const cleanDays = Array.isArray(days) ? days : [];

  if (!cleanDays.length) {
    throw new Error('Der Trainingsplan braucht mindestens einen Trainingstag.');
  }

  cleanDays.forEach((day, dayIndex) => {
    const dayType = normalizeDayType(day?.type);
    const dayName = day.name || getDefaultDayName(dayType, dayIndex);

    if (!safeText(day.name)) {
      throw new Error(`Tag ${dayIndex + 1} braucht einen Namen.`);
    }

    if (dayType === 'run' || dayType === 'rest') {
      return;
    }

    if (!Array.isArray(day.exercises) || day.exercises.length === 0) {
      throw new Error(`${dayName}: Füge mindestens eine Übung hinzu oder stelle den Tag auf Laufen/Rest.`);
    }

    day.exercises.forEach((exercise) => {
      if (!exercise.name) return;

      if (!Number.isInteger(exercise.sets) || exercise.sets <= 0) {
        throw new Error(`${dayName}: "${exercise.name}" braucht eine Satzzahl größer 0.`);
      }

      if (!Number.isInteger(exercise.reps) || exercise.reps <= 0) {
        throw new Error(`${dayName}: "${exercise.name}" braucht Wiederholungen größer 0.`);
      }
    });
  });
}


function isMissingColumnError(error, columnName) {
  const message = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
  return Boolean(
    columnName
    && error
    && (
      error.code === 'PGRST204'
      || error.code === '42703'
      || message.includes('column')
    )
    && message.includes(columnName.toLowerCase())
  );
}

function requiresDayTypeColumn(days) {
  return (days || []).some((day) => normalizeDayType(day?.type) !== 'gym');
}

function throwMissingTrainingSchemaError() {
  throw new Error('Die Trainings-Datenbank ist noch nicht vollständig migriert. Lauf- und Resttage brauchen die neue Spalte day_type. Bitte Supabase-Migration ausführen und danach erneut versuchen.');
}

async function insertTrainingDay(planId, day) {
  const payload = { plan_id: planId, name: day.name, day_type: day.type };
  const { data, error } = await supabase
    .from('training_days')
    .insert(payload)
    .select()
    .single();

  if (!error) return data;

  if (!isMissingColumnError(error, 'day_type')) {
    throw error;
  }

  if (normalizeDayType(day.type) !== 'gym') {
    throwMissingTrainingSchemaError();
  }

  console.warn('[Training] day_type column missing. Falling back to legacy gym day insert.');

  const { data: legacyData, error: legacyError } = await supabase
    .from('training_days')
    .insert({ plan_id: planId, name: day.name })
    .select()
    .single();

  if (legacyError) throw legacyError;
  return legacyData;
}

async function updateTrainingDayType(dayId, dayType) {
  const { error } = await supabase
    .from('training_days')
    .update({ day_type: normalizeDayType(dayType) })
    .eq('id', dayId);

  if (!error) return;

  if (isMissingColumnError(error, 'day_type')) {
    console.warn('[Training] day_type column missing. Skipping day_type update.');
    return;
  }

  throw error;
}

async function getCurrentUserId() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user?.id ?? null;
}

export async function fetchTrainingPlan() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.log('[Training] No user ID');
      return null;
    }

    const { data: plans, error: planError } = await supabase
      .from('training_plans')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1);

    if (planError) {
      console.error('[Training] Plans query error:', planError);
      throw planError;
    }
    if (!plans || plans.length === 0) {
      console.log('[Training] No plans found');
      return null;
    }

    const plan = plans[0];

    const { data: days, error: daysError } = await supabase
      .from('training_days')
      .select('*')
      .eq('plan_id', plan.id)
      .order('created_at', { ascending: true });

    if (daysError) {
      console.error('[Training] Days query error:', daysError);
      throw daysError;
    }

    const dayIds = (days || []).map(d => d.id);
    let exercises = [];

    if (dayIds.length > 0) {
      const { data: exData, error: exError } = await supabase
        .from('training_exercises')
        .select('*')
        .in('day_id', dayIds)
        .order('created_at', { ascending: true });

      if (exError) {
        console.error('[Training] Exercises query error:', exError);
        throw exError;
      }
      exercises = exData || [];
    }

    return {
      ...plan,
      days: (days || []).map(day => {
        const dayExercises = exercises.filter(ex => ex.day_id === day.id);
        return {
          ...day,
          // Ohne DB-Migration wird ein Lauftag als Tag ohne Übungen gespeichert.
          type: normalizeDayType(day.day_type || day.type),
          exercises: dayExercises.map((exercise) => ({
            ...exercise,
            muscle_group: resolveMuscleGroup(exercise.muscle_group, exercise.name),
          })),
        };
      }),
    };
  } catch (e) {
    console.error('[Training] fetchTrainingPlan error:', e);
    throw e;
  }
}


async function deleteTrainingDays(dayIds) {
  const cleanDayIds = Array.isArray(dayIds)
    ? dayIds.filter(Boolean)
    : [];

  if (cleanDayIds.length === 0) return;

  const { error: deleteExercisesError } = await supabase
    .from('training_exercises')
    .delete()
    .in('day_id', cleanDayIds);

  if (deleteExercisesError) throw deleteExercisesError;

  const { error: deleteDaysError } = await supabase
    .from('training_days')
    .delete()
    .in('id', cleanDayIds);

  if (deleteDaysError) throw deleteDaysError;
}

async function deletePlanTree(planId, userId) {
  if (!planId || !userId) return;

  const { data: existingDays, error: existingDaysError } = await supabase
    .from('training_days')
    .select('id')
    .eq('plan_id', planId);

  if (existingDaysError) throw existingDaysError;

  await deleteTrainingDays((existingDays || []).map((day) => day.id));

  const { error: deletePlanError } = await supabase
    .from('training_plans')
    .delete()
    .eq('id', planId)
    .eq('user_id', userId);

  if (deletePlanError) throw deletePlanError;
}

async function cleanupCreatedPlan(planId, userId) {
  try {
    await deletePlanTree(planId, userId);
  } catch (cleanupError) {
    console.error('[Training] cleanupCreatedPlan failed:', cleanupError);
  }
}

export async function createTrainingPlan(planName, daysData) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Nicht eingeloggt');

  const cleanPlanName = safeText(planName, 'Mein Trainingsplan');
  const cleanDaysData = normalizeDaysData(daysData);

  console.log('[Training] createTrainingPlan start', {
    planName: cleanPlanName,
    dayCount: cleanDaysData.length,
    gymDayCount: cleanDaysData.filter((day) => day.type === 'gym').length,
    runDayCount: cleanDaysData.filter((day) => day.type === 'run').length,
    restDayCount: cleanDaysData.filter((day) => day.type === 'rest').length,
    exerciseCount: cleanDaysData.reduce((sum, day) => sum + day.exercises.length, 0),
  });

  validateTrainingDays(cleanDaysData);

  if (requiresDayTypeColumn(cleanDaysData)) {
    const { error: schemaProbeError } = await supabase
      .from('training_days')
      .select('day_type')
      .limit(1);

    if (isMissingColumnError(schemaProbeError, 'day_type')) {
      throwMissingTrainingSchemaError();
    }

    if (schemaProbeError) throw schemaProbeError;
  }

  const { data: existingPlans, error: existingPlanError } = await supabase
    .from('training_plans')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (existingPlanError) throw existingPlanError;

  const oldPlanIds = (existingPlans || []).map((existingPlan) => existingPlan.id);
  const targetPlanId = oldPlanIds[0] || null;

  async function insertPlanContent(planId) {
    const createdDayIds = [];

    try {
      for (let i = 0; i < cleanDaysData.length; i++) {
        const day = cleanDaysData[i];
        const createdDay = await insertTrainingDay(planId, day);
        createdDayIds.push(createdDay.id);

        for (let j = 0; j < day.exercises.length; j++) {
          const ex = day.exercises[j];

          const { error: exError } = await supabase
            .from('training_exercises')
            .insert({
              day_id: createdDay.id,
              name: ex.name,
              muscle_group: ex.muscle_group,
              weight: ex.weight,
              sets: ex.sets,
              reps: ex.reps,
              note: ex.note,
            });

          if (exError) throw exError;
        }
      }

      return createdDayIds;
    } catch (contentError) {
      await deleteTrainingDays(createdDayIds);
      throw contentError;
    }
  }

  if (targetPlanId) {
    const { data: oldDays, error: oldDaysError } = await supabase
      .from('training_days')
      .select('id')
      .eq('plan_id', targetPlanId);

    if (oldDaysError) throw oldDaysError;

    const oldDayIds = (oldDays || []).map((day) => day.id);

    const { data: updatedPlan, error: updatePlanError } = await supabase
      .from('training_plans')
      .update({ name: cleanPlanName })
      .eq('id', targetPlanId)
      .eq('user_id', userId)
      .select()
      .single();

    if (updatePlanError) throw updatePlanError;

    await insertPlanContent(targetPlanId);
    await deleteTrainingDays(oldDayIds);

    for (const extraPlanId of oldPlanIds.slice(1)) {
      await deletePlanTree(extraPlanId, userId);
    }

    console.log('[Training] createTrainingPlan success', { planId: updatedPlan.id });
    return updatedPlan;
  }

  let plan = null;

  try {
    const { data: createdPlan, error: planError } = await supabase
      .from('training_plans')
      .insert({ user_id: userId, name: cleanPlanName })
      .select()
      .single();

    if (planError) throw planError;
    plan = createdPlan;

    await insertPlanContent(plan.id);
  } catch (creationError) {
    if (plan?.id) {
      await cleanupCreatedPlan(plan.id, userId);
    }
    throw creationError;
  }

  console.log('[Training] createTrainingPlan success', { planId: plan.id });
  return plan;
}

export async function addExerciseToDay(dayId, exerciseData) {
  const cleanExercise = {
    name: safeText(exerciseData?.name),
    muscle_group: resolveMuscleGroup(exerciseData?.muscle_group ?? exerciseData?.muscleGroup, exerciseData?.name),
    weight: parseOptionalNumber(exerciseData?.weight),
    sets: parsePositiveInteger(exerciseData?.sets),
    reps: parsePositiveInteger(exerciseData?.reps),
    note: safeText(exerciseData?.note) || null,
  };

  validateTrainingDays([{ type: 'gym', name: 'Neue Übung', exercises: [cleanExercise] }]);

  const { data, error } = await supabase
    .from('training_exercises')
    .insert({
      day_id: dayId,
      name: cleanExercise.name,
      muscle_group: cleanExercise.muscle_group,
      weight: cleanExercise.weight,
      sets: cleanExercise.sets,
      reps: cleanExercise.reps,
      note: cleanExercise.note,
    })
    .select()
    .single();

  if (error) throw error;

  await updateTrainingDayType(dayId, 'gym');

  return data;
}

export async function updateExercise(exerciseId, exerciseData) {
  const cleanExercise = {
    name: safeText(exerciseData?.name),
    muscle_group: resolveMuscleGroup(exerciseData?.muscle_group ?? exerciseData?.muscleGroup, exerciseData?.name),
    weight: parseOptionalNumber(exerciseData?.weight),
    sets: parsePositiveInteger(exerciseData?.sets),
    reps: parsePositiveInteger(exerciseData?.reps),
    note: safeText(exerciseData?.note) || null,
  };

  validateTrainingDays([{ type: 'gym', name: 'Übung bearbeiten', exercises: [cleanExercise] }]);

  const { data, error } = await supabase
    .from('training_exercises')
    .update({
      name: cleanExercise.name,
      muscle_group: cleanExercise.muscle_group,
      weight: cleanExercise.weight,
      sets: cleanExercise.sets,
      reps: cleanExercise.reps,
      note: cleanExercise.note,
    })
    .eq('id', exerciseId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteExercise(exerciseId) {
  const { error } = await supabase
    .from('training_exercises')
    .delete()
    .eq('id', exerciseId);

  if (error) throw error;
}

export async function deleteTrainingPlan(planId) {
  const { error } = await supabase
    .from('training_plans')
    .delete()
    .eq('id', planId);

  if (error) throw error;
}

export async function renameTrainingDay(dayId, newName) {
  const { data, error } = await supabase
    .from('training_days')
    .update({ name: safeText(newName, 'Trainingstag') })
    .eq('id', dayId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function addTrainingDay(planId, dayName, dayType = 'gym') {
  const cleanDayType = normalizeDayType(dayType);

  const cleanName = safeText(dayName, getDefaultDayName(cleanDayType, 0));

  if (cleanDayType !== 'gym') {
    const { error: schemaProbeError } = await supabase
      .from('training_days')
      .select('day_type')
      .limit(1);

    if (isMissingColumnError(schemaProbeError, 'day_type')) {
      throwMissingTrainingSchemaError();
    }

    if (schemaProbeError) throw schemaProbeError;
  }

  return insertTrainingDay(planId, { name: cleanName, type: cleanDayType });
}