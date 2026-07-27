import {
  listTrainingPlansResponseSchema,
  trainingExerciseDetailResponseSchema,
  trainingPlanDetailResponseSchema,
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

function responseError(status, code) {
  if (status === 401) return new TrainingV2AuthError(code);
  if (status === 404) return new TrainingV2NotFoundError(code);
  if (status === 409) return new TrainingV2ConflictError(code);
  if (status >= 500 || code === 'INTERNAL_ERROR') return new TrainingV2ContractError();
  return new TrainingV2ApiError('Die Training-API hat die Anfrage abgelehnt.', { status, code });
}

export async function requestTrainingV2(path, schema) {
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
      method: 'GET',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
  } catch {
    throw new TrainingV2NetworkError();
  }

  const payload = await responseJson(response);
  if (!response.ok) {
    throw responseError(response.status, payload?.error?.code ?? 'TRAINING_V2_REQUEST_FAILED');
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new TrainingV2ContractError();
  return parsed.data;
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

export async function resolveTrainingV2ExerciseNames(plan, cache = new Map()) {
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
    return [exerciseId, exercise?.name];
  })));
}
