import { createTrainingV2LogicalKey } from '../services/trainingV2LogicalId';

// The fallback rest whenever a target set carries no real rest value of its own. 0 — never
// null — is that "no value" sentinel in practice: training_plan_target_sets_v2.planned_rest_seconds
// is `not null default 0`, and both the plan editor (it has no rest-seconds field at all — see
// toTargetSetInput in trainingV2EditorModel.js) and the seeded Grow template library persist
// literal 0 for every set. A plain `?? DEFAULT_REST_SECONDS` never reaches this default in
// practice because 0 is not nullish — see completeSessionSet below for the `> 0` check this
// requires instead.
export const DEFAULT_REST_SECONDS = 180;

// A full start snapshot of one strength unit, taken once when a session begins: every target
// exercise/set the plan currently defines, copied into the draft so later plan edits (or being
// offline) can never change what is being logged mid-session. `logicalKeyFactory` is injectable
// so tests can produce deterministic ids instead of random UUIDs.
export function createTrainingV2SessionDraft(plan, unit, exerciseNames, {
  now = () => new Date(),
  logicalKeyFactory = createTrainingV2LogicalKey,
} = {}) {
  return {
    planId: plan.id,
    unitId: unit.id,
    idempotencyKey: logicalKeyFactory(),
    startedAt: now().toISOString(),
    planName: plan.name,
    unitName: unit.name,
    unitType: unit.unitType,
    exercises: unit.exercises.map((exercise) => ({
      exerciseId: exercise.exerciseId,
      logicalTargetExerciseKey: exercise.logicalTargetExerciseKey,
      orderIndex: exercise.orderIndex,
      exerciseName: exerciseNames[exercise.exerciseId] ?? 'Unbekannte Übung',
      note: null,
      sets: exercise.targetSets.map((targetSet) => ({
        clientSetId: logicalKeyFactory(),
        logicalTargetSetKey: targetSet.logicalTargetSetKey,
        orderIndex: targetSet.orderIndex,
        setType: targetSet.setType,
        targetWeightKg: targetSet.targetWeightKg,
        targetReps: targetSet.targetReps,
        plannedRestSeconds: targetSet.plannedRestSeconds,
        weightKg: null,
        reps: null,
        note: null,
        completed: false,
        completedAt: null,
        actualRestSeconds: null,
      })),
    })),
    restTimer: null,
  };
}

function updateSet(state, exerciseIndex, setIndex, updater) {
  return {
    ...state,
    exercises: state.exercises.map((exercise, index) => (
      index !== exerciseIndex ? exercise : {
        ...exercise,
        sets: exercise.sets.map((set, sIndex) => (sIndex !== setIndex ? set : updater(set))),
      }
    )),
  };
}

