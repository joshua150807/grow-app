import { supabase } from "../../../../services/supabaseClient";

export async function createTrainingSession({ userId, planId, dayId, note, exercises }) {
  const { data: session, error: sessionError } = await supabase
    .from('training_sessions')
    .insert({
      user_id: userId,
      plan_id: planId,
      day_id: dayId,
      note: note || null,
    })
    .select('id')
    .single();

  if (sessionError) throw sessionError;

  const exerciseRows = exercises.map(exercise => ({
    session_id: session.id,
    exercise_id: exercise.exerciseId,
    exercise_name: exercise.name,
    weight: exercise.weight,
    sets: exercise.sets,
    reps: exercise.reps,
    note: exercise.note || null,
  }));

  if (exerciseRows.length > 0) {
    const { error: exercisesError } = await supabase
      .from('training_session_exercises')
      .insert(exerciseRows);

    if (exercisesError) throw exercisesError;
  }

  return session;
}

export async function fetchLatestTrainingSessions(limit = null) {
  let query = supabase
    .from('training_sessions')
    .select(`
      id,
      performed_at,
      note,
      training_days (
        id,
        name
      ),
      training_session_exercises (
        id
      )
    `)
    .order('performed_at', { ascending: false });

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data || []).map(session => ({
    id: session.id,
    performedAt: session.performed_at,
    dayName: session.training_days?.name || 'Training',
    exerciseCount: session.training_session_exercises?.length || 0,
    note: session.note,
  }));
}

export async function fetchTrainingSessionDetail(sessionId) {
  const { data, error } = await supabase
    .from('training_sessions')
    .select(`
      id,
      performed_at,
      note,
      training_days (
        id,
        name
      ),
      training_session_exercises (
        id,
        exercise_name,
        weight,
        sets,
        reps,
        note
      )
    `)
    .eq('id', sessionId)
    .single();

  if (error) throw error;

  return {
    id: data.id,
    performedAt: data.performed_at,
    note: data.note,
    dayName: data.training_days?.name || 'Training',
    exercises: data.training_session_exercises || [],
  };
}