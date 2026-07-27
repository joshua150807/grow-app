const assert = require('node:assert/strict');
const test = require('node:test');

const { loadModule } = require('../testing/loadModule.cjs');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, reject, resolve };
}

async function flush() {
  await new Promise((resolve) => setImmediate(resolve));
}

function createPlansHookHarness(listPlans) {
  const state = [];
  const refs = [];
  let stateIndex = 0;
  let refIndex = 0;
  let focusCallback;
  let cleanup;
  const react = {
    useCallback: (callback) => callback,
    useRef: (initial) => {
      const index = refIndex++;
      if (!refs[index]) refs[index] = { current: initial };
      return refs[index];
    },
    useState: (initial) => {
      const index = stateIndex++;
      if (!(index in state)) state[index] = initial;
      return [state[index], (next) => {
        state[index] = typeof next === 'function' ? next(state[index]) : next;
      }];
    },
  };
  const module = loadModule(__dirname, './useTrainingV2Plans.js', {
    react,
    'expo-router': {
      useFocusEffect: (callback) => {
        focusCallback = callback;
        cleanup = callback();
      },
    },
    '../services/trainingV2Api': { listTrainingV2Plans: listPlans },
  });
  const render = () => {
    stateIndex = 0;
    refIndex = 0;
    return module.useTrainingV2Plans();
  };
  const result = render();

  return {
    get plans() { return state[0]; },
    get loading() { return state[1]; },
    get refreshing() { return state[2]; },
    refresh: result.refresh,
    refocus() {
      cleanup?.();
      cleanup = focusCallback();
    },
    unmount() {
      cleanup?.();
    },
  };
}

test('focus reload applies the newest response and rejects a stale older response', async () => {
  const first = deferred();
  const second = deferred();
  let calls = 0;
  const harness = createPlansHookHarness(() => {
    calls += 1;
    return calls === 1 ? first.promise : second.promise;
  });

  harness.refocus();
  second.resolve([{ id: 'new' }]);
  await flush();
  first.resolve([{ id: 'old' }]);
  await flush();

  assert.equal(calls, 2);
  assert.deepEqual(harness.plans, [{ id: 'new' }]);
});

test('pull-to-refresh exposes refreshing state and applies the response', async () => {
  const initial = deferred();
  const refreshed = deferred();
  let calls = 0;
  const harness = createPlansHookHarness(() => {
    calls += 1;
    return calls === 1 ? initial.promise : refreshed.promise;
  });
  initial.resolve([]);
  await flush();

  const refreshPromise = harness.refresh();
  assert.equal(harness.refreshing, true);
  refreshed.resolve([{ id: 'refreshed' }]);
  await refreshPromise;

  assert.deepEqual(harness.plans, [{ id: 'refreshed' }]);
  assert.equal(harness.refreshing, false);
});

test('unmount prevents a late state update', async () => {
  const request = deferred();
  const harness = createPlansHookHarness(() => request.promise);
  harness.unmount();
  request.resolve([{ id: 'late' }]);
  await flush();
  assert.deepEqual(harness.plans, []);
});

test('archive visibility is initially closed and toggles through the interaction callback', () => {
  const state = [];
  let stateIndex = 0;
  const module = loadModule(__dirname, './useTrainingV2ArchiveVisibility.js', {
    react: {
      useCallback: (callback) => callback,
      useState: (initial) => {
        const index = stateIndex++;
        if (!(index in state)) state[index] = initial;
        return [state[index], (next) => {
          state[index] = typeof next === 'function' ? next(state[index]) : next;
        }];
      },
    },
  });
  const render = () => {
    stateIndex = 0;
    return module.useTrainingV2ArchiveVisibility();
  };

  const initial = render();
  assert.equal(initial.archivesExpanded, false);
  initial.toggleArchives();
  assert.equal(render().archivesExpanded, true);
  render().toggleArchives();
  assert.equal(render().archivesExpanded, false);
});

test('an Exercise 404 fallback still produces a renderable detail plan', async () => {
  const state = [];
  const refs = [];
  let stateIndex = 0;
  let refIndex = 0;
  const react = {
    useCallback: (callback) => callback,
    useRef: (initial) => {
      const index = refIndex++;
      if (!refs[index]) refs[index] = { current: initial };
      return refs[index];
    },
    useState: (initial) => {
      const index = stateIndex++;
      if (!(index in state)) state[index] = initial;
      return [state[index], (next) => {
        state[index] = typeof next === 'function' ? next(state[index]) : next;
      }];
    },
  };
  const viewModel = loadModule(__dirname, '../models/trainingV2ViewModel.js');
  const plan = {
    id: 'plan',
    status: 'active',
    revision: {
      units: [{
        id: 'unit',
        unitType: 'strength',
        exercises: [{ id: 'target', exerciseId: 'deleted', targetSets: [] }],
      }],
    },
  };
  const module = loadModule(__dirname, './useTrainingV2PlanDetail.js', {
    react,
    'expo-router': { useFocusEffect: (callback) => callback() },
    '../services/trainingV2Api': {
      getTrainingV2Plan: async () => plan,
      resolveTrainingV2ExerciseNames: async () => ({ deleted: undefined }),
    },
    '../models/trainingV2ViewModel': viewModel,
  });

  stateIndex = 0;
  refIndex = 0;
  module.useTrainingV2PlanDetail('plan');
  await flush();

  assert.equal(state[3], null);
  assert.equal(
    state[0].units[0].exercises[0].exerciseName,
    'Unbekannte Übung',
  );
});
