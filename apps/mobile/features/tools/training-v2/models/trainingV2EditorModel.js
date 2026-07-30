import { resolveUiMuscleGroup } from '@grow/shared';

import { createTrainingV2LogicalKey } from '../services/trainingV2LogicalId';

export const TRAINING_V2_UNIT_TYPE_OPTIONS = ['strength', 'run', 'rest', 'mobility', 'stretching'];
export const TRAINING_V2_SET_TYPE_OPTIONS = ['warmup', 'work', 'drop'];

export function unitTypeAllowsExercises(unitType) {
  return unitType === 'strength' || unitType === 'mobility' || unitType === 'stretching';
}

// A private exercise draft's category is always derived from the unit it lives in, never
// asked for separately. The real, full unit-type enum (trainingUnitTypeSchema in
// @grow/shared) is exactly ['strength', 'run', 'rest', 'mobility', 'stretching'] — there is
// no 'cardio' unit type (only 'cardio' as an exercise *category*, tracked on 'run' units,
// which never carry target exercises at all per unitTypeForbidsExercises). So the only unit
// types that can ever reach this function (guarded by unitTypeAllowsExercises above) are
// strength/mobility/stretching, mapping onto three of exerciseCategorySchema's four values.
// Reusing unitTypeAllowsExercises here (rather than a second, hand-maintained list) means
// this guard can never silently drift out of sync with it. Any other unit type — run, rest,
// or a future/unrecognized value — has no exercise category by definition and must fail
// loudly rather than being quietly filed under 'strength', since reaching this function for
// one of them means the UI's own gating (unitTypeAllowsExercises) was bypassed upstream.
export function categoryForUnitType(unitType) {
  if (!unitTypeAllowsExercises(unitType)) {
    throw new Error(`categoryForUnitType: unit type "${unitType}" is not exercise-enabled and has no exercise category.`);
  }
  return unitType === 'mobility' || unitType === 'stretching' ? unitType : 'strength';
}

export function unitTypeRequiresExercises(unitType) {
  return unitType === 'strength';
}

export function unitTypeForbidsExercises(unitType) {
  return unitType === 'run' || unitType === 'rest';
}

function reindex(items) {
  return items.map((item, index) => (item.orderIndex === index ? item : { ...item, orderIndex: index }));
}

function moveByKey(items, keyField, key, direction) {
  const index = items.findIndex((item) => item[keyField] === key);
  if (index === -1) return items;
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= items.length) return items;
  const next = items.slice();
  const [moved] = next.splice(index, 1);
  next.splice(targetIndex, 0, moved);
  return reindex(next);
}

function updateByKey(items, keyField, key, updater) {
  return items.map((item) => (item[keyField] === key ? updater(item) : item));
}

function removeByKey(items, keyField, key) {
  return reindex(items.filter((item) => item[keyField] !== key));
}

export function createEmptyTargetSet() {
  return {
    logicalTargetSetKey: createTrainingV2LogicalKey(),
    orderIndex: 0,
    setType: 'work',
    targetWeightKg: null,
    targetReps: null,
    targetRir: null,
    plannedRestSeconds: 0,
    importedFromLegacyPlan: false,
  };
}

export function createEmptyTargetExercise() {
  return {
    logicalTargetExerciseKey: createTrainingV2LogicalKey(),
    exerciseId: null,
    // Set instead of exerciseId once the row describes a not-yet-existing private exercise
    // (typed name with no exact match, or a muscle-group edit on a previously bound
    // exercise): { logicalKey, name, mainMuscle, category }, matching
    // planExerciseDraftInputSchema in @grow/shared exactly so it can be sent as-is.
    exerciseDraft: null,
    exerciseName: '',
    // Always one of the nine UI groups; mirrors exerciseDraft.mainMuscle while a draft is
    // active, and the resolved display group of the bound exercise otherwise.
    muscleGroup: 'other',
    orderIndex: 0,
    note: '',
    targetSets: [{ ...createEmptyTargetSet(), orderIndex: 0 }],
  };
}

export function createEmptyUnit() {
  return {
    logicalUnitKey: createTrainingV2LogicalKey(),
    name: '',
    unitType: 'strength',
    orderIndex: 0,
    exercises: [],
  };
}

export function createEmptyEditorState() {
  return {
    name: '',
    weeklyGoal: '',
    units: [{ ...createEmptyUnit(), orderIndex: 0 }],
  };
}

