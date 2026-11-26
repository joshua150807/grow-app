const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildCreatePlanInput,
  buildUpdatePlanInput,
  categoryForUnitType,
  createEmptyEditorState,
  createEmptyTargetExercise,
  createEmptyTargetSet,
  createEmptyUnit,
  getEditorValidationIssues,
  isEditorStateDirty,
  mapTrainingPlanToEditorState,
  trainingV2EditorReducer,
} = require('../testing/loadModule.cjs').loadModule(__dirname, './trainingV2EditorModel.js');

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function dispatchAll(state, actions) {
  return actions.reduce(trainingV2EditorReducer, state);
}

test('create mode starts with one empty unit carrying a fresh UUID logical key', () => {
  const stateA = createEmptyEditorState();
  const stateB = createEmptyEditorState();

  assert.match(stateA.units[0].logicalUnitKey, uuidPattern);
  assert.notEqual(stateA.units[0].logicalUnitKey, stateB.units[0].logicalUnitKey);
  assert.equal(stateA.units[0].orderIndex, 0);
});

test('creating new units, exercises and target sets always mints unique fresh keys', () => {
  const unit = createEmptyUnit();
  const exercise = createEmptyTargetExercise();
  const set = createEmptyTargetSet();

  assert.match(unit.logicalUnitKey, uuidPattern);
  assert.match(exercise.logicalTargetExerciseKey, uuidPattern);
  assert.match(set.logicalTargetSetKey, uuidPattern);
  assert.notEqual(createEmptyUnit().logicalUnitKey, unit.logicalUnitKey);
  assert.notEqual(createEmptyTargetExercise().logicalTargetExerciseKey, exercise.logicalTargetExerciseKey);
  assert.notEqual(createEmptyTargetSet().logicalTargetSetKey, set.logicalTargetSetKey);
});

test('DTO to editor mapping reuses the persisted logical keys unchanged and never uses DB ids as keys', () => {
  const plan = {
    name: 'Push Pull Legs',
    weeklyGoal: 4,
    revision: {
      units: [{
        id: 'db-unit-id',
        logicalUnitKey: 'unit-logical-key',
        name: 'Push Day',
        unitType: 'strength',
        orderIndex: 0,
        exercises: [{
          id: 'db-exercise-id',
          logicalTargetExerciseKey: 'exercise-logical-key',
          exerciseId: 'exercise-1',
          orderIndex: 0,
          note: 'leicht',
          targetSets: [{
            id: 'db-set-id',
            logicalTargetSetKey: 'set-logical-key',
            orderIndex: 0,
            setType: 'work',
            targetWeightKg: 60,
            targetReps: { minimum: 8, maximum: 10 },
            targetRir: 2,
            plannedRestSeconds: 90,
            importedFromLegacyPlan: false,
          }],
        }],
      }],
    },
  };

  const state = mapTrainingPlanToEditorState(plan, {
    'exercise-1': { name: 'Bankdrücken', mainMuscle: 'chest' },
  });

  assert.equal(state.name, 'Push Pull Legs');
  assert.equal(state.weeklyGoal, '4');
  assert.equal(state.units[0].logicalUnitKey, 'unit-logical-key');
  assert.equal(state.units[0].exercises[0].logicalTargetExerciseKey, 'exercise-logical-key');
  assert.equal(state.units[0].exercises[0].exerciseName, 'Bankdrücken');
  assert.equal(state.units[0].exercises[0].muscleGroup, 'chest');
  assert.equal(state.units[0].exercises[0].exerciseDraft, null);
  assert.equal(state.units[0].exercises[0].targetSets[0].logicalTargetSetKey, 'set-logical-key');
  assert.equal(state.units[0].exercises[0].targetSets[0].targetWeightKg, 60);
  // The mapped editor state must not carry any DB id field forward as a logical key source.
  assert.equal('id' in state.units[0], false);
  assert.equal('id' in state.units[0].exercises[0], false);
  assert.equal('id' in state.units[0].exercises[0].targetSets[0], false);
});

