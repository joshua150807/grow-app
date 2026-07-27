const assert = require('node:assert/strict');
const test = require('node:test');

const { loadModule } = require('../testing/loadModule.cjs');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((onResolve, onReject) => { resolve = onResolve; reject = onReject; });
  return { promise, resolve, reject };
}

async function flush() {
  await new Promise((resolve) => setImmediate(resolve));
}

function createPickerHarness(listExercises) {
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
      if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
      return [state[index], (next) => {
        state[index] = typeof next === 'function' ? next(state[index]) : next;
      }];
    },
  };
  const module = loadModule(__dirname, './useTrainingV2ExercisePicker.js', {
    react,
    '../services/trainingV2Api': { listTrainingV2Exercises: listExercises },
  });
  const result = module.useTrainingV2ExercisePicker();

  return {
    result,
    get results() { return state[0]; },
    get loading() { return state[1]; },
    get error() { return state[2]; },
  };
}

test('search reflects loading, applies results and resets state on demand', async () => {
  const call = deferred();
  const harness = createPickerHarness(() => call.promise);

  const searchPromise = harness.result.search({ search: 'bank' });
  assert.equal(harness.loading, true);
  call.resolve({ exercises: [{ id: 'exercise-1', name: 'Bankdrücken' }] });
  await searchPromise;

  assert.equal(harness.loading, false);
  assert.deepEqual(harness.results, [{ id: 'exercise-1', name: 'Bankdrücken' }]);

  harness.result.reset();
  assert.deepEqual(harness.results, []);
  assert.equal(harness.error, null);
});

test('a stale search response is rejected once a newer search has started', async () => {
  const first = deferred();
  const second = deferred();
  let calls = 0;
  const harness = createPickerHarness(() => {
    calls += 1;
    return calls === 1 ? first.promise : second.promise;
  });

  const firstSearch = harness.result.search({ search: 'a' });
  const secondSearch = harness.result.search({ search: 'b' });
  second.resolve({ exercises: [{ id: 'newer' }] });
  await secondSearch;
  first.resolve({ exercises: [{ id: 'older' }] });
  await firstSearch;
  await flush();

  assert.deepEqual(harness.results, [{ id: 'newer' }]);
});

test('a failed search clears results and surfaces the error', async () => {
  const harness = createPickerHarness(async () => { throw new Error('offline'); });

  await harness.result.search({ search: 'x' });

  assert.deepEqual(harness.results, []);
  assert.ok(harness.error);
  assert.equal(harness.loading, false);
});