// Only kg and Wiederholungen are collected (no RIR) — trims to a finite, non-negative number
// or null, matching the shared weightKgSchema/completedRepsSchema exactly so a later payload
// build never fails validation on a value the UI itself accepted.
export function parseSessionWeightInput(text) {
  const trimmed = typeof text === 'string' ? text.trim().replace(',', '.') : '';
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function parseSessionRepsInput(text) {
  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isInteger(value) && value > 0 ? value : null;
}

export function updateSessionSetInput(state, exerciseIndex, setIndex, patch) {
  return updateSet(state, exerciseIndex, setIndex, (set) => ({ ...set, ...patch }));
}

// Today's exercise-level note ("Notiz zur Übung") — distinct from a set's own note, and never
// pre-filled from `lastExerciseNote` (that read-only "Letzte Notiz" hint is fetched and shown
// separately, in TrainingV2SessionActiveScreen, and is never fed back into this field).
export function updateExerciseNote(state, exerciseIndex, note) {
  return {
    ...state,
    exercises: state.exercises.map((exercise, index) => (
      index !== exerciseIndex ? exercise : { ...exercise, note }
    )),
  };
}

// Marks a set completed using whatever kg/reps/note it currently holds and stamps completedAt
// once — that same timestamp travels into the save payload and is never regenerated at submit
// time, which is exactly what keeps a network-retry byte-identical (see
// trainingSessionFingerprint.ts server-side: completedAt is part of the compared fingerprint).
//
// The rest timer always starts at DEFAULT_REST_SECONDS (180s), regardless of the set's own
// plannedRestSeconds — the plan editor has no rest-seconds field to set it with, so any
// non-zero value on a target set is stale seed/import data, not a real user choice. Until
// V1 grows a way to actually configure this per set, honoring that stale value would silently
// start the wrong countdown, so it is ignored here entirely rather than only when it's 0.
export function completeSessionSet(state, exerciseIndex, setIndex, { completedAt }) {
  const nextState = updateSet(state, exerciseIndex, setIndex, (set) => ({
    ...set, completed: true, completedAt,
  }));
  return { state: nextState, plannedRestSeconds: DEFAULT_REST_SECONDS };
}

export function uncompleteSessionSet(state, exerciseIndex, setIndex) {
  return updateSet(state, exerciseIndex, setIndex, (set) => ({
    ...set, completed: false, completedAt: null, actualRestSeconds: null,
  }));
}

export function recordRestSecondsForSet(state, exerciseIndex, setIndex, actualRestSeconds) {
  return updateSet(state, exerciseIndex, setIndex, (set) => ({ ...set, actualRestSeconds }));
}

export function setRestTimer(state, restTimer) {
  return { ...state, restTimer };
}

// Called once, right before the first save attempt — never regenerated on a retry (idempotent:
// a draft that already carries an endedAt is returned untouched), the same way idempotencyKey
// is fixed once at draft creation. Keeping this a pure, separate step (rather than folding it
// into buildTrainingV2SessionPayload) lets the caller persist the stamped draft to storage
// before the network call, so the same endedAt survives even an app kill between attempts.
export function stampSessionEndedAt(state, endedAt) {
  if (state.endedAt) return state;
  return { ...state, endedAt };
}

// True once the user has entered or completed anything — the signal for whether leaving needs
// the fortsetzen/unvollständig-speichern/verwerfen dialog, or can just navigate back.
export function hasSessionProgress(state) {
  return state.exercises.some((exercise) => (
    (exercise.note ?? '').trim().length > 0
    || exercise.sets.some((set) => (
      set.completed || set.weightKg !== null || set.reps !== null || (set.note ?? '').trim().length > 0
    ))
  ));
}

export function sessionProgressSummary(state) {
  const sets = state.exercises.flatMap((exercise) => exercise.sets);
  return { completedSets: sets.filter((set) => set.completed).length, totalSets: sets.length };
}

// The exact request createTrainingSessionInputSchema expects: only completed sets can ever be
// included (the schema requires a non-null completedAt on every set it accepts), so an
// exercise with zero completed sets is dropped entirely rather than sent with an empty array
// (sessionCompletionExerciseInputSchema requires sets.length >= 1). No RIR is ever collected,
// so rir is always sent as null.
//
// startedAt/endedAt are read straight off the draft (the caller is responsible for having
// stamped endedAt via stampSessionEndedAt before its first save attempt — see
// useTrainingV2Session.js's save()). pausedDurationSeconds is always 0: V1 has no persisted
// session-level pause state to derive a real value from, and the contract explicitly forbids
// inventing one — 0 here means "no pause recorded", not "no pause happened".
export function buildTrainingV2SessionPayload(state, status) {
  return {
    planId: state.planId,
    unitId: state.unitId,
    status,
    idempotencyKey: state.idempotencyKey,
    startedAt: state.startedAt ?? null,
    endedAt: state.endedAt ?? null,
    pausedDurationSeconds: 0,
    exercises: state.exercises
      .map((exercise) => ({
        exerciseId: exercise.exerciseId,
        logicalTargetExerciseKey: exercise.logicalTargetExerciseKey,
        orderIndex: exercise.orderIndex,
        note: exercise.note,
        sets: exercise.sets
          .filter((set) => set.completed)
          .map((set) => ({
            clientSetId: set.clientSetId,
            logicalTargetSetKey: set.logicalTargetSetKey,
            orderIndex: set.orderIndex,
            setType: set.setType,
            weightKg: set.weightKg,
            reps: set.reps,
            rir: null,
            note: set.note,
            completedAt: set.completedAt,
            actualRestSeconds: set.actualRestSeconds,
          })),
      }))
      .filter((exercise) => exercise.sets.length > 0),
  };
}