test('exercise 404/missing names fall back the same way the read-only detail view does', () => {
  const plan = {
    name: 'Plan',
    weeklyGoal: null,
    revision: {
      units: [{
        logicalUnitKey: 'unit-1',
        name: 'Einheit',
        unitType: 'strength',
        orderIndex: 0,
        exercises: [{
          logicalTargetExerciseKey: 'exercise-1',
          exerciseId: 'missing-exercise',
          orderIndex: 0,
          note: null,
          targetSets: [],
        }],
      }],
    },
  };
  const state = mapTrainingPlanToEditorState(plan, {});
  assert.equal(state.units[0].exercises[0].exerciseName, 'Unbekannte Übung');
  assert.equal(state.units[0].exercises[0].muscleGroup, 'other');
  assert.equal(state.weeklyGoal, '');
});

test('reorder actions preserve logical keys and reindex orderIndex deterministically to 0..n-1', () => {
  let state = createEmptyEditorState();
  const firstUnitKey = state.units[0].logicalUnitKey;
  state = trainingV2EditorReducer(state, { type: 'ADD_UNIT' });
  state = trainingV2EditorReducer(state, { type: 'ADD_UNIT' });
  const keysBeforeMove = state.units.map((unit) => unit.logicalUnitKey);

  state = trainingV2EditorReducer(state, {
    type: 'MOVE_UNIT',
    logicalUnitKey: state.units[2].logicalUnitKey,
    direction: 'up',
  });

  assert.equal(state.units[1].logicalUnitKey, keysBeforeMove[2]);
  assert.equal(state.units[2].logicalUnitKey, keysBeforeMove[1]);
  assert.deepEqual(state.units.map((unit) => unit.orderIndex), [0, 1, 2]);
  assert.equal(state.units[0].logicalUnitKey, firstUnitKey);

  // Moving the first unit further up is a no-op (already at the top).
  const stable = trainingV2EditorReducer(state, {
    type: 'MOVE_UNIT',
    logicalUnitKey: state.units[0].logicalUnitKey,
    direction: 'up',
  });
  assert.deepEqual(stable, state);
});

test('removing an item reindexes the remaining siblings and a re-added item gets a brand new key', () => {
  let state = createEmptyEditorState();
  state = trainingV2EditorReducer(state, { type: 'ADD_UNIT' });
  state = trainingV2EditorReducer(state, { type: 'ADD_UNIT' });
  const removedKey = state.units[1].logicalUnitKey;

  state = trainingV2EditorReducer(state, { type: 'REMOVE_UNIT', logicalUnitKey: removedKey });
  assert.equal(state.units.length, 2);
  assert.deepEqual(state.units.map((unit) => unit.orderIndex), [0, 1]);
  assert.ok(state.units.every((unit) => unit.logicalUnitKey !== removedKey));

  state = trainingV2EditorReducer(state, { type: 'ADD_UNIT' });
  const newKey = state.units[2].logicalUnitKey;
  assert.notEqual(newKey, removedKey);
});

test('switching a unit to run or rest clears its exercises; strength keeps them', () => {
  let state = createEmptyEditorState();
  const unitKey = state.units[0].logicalUnitKey;
  state = trainingV2EditorReducer(state, { type: 'ADD_EXERCISE', logicalUnitKey: unitKey });
  assert.equal(state.units[0].exercises.length, 1);

  state = trainingV2EditorReducer(state, { type: 'SET_UNIT_TYPE', logicalUnitKey: unitKey, unitType: 'run' });
  assert.equal(state.units[0].exercises.length, 0);

  state = trainingV2EditorReducer(state, { type: 'SET_UNIT_TYPE', logicalUnitKey: unitKey, unitType: 'strength' });
  assert.equal(state.units[0].exercises.length, 0);
});

