import { logger } from '../../../../lib/logger';
import { supabase } from "../../../../services/supabaseClient";
import { getCurrentUserId } from '../../../../services/authUser';

function normalizeSessionType(value) {
  return value === 'run' ? 'run' : 'gym';
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

function isTrainingSessionSchemaError(error) {
  return ['session_type', 'run_duration_minutes', 'run_distance_km', 'run_pace', 'day_type']
    .some((columnName) => isMissingColumnError(error, columnName));
}

function throwMissingSessionSchemaError() {
  throw new Error('Die Trainings-Datenbank ist noch nicht vollständig migriert. Laufeinheiten brauchen die neuen Session-Spalten. Bitte Supabase-Migration ausführen und danach erneut versuchen.');
}

function safeText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function validateGymExercises(exercises = []) {
  if (!Array.isArray(exercises) || exercises.length === 0) {
    throw new Error('Diese Trainingseinheit braucht mindestens eine Übung.');
  }

  exercises.forEach((exercise, index) => {
    const exerciseName = safeText(exercise?.name) || `Übung ${index + 1}`;

    if (!safeText(exercise?.exerciseId)) {
      throw new Error(`${exerciseName}: Übungs-ID fehlt.`);
    }

    if (!safeText(exercise?.name)) {
      throw new Error(`Übung ${index + 1}: Name fehlt.`);
    }

    if (!isPositiveInteger(exercise?.sets)) {
      throw new Error(`${exerciseName}: Trage eine Satzzahl größer 0 ein.`);
    }

    if (!isPositiveInteger(exercise?.reps)) {
      throw new Error(`${exerciseName}: Trage Wiederholungen größer 0 ein.`);
    }
  });
}

async function cleanupSession(sessionId) {
  if (!sessionId) return;

  try {
    await supabase
      .from('training_sessions')
      .delete()
      .eq('id', sessionId);
  } catch (cleanupError) {
    logger.error('[Training Session] cleanupSession failed:', cleanupError);
  }
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

function mapSessionSummary(session) {
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
    runDurationMinutes: session.run_duration_minutes ?? null,
    runDistanceKm: session.run_distance_km ?? null,
    runPace: session.run_pace ?? null,
    metaText: sessionType === 'run'
      ? runMeta || 'Laufeinheit'
      : `${exerciseCount} ${exerciseCount === 1 ? 'Übung' : 'Übungen'}`,
  };
}

function mapSessionDetail(data) {
  const sessionType = normalizeSessionType(data.session_type || data.training_days?.day_type);

  return {
    id: data.id,
    performedAt: data.performed_at,
    note: data.note,
    sessionType,
    dayName: data.training_days?.name || (sessionType === 'run' ? 'Lauf' : 'Training'),
    runDurationMinutes: data.run_duration_minutes ?? null,
    runDistanceKm: data.run_distance_km ?? null,
    runPace: data.run_pace ?? null,
    runMetaText: sessionType === 'run' ? formatRunMeta(data) : '',
    exercises: data.training_session_exercises || [],
  };
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

  if (cleanSessionType === 'gym') {
    validateGymExercises(exercises);
  }

  const sessionPayload = {
    user_id: userId,
    plan_id: planId,
    day_id: dayId,
    session_type: cleanSessionType,
    note: note || null,
    run_duration_minutes: cleanSessionType === 'run' ? runDurationMinutes : null,
    run_distance_km: cleanSessionType === 'run' ? runDistanceKm : null,
    run_pace: cleanSessionType === 'run' ? runPace : null,
  };

  let { data: session, error: sessionError } = await supabase
    .from('training_sessions')
    .insert(sessionPayload)
    .select('id')
    .single();

  if (sessionError && isTrainingSessionSchemaError(sessionError)) {
    if (cleanSessionType === 'run') {
      throwMissingSessionSchemaError();
    }

    logger.warn('[Training Session] New session columns missing. Falling back to legacy gym session insert.');

    const legacyResult = await supabase
      .from('training_sessions')
      .insert({
        user_id: userId,
        plan_id: planId,
        day_id: dayId,
        note: note || null,
      })
      .select('id')
      .single();

    session = legacyResult.data;
    sessionError = legacyResult.error;
  }

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
        muscle_group: exercise.muscleGroup || exercise.muscle_group || 'Sonstiges',
      }))
    : [];

  if (exerciseRows.length > 0) {
    const { error: exercisesError } = await supabase
      .from('training_session_exercises')
      .insert(exerciseRows);

    if (exercisesError) {
      await cleanupSession(session.id);
      throw exercisesError;
    }
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

  let { data, error } = await query;

  if (error && isTrainingSessionSchemaError(error)) {
    logger.warn('[Training Sessions] New session/day columns missing. Falling back to legacy sessions query.');

    let legacyQuery = supabase
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
      legacyQuery = legacyQuery.limit(limit);
    }

    const legacyResult = await legacyQuery;
    data = legacyResult.data;
    error = legacyResult.error;
  }

  if (error) throw error;

  return (data || []).map(mapSessionSummary);
}

export async function fetchTrainingSessionDetail(sessionId) {
  let { data, error } = await supabase
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
        muscle_group,
        weight,
        sets,
        reps,
        note
      )
    `)
    .eq('id', sessionId)
    .single();

  if (error && isTrainingSessionSchemaError(error)) {
    logger.warn('[Training Session Detail] New session/day columns missing. Falling back to legacy detail query.');

    const legacyResult = await supabase
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

    data = legacyResult.data;
    error = legacyResult.error;
  }

  if (error) throw error;

  return mapSessionDetail(data);
}

export async function deleteTrainingSession(sessionId) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Nicht eingeloggt');
  if (!sessionId) throw new Error('Keine Trainingseinheit ausgewählt');

  const { error: ownershipError } = await supabase
    .from('training_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single();

  if (ownershipError) throw ownershipError;

  const { error: exercisesError } = await supabase
    .from('training_session_exercises')
    .delete()
    .eq('session_id', sessionId);

  if (exercisesError) throw exercisesError;

  const { error: sessionError } = await supabase
    .from('training_sessions')
    .delete()
    .eq('id', sessionId)
    .eq('user_id', userId);

  if (sessionError) throw sessionError;
}

