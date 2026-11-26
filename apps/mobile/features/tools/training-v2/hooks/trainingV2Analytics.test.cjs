const test = require('node:test'), assert = require('node:assert/strict');
const { loadModule } = require('../testing/loadModule.cjs');
const { createHookHarness } = require('../testing/createHookHarness.cjs');
const moduleWith = react => loadModule(__dirname, './useTrainingV2Analytics.js', { react, 'expo-router': { useFocusEffect: callback => react.useEffect(callback, [callback]) }, '../services/trainingV2Api': {} });
const { createTrainingAnalyticsRequest } = moduleWith({});
const tick = () => new Promise(setImmediate);
const page = (n, hasMore = n < 1) => ({ exercises: [{ exerciseId: String(n) }], pagination: { page: n, hasMore } });
test('analytics: refresh preserves loaded pages and visible data without a loading flash', async () => {
  let state; const reads = [];
  const request = createTrainingAnalyticsRequest(async n => { reads.push(n); return page(n); }, next => { state = next; }, 'exercises');
  let blur = request.focus(); await tick(); await request.loadMore(); assert.equal(state.data.exercises.length, 2);
  blur(); blur = request.focus(); assert.equal(state.loading, false); assert.equal(state.data.exercises.length, 2);
  await tick(); assert.equal(state.data.exercises.length, 2); assert.deepEqual(reads, [0, 1, 0, 1]); blur();
});
test('analytics: background failure preserves data, native retry events do not enable refreshing', async () => {
  let state, fail = false;
  const request = createTrainingAnalyticsRequest(async () => { if (fail) throw Error('offline'); return page(0); }, next => { state = next; });
  const blur = request.focus(); await tick(); fail = true; await request.refresh({ nativeEvent: {} });
  assert.equal(state.refreshing, false); assert.equal(state.data.exercises.length, 1); assert.equal(state.error.message, 'offline'); blur();
});
test('analytics: blur invalidates delayed reads; double loadMore does not duplicate pages', async () => {
  let state, finish;
  const request = createTrainingAnalyticsRequest(n => n === 0 ? Promise.resolve(page(0)) : new Promise(resolve => { finish = resolve; }), next => { state = next; }, 'exercises');
  const blur = request.focus(); await tick(); const next = request.loadMore(); await request.loadMore(); blur(); finish(page(1)); await next;
  assert.equal(state.data.exercises.length, 1);
});
test('analytics: query/owner remount has no old data and cannot consume an older query response', async () => {
  let key = 'ownerA', finish;
  const harness = createHookHarness(react => {
    const { useTrainingAnalyticsResource } = moduleWith(react);
    return () => { const read = react.useCallback(() => key === 'ownerA' ? new Promise(resolve => { finish = resolve; }) : Promise.resolve({ owner: 'B' }), [key]); return useTrainingAnalyticsResource(read); };
  });
  harness.render(); await tick(); key = 'ownerB'; harness.render(); assert.equal(harness.result.data, null);
  await harness.settle(); finish({ owner: 'A' }); await harness.settle(); assert.equal(harness.result.data.owner, 'B'); harness.unmount();
});
test('analytics: overlapping pages after a new save are deduplicated by stable session identity', async () => {
  let state;
  const request = createTrainingAnalyticsRequest(async n => ({ points: n === 0 ? [{ sessionId: 'new' }, { sessionId: 'shared' }] : [{ sessionId: 'shared' }, { sessionId: 'old' }], pagination: { page: n, hasMore: n === 0 } }), next => { state = next; }, 'points');
  const blur = request.focus(); await tick(); await request.loadMore();
  assert.deepEqual(state.data.points.map(point => point.sessionId), ['new', 'shared', 'old']); blur();
});
