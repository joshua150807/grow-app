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
    get exactMatch() { return state[3]; },
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

test('resolves an exact normalized match (trim/case/whitespace-insensitive) from the filtered results', async () => {
  const harness = createPickerHarness(async () => ({
    exercises: [
      { id: 'similar', name: 'Bankdrücken schräg' },
      { id: 'exact', name: '  bankdrücken  ' },
    ],
  }));

  await harness.result.search({ search: 'Bankdrücken' });

  assert.deepEqual(harness.exactMatch, { id: 'exact', name: '  bankdrücken  ' });
  assert.equal(harness.results.length, 2);
});

test('reports no exact match when only similar (non-exact) results exist', async () => {
  const harness = createPickerHarness(async () => ({
    exercises: [{ id: 'similar', name: 'Bankdrücken schräg' }],
  }));

  await harness.result.search({ search: 'Bankdrücken' });

  assert.equal(harness.exactMatch, null);
});

test('clears the exact match for an empty query', async () => {
  const harness = createPickerHarness(async () => ({ exercises: [] }));

  await harness.result.search({ search: undefined });

  assert.equal(harness.exactMatch, null);
});

test('re-checks without an active category filter before ruling out an exact match', async () => {
  const calls = [];
  const harness = createPickerHarness(async (query) => {
    calls.push(query);
    if (query.category === 'cardio') return { exercises: [{ id: 'unrelated', name: 'Laufen' }] };
    return { exercises: [{ id: 'exact', name: 'Bankdrücken' }] };
  });

  await harness.result.search({ search: 'Bankdrücken', category: 'cardio' });

  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], { search: 'Bankdrücken', category: 'cardio' });
  assert.deepEqual(calls[1], { search: 'Bankdrücken' });
  assert.deepEqual(harness.exactMatch, { id: 'exact', name: 'Bankdrücken' });
  // The filtered, category-scoped results are still what gets displayed.
  assert.deepEqual(harness.results, [{ id: 'unrelated', name: 'Laufen' }]);
});

test('skips the second lookup entirely when no category filter is active', async () => {
  let calls = 0;
  const harness = createPickerHarness(async () => {
    calls += 1;
    return { exercises: [{ id: 'exact', name: 'Bankdrücken' }] };
  });

  await harness.result.search({ search: 'Bankdrücken' });

  assert.equal(calls, 1);
  assert.deepEqual(harness.exactMatch, { id: 'exact', name: 'Bankdrücken' });
});

test('prefers a private (scope=user) exact match over a same-named system exercise', async () => {
  const harness = createPickerHarness(async () => ({
    exercises: [
      { id: 'system-copy', name: 'Bankdrücken', scope: 'system' },
      { id: 'own-copy', name: 'Bankdrücken', scope: 'user' },
    ],
  }));

  await harness.result.search({ search: 'Bankdrücken' });

  assert.equal(harness.exactMatch.id, 'own-copy');
});

test('falls back to whichever match comes first when no candidate is scope=user (e.g. only system matches exist)', async () => {
  const harness = createPickerHarness(async () => ({
    exercises: [{ id: 'system-copy', name: 'Bankdrücken', scope: 'system' }],
  }));

  await harness.result.search({ search: 'Bankdrücken' });

  assert.equal(harness.exactMatch.id, 'system-copy');
});

test('reset clears the exact match alongside results and error', async () => {
  const harness = createPickerHarness(async () => ({
    exercises: [{ id: 'exact', name: 'Bankdrücken' }],
  }));
  await harness.result.search({ search: 'Bankdrücken' });
  assert.ok(harness.exactMatch);

  harness.result.reset();

  assert.equal(harness.exactMatch, null);
});

test('search resolves the fresh { results, exactMatch } directly, not just via state — so a caller never has to trust stale debounced state', async () => {
  const harness = createPickerHarness(async () => ({
    exercises: [{ id: 'exact', name: 'Bankdrücken' }],
  }));

  const resolved = await harness.result.search({ search: 'Bankdrücken' });

  assert.deepEqual(resolved, {
    results: [{ id: 'exact', name: 'Bankdrücken' }],
    exactMatch: { id: 'exact', name: 'Bankdrücken' },
  });
});

test('a failed search still resolves (not throws) with an empty exactMatch, so a confirm caller can safely proceed to create', async () => {
  const harness = createPickerHarness(async () => { throw new Error('offline'); });

  const resolved = await harness.result.search({ search: 'Bankdrücken' });

  assert.equal(resolved.exactMatch, null);
  assert.deepEqual(resolved.results, []);
  assert.ok(resolved.error);
});
