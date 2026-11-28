import { trainingRecordsResponseSchema, trainingProgressResponseSchema, trainingExerciseProgressResponseSchema } from '@grow/shared';
import {
  createTrainingExerciseInputSchema,
  createTrainingPlanInputSchema,
  createTrainingSessionInputSchema,
  lastExerciseNoteResponseSchema,
  lastExerciseSetsResponseSchema,
  listTrainingExercisesResponseSchema,
  listTrainingPlansResponseSchema,
  listTrainingSessionHistoryResponseSchema,
  listTrainingTemplatesResponseSchema,
  lookupTrainingExercisesResponseSchema,
  planVersionInputSchema,
  scheduleTrainingPlanInputSchema,
  templateUserPlanResponseSchema,
  trainingExerciseDetailResponseSchema,
  trainingPlanDetailResponseSchema,
  trainingSessionDetailResponseSchema,
  trainingSessionHistoryResponseSchema,
  trainingSessionStatsResponseSchema,
  trainingTemplateDetailResponseSchema,
  updateTrainingPlanInputSchema,
  updateWeeklyGoalInputSchema,
} from '@grow/shared';

import { supabase } from '../../../../services/supabaseClient';

export class TrainingV2ApiError extends Error {
  constructor(message, { status = null, code = null } = {}) {
    super(message);
    this.name = 'TrainingV2ApiError';
    this.status = status;
    this.code = code;
  }
}

export class TrainingV2AuthError extends TrainingV2ApiError {
  constructor(code = 'UNAUTHORIZED') {
    super('Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.', { status: 401, code });
    this.name = 'TrainingV2AuthError';
  }
}

export class TrainingV2NotFoundError extends TrainingV2ApiError {
  constructor(code = 'NOT_FOUND') {
    super('Der angeforderte Trainingsplan wurde nicht gefunden.', { status: 404, code });
    this.name = 'TrainingV2NotFoundError';
  }
}

export class TrainingV2ConflictError extends TrainingV2ApiError {
  constructor(code = 'CONFLICT') {
    super('Die Trainingsdaten haben sich zwischenzeitlich geändert.', { status: 409, code });
    this.name = 'TrainingV2ConflictError';
  }
}

export class TrainingV2NetworkError extends TrainingV2ApiError {
  constructor() {
    super('Die Trainingsdaten konnten nicht geladen werden. Prüfe deine Verbindung.', {
      code: 'TRAINING_V2_NETWORK_ERROR',
    });
    this.name = 'TrainingV2NetworkError';
  }
}

export class TrainingV2ContractError extends TrainingV2ApiError {
  constructor() {
    super('Die Trainingsdaten konnten nicht sicher gelesen werden.', {
      code: 'TRAINING_V2_CONTRACT_ERROR',
    });
    this.name = 'TrainingV2ContractError';
  }
}

export class TrainingV2HistoryUnavailableError extends TrainingV2ApiError {
  constructor() {
    super('Die Trainingshistorie ist mit dieser API-Version noch nicht verfuegbar.', {
      code: 'TRAINING_V2_HISTORY_UNAVAILABLE',
    });
    this.name = 'TrainingV2HistoryUnavailableError';
  }
}

// No fallback to legacy summaries: their missing aggregates are unknown, not zero.
async function requestSessionHistory(path, schema) {
  try {
    return await requestTrainingV2(path, schema);
  } catch (error) {
    if (error.status === 404 && error.code !== 'TRAINING_SESSION_NOT_FOUND') {
      throw new TrainingV2HistoryUnavailableError();
    }
    throw error;
  }
}

export class TrainingV2ValidationError extends TrainingV2ApiError {
  constructor(code = 'VALIDATION_ERROR', fieldErrors = {}) {
    super('Bitte überprüfe deine Eingaben.', { status: 400, code });
    this.name = 'TrainingV2ValidationError';
    this.fieldErrors = fieldErrors;
  }
}

function apiBaseUrl() {
  const value = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!value) {
    throw new TrainingV2ApiError('Die Training-API ist nicht konfiguriert.', {
      code: 'TRAINING_V2_API_URL_MISSING',
    });
  }

  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported protocol');
    return url.toString().replace(/\/+$/, '');
  } catch {
    throw new TrainingV2ApiError('Die Training-API ist nicht korrekt konfiguriert.', {
      code: 'TRAINING_V2_API_URL_INVALID',
    });
  }
}

async function responseJson(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new TrainingV2ContractError();
  }
}

function responseError(status, code, details) {
  if (status === 400) return new TrainingV2ValidationError(code, details?.fieldErrors ?? {});
  if (status === 401) return new TrainingV2AuthError(code);
  if (status === 404) return new TrainingV2NotFoundError(code);
  if (status === 409) return new TrainingV2ConflictError(code);
  if (status >= 500 || code === 'INTERNAL_ERROR') return new TrainingV2ContractError();
  return new TrainingV2ApiError('Die Training-API hat die Anfrage abgelehnt.', { status, code });
}

