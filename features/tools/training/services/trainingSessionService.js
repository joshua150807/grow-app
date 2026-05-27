import { supabase } from "../../../../services/supabaseClient";

function normalizeSessionType(value) {
  return value === 'run' ? 'run' : 'gym';
}

function formatRunMeta(session) {
  const parts = [];

  if (session.run_distance_km !== null && session.run_distance_km !== undefined) {
    parts.push(`${Number(session.run_distance_km).toString().replace('.', ',')} km`);
  }

  if (session.run_duration_minutes !== null && session.run_duration_minutes !== undefined) {
    parts.push(`${session.run_duration_minutes} Min.`);
  }

  if (session.run_pace) {
    parts.push(`${session.run_pace} Pace`);
  }

  return parts.join(' · ');
}

export async function createTrainingSession({
  userId,
  planId,
  dayId,
  sessionType = 'gym',
  note,
  exercises = [],
  runDurationMinutes = null,
  runDistanceKm = null,
  runPace = null,
}) {
  const cleanSessionType = normalizeSessionType(sessionType);

  const { data: session, error: sessionError } = await supabase
    .from('training_sessions')
    .insert({
      user_id: userId,
      plan_id: planId,
      day_id: dayId,
      session_type: cleanSessionType,
      note: note || null,
      run_duration_minutes: cleanSessionType === 'run' ? runDurationMinutes : null,
      run_distance_km: cleanSessionType === 'run' ? runDistanceKm : null,
      run_pace: cleanSessionType === 'run' ? runPace : null,
    })
    .select('id')
    .single();

  if (sessionError) throw sessionError;

  const exerciseRows = cleanSessionType === 'gym'
    ? exercises.map(exercise => ({
        session_id: session.id,
        exercise_id: exercise.exerciseId,
        exercise_name: exercise.name,
        weight: exercise.weight,
        sets: exercise.sets,
        reps: exercise.reps,
        note: exercise.note || null,
      }))
    : [];

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
      session_type,
      run_duration_minutes,
      run_distance_km,
      run_pace,
      training_days (
        id,
        name,
        day_type
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

  return (data || []).map(session => {
    const sessionType = normalizeSessionType(session.session_type || session.training_days?.day_type);
    const exerciseCount = session.training_session_exercises?.length || 0;
    const runMeta = sessionType === 'run' ? formatRunMeta(session) : '';

    return {
      id: session.id,
      performedAt: session.performed_at,
      sessionType,
      dayName: session.training_days?.name || (sessionType === 'run' ? 'Lauf' : 'Training'),
      exerciseCount,
      note: session.note,
      runDurationMinutes: session.run_duration_minutes,
      runDistanceKm: session.run_distance_km,
      runPace: session.run_pace,
      metaText: sessionType === 'run'
        ? runMeta || 'Laufeinheit'
        : `${exerciseCount} ${exerciseCount === 1 ? 'Übung' : 'Übungen'}`,
    };
  });
}

export async function fetchTrainingSessionDetail(sessionId) {
  const { data, error } = await supabase
    .from('training_sessions')
    .select(`
      id,
      performed_at,
      note,
      session_type,
      run_duration_minutes,
      run_distance_km,
      run_pace,
      training_days (
        id,
        name,
        day_type
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

  const sessionType = normalizeSessionType(data.session_type || data.training_days?.day_type);

  return {
    id: data.id,
    performedAt: data.performed_at,
    note: data.note,
    sessionType,
    dayName: data.training_days?.name || (sessionType === 'run' ? 'Lauf' : 'Training'),
    runDurationMinutes: data.run_duration_minutes,
    runDistanceKm: data.run_distance_km,
    runPace: data.run_pace,
    runMetaText: sessionType === 'run' ? formatRunMeta(data) : '',
    exercises: data.training_session_exercises || [],
  };
}