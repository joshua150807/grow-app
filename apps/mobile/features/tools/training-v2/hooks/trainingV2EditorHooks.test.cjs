const assert = require('node:assert/strict');
const test = require('node:test');

const { loadModule } = require('../testing/loadModule.cjs');

async function flushMicrotasks() {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}

// This hook keeps its editable tree in useState (not useRef), so callbacks such as
// `save` close over a fresh `state` only on the render where they were created —
// exactly like real React. The harness re-invokes the hook body after each dispatch
// to hand back the current render's closures, mirroring how a real component would
// always wire its button handlers to the latest render's returned callbacks.
function createEditorHookHarness(planId, apiMocks) {
  const cells = [];
  const refs = [];
  let cellIndex = 0;
  let refIndex = 0;
  let effectHasRun = false;
  const react = {
    useCallback: (callback) => callback,
    useRef: (initial) => {
      const index = refIndex++;
      if (!refs[index]) refs[index] = { current: initial };
      return refs[index];
    },
    useState: (initial) => {
      const index = cellIndex++;
      if (!(index in cells)) cells[index] = typeof initial === 'function' ? initial() : initial;
      return [cells[index], (next) => {
        cells[index] = typeof next === 'function' ? next(cells[index]) : next;
      }];
    },
    useEffect: (effect) => {
      if (!effectHasRun) {
        effectHasRun = true;
        effect();
      }
    },
  };
  const model = loadModule(__dirname, '../models/trainingV2EditorModel.js');
  const module = loadModule(__dirname, './useTrainingV2PlanEditor.js', {
    react,
    '../services/trainingV2Api': apiMocks,
    '../models/trainingV2EditorModel': model,
  });

  function render() {
    cellIndex = 0;
    refIndex = 0;
    return module.useTrainingV2PlanEditor(planId);
  }

  let result = render();

  return {
    model,
    get result() { return result; },
    rerender() { result = render(); return result; },
    dispatch(action) { result.dispatch(action); result = render(); return result; },
    async settle() { await flushMicrotasks(); result = render(); return result; },
    get state() { return cells[0]; },
    get initialState() { return cells[1]; },
    get expectedVersion() { return cells[2]; },
    get loading() { return cells[3]; },
    get loadError() { return cells[4]; },
    get saving() { return cells[5]; },
    get saveError() { return cells[6]; },
    get conflict() { return cells[7]; },
  };
}

function fakeApi(overrides = {}) {
  class TrainingV2ConflictError extends Error {}
  return {
    TrainingV2ConflictError,
    getTrainingV2Plan: async () => { throw new Error('not mocked'); },
    resolveTrainingV2ExerciseDetails: async () => ({}),
    createTrainingV2Plan: async () => { throw new Error('not mocked'); },
    updateTrainingV2Plan: async () => { throw new Error('not mocked'); },
    ...overrides,
  };
}

function fillValidStrengthUnit(harness) {
  harness.dispatch({ type: 'SET_NAME', name: 'Ganzkörper' });
  harness.dispatch({ type: 'SET_WEEKLY_GOAL', weeklyGoal: '3' });
  const unitKey = harness.state.units[0].logicalUnitKey;
  harness.dispatch({ type: 'SET_UNIT_NAME', logicalUnitKey: unitKey, name: 'Tag 1' });
  harness.dispatch({ type: 'ADD_EXERCISE', logicalUnitKey: unitKey });
  const exerciseKey = harness.state.units[0].exercises[0].logicalTargetExerciseKey;
  harness.dispatch({
    type: 'SET_EXERCISE_SELECTION',
    logicalUnitKey: unitKey,
    logicalTargetExerciseKey: exerciseKey,
    exerciseId: 'exercise-1',
    exerciseName: 'Kniebeuge',
  });
  return { unitKey, exerciseKey };
}

test('create mode starts ready with an empty draft and is not dirty until edited', () => {
  const harness = createEditorHookHarness(null, fakeApi());

  assert.equal(harness.loading, false);
  assert.equal(harness.result.dirty, false);
  assert.equal(harness.state.units.length, 1);

  harness.dispatch({ type: 'SET_NAME', name: 'Neuer Plan' });
  assert.equal(harness.state.name, 'Neuer Plan');
  assert.equal(harness.result.dirty, true);
});