async function callTrainingV2(path, { method = 'GET', body, expectedOwnerId } = {}, schema) {
  const baseUrl = apiBaseUrl();
  const {
    data: { session } = {},
    error,
  } = await supabase.auth.getSession();

  if (error || !session?.access_token) {
    throw new TrainingV2AuthError(error ? 'TRAINING_V2_SESSION_ERROR' : 'UNAUTHORIZED');
  }
  if (expectedOwnerId && session.user?.id !== expectedOwnerId) throw new TrainingV2AuthError('TRAINING_V2_OWNER_CHANGED');

  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new TrainingV2NetworkError();
  }

  const payload = await responseJson(response);
  // Never publish an old owner's response into the next account's screen/cache.
  // Token refresh for the same owner remains valid.
  if (session.user?.id) {
    const { data: current, error: currentError } = await supabase.auth.getSession();
    if (currentError || current?.session?.user?.id !== session.user.id) throw new TrainingV2AuthError('TRAINING_V2_OWNER_CHANGED');
  }
  if (!response.ok) {
    throw responseError(response.status, payload?.error?.code ?? 'TRAINING_V2_REQUEST_FAILED', payload?.error?.details);
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new TrainingV2ContractError();
  return parsed.data;
}

export async function requestTrainingV2(path, schema) {
  return callTrainingV2(path, { method: 'GET' }, schema);
}

export async function listTrainingV2Plans() {
  return (await requestTrainingV2('/v1/training/plans', listTrainingPlansResponseSchema)).plans;
}

export async function getTrainingV2Plan(planId) {
  return (await requestTrainingV2(
    `/v1/training/plans/${encodeURIComponent(planId)}`,
    trainingPlanDetailResponseSchema,
  )).plan;
}

export async function getTrainingV2Exercise(exerciseId) {
  return (await requestTrainingV2(
    `/v1/training/exercises/${encodeURIComponent(exerciseId)}`,
    trainingExerciseDetailResponseSchema,
  )).exercise;
}

export async function createTrainingV2Exercise(input) {
  const body = parseTrainingV2Input(createTrainingExerciseInputSchema, input);
  return (await callTrainingV2(
    '/v1/training/exercises',
    { method: 'POST', body },
    trainingExerciseDetailResponseSchema,
  )).exercise;
}

export async function listTrainingV2Exercises(query = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    searchParams.set(key, String(value));
  });
  const queryString = searchParams.toString();
  return requestTrainingV2(
    `/v1/training/exercises${queryString ? `?${queryString}` : ''}`,
    listTrainingExercisesResponseSchema,
  );
}

function parseTrainingV2Input(schema, input) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || '_root';
      fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
    }
    throw new TrainingV2ValidationError('TRAINING_V2_CLIENT_VALIDATION_ERROR', fieldErrors);
  }
  return parsed.data;
}

export async function createTrainingV2Plan(input, { ownerId } = {}) {
  const body = parseTrainingV2Input(createTrainingPlanInputSchema, input);
  return (await callTrainingV2(
    '/v1/training/plans',
    { method: 'POST', body, expectedOwnerId: ownerId },
    trainingPlanDetailResponseSchema,
  )).plan;
}

export async function updateTrainingV2Plan(planId, input) {
  const body = parseTrainingV2Input(updateTrainingPlanInputSchema, input);
  return (await callTrainingV2(
    `/v1/training/plans/${encodeURIComponent(planId)}`,
    { method: 'PATCH', body },
    trainingPlanDetailResponseSchema,
  )).plan;
}

export async function activateTrainingV2Plan(planId, expectedVersion) {
  const body = parseTrainingV2Input(planVersionInputSchema, { expectedVersion });
  return (await callTrainingV2(
    `/v1/training/plans/${encodeURIComponent(planId)}/activate`,
    { method: 'POST', body },
    trainingPlanDetailResponseSchema,
  )).plan;
}

export async function reactivateTrainingV2Plan(planId, expectedVersion) {
  const body = parseTrainingV2Input(planVersionInputSchema, { expectedVersion });
  return (await callTrainingV2(
    `/v1/training/plans/${encodeURIComponent(planId)}/reactivate`,
    { method: 'POST', body },
    trainingPlanDetailResponseSchema,
  )).plan;
}

export async function archiveTrainingV2Plan(planId, expectedVersion) {
  const body = parseTrainingV2Input(planVersionInputSchema, { expectedVersion });
  return (await callTrainingV2(
    `/v1/training/plans/${encodeURIComponent(planId)}/archive`,
    { method: 'POST', body },
    trainingPlanDetailResponseSchema,
  )).plan;
}

