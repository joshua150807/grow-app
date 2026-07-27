import { createTrainingV2LogicalKey } from '../services/trainingV2LogicalId';

export const TRAINING_V2_UNIT_TYPE_OPTIONS = ['strength', 'run', 'rest', 'mobility', 'stretching'];
export const TRAINING_V2_SET_TYPE_OPTIONS = ['warmup', 'work', 'drop'];

export function unitTypeAllowsExercises(unitType) {
  return unitType === 'strength' || unitType === 'mobility' || unitType === 'stretching';
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
    exerciseName: '',
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

export function mapTrainingPlanToEditorState(plan, exerciseNames = {}) {
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
          return {
            logicalTargetExerciseKey: exercise.logicalTargetExerciseKey,
            exerciseId: exercise.exerciseId,
            exerciseName: exerciseNames[exercise.exerciseId] ?? 'Unbekannte Übung',
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
    targetRir: set.targetRir,
    plannedRestSeconds: set.plannedRestSeconds,
    importedFromLegacyPlan: set.importedFromLegacyPlan,
  };
}

function toTargetExerciseInput(exercise) {
  const note = typeof exercise.note === 'string' ? exercise.note.trim() : '';
  return {
    logicalTargetExerciseKey: exercise.logicalTargetExerciseKey,
    exerciseId: exercise.exerciseId,
    orderIndex: exercise.orderIndex,
    note: note.length > 0 ? note : null,
    targetSets: exercise.targetSets.map(toTargetSetInput),
  };
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
      if (!exercise.exerciseId) {
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
      return {
        ...state,
        units: updateByKey(state.units, 'logicalUnitKey', action.logicalUnitKey, (unit) => ({
          ...unit,
          exercises: updateByKey(unit.exercises, 'logicalTargetExerciseKey', action.logicalTargetExerciseKey, (exercise) => ({
            ...exercise,
            exerciseId: action.exerciseId,
            exerciseName: action.exerciseName,
          })),
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
