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

// A minimal stand-in for trainingV2PlansCache.js's contract, so hook tests can drive the
// "who is signed in" axis directly (`__setOwner`) without going through the real module's
// own supabase.auth.onAuthStateChange wiring — that wiring is covered on its own in
// trainingV2PlansCache.test.cjs. Defaulting to no owner (null) keeps the pre-existing tests
// below (which don't care about user-scoping at all) working unchanged: with no owner, both
// cache reads and writes are simply no-ops, exactly like a hook used while signed out.
function createTestPlansCache(initialOwnerId = null) {
  const store = new Map();
  let ownerId = initialOwnerId;
  return {
    getTrainingV2PlansOwnerId: () => ownerId,
    getCachedTrainingV2Plans: (userId) => (userId ? store.get(userId) ?? null : null),
    setCachedTrainingV2Plans: (userId, plans) => { if (userId) store.set(userId, plans); },
    __setOwner: (nextOwnerId) => { ownerId = nextOwnerId; },
  };
}

function createPlansHookHarness(listPlans, cache = createTestPlansCache()) {
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
    '../services/trainingV2PlansCache': cache,
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
    get error() { return state[3]; },
    get fetching() { return state[4]; },
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

test('initial load with an empty cache still shows the loading state', () => {
  const cache = createTestPlansCache('user-a');
  const harness = createPlansHookHarness(() => new Promise(() => {}), cache);
  assert.equal(harness.loading, true);
  assert.deepEqual(harness.plans, []);
});

test('a fresh hook mount for the SAME signed-in user (simulating a remount across an interactive iOS swipe-back) seeds plans from the cache, never re-shows the first-load spinner, and only flags a quiet background fetch', async () => {
  const cache = createTestPlansCache('user-a');
  const harnessA = createPlansHookHarness(async () => [{ id: 'p1' }], cache);
  assert.equal(harnessA.loading, true);
  await flush();
  assert.deepEqual(harnessA.plans, [{ id: 'p1' }]);
  assert.equal(harnessA.loading, false);

  // harnessA is now "gone" (e.g. the Hub was torn down mid swipe-back); harnessB is a brand
  // new instance of the same hook, for the same user, exactly what such a remount produces.
  const harnessB = createPlansHookHarness(async () => [{ id: 'p1' }], cache);
  assert.equal(harnessB.loading, false, 'a remount for the same user must not show the fullscreen first-load spinner once a cache exists');
  assert.deepEqual(harnessB.plans, [{ id: 'p1' }], 'a remount must start from the cached plans, never an empty list');
  assert.equal(harnessB.fetching, true, 'a remount still quietly refetches in the background');
});

test('a fresh hook mount for a DIFFERENT signed-in user never sees the previous user\'s cached plans and runs a genuine first load', async () => {
  const cache = createTestPlansCache('user-a');
  const harnessA = createPlansHookHarness(async () => [{ id: 'plan-a' }], cache);
  await flush();
  assert.deepEqual(harnessA.plans, [{ id: 'plan-a' }]);

  cache.__setOwner('user-b');

  const harnessB = createPlansHookHarness(async () => [{ id: 'plan-b' }], cache);
  assert.equal(harnessB.loading, true, 'user B has no cache yet and must see a genuine first load, never a stale one from user A');
  assert.deepEqual(harnessB.plans, [], 'user B must never receive user A\'s plans as an initial state');
  await flush();
  assert.deepEqual(harnessB.plans, [{ id: 'plan-b' }]);
});

test('a fresh hook mount with no signed-in user (e.g. after logout) never serves a previous user\'s cached plans', async () => {
  const cache = createTestPlansCache('user-a');
  const harnessA = createPlansHookHarness(async () => [{ id: 'plan-a' }], cache);
  await flush();
  assert.deepEqual(harnessA.plans, [{ id: 'plan-a' }]);

  cache.__setOwner(null);

  const harnessB = createPlansHookHarness(async () => [], cache);
  assert.equal(harnessB.loading, true);
  assert.deepEqual(harnessB.plans, []);
});

test('a successful refetch updates only the current user\'s cache entry', async () => {
  const cache = createTestPlansCache('user-a');
  createPlansHookHarness(async () => [{ id: 'plan-a-v2' }], cache);
  await flush();
  assert.deepEqual(cache.getCachedTrainingV2Plans('user-a'), [{ id: 'plan-a-v2' }]);
});

test('a response that resolves after the signed-in user changed mid-flight is neither applied nor cached for either user', async () => {
  const cache = createTestPlansCache('user-a');
  const pending = deferred();
  const harness = createPlansHookHarness(() => pending.promise, cache);

  // The user switches while the request for user-a is still in flight.
  cache.__setOwner('user-b');
  pending.resolve([{ id: 'plan-a' }]);
  await flush();

  assert.deepEqual(harness.plans, [], 'a response for a user who is no longer signed in must not be applied');
  assert.equal(cache.getCachedTrainingV2Plans('user-a'), null, 'a stale response must not be cached under the user it started for');
  assert.equal(cache.getCachedTrainingV2Plans('user-b'), null, 'a stale response must not be cached under the new user either');
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

test('applyServerPlan replaces the displayed plan with a mutation response, without an extra GET', async () => {
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
    id: 'plan', status: 'draft', version: 1,
    revision: {
      units: [{
        id: 'unit', unitType: 'strength',
        exercises: [{ id: 'target', exerciseId: 'exercise-1', targetSets: [] }],
      }],
    },
  };
  let getCalls = 0;
  const module = loadModule(__dirname, './useTrainingV2PlanDetail.js', {
    react,
    'expo-router': { useFocusEffect: (callback) => callback() },
    '../services/trainingV2Api': {
      getTrainingV2Plan: async () => { getCalls += 1; return plan; },
      resolveTrainingV2ExerciseNames: async () => ({ 'exercise-1': 'Kniebeuge' }),
    },
    '../models/trainingV2ViewModel': viewModel,
  });

  stateIndex = 0;
  refIndex = 0;
  const result = module.useTrainingV2PlanDetail('plan');
  await flush();
  assert.equal(getCalls, 1);
  assert.equal(state[0].status, 'draft');

  const activatedPlan = {
    ...plan,
    status: 'active',
    version: 2,
    revision: plan.revision,
  };
  await result.applyServerPlan(activatedPlan);

  assert.equal(getCalls, 1);
  assert.equal(state[0].status, 'active');
  assert.equal(state[0].version, 2);
  assert.equal(state[0].units[0].exercises[0].exerciseName, 'Kniebeuge');
});
