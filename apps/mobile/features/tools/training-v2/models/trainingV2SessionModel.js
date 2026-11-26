import { createTrainingV2LogicalKey } from '../services/trainingV2LogicalId';
import {
  isPlausibleTrainingV2Reps, isPlausibleTrainingV2WeightKg, parseTrainingV2RepsText, parseTrainingV2WeightText,
  TRAINING_V2_LIMITS, TRAINING_V2_REPS_INPUT_HINT, TRAINING_V2_WEIGHT_INPUT_HINT,
} from '../utils/trainingV2NumericInput';

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
  return parseTrainingV2WeightText(text).value;
}

// Returns the reps number only for a valid entry (1-1000, Fixplan D2); anything else is null. The
// screen keeps the raw text in `repsInput` (like `weightInput`), so an incomplete or too-large entry
// stays visible and correctable instead of silently turning into "no value".
export function parseSessionRepsInput(text) {
  return parseTrainingV2RepsText(text).value;
}

const lastValueNumber = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });

// Grey placeholder text for one set's kg/Wdh. fields: the value of the set at the same position
// in the last saved session of this exercise. Display-only — never written into the draft, so an
// empty field still saves as "nothing entered". Falls back to the plain field hints.
export function sessionSetPlaceholders(lastSet) {
  const weight = lastSet && lastSet.weightKg !== null && lastSet.weightKg !== undefined ? `${lastValueNumber.format(lastSet.weightKg)} kg` : 'kg';
  const reps = lastSet && lastSet.reps !== null && lastSet.reps !== undefined ? `${lastValueNumber.format(lastSet.reps)} Wdh.` : 'Wdh.';
  return { weight, reps };
}

// Why a set cannot be confirmed/saved as entered, or null. Covers the raw text fields and -- for
// drafts persisted by an older build -- numeric values that bypassed today's parsers.
export function getSessionSetInputIssue(set) {
  if (set.weightInput !== undefined && !parseTrainingV2WeightText(set.weightInput).valid) return 'weight';
  if (set.repsInput !== undefined && !parseTrainingV2RepsText(set.repsInput).valid) return 'reps';
  if (set.weightKg !== null && set.weightKg !== undefined && !isPlausibleTrainingV2WeightKg(set.weightKg)) return 'weight';
  if (set.reps !== null && set.reps !== undefined && !isPlausibleTrainingV2Reps(set.reps)) return 'reps';
  return null;
}

// The API answers 400 TRAINING_SESSION_VALIDATION_ERROR for a session save only from its input
// contract check, which runs before any database access (trainingSessionService.create). Such an
// answer proves nothing was stored, so the draft may be unlocked for correction. Any other error
// (network, 5xx, contract/parse error, 401/404/409, other 400 codes) leaves the outcome unknown or
// not correctable by editing, and the locked replay must be kept.
export function isDefinitiveTrainingV2SessionRejection(error) {
  return error?.status === 400 && error?.code === 'TRAINING_SESSION_VALIDATION_ERROR';
}

// Removes the pendingSave lock only; idempotencyKey, endedAt, every set and timestamp stay as they
// were, so a later save is still the same logical request (no duplicate session can be created).
export function unlockRejectedTrainingV2SessionDraft(state) {
  const { pendingSave: _pendingSave, ...unlocked } = state;
  return unlocked;
}

export function sessionSetInputIssueMessage(issue) {
  if (issue === 'weight') return `Bitte korrigiere das Gewicht. ${TRAINING_V2_WEIGHT_INPUT_HINT}`;
  if (issue === 'reps') return `Bitte korrigiere die Wiederholungen. ${TRAINING_V2_REPS_INPUT_HINT}`;
  return null;
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

// A measured rest above 24 h (e.g. the app sat in the background overnight) is not a valid rest
// measurement (Fixplan D4): it is recorded as null ("not measured") instead of producing a value the
// API would reject -- that rejection would otherwise block saving the whole unit.
export function recordRestSecondsForSet(state, exerciseIndex, setIndex, actualRestSeconds) {
  const value = Number.isInteger(actualRestSeconds) && actualRestSeconds >= 0
    && actualRestSeconds <= TRAINING_V2_LIMITS.maxActualRestSeconds ? actualRestSeconds : null;
  return updateSet(state, exerciseIndex, setIndex, (set) => ({ ...set, actualRestSeconds: value }));
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
      set.completed || set.weightKg !== null || set.reps !== null || (set.weightInput ?? '').trim().length > 0 || (set.note ?? '').trim().length > 0
    ))
  ));
}

export function sessionProgressSummary(state) {
  const sets = state.exercises.flatMap((exercise) => exercise.sets);
  return { completedSets: sets.filter((set) => set.completed).length, totalSets: sets.length };
}

// Refuse saves that would discard entered values: the wire contract only stores
// confirmed sets. Keep the draft until the user explicitly confirms those sets.
export function getTrainingV2SessionSaveIssue(state, status) {
  if (state.exercises.some((exercise) => (exercise.note ?? '').trim().length > 1000
    || exercise.sets.some((set) => (set.note ?? '').trim().length > 1000))) {
    return 'Eine Notiz darf höchstens 1000 Zeichen enthalten. Kürze die Notiz vor dem Speichern; dein Entwurf bleibt erhalten.';
  }
  const invalid = state.exercises.flatMap((exercise) => exercise.sets.map((set) => getSessionSetInputIssue(set))).find(Boolean);
  if (invalid === 'weight') return `Bitte korrigiere ungültige Gewichte. ${TRAINING_V2_WEIGHT_INPUT_HINT} Bestätigte Sätze kannst du über „Erledigt“ wieder bearbeiten; dein Entwurf bleibt erhalten.`;
  if (invalid === 'reps') return `Bitte korrigiere ungültige Wiederholungen. ${TRAINING_V2_REPS_INPUT_HINT} Bestätigte Sätze kannst du über „Erledigt“ wieder bearbeiten; dein Entwurf bleibt erhalten.`;
  const { completedSets, totalSets } = sessionProgressSummary(state);
  if (status === 'completed' && (totalSets === 0 || completedSets !== totalSets)) {
    return 'Bestätige alle Sätze mit „Fertig“, bevor du das Training abschließt. Für einen Teilabschluss wähle „Unvollständig beenden“.';
  }
  const pending = state.exercises.some((exercise) => (
    exercise.sets.some((set) => !set.completed && (
      set.weightKg !== null || set.reps !== null || (set.weightInput ?? '').trim().length > 0
      || (set.repsInput ?? '').trim().length > 0 || (set.note ?? '').trim().length > 0
    ))
    || ((exercise.note ?? '').trim().length > 0 && !exercise.sets.some((set) => set.completed))
  ));
  if (pending) return 'Es gibt Eingaben ohne bestätigten Satz. Bestätige die zugehörigen Sätze mit „Fertig“. Deine Eingaben bleiben bis dahin im Entwurf erhalten.';
  if (completedSets === 0) return 'Bestätige mindestens einen Satz mit „Fertig“. Dein Training bleibt als Entwurf erhalten.';
  return null;
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