export function mapTrainingPlanToEditorState(plan, exerciseDetails = {}) {
  const units = plan.revision.units
    .slice()
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((unit) => {
      const exercises = unit.exercises
        .slice()
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((exercise) => {
          const targetSets = exercise.targetSets
            .slice()
            .sort((a, b) => a.orderIndex - b.orderIndex)
            .map((set, setIndex) => ({
              logicalTargetSetKey: set.logicalTargetSetKey,
              orderIndex: setIndex,
              setType: set.setType,
              targetWeightKg: set.targetWeightKg,
              targetReps: set.targetReps,
              targetRir: set.targetRir,
              plannedRestSeconds: set.plannedRestSeconds,
              importedFromLegacyPlan: set.importedFromLegacyPlan,
            }));
          const detail = exerciseDetails[exercise.exerciseId];
          return {
            logicalTargetExerciseKey: exercise.logicalTargetExerciseKey,
            exerciseId: exercise.exerciseId,
            exerciseDraft: null,
            exerciseName: detail?.name ?? 'Unbekannte Übung',
            muscleGroup: resolveUiMuscleGroup(detail?.mainMuscle),
            orderIndex: 0,
            note: exercise.note ?? '',
            targetSets,
          };
        })
        .map((exercise, exerciseIndex) => ({ ...exercise, orderIndex: exerciseIndex }));
      return {
        logicalUnitKey: unit.logicalUnitKey,
        name: unit.name,
        unitType: unit.unitType,
        orderIndex: 0,
        exercises,
      };
    })
    .map((unit, unitIndex) => ({ ...unit, orderIndex: unitIndex }));

  return {
    name: plan.name,
    weeklyGoal: plan.weeklyGoal != null ? String(plan.weeklyGoal) : '',
    units,
  };
}

function toTargetSetInput(set) {
  return {
    logicalTargetSetKey: set.logicalTargetSetKey,
    orderIndex: set.orderIndex,
    setType: set.setType,
    targetWeightKg: set.targetWeightKg,
    targetReps: set.targetReps,
    // The editor no longer shows RIR/rest-seconds fields, so `set.targetRir`/
    // `set.plannedRestSeconds` may still hold a stale non-neutral value carried through
    // unedited from a plan loaded before this change (or from a template copy) — this is
    // the one place that neutralizes them on every save, rather than leaving whatever the
    // server last returned in place indefinitely.
    targetRir: null,
    plannedRestSeconds: 0,
    importedFromLegacyPlan: set.importedFromLegacyPlan,
  };
}

function toTargetExerciseInput(exercise) {
  const note = typeof exercise.note === 'string' ? exercise.note.trim() : '';
  const base = {
    logicalTargetExerciseKey: exercise.logicalTargetExerciseKey,
    orderIndex: exercise.orderIndex,
    note: note.length > 0 ? note : null,
    targetSets: exercise.targetSets.map(toTargetSetInput),
  };
  // planTargetExerciseInputSchema requires exactly one of exerciseId/exerciseDraft — a local
  // draft (no exact match, or an edited muscle group/name) is never sent as an exerciseId, and
  // the atomic server-side resolveExerciseDraft path is the only thing allowed to turn a draft
  // into a real exercise row; the editor itself must never call POST /training/exercises.
  return exercise.exerciseDraft
    ? { ...base, exerciseDraft: exercise.exerciseDraft }
    : { ...base, exerciseId: exercise.exerciseId };
}

function toUnitInput(unit) {
  return {
    logicalUnitKey: unit.logicalUnitKey,
    name: unit.name.trim(),
    unitType: unit.unitType,
    orderIndex: unit.orderIndex,
    exercises: unitTypeForbidsExercises(unit.unitType) ? [] : unit.exercises.map(toTargetExerciseInput),
  };
}

export function buildCreatePlanInput(state) {
  return {
    name: state.name.trim(),
    weeklyGoal: Number(state.weeklyGoal),
    units: state.units.map(toUnitInput),
  };
}

export function buildUpdatePlanInput(state, expectedVersion) {
  return {
    name: state.name.trim(),
    units: state.units.map(toUnitInput),
    expectedVersion,
  };
}

