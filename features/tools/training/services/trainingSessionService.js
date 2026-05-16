import { supabase } from "../../../../services/supabaseClient";

const MAX_STORED_SESSIONS = 5;

async function deleteOlderTrainingSessions(userId) {
  const { data: sessions, error: fetchError } = await supabase
    .from('training_sessions')
    .select('id, performed_at, created_at')
    .eq('user_id', userId)
    .order('performed_at', { ascending: false })
    .order('created_at', { ascending: false });

  if (fetchError) throw fetchError;

  if (!sessions || sessions.length <= MAX_STORED_SESSIONS) {
    return;
  }

  const oldSessionIds = sessions
    .slice(MAX_STORED_SESSIONS)
    .map(session => session.id);

  if (oldSessionIds.length === 0) {
    return;
  }

  const { error: deleteError } = await supabase
    .from('training_sessions')
    .delete()
    .in('id', oldSessionIds)
    .eq('user_id', userId);

  if (deleteError) throw deleteError;
}

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

  await deleteOlderTrainingSessions(userId);

  return session;
}
export async function fetchLatestTrainingSessions(limit = 5) {
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
        id
      )
    `)
    .order('performed_at', { ascending: false })
    .limit(limit);

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