export async function scheduleTrainingV2Plan(planId, expectedVersion, startDate, timeZone) {
  const body = parseTrainingV2Input(scheduleTrainingPlanInputSchema, { expectedVersion, startDate, timeZone });
  return (await callTrainingV2(
    `/v1/training/plans/${encodeURIComponent(planId)}/schedule`,
    { method: 'POST', body },
    trainingPlanDetailResponseSchema,
  )).plan;
}

// Returns the full { session, created } envelope, not just the session, so a caller can tell
// a genuinely new save apart from an idempotent replay of an already-saved request.
export async function createTrainingV2Session(input) {
  const body = parseTrainingV2Input(createTrainingSessionInputSchema, input);
  return callTrainingV2(
    '/v1/training/sessions',
    { method: 'POST', body },
    trainingSessionDetailResponseSchema,
  );
}

// History/dashboard read path: paginated list of the caller's own past sessions (newest
// first, no filters), and a single session's full snapshot by id. Neither call ever 404s for
// "not visible any more" the way a plan read can — a session keeps meaning what it meant
// even after its source plan is edited, archived or deleted server-side.
export async function listTrainingV2Sessions(query = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    searchParams.set(key, String(value));
  });
  const queryString = searchParams.toString();
  return requestSessionHistory(
    `/v1/training/session-history${queryString ? `?${queryString}` : ''}`,
    listTrainingSessionHistoryResponseSchema,
  );
}

export async function getTrainingV2Session(sessionId) {
  return (await requestSessionHistory(
    `/v1/training/session-history/${encodeURIComponent(sessionId)}`,
    trainingSessionHistoryResponseSchema,
  )).session;
}

// Owner-scoped totals across all saved sessions, independent of history pagination.
export async function getTrainingV2SessionStats() {
  try {
    return await requestSessionHistory('/v1/training/sessions/stats', trainingSessionStatsResponseSchema);
  } catch (error) {
    // Older APIs match 'stats' as a session ID and reject it during parameter validation.
    if (error.status === 400 && error.code === 'TRAINING_SESSION_VALIDATION_ERROR' && error.fieldErrors.sessionId) {
      throw new TrainingV2HistoryUnavailableError();
    }
    throw error;
  }
}

// Read-only lookup for the "Letzte Notiz" hint (last note left on this exercise in any past
// session) — never 404s, since "no note yet" is a normal result, not an error.
export async function getTrainingV2LastExerciseNote(exerciseId) {
  return requestTrainingV2(
    `/v1/training/exercises/${encodeURIComponent(exerciseId)}/last-note`,
    lastExerciseNoteResponseSchema,
  );
}

// Read-only lookup for the grey "last time" placeholders in the session screen: this exercise's
// sets from the most recent saved session. An API without this route (404) just means no hint.
export async function getTrainingV2LastExerciseSets(exerciseId) {
  try {
    return await requestTrainingV2(
      `/v1/training/exercises/${encodeURIComponent(exerciseId)}/last-sets`,
      lastExerciseSetsResponseSchema,
    );
  } catch (error) {
    if (error?.status === 404) return { completedAt: null, sets: [] };
    throw error;
  }
}

export async function updateTrainingV2WeeklyGoal(planId, expectedVersion, weeklyGoal) {
  const body = parseTrainingV2Input(updateWeeklyGoalInputSchema, { expectedVersion, weeklyGoal });
  return (await callTrainingV2(
    `/v1/training/plans/${encodeURIComponent(planId)}/weekly-goal`,
    { method: 'PUT', body },
    trainingPlanDetailResponseSchema,
  )).plan;
}

// DELETE /training/plans/:id responds 204 No Content — there is no shared response schema
// for an empty body, so this trivial pass-through stands in for one rather than inventing a
// one-off schema in @grow/shared for a single endpoint with nothing to validate.
const emptyResponseSchema = { safeParse: (value) => ({ success: true, data: value }) };

export async function deleteTrainingV2Plan(planId) {
  await callTrainingV2(
    `/v1/training/plans/${encodeURIComponent(planId)}`,
    { method: 'DELETE' },
    emptyResponseSchema,
  );
}

export async function listTrainingV2Templates() {
  return (await requestTrainingV2('/v1/training/templates', listTrainingTemplatesResponseSchema)).templates;
}

export async function getTrainingV2Template(templateId) {
  return callTrainingV2(
    `/v1/training/templates/${encodeURIComponent(templateId)}`,
    { method: 'GET' },
    trainingTemplateDetailResponseSchema,
  );
}

export async function saveTrainingV2Template(templateId) {
  return (await callTrainingV2(
    `/v1/training/templates/${encodeURIComponent(templateId)}/save`,
    { method: 'PUT' },
    templateUserPlanResponseSchema,
  )).userPlan;
}