export function getEditorValidationIssues(state, { mode = 'create' } = {}) {
  const issues = [];
  const name = state.name.trim();
  if (name.length < 1 || name.length > 120) {
    issues.push({ path: 'name', message: 'Der Name muss zwischen 1 und 120 Zeichen lang sein.' });
  }
  if (state.units.length < 1) {
    issues.push({ path: 'units', message: 'Mindestens eine Trainingseinheit wird benötigt.' });
  }
  state.units.forEach((unit, unitIndex) => {
    if (!unit.name.trim()) {
      issues.push({ path: `units.${unitIndex}.name`, message: 'Der Name der Einheit darf nicht leer sein.' });
    }
    if (unitTypeRequiresExercises(unit.unitType) && unit.exercises.length === 0) {
      issues.push({ path: `units.${unitIndex}.exercises`, message: 'Kraft-Einheiten benötigen mindestens eine Übung.' });
    }
    if (unitTypeForbidsExercises(unit.unitType) && unit.exercises.length > 0) {
      issues.push({ path: `units.${unitIndex}.exercises`, message: 'Lauf- und Erholungseinheiten dürfen keine Übungen enthalten.' });
    }
    unit.exercises.forEach((exercise, exerciseIndex) => {
      const hasDraftName = Boolean(exercise.exerciseDraft?.name?.trim());
      if (!exercise.exerciseId && !hasDraftName) {
        issues.push({
          path: `units.${unitIndex}.exercises.${exerciseIndex}.exerciseId`,
          message: 'Bitte eine Übung auswählen.',
        });
      }
      if (exercise.targetSets.length === 0) {
        issues.push({
          path: `units.${unitIndex}.exercises.${exerciseIndex}.targetSets`,
          message: 'Jede Übung benötigt mindestens einen Zielsatz.',
        });
      }
    });
  });
  if (mode === 'create') {
    const weeklyGoalNumber = Number(state.weeklyGoal);
    if (!Number.isInteger(weeklyGoalNumber) || weeklyGoalNumber <= 0) {
      issues.push({ path: 'weeklyGoal', message: 'Das Wochenziel muss eine positive Ganzzahl sein.' });
    }
  }
  return issues;
}

export function isEditorStateDirty(initialState, currentState) {
  return JSON.stringify(initialState) !== JSON.stringify(currentState);
}

