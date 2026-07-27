const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildCreatePlanInput,
  buildUpdatePlanInput,
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

  const state = mapTrainingPlanToEditorState(plan, { 'exercise-1': 'Bankdrücken' });

  assert.equal(state.name, 'Push Pull Legs');
  assert.equal(state.weeklyGoal, '4');
  assert.equal(state.units[0].logicalUnitKey, 'unit-logical-key');
  assert.equal(state.units[0].exercises[0].logicalTargetExerciseKey, 'exercise-logical-key');
  assert.equal(state.units[0].exercises[0].exerciseName, 'Bankdrücken');
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

test('exercise selection sets id and cached display name for the picker', () => {
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
  });

  assert.equal(state.units[0].exercises[0].exerciseId, 'exercise-42');
  assert.equal(state.units[0].exercises[0].exerciseName, 'Kniebeuge');
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
  assert.equal(input.units[0].logicalUnitKey, unitKey);
});

test('buildUpdatePlanInput carries expectedVersion and omits weeklyGoal entirely', () => {
  const state = createEmptyEditorState();
  const input = buildUpdatePlanInput(state, 7);
  assert.equal(input.expectedVersion, 7);
  assert.equal('weeklyGoal' in input, false);
});

test('isEditorStateDirty detects real changes and ignores identical re-derivations', () => {
  const state = createEmptyEditorState();
  const untouched = dispatchAll(state, []);
  assert.equal(isEditorStateDirty(state, untouched), false);

  const changed = trainingV2EditorReducer(state, { type: 'SET_NAME', name: 'Neuer Name' });
  assert.equal(isEditorStateDirty(state, changed), true);
});