test('target set add/remove/move reindexes within the owning exercise only', () => {
  let state = createEmptyEditorState();
  const unitKey = state.units[0].logicalUnitKey;
  state = trainingV2EditorReducer(state, { type: 'ADD_EXERCISE', logicalUnitKey: unitKey });
  const exerciseKey = state.units[0].exercises[0].logicalTargetExerciseKey;
  const firstSetKey = state.units[0].exercises[0].targetSets[0].logicalTargetSetKey;

  state = trainingV2EditorReducer(state, {
    type: 'ADD_TARGET_SET', logicalUnitKey: unitKey, logicalTargetExerciseKey: exerciseKey,
  });
  state = trainingV2EditorReducer(state, {
    type: 'ADD_TARGET_SET', logicalUnitKey: unitKey, logicalTargetExerciseKey: exerciseKey,
  });
  assert.deepEqual(
    state.units[0].exercises[0].targetSets.map((set) => set.orderIndex),
    [0, 1, 2],
  );

  state = trainingV2EditorReducer(state, {
    type: 'REMOVE_TARGET_SET',
    logicalUnitKey: unitKey,
    logicalTargetExerciseKey: exerciseKey,
    logicalTargetSetKey: firstSetKey,
  });
  assert.deepEqual(
    state.units[0].exercises[0].targetSets.map((set) => set.orderIndex),
    [0, 1],
  );
  assert.ok(state.units[0].exercises[0].targetSets.every((set) => set.logicalTargetSetKey !== firstSetKey));
});

test('setting the target set field updates only the targeted set', () => {
  let state = createEmptyEditorState();
  const unitKey = state.units[0].logicalUnitKey;
  state = trainingV2EditorReducer(state, { type: 'ADD_EXERCISE', logicalUnitKey: unitKey });
  const exerciseKey = state.units[0].exercises[0].logicalTargetExerciseKey;
  const setKey = state.units[0].exercises[0].targetSets[0].logicalTargetSetKey;

  state = trainingV2EditorReducer(state, {
    type: 'SET_TARGET_SET_FIELD',
    logicalUnitKey: unitKey,
    logicalTargetExerciseKey: exerciseKey,
    logicalTargetSetKey: setKey,
    field: 'targetWeightKg',
    value: 80,
  });

  assert.equal(state.units[0].exercises[0].targetSets[0].targetWeightKg, 80);
  assert.equal(state.units[0].exercises[0].targetSets[0].plannedRestSeconds, 0);
});

test('exercise selection sets id, cached display name and resolved muscle group, clearing any draft', () => {
  let state = createEmptyEditorState();
  const unitKey = state.units[0].logicalUnitKey;
  state = trainingV2EditorReducer(state, { type: 'ADD_EXERCISE', logicalUnitKey: unitKey });
  const exerciseKey = state.units[0].exercises[0].logicalTargetExerciseKey;

  state = trainingV2EditorReducer(state, {
    type: 'SET_EXERCISE_SELECTION',
    logicalUnitKey: unitKey,
    logicalTargetExerciseKey: exerciseKey,
    exerciseId: 'exercise-42',
    exerciseName: 'Kniebeuge',
    mainMuscle: 'quadriceps',
  });

  assert.equal(state.units[0].exercises[0].exerciseId, 'exercise-42');
  assert.equal(state.units[0].exercises[0].exerciseName, 'Kniebeuge');
  assert.equal(state.units[0].exercises[0].muscleGroup, 'legs');
  assert.equal(state.units[0].exercises[0].exerciseDraft, null);
});

test('confirming a suggestion always wins over an in-progress draft on the same row', () => {
  let state = createEmptyEditorState();
  const unitKey = state.units[0].logicalUnitKey;
  state = trainingV2EditorReducer(state, { type: 'ADD_EXERCISE', logicalUnitKey: unitKey });
  const exerciseKey = state.units[0].exercises[0].logicalTargetExerciseKey;

  state = trainingV2EditorReducer(state, {
    type: 'SET_EXERCISE_DRAFT', logicalUnitKey: unitKey, logicalTargetExerciseKey: exerciseKey, name: 'Neue Übung',
  });
  assert.ok(state.units[0].exercises[0].exerciseDraft);

  state = trainingV2EditorReducer(state, {
    type: 'SET_EXERCISE_SELECTION',
    logicalUnitKey: unitKey,
    logicalTargetExerciseKey: exerciseKey,
    exerciseId: 'exercise-42',
    exerciseName: 'Kniebeuge',
    mainMuscle: 'quadriceps',
  });

  assert.equal(state.units[0].exercises[0].exerciseId, 'exercise-42');
  assert.equal(state.units[0].exercises[0].exerciseDraft, null);
});