test('edit mode loads the plan, hydrates state with stable keys and captures the expected version', async () => {
  const plan = {
    id: 'plan-1',
    name: 'Push Pull Legs',
    weeklyGoal: 4,
    version: 3,
    revision: {
      units: [{
        logicalUnitKey: 'unit-key',
        name: 'Push',
        unitType: 'strength',
        orderIndex: 0,
        exercises: [{
          logicalTargetExerciseKey: 'exercise-key',
          exerciseId: 'exercise-1',
          orderIndex: 0,
          note: null,
          targetSets: [{
            logicalTargetSetKey: 'set-key',
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
  const harness = createEditorHookHarness('plan-1', fakeApi({
    getTrainingV2Plan: async (id) => { assert.equal(id, 'plan-1'); return plan; },
    resolveTrainingV2ExerciseDetails: async () => ({ 'exercise-1': { name: 'Bankdrücken', mainMuscle: 'chest' } }),
  }));

  assert.equal(harness.loading, true);
  await harness.settle();

  assert.equal(harness.loading, false);
  assert.equal(harness.expectedVersion, 3);
  assert.equal(harness.state.units[0].logicalUnitKey, 'unit-key');
  assert.equal(harness.state.units[0].exercises[0].logicalTargetExerciseKey, 'exercise-key');
  assert.equal(harness.state.units[0].exercises[0].exerciseName, 'Bankdrücken');
  assert.equal(harness.result.dirty, false);

  // Reordering keeps the same logical keys stable, it only changes orderIndex.
  harness.dispatch({ type: 'ADD_UNIT' });
  const secondUnitKey = harness.state.units[1].logicalUnitKey;
  harness.dispatch({ type: 'MOVE_UNIT', logicalUnitKey: secondUnitKey, direction: 'up' });
  assert.equal(harness.state.units[0].logicalUnitKey, secondUnitKey);
  assert.equal(harness.state.units[1].logicalUnitKey, 'unit-key');
  assert.deepEqual(harness.state.units.map((unit) => unit.orderIndex), [0, 1]);
  assert.equal(harness.result.dirty, true);
});

test('a load failure surfaces as loadError and retryLoad recovers', async () => {
  let attempt = 0;
  const harness = createEditorHookHarness('plan-1', fakeApi({
    getTrainingV2Plan: async () => {
      attempt += 1;
      if (attempt === 1) throw new Error('network down');
      return {
        id: 'plan-1', name: 'Plan', weeklyGoal: 1, version: 1,
        revision: { units: [] },
      };
    },
  }));

  await harness.settle();
  assert.ok(harness.loadError);
  assert.equal(harness.loading, false);

  await harness.result.retryLoad();
  harness.rerender();
  assert.equal(harness.loadError, null);
  assert.equal(harness.state.name, 'Plan');
});

test('save is blocked locally by validation issues and never calls the API', async () => {
  const calls = [];
  const harness = createEditorHookHarness(null, fakeApi({
    createTrainingV2Plan: async (input) => { calls.push(input); return { id: 'x' }; },
  }));

  const outcome = await harness.result.save();
  assert.equal(outcome.ok, false);
  assert.ok(outcome.issues.length > 0);
  assert.equal(calls.length, 0);
  assert.equal(harness.saveError.type, 'validation');
});

test('a valid create submits the built payload (stripped of display-only fields) and returns the created plan', async () => {
  const calls = [];
  const harness = createEditorHookHarness(null, fakeApi({
    createTrainingV2Plan: async (input) => { calls.push(input); return { id: 'new-plan', name: input.name }; },
  }));

  fillValidStrengthUnit(harness);
  assert.equal(harness.result.dirty, true);

  const outcome = await harness.result.save();
  assert.equal(outcome.ok, true);
  assert.equal(outcome.plan.id, 'new-plan');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'Ganzkörper');
  assert.equal(calls[0].weeklyGoal, 3);
  assert.equal('exerciseName' in calls[0].units[0].exercises[0], false);

  // The just-saved draft becomes the new baseline: dirty must flip to false right away.
  harness.rerender();
  assert.equal(harness.result.dirty, false);
});

test('a successful edit save makes the just-saved draft the new baseline, so dirty flips to false', async () => {
  const plan = {
    id: 'plan-1', name: 'Original', weeklyGoal: 2, version: 1,
    revision: {
      units: [{
        logicalUnitKey: 'unit-1', name: 'Tag 1', unitType: 'rest', orderIndex: 0,
        exercises: [],
      }],
    },
  };
  const calls = [];
  const harness = createEditorHookHarness('plan-1', fakeApi({
    getTrainingV2Plan: async () => plan,
    updateTrainingV2Plan: async (id, input) => {
      calls.push([id, input]);
      return { id: 'plan-1', name: input.name, revision: { units: [] } };
    },
  }));
  await harness.settle();
  assert.equal(harness.result.dirty, false);

  harness.dispatch({ type: 'SET_UNIT_NAME', logicalUnitKey: 'unit-1', name: 'Geänderter Name' });
  assert.equal(harness.result.dirty, true);

  const outcome = await harness.result.save();
  assert.equal(outcome.ok, true);
  assert.equal(calls.length, 1);
  assert.equal('weeklyGoal' in calls[0][1], false);

  harness.rerender();
  assert.equal(harness.result.dirty, false);
});

test('a failed save (network error) leaves dirty true and does not move the baseline', async () => {
  const harness = createEditorHookHarness(null, fakeApi({
    createTrainingV2Plan: async () => { throw new Error('offline'); },
  }));
  fillValidStrengthUnit(harness);
  assert.equal(harness.result.dirty, true);

  const outcome = await harness.result.save();
  assert.equal(outcome.ok, false);
  assert.equal(harness.saveError.type, 'api');

  harness.rerender();
  assert.equal(harness.result.dirty, true);
});

test('a second concurrent save call is deduplicated while the first is in flight', async () => {
  let resolveFirst;
  const calls = [];
  const harness = createEditorHookHarness(null, fakeApi({
    createTrainingV2Plan: async (input) => {
      calls.push(input);
      return new Promise((resolve) => { resolveFirst = () => resolve({ id: 'plan-x' }); });
    },
  }));
  fillValidStrengthUnit(harness);

  const firstCall = harness.result.save();
  assert.equal(harness.saving, true);
  const secondOutcome = await harness.result.save();
  assert.equal(secondOutcome.ok, false);
  assert.equal(calls.length, 1);

  resolveFirst();
  const firstOutcome = await firstCall;
  assert.equal(firstOutcome.ok, true);
  assert.equal(harness.saving, false);
});

test('a 409 on edit sets the conflict flag without overwriting local edits, and reload discards them on demand', async () => {
  const initialPlan = {
    id: 'plan-1', name: 'Original', weeklyGoal: 2, version: 1,
    revision: {
      units: [{
        logicalUnitKey: 'unit-1', name: 'Tag 1', unitType: 'rest', orderIndex: 0,
        exercises: [],
      }],
    },
  };
  const reloadedPlan = {
    id: 'plan-1', name: 'Server-Stand', weeklyGoal: 2, version: 2,
    revision: {
      units: [{
        logicalUnitKey: 'unit-1', name: 'Tag 1 (Server)', unitType: 'rest', orderIndex: 0,
        exercises: [],
      }],
    },
  };
  let loadCount = 0;
  const conflictApi = fakeApi({
    getTrainingV2Plan: async () => { loadCount += 1; return loadCount === 1 ? initialPlan : reloadedPlan; },
  });
  conflictApi.updateTrainingV2Plan = async () => {
    throw new conflictApi.TrainingV2ConflictError('CONFLICT');
  };
  const harness = createEditorHookHarness('plan-1', conflictApi);
  await harness.settle();

  harness.dispatch({
    type: 'SET_UNIT_NAME', logicalUnitKey: 'unit-1', name: 'Lokale Änderung',
  });
  assert.equal(harness.state.units[0].name, 'Lokale Änderung');

  const outcome = await harness.result.save();
  assert.equal(outcome.ok, false);
  assert.equal(harness.conflict, true);
  // Local edit must survive until the user explicitly asks to reload, and the
  // draft must still be reported as dirty since nothing was actually persisted.
  assert.equal(harness.state.units[0].name, 'Lokale Änderung');
  harness.rerender();
  assert.equal(harness.result.dirty, true);

  await harness.result.reloadAfterConflict();
  harness.rerender();
  assert.equal(harness.conflict, false);
  assert.equal(harness.state.name, 'Server-Stand');
  assert.equal(harness.state.units[0].name, 'Tag 1 (Server)');
  assert.equal(harness.result.dirty, false);
});
