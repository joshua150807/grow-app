const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { loadModule } = require('../testing/loadModule.cjs');

function historyModule(listTrainingV2Sessions) {
  return loadModule(__dirname, './useTrainingV2History.js', {
    react: {},
    'expo-router': {},
    '../services/trainingV2Api': { listTrainingV2Sessions },
  });
}

function page(index, ids, hasMore = false) {
  return { sessions: ids.map((id) => ({ id, status: 'completed' })), pagination: { page: index, hasMore } };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((success, failure) => {
    resolve = success;
    reject = failure;
  });
  return { promise, resolve, reject };
}

function settle() {
  return new Promise((resolve) => setImmediate(resolve));
}

test('recent sessions scan past incomplete entries across pages and return three distinct completed sessions', async () => {
  const requested = [];
  const { loadRecentCompletedSessions } = historyModule(async ({ page: index }) => {
    requested.push(index);
    const result = index === 0 ? page(0, ['a', 'b'], true) : page(1, ['b', 'c', 'd', 'e'], true);
    if (index === 0) result.sessions[0].status = 'incomplete';
    return result;
  });
  assert.deepEqual((await loadRecentCompletedSessions()).map(({ id }) => id), ['b', 'c', 'd']);
  assert.deepEqual(requested, [0, 1]);
});

test('pull-to-refresh discards an in-flight next page and immediately clears its loading flag', async () => {
  const pending = deferred();
  const requested = [];
  const { createHistoryRequest } = historyModule(({ page: index }) => {
    requested.push(index);
    return pending.promise;
  });
  let state;
  let version = 0;
  const request = createHistoryRequest(
    async () => page(0, [String(++version)], true),
    (next) => { state = next; },
    () => assert.fail('stale page must not be appended'),
  );
  const blur = request.focus();
  await settle();
  const more = request.loadMore();
  await request.loadMore();
  assert.deepEqual(requested, [1]);
  assert.equal(state.loadingMore, true);
  await request.refresh(true);
  assert.equal(state.loadingMore, false);
  assert.equal(state.refreshing, false);
  pending.resolve(page(1, ['stale']));
  await more;
  assert.equal(state.data.sessions[0].id, '2');
  blur();
});

test('failed next page retries the same cursor and the successful result deduplicates overlap', async () => {
  const requested = [];
  const failure = new Error('offline');
  const { createHistoryRequest, appendHistoryPage } = historyModule(async ({ page: index }) => {
    requested.push(index);
    if (requested.length === 1) throw failure;
    return page(1, ['a', 'b']);
  });
  let state;
  const request = createHistoryRequest(async () => page(0, ['a'], true), (next) => { state = next; }, appendHistoryPage);
  const blur = request.focus();
  await settle();
  await request.loadMore();
  assert.equal(state.moreError, failure);
  assert.equal(state.loadingMore, false);
  assert.equal(state.data.pagination.page, 0);
  await request.loadMore();
  assert.deepEqual(requested, [1, 1]);
  assert.deepEqual(state.data.sessions.map(({ id }) => id), ['a', 'b']);
  assert.equal(state.moreError, null);
  assert.equal(state.loadingMore, false);
  blur();
});

test('refocus ignores a rejected prior read and current API errors remain visible until retry', async () => {
  const previous = deferred();
  const unavailable = Object.assign(new Error('Historie nicht verfügbar'), { code: 'TRAINING_V2_HISTORY_UNAVAILABLE' });
  const reads = [() => previous.promise, async () => { throw unavailable; }, async () => 'snapshot'];
  const { createHistoryRequest } = historyModule();
  let state;
  const request = createHistoryRequest(() => reads.shift()(), (next) => { state = next; });
  request.focus()();
  const blur = request.focus();
  await settle();
  previous.reject(new Error('stale failure'));
  await settle();
  assert.equal(state.error, unavailable);
  assert.equal(state.loading, false);
  await request.refresh();
  assert.equal(state.error, null);
  assert.equal(state.data, 'snapshot');
  blur();
});

test('history screens wire independent retries, snapshot-only details and navigation without a plan', () => {
  const screen = (name) => fs.readFileSync(path.resolve(__dirname, '../screens', name), 'utf8');
  const myTraining = screen('TrainingV2MyTrainingScreen.jsx');
  assert.match(myTraining, /pathname: '\/tools\/training-v2-history'/);
  assert.match(myTraining, /<\/> : null\}\s*<RecentTrainingSection recent=/);
  const history = screen('TrainingV2HistoryScreen.jsx');
  assert.match(history, /error=\{stats.error\} onRetry=\{stats.retry\}/);
  assert.match(history, /error=\{history.moreError\} onRetry=\{history.loadMore\}/);
  const detail = screen('TrainingV2SessionDetailScreen.jsx');
  assert.match(detail, /duration !== null/);
  assert.match(detail, /set.weightKg !== null/);
  assert.match(detail, /set.reps !== null/);
  assert.doesNotMatch(detail, /TextInput|createTrainingV2Session/);
});
