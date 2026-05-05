import { supabase } from '../../../../services/supabaseClient';

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
      days: (days || []).map(day => ({
        ...day,
        exercises: exercises.filter(ex => ex.day_id === day.id),
      })),
    };
  } catch (e) {
    console.error('[Training] fetchTrainingPlan error:', e);
    throw e;
  }
}

export async function createTrainingPlan(planName, daysData) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Nicht eingeloggt');

  const { data: plan, error: planError } = await supabase
    .from('training_plans')
    .insert({ user_id: userId, name: planName })
    .select()
    .single();

  if (planError) throw planError;

  for (let i = 0; i < daysData.length; i++) {
    const day = daysData[i];

    const { data: createdDay, error: dayError } = await supabase
      .from('training_days')
      .insert({ plan_id: plan.id, name: day.name })
      .select()
      .single();

    if (dayError) throw dayError;

    const validExercises = day.exercises.filter(ex => ex.name.trim());
    for (let j = 0; j < validExercises.length; j++) {
      const ex = validExercises[j];
      const { error: exError } = await supabase
        .from('training_exercises')
        .insert({
          day_id: createdDay.id,
          name: ex.name.trim(),
          weight: ex.weight ? parseFloat(ex.weight) : null,
          sets: ex.sets ? parseInt(ex.sets, 10) : null,
          reps: ex.reps ? parseInt(ex.reps, 10) : null,
          note: ex.note || null,
        });

      if (exError) throw exError;
    }
  }

  return plan;
}

export async function addExerciseToDay(dayId, exerciseData) {
  const { data, error } = await supabase
    .from('training_exercises')
    .insert({
      day_id: dayId,
      name: exerciseData.name.trim(),
      weight: exerciseData.weight ? parseFloat(exerciseData.weight) : null,
      sets: exerciseData.sets ? parseInt(exerciseData.sets, 10) : null,
      reps: exerciseData.reps ? parseInt(exerciseData.reps, 10) : null,
      note: exerciseData.note || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateExercise(exerciseId, exerciseData) {
  const { data, error } = await supabase
    .from('training_exercises')
    .update({
      name: exerciseData.name.trim(),
      weight: exerciseData.weight ? parseFloat(exerciseData.weight) : null,
      sets: exerciseData.sets ? parseInt(exerciseData.sets, 10) : null,
      reps: exerciseData.reps ? parseInt(exerciseData.reps, 10) : null,
      note: exerciseData.note || null,
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
    .update({ name: newName.trim() })
    .eq('id', dayId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function addTrainingDay(planId, dayName) {
  const { data, error } = await supabase
    .from('training_days')
    .insert({ plan_id: planId, name: dayName.trim() })
    .select()
    .single();

  if (error) throw error;
  return data;
}
