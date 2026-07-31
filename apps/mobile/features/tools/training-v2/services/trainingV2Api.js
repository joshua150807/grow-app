import {
  createTrainingExerciseInputSchema,
  createTrainingPlanInputSchema,
  listTrainingExercisesResponseSchema,
  listTrainingPlansResponseSchema,
  listTrainingTemplatesResponseSchema,
  planVersionInputSchema,
  scheduleTrainingPlanInputSchema,
  templateUserPlanResponseSchema,
  trainingExerciseDetailResponseSchema,
  trainingPlanDetailResponseSchema,
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

async function callTrainingV2(path, { method = 'GET', body } = {}, schema) {
  const baseUrl = apiBaseUrl();
  const {
    data: { session } = {},
    error,
  } = await supabase.auth.getSession();

  if (error || !session?.access_token) {
    throw new TrainingV2AuthError(error ? 'TRAINING_V2_SESSION_ERROR' : 'UNAUTHORIZED');
  }

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

export async function createTrainingV2Plan(input) {
  const body = parseTrainingV2Input(createTrainingPlanInputSchema, input);
  return (await callTrainingV2(
    '/v1/training/plans',
    { method: 'POST', body },
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

export async function updateTrainingV2WeeklyGoal(planId, expectedVersion, weeklyGoal) {
  const body = parseTrainingV2Input(updateWeeklyGoalInputSchema, { expectedVersion, weeklyGoal });
  return (await callTrainingV2(
    `/v1/training/plans/${encodeURIComponent(planId)}/weekly-goal`,
    { method: 'PUT', body },
    trainingPlanDetailResponseSchema,
  )).plan;
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

// Resolves each exercise id referenced by a plan to its full { name, mainMuscle } — the
// editor needs mainMuscle too (to show the correct muscle-group chip for an already-bound
// exercise), while the read-only detail view only ever needed the name.
export async function resolveTrainingV2ExerciseDetails(plan, cache = new Map()) {
  const exerciseIds = [
    ...new Set(plan.revision.units.flatMap((unit) => (
      unit.exercises.map((exercise) => exercise.exerciseId)
    ))),
  ];

  await Promise.all(exerciseIds.map(async (exerciseId) => {
    if (!cache.has(exerciseId)) {
      cache.set(exerciseId, getTrainingV2Exercise(exerciseId).catch((error) => {
        if (error instanceof TrainingV2NotFoundError) return null;
        cache.delete(exerciseId);
        throw error;
      }));
    }
    await cache.get(exerciseId);
  }));

  return Object.fromEntries(await Promise.all(exerciseIds.map(async (exerciseId) => {
    const exercise = await cache.get(exerciseId);
    return [exerciseId, exercise ? { name: exercise.name, mainMuscle: exercise.mainMuscle } : null];
  })));
}

export async function resolveTrainingV2ExerciseNames(plan, cache = new Map()) {
  const details = await resolveTrainingV2ExerciseDetails(plan, cache);
  return Object.fromEntries(Object.entries(details).map(([exerciseId, detail]) => [exerciseId, detail?.name]));
}
