import { supabase } from '../../../../services/supabaseClient';

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
          exercises: dayExercises,
        };
      }),
    };
  } catch (e) {
    console.error('[Training] fetchTrainingPlan error:', e);
    throw e;
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

  // Erst validieren, dann bestehenden Plan löschen/ersetzen.
  validateTrainingDays(cleanDaysData);

  // 1. Bestehenden Plan suchen
  const { data: existingPlans, error: existingPlanError } = await supabase
    .from('training_plans')
    .select('id')
    .eq('user_id', userId)
    .limit(1);

  if (existingPlanError) throw existingPlanError;

  const existingPlan = existingPlans?.[0];

  // 2. Falls vorhanden: alten Plan sauber löschen
  if (existingPlan?.id) {
    const { data: existingDays, error: existingDaysError } = await supabase
      .from('training_days')
      .select('id')
      .eq('plan_id', existingPlan.id);

    if (existingDaysError) throw existingDaysError;

    const existingDayIds = (existingDays || []).map((day) => day.id);

    if (existingDayIds.length > 0) {
      const { error: deleteExercisesError } = await supabase
        .from('training_exercises')
        .delete()
        .in('day_id', existingDayIds);

      if (deleteExercisesError) throw deleteExercisesError;

      const { error: deleteDaysError } = await supabase
        .from('training_days')
        .delete()
        .eq('plan_id', existingPlan.id);

      if (deleteDaysError) throw deleteDaysError;
    }

    const { error: deletePlanError } = await supabase
      .from('training_plans')
      .delete()
      .eq('id', existingPlan.id)
      .eq('user_id', userId);

    if (deletePlanError) throw deletePlanError;
  }

  // 3. Neuen Plan erstellen
  const { data: plan, error: planError } = await supabase
    .from('training_plans')
    .insert({ user_id: userId, name: cleanPlanName })
    .select()
    .single();

  if (planError) throw planError;

  // 4. Neue Trainingstage + Übungen erstellen
  for (let i = 0; i < cleanDaysData.length; i++) {
    const day = cleanDaysData[i];

    const { data: createdDay, error: dayError } = await supabase
      .from('training_days')
      .insert({ plan_id: plan.id, name: day.name, day_type: day.type })
      .select()
      .single();

    if (dayError) throw dayError;

    for (let j = 0; j < day.exercises.length; j++) {
      const ex = day.exercises[j];

      const { error: exError } = await supabase
        .from('training_exercises')
        .insert({
          day_id: createdDay.id,
          name: ex.name,
          weight: ex.weight,
          sets: ex.sets,
          reps: ex.reps,
          note: ex.note,
        });

      if (exError) throw exError;
    }
  }

  console.log('[Training] createTrainingPlan success', { planId: plan.id });
  return plan;
}

export async function addExerciseToDay(dayId, exerciseData) {
  const cleanExercise = {
    name: safeText(exerciseData?.name),
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
      weight: cleanExercise.weight,
      sets: cleanExercise.sets,
      reps: cleanExercise.reps,
      note: cleanExercise.note,
    })
    .select()
    .single();

  if (error) throw error;

  await supabase
    .from('training_days')
    .update({ day_type: 'gym' })
    .eq('id', dayId);

  return data;
}

export async function updateExercise(exerciseId, exerciseData) {
  const cleanExercise = {
    name: safeText(exerciseData?.name),
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

  const { data, error } = await supabase
    .from('training_days')
    .insert({ plan_id: planId, name: safeText(dayName, getDefaultDayName(cleanDayType, 0)), day_type: cleanDayType })
    .select()
    .single();

  if (error) throw error;
  return data;
}