export async function unsaveTrainingV2Template(templateId) {
  return (await callTrainingV2(
    `/v1/training/templates/${encodeURIComponent(templateId)}/save`,
    { method: 'DELETE' },
    templateUserPlanResponseSchema,
  )).userPlan;
}

export async function activateTrainingV2Template(templateId) {
  return (await callTrainingV2(
    `/v1/training/templates/${encodeURIComponent(templateId)}/activate`,
    { method: 'POST' },
    templateUserPlanResponseSchema,
  )).userPlan;
}

// Up to this many ids are resolved per batch request (mirrors the API's own limit).
const EXERCISE_LOOKUP_CHUNK_SIZE = 100;
// Flips to false once the API answers the batch route as unknown (an API deployed before
// /training/exercises/lookup existed matches it as /training/exercises/:exerciseId and
// rejects "lookup" as an invalid id, or answers 404). Every later resolve then goes
// straight to the per-exercise requests instead of retrying the batch route.
let exerciseLookupAvailable = true;

async function lookupTrainingV2Exercises(exerciseIds) {
  const found = new Map();
  for (let start = 0; start < exerciseIds.length; start += EXERCISE_LOOKUP_CHUNK_SIZE) {
    const chunk = exerciseIds.slice(start, start + EXERCISE_LOOKUP_CHUNK_SIZE);
    const { exercises } = await requestTrainingV2(
      `/v1/training/exercises/lookup?ids=${chunk.map(encodeURIComponent).join(',')}`,
      lookupTrainingExercisesResponseSchema,
    );
    exercises.forEach((exercise) => found.set(exercise.id, exercise));
  }
  return found;
}

function batchRouteUnavailable(error) {
  return error instanceof TrainingV2NotFoundError || error instanceof TrainingV2ValidationError;
}

// Resolves each exercise id referenced by a plan to its full { name, mainMuscle } — the
// editor needs mainMuscle too (to show the correct muscle-group chip for an already-bound
// exercise), while the read-only detail view only ever needed the name.
// All ids not yet in the cache are resolved with one batch request; ids the caller cannot
// see resolve to null, exactly like a 404 from the per-exercise route.
export async function resolveTrainingV2ExerciseDetails(plan, cache = new Map()) {
  const exerciseIds = [
    ...new Set(plan.revision.units.flatMap((unit) => (
      unit.exercises.map((exercise) => exercise.exerciseId)
    ))),
  ];

  const fetchSingle = (exerciseId) => getTrainingV2Exercise(exerciseId).catch((error) => {
    if (error instanceof TrainingV2NotFoundError) return null;
    cache.delete(exerciseId);
    throw error;
  });

  const missing = exerciseIds.filter((exerciseId) => !cache.has(exerciseId));
  if (missing.length > 0 && exerciseLookupAvailable) {
    const batch = lookupTrainingV2Exercises(missing);
    missing.forEach((exerciseId) => {
      cache.set(exerciseId, batch.then(
        (found) => found.get(exerciseId) ?? null,
        (error) => {
          if (batchRouteUnavailable(error)) {
            exerciseLookupAvailable = false;
            return fetchSingle(exerciseId);
          }
          cache.delete(exerciseId);
          throw error;
        },
      ));
    });
  } else {
    missing.forEach((exerciseId) => cache.set(exerciseId, fetchSingle(exerciseId)));
  }

  return Object.fromEntries(await Promise.all(exerciseIds.map(async (exerciseId) => {
    const exercise = await cache.get(exerciseId);
    return [exerciseId, exercise ? { name: exercise.name, mainMuscle: exercise.mainMuscle } : null];
  })));
}

export async function resolveTrainingV2ExerciseNames(plan, cache = new Map()) {
  const details = await resolveTrainingV2ExerciseDetails(plan, cache);
  return Object.fromEntries(Object.entries(details).map(([exerciseId, detail]) => [exerciseId, detail?.name]));
}

async function requestTrainingAnalytics(resource, query, schema) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => { if (value !== undefined) params.set(key, String(value)); });
  try { return await requestTrainingV2('/v1/training/analytics/' + resource + '?' + params, schema); }
  catch (error) {
    if (error.status === 404 && error.code !== 'TRAINING_SESSION_NOT_FOUND') {
      throw new TrainingV2ApiError('Die Leistungsauswertung ist mit dieser API-Version noch nicht verfügbar.', { code: 'TRAINING_ANALYTICS_UNAVAILABLE' });
    }
    throw error;
  }
}
export const getTrainingV2Records = (query = {}) => requestTrainingAnalytics('records', query, trainingRecordsResponseSchema);
export const getTrainingV2Progress = (query = {}) => requestTrainingAnalytics('progress', query, trainingProgressResponseSchema);
export const getTrainingV2ExerciseProgress = (exerciseId, query = {}) => requestTrainingAnalytics('exercises/' + encodeURIComponent(exerciseId), query, trainingExerciseProgressResponseSchema);