test('SET_EXERCISE_DRAFT starts a fresh private draft with a stable logicalKey that survives a rename', () => {
  let state = createEmptyEditorState();
  const unitKey = state.units[0].logicalUnitKey;
  state = trainingV2EditorReducer(state, { type: 'ADD_EXERCISE', logicalUnitKey: unitKey });
  const exerciseKey = state.units[0].exercises[0].logicalTargetExerciseKey;

  state = trainingV2EditorReducer(state, {
    type: 'SET_EXERCISE_DRAFT', logicalUnitKey: unitKey, logicalTargetExerciseKey: exerciseKey, name: 'Kabelzug schräg',
  });
  const draft = state.units[0].exercises[0].exerciseDraft;
  assert.equal(state.units[0].exercises[0].exerciseId, null);
  assert.equal(draft.name, 'Kabelzug schräg');
  assert.equal(draft.mainMuscle, 'other');
  assert.equal(draft.category, 'strength');
  assert.equal(state.units[0].exercises[0].muscleGroup, 'other');
  assert.match(draft.logicalKey, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

  // Retyping a still-unmatched name keeps the same logicalKey — it is still "the same" local
  // private exercise, only renamed.
  const nextState = trainingV2EditorReducer(state, {
    type: 'SET_EXERCISE_DRAFT', logicalUnitKey: unitKey, logicalTargetExerciseKey: exerciseKey, name: 'Kabelzug schräg oben',
  });
  const nextDraft = nextState.units[0].exercises[0].exerciseDraft;
  assert.equal(nextDraft.logicalKey, draft.logicalKey);
  assert.equal(nextDraft.name, 'Kabelzug schräg oben');
});

test('category for a new draft is derived from the owning unit type: mobility/stretching pass through, strength maps to strength', () => {
  assert.equal(categoryForUnitType('mobility'), 'mobility');
  assert.equal(categoryForUnitType('stretching'), 'stretching');
  assert.equal(categoryForUnitType('strength'), 'strength');
});

test('categoryForUnitType covers every real exercise-enabled unit type (trainingUnitTypeSchema in @grow/shared: strength/run/rest/mobility/stretching) and never silently defaults a non-exercise-enabled or unknown type to strength', () => {
  // run/rest are real unit types but never carry target exercises at all (unitTypeForbidsExercises)
  // — reaching this function for one of them means the UI's own gating was bypassed, so it
  // must fail loudly rather than quietly filing them under 'strength'.
  assert.throws(() => categoryForUnitType('run'), /not exercise-enabled/);
  assert.throws(() => categoryForUnitType('rest'), /not exercise-enabled/);
  // 'cardio' is a real exerciseCategorySchema value, but it is NOT one of the five real unit
  // types — there is no "cardio unit" to map, so this must not be silently accepted either.
  assert.throws(() => categoryForUnitType('cardio'), /not exercise-enabled/);
  assert.throws(() => categoryForUnitType('some_future_unit_type'), /not exercise-enabled/);
  assert.throws(() => categoryForUnitType(undefined), /not exercise-enabled/);
});

test('SET_EXERCISE_DRAFT and SET_EXERCISE_MUSCLE_GROUP category derivation stays consistent with categoryForUnitType', () => {
  let state = createEmptyEditorState();
  const unitKey = state.units[0].logicalUnitKey;
  state = trainingV2EditorReducer(state, { type: 'SET_UNIT_TYPE', logicalUnitKey: unitKey, unitType: 'mobility' });
  state = trainingV2EditorReducer(state, { type: 'ADD_EXERCISE', logicalUnitKey: unitKey });
  const exerciseKey = state.units[0].exercises[0].logicalTargetExerciseKey;
  state = trainingV2EditorReducer(state, {
    type: 'SET_EXERCISE_DRAFT', logicalUnitKey: unitKey, logicalTargetExerciseKey: exerciseKey, name: 'Hüftbeuger Dehnung',
  });
  assert.equal(state.units[0].exercises[0].exerciseDraft.category, 'mobility');
});

test('changing the muscle group of a bound known exercise converts it into a private draft with a fresh logicalKey but the existing name', () => {
  let state = createEmptyEditorState();
  const unitKey = state.units[0].logicalUnitKey;
  state = trainingV2EditorReducer(state, { type: 'ADD_EXERCISE', logicalUnitKey: unitKey });
  const exerciseKey = state.units[0].exercises[0].logicalTargetExerciseKey;
  state = trainingV2EditorReducer(state, {
    type: 'SET_EXERCISE_SELECTION',
    logicalUnitKey: unitKey,
    logicalTargetExerciseKey: exerciseKey,
    exerciseId: 'exercise-42',
    exerciseName: 'Kniebeuge',
    mainMuscle: 'quadriceps',
  });

  state = trainingV2EditorReducer(state, {
    type: 'SET_EXERCISE_MUSCLE_GROUP', logicalUnitKey: unitKey, logicalTargetExerciseKey: exerciseKey, muscleGroup: 'back',
  });

  const exercise = state.units[0].exercises[0];
  assert.equal(exercise.exerciseId, null);
  assert.equal(exercise.exerciseName, 'Kniebeuge');
  assert.equal(exercise.muscleGroup, 'back');
  assert.ok(exercise.exerciseDraft);
  assert.equal(exercise.exerciseDraft.name, 'Kniebeuge');
  assert.equal(exercise.exerciseDraft.mainMuscle, 'back');
  assert.equal(exercise.exerciseDraft.category, 'strength');
});

test('changing the muscle group of an already-drafted private exercise updates it in place, keeping the same logicalKey and name', () => {
  let state = createEmptyEditorState();
  const unitKey = state.units[0].logicalUnitKey;
  state = trainingV2EditorReducer(state, { type: 'ADD_EXERCISE', logicalUnitKey: unitKey });
  const exerciseKey = state.units[0].exercises[0].logicalTargetExerciseKey;
  state = trainingV2EditorReducer(state, {
    type: 'SET_EXERCISE_DRAFT', logicalUnitKey: unitKey, logicalTargetExerciseKey: exerciseKey, name: 'Eigene Übung',
  });
  const originalLogicalKey = state.units[0].exercises[0].exerciseDraft.logicalKey;

  state = trainingV2EditorReducer(state, {
    type: 'SET_EXERCISE_MUSCLE_GROUP', logicalUnitKey: unitKey, logicalTargetExerciseKey: exerciseKey, muscleGroup: 'triceps',
  });

  const exercise = state.units[0].exercises[0];
  assert.equal(exercise.exerciseDraft.logicalKey, originalLogicalKey);
  assert.equal(exercise.exerciseDraft.name, 'Eigene Übung');
  assert.equal(exercise.exerciseDraft.mainMuscle, 'triceps');
  assert.equal(exercise.muscleGroup, 'triceps');
});

test('empty confirmed text removes the entire exercise row, including its sets and note', () => {
  let state = createEmptyEditorState();
  const unitKey = state.units[0].logicalUnitKey;
  state = trainingV2EditorReducer(state, { type: 'ADD_EXERCISE', logicalUnitKey: unitKey });
  const exerciseKey = state.units[0].exercises[0].logicalTargetExerciseKey;
  state = trainingV2EditorReducer(state, {
    type: 'SET_EXERCISE_NOTE', logicalUnitKey: unitKey, logicalTargetExerciseKey: exerciseKey, note: 'leicht',
  });

  state = trainingV2EditorReducer(state, { type: 'REMOVE_EXERCISE', logicalUnitKey: unitKey, logicalTargetExerciseKey: exerciseKey });

  assert.equal(state.units[0].exercises.length, 0);
});

test('validation flags missing exercise on strength units and exercises without exercise or target sets', () => {
  let state = createEmptyEditorState();
  const unitKey = state.units[0].logicalUnitKey;
  let issues = getEditorValidationIssues(state, { mode: 'create' });
  assert.ok(issues.some((issue) => issue.path === `units.0.exercises`));
  assert.ok(issues.some((issue) => issue.path === 'weeklyGoal'));

  state = trainingV2EditorReducer(state, { type: 'ADD_EXERCISE', logicalUnitKey: unitKey });
  const exerciseKey = state.units[0].exercises[0].logicalTargetExerciseKey;
  issues = getEditorValidationIssues(state, { mode: 'create' });
  assert.ok(issues.some((issue) => issue.path === `units.0.exercises.0.exerciseId`));

  state = trainingV2EditorReducer(state, {
    type: 'REMOVE_TARGET_SET',
    logicalUnitKey: unitKey,
    logicalTargetExerciseKey: exerciseKey,
    logicalTargetSetKey: state.units[0].exercises[0].targetSets[0].logicalTargetSetKey,
  });
  issues = getEditorValidationIssues(state, { mode: 'create' });
  assert.ok(issues.some((issue) => issue.path === `units.0.exercises.0.targetSets`));
});

test('a private draft with a name satisfies the "an exercise must be chosen" validation, same as a bound exerciseId', () => {
  let state = createEmptyEditorState();
  const unitKey = state.units[0].logicalUnitKey;
  state = trainingV2EditorReducer(state, { type: 'ADD_EXERCISE', logicalUnitKey: unitKey });
  const exerciseKey = state.units[0].exercises[0].logicalTargetExerciseKey;
  state = trainingV2EditorReducer(state, {
    type: 'SET_EXERCISE_DRAFT', logicalUnitKey: unitKey, logicalTargetExerciseKey: exerciseKey, name: 'Eigene Übung',
  });

  const issues = getEditorValidationIssues(state, { mode: 'create' });
  assert.ok(!issues.some((issue) => issue.path === 'units.0.exercises.0.exerciseId'));
});

test('run/rest units with exercises are flagged invalid', () => {
  let state = createEmptyEditorState();
  const unitKey = state.units[0].logicalUnitKey;
  state = trainingV2EditorReducer(state, { type: 'ADD_EXERCISE', logicalUnitKey: unitKey });
  // Force an inconsistent state directly (bypassing the reducer's own clearing rule)
  // to prove the validator itself also rejects it defensively.
  const forced = { ...state, units: [{ ...state.units[0], unitType: 'run' }] };
  const issues = getEditorValidationIssues(forced, { mode: 'create' });
  assert.ok(issues.some((issue) => issue.path === 'units.0.exercises'));
});

test('weeklyGoal validation only applies in create mode', () => {
  const state = createEmptyEditorState();
  const createIssues = getEditorValidationIssues(state, { mode: 'create' });
  const editIssues = getEditorValidationIssues(state, { mode: 'edit' });
  assert.ok(createIssues.some((issue) => issue.path === 'weeklyGoal'));
  assert.ok(!editIssues.some((issue) => issue.path === 'weeklyGoal'));
});

test('buildCreatePlanInput strips display-only fields and coerces empty notes to null', () => {
  let state = createEmptyEditorState();
  state = trainingV2EditorReducer(state, { type: 'SET_NAME', name: '  Ganzkörper  ' });
  state = trainingV2EditorReducer(state, { type: 'SET_WEEKLY_GOAL', weeklyGoal: '3' });
  const unitKey = state.units[0].logicalUnitKey;
  state = trainingV2EditorReducer(state, { type: 'ADD_EXERCISE', logicalUnitKey: unitKey });
  const exerciseKey = state.units[0].exercises[0].logicalTargetExerciseKey;
  state = trainingV2EditorReducer(state, {
    type: 'SET_EXERCISE_SELECTION',
    logicalUnitKey: unitKey,
    logicalTargetExerciseKey: exerciseKey,
    exerciseId: 'exercise-1',
    exerciseName: 'Kniebeuge',
  });
  state = trainingV2EditorReducer(state, {
    type: 'SET_EXERCISE_NOTE', logicalUnitKey: unitKey, logicalTargetExerciseKey: exerciseKey, note: '   ',
  });

  const input = buildCreatePlanInput(state);

  assert.equal(input.name, 'Ganzkörper');
  assert.equal(input.weeklyGoal, 3);
  assert.equal(input.units[0].exercises[0].note, null);
  assert.equal('exerciseName' in input.units[0].exercises[0], false);
  assert.equal('muscleGroup' in input.units[0].exercises[0], false);
  assert.equal(input.units[0].exercises[0].exerciseId, 'exercise-1');
  assert.equal('exerciseDraft' in input.units[0].exercises[0], false);
  assert.equal(input.units[0].logicalUnitKey, unitKey);
});

test('a private draft is sent as exerciseDraft, never as exerciseId, and the editor never calls the exercise-creation endpoint', () => {
  let state = createEmptyEditorState();
  state = trainingV2EditorReducer(state, { type: 'SET_NAME', name: 'Mobility Tag' });
  state = trainingV2EditorReducer(state, { type: 'SET_WEEKLY_GOAL', weeklyGoal: '2' });
  const unitKey = state.units[0].logicalUnitKey;
  state = trainingV2EditorReducer(state, { type: 'SET_UNIT_TYPE', logicalUnitKey: unitKey, unitType: 'mobility' });
  state = trainingV2EditorReducer(state, { type: 'ADD_EXERCISE', logicalUnitKey: unitKey });
  const exerciseKey = state.units[0].exercises[0].logicalTargetExerciseKey;
  state = trainingV2EditorReducer(state, {
    type: 'SET_EXERCISE_DRAFT', logicalUnitKey: unitKey, logicalTargetExerciseKey: exerciseKey, name: 'Hüftöffner',
  });

  const input = buildCreatePlanInput(state);
  const exerciseInput = input.units[0].exercises[0];

  assert.equal('exerciseId' in exerciseInput, false);
  assert.deepEqual(exerciseInput.exerciseDraft, {
    logicalKey: state.units[0].exercises[0].exerciseDraft.logicalKey,
    name: 'Hüftöffner',
    mainMuscle: 'other',
    category: 'mobility',
  });
});

test('buildUpdatePlanInput carries expectedVersion and omits weeklyGoal entirely', () => {
  const state = createEmptyEditorState();
  const input = buildUpdatePlanInput(state, 7);
  assert.equal(input.expectedVersion, 7);
  assert.equal('weeklyGoal' in input, false);
});

test('buildCreatePlanInput and buildUpdatePlanInput always neutralize targetRir to null and plannedRestSeconds to 0, even for a set loaded with old non-neutral server values, while kg and Wiederholungen survive unchanged', () => {
  const plan = {
    name: 'Ganzkörper',
    weeklyGoal: 3,
    revision: {
      units: [{
        logicalUnitKey: 'unit-1',
        name: 'Tag 1',
        unitType: 'strength',
        orderIndex: 0,
        exercises: [{
          logicalTargetExerciseKey: 'exercise-1',
          exerciseId: 'exercise-1',
          orderIndex: 0,
          note: null,
          // Simulates a set persisted before the RIR/rest-seconds fields were removed from
          // the editor (or copied from a template) — these must never survive a save made
          // through the current editor, even though the user never touched this set at all.
          targetSets: [{
            logicalTargetSetKey: 'set-1',
            orderIndex: 0,
            setType: 'work',
            targetWeightKg: 60,
            targetReps: { minimum: 8, maximum: 8 },
            targetRir: 3,
            plannedRestSeconds: 120,
            importedFromLegacyPlan: false,
          }],
        }],
      }],
    },
  };
  const state = mapTrainingPlanToEditorState(plan, { 'exercise-1': 'Kniebeuge' });

  for (const input of [buildCreatePlanInput(state), buildUpdatePlanInput(state, 1)]) {
    const set = input.units[0].exercises[0].targetSets[0];
    assert.equal(set.targetRir, null);
    assert.equal(set.plannedRestSeconds, 0);
    assert.equal(set.targetWeightKg, 60);
    assert.deepEqual(set.targetReps, { minimum: 8, maximum: 8 });
  }
});

test('isEditorStateDirty detects real changes and ignores identical re-derivations', () => {
  const state = createEmptyEditorState();
  const untouched = dispatchAll(state, []);
  assert.equal(isEditorStateDirty(state, untouched), false);

  const changed = trainingV2EditorReducer(state, { type: 'SET_NAME', name: 'Neuer Name' });
  assert.equal(isEditorStateDirty(state, changed), true);
});