export function trainingV2EditorReducer(state, action) {
  switch (action.type) {
    case 'HYDRATE':
      return action.state;

    case 'SET_NAME':
      return { ...state, name: action.name };

    case 'SET_WEEKLY_GOAL':
      return { ...state, weeklyGoal: action.weeklyGoal };

    case 'ADD_UNIT':
      return { ...state, units: reindex([...state.units, createEmptyUnit()]) };

    case 'REMOVE_UNIT':
      return { ...state, units: removeByKey(state.units, 'logicalUnitKey', action.logicalUnitKey) };

    case 'MOVE_UNIT':
      return { ...state, units: moveByKey(state.units, 'logicalUnitKey', action.logicalUnitKey, action.direction) };

    case 'SET_UNIT_NAME':
      return {
        ...state,
        units: updateByKey(state.units, 'logicalUnitKey', action.logicalUnitKey, (unit) => ({
          ...unit,
          name: action.name,
        })),
      };

    case 'SET_UNIT_TYPE':
      return {
        ...state,
        units: updateByKey(state.units, 'logicalUnitKey', action.logicalUnitKey, (unit) => ({
          ...unit,
          unitType: action.unitType,
          exercises: unitTypeForbidsExercises(action.unitType) ? [] : unit.exercises,
        })),
      };

    case 'ADD_EXERCISE':
      return {
        ...state,
        units: updateByKey(state.units, 'logicalUnitKey', action.logicalUnitKey, (unit) => ({
          ...unit,
          exercises: reindex([...unit.exercises, createEmptyTargetExercise()]),
        })),
      };

    case 'REMOVE_EXERCISE':
      return {
        ...state,
        units: updateByKey(state.units, 'logicalUnitKey', action.logicalUnitKey, (unit) => ({
          ...unit,
          exercises: removeByKey(unit.exercises, 'logicalTargetExerciseKey', action.logicalTargetExerciseKey),
        })),
      };

    case 'MOVE_EXERCISE':
      return {
        ...state,
        units: updateByKey(state.units, 'logicalUnitKey', action.logicalUnitKey, (unit) => ({
          ...unit,
          exercises: moveByKey(unit.exercises, 'logicalTargetExerciseKey', action.logicalTargetExerciseKey, action.direction),
        })),
      };

    case 'SET_EXERCISE_SELECTION':
      // Binding to a known exercise (system or the user's own) always wins over any local
      // draft in progress — this is the "confirmed suggestion" / "confirmed exact match" path,
      // never the "no match, start a private draft" path.
      return {
        ...state,
        units: updateByKey(state.units, 'logicalUnitKey', action.logicalUnitKey, (unit) => ({
          ...unit,
          exercises: updateByKey(unit.exercises, 'logicalTargetExerciseKey', action.logicalTargetExerciseKey, (exercise) => ({
            ...exercise,
            exerciseId: action.exerciseId,
            exerciseDraft: null,
            exerciseName: action.exerciseName,
            muscleGroup: resolveUiMuscleGroup(action.mainMuscle),
          })),
        })),
      };

    case 'SET_EXERCISE_DRAFT':
      // Confirmed typed text with no exact match. If the row was already a draft, its
      // logicalKey and muscleGroup survive the rename unchanged (same private exercise, just
      // renamed); otherwise a fresh logicalKey is minted and the group defaults to "Sonstiges"
      // — this is what breaks the exerciseId binding for both an edited system name and an
      // edited private name alike, since neither exact-matches anymore.
      return {
        ...state,
        units: updateByKey(state.units, 'logicalUnitKey', action.logicalUnitKey, (unit) => ({
          ...unit,
          exercises: updateByKey(unit.exercises, 'logicalTargetExerciseKey', action.logicalTargetExerciseKey, (exercise) => {
            const logicalKey = exercise.exerciseDraft?.logicalKey ?? createTrainingV2LogicalKey();
            const muscleGroup = exercise.exerciseDraft?.mainMuscle ?? 'other';
            return {
              ...exercise,
              exerciseId: null,
              exerciseDraft: {
                logicalKey,
                name: action.name,
                mainMuscle: muscleGroup,
                category: categoryForUnitType(unit.unitType),
              },
              exerciseName: action.name,
              muscleGroup,
            };
          }),
        })),
      };

    case 'SET_EXERCISE_MUSCLE_GROUP':
      // Changing the muscle group of an already-bound known exercise turns it into a private
      // draft with a fresh logicalKey but the existing display name; changing it on a row
      // that's already a draft just updates that same draft in place.
      return {
        ...state,
        units: updateByKey(state.units, 'logicalUnitKey', action.logicalUnitKey, (unit) => ({
          ...unit,
          exercises: updateByKey(unit.exercises, 'logicalTargetExerciseKey', action.logicalTargetExerciseKey, (exercise) => {
            const logicalKey = exercise.exerciseDraft?.logicalKey ?? createTrainingV2LogicalKey();
            return {
              ...exercise,
              exerciseId: null,
              exerciseDraft: {
                logicalKey,
                name: exercise.exerciseName,
                mainMuscle: action.muscleGroup,
                category: categoryForUnitType(unit.unitType),
              },
              muscleGroup: action.muscleGroup,
            };
          }),
        })),
      };

    case 'SET_EXERCISE_NOTE':
      return {
        ...state,
        units: updateByKey(state.units, 'logicalUnitKey', action.logicalUnitKey, (unit) => ({
          ...unit,
          exercises: updateByKey(unit.exercises, 'logicalTargetExerciseKey', action.logicalTargetExerciseKey, (exercise) => ({
            ...exercise,
            note: action.note,
          })),
        })),
      };

    case 'ADD_TARGET_SET':
      return {
        ...state,
        units: updateByKey(state.units, 'logicalUnitKey', action.logicalUnitKey, (unit) => ({
          ...unit,
          exercises: updateByKey(unit.exercises, 'logicalTargetExerciseKey', action.logicalTargetExerciseKey, (exercise) => ({
            ...exercise,
            targetSets: reindex([...exercise.targetSets, createEmptyTargetSet()]),
          })),
        })),
      };

    case 'REMOVE_TARGET_SET':
      return {
        ...state,
        units: updateByKey(state.units, 'logicalUnitKey', action.logicalUnitKey, (unit) => ({
          ...unit,
          exercises: updateByKey(unit.exercises, 'logicalTargetExerciseKey', action.logicalTargetExerciseKey, (exercise) => ({
            ...exercise,
            targetSets: removeByKey(exercise.targetSets, 'logicalTargetSetKey', action.logicalTargetSetKey),
          })),
        })),
      };

    case 'MOVE_TARGET_SET':
      return {
        ...state,
        units: updateByKey(state.units, 'logicalUnitKey', action.logicalUnitKey, (unit) => ({
          ...unit,
          exercises: updateByKey(unit.exercises, 'logicalTargetExerciseKey', action.logicalTargetExerciseKey, (exercise) => ({
            ...exercise,
            targetSets: moveByKey(exercise.targetSets, 'logicalTargetSetKey', action.logicalTargetSetKey, action.direction),
          })),
        })),
      };

    case 'SET_TARGET_SET_FIELD':
      return {
        ...state,
        units: updateByKey(state.units, 'logicalUnitKey', action.logicalUnitKey, (unit) => ({
          ...unit,
          exercises: updateByKey(unit.exercises, 'logicalTargetExerciseKey', action.logicalTargetExerciseKey, (exercise) => ({
            ...exercise,
            targetSets: updateByKey(exercise.targetSets, 'logicalTargetSetKey', action.logicalTargetSetKey, (set) => ({
              ...set,
              [action.field]: action.value,
            })),
          })),
        })),
      };

    default:
      return state;
  }
}
