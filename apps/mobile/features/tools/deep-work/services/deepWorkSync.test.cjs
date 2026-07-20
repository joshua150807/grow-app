const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { transformFileSync } = require('@babel/core');
const transformModulesCommonJs = require('@babel/plugin-transform-modules-commonjs');

function loadModule(relativePath, mocks = {}) {
  const filename = path.resolve(__dirname, relativePath);
  const code = transformFileSync(filename, {
    babelrc: false,
    configFile: false,
    plugins: [transformModulesCommonJs],
  }).code;
  const module = { exports: {} };
  const localRequire = (request) => (
    Object.prototype.hasOwnProperty.call(mocks, request) ? mocks[request] : require(request)
  );
  new Function('require', 'module', 'exports', '__filename', '__dirname', code)(
    localRequire, module, module.exports, filename, path.dirname(filename)
  );
  return module.exports;
}

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  const calls = [];
  let failSetFor = null;
  let failRemoveFor = null;
  return {
    values,
    calls,
    failNextSet(key) { failSetFor = key; },
    failNextRemove(key) { failRemoveFor = key; },
    api: {
      async getItem(key) {
        calls.push(['get', key]);
        return values.has(key) ? values.get(key) : null;
      },
      async setItem(key, value) {
        calls.push(['set', key]);
        if (failSetFor === key) {
          failSetFor = null;
          throw new Error('planned storage failure');
        }
        values.set(key, value);
      },
      async removeItem(key) {
        calls.push(['remove', key]);
        if (failRemoveFor === key) {
          failRemoveFor = null;
          throw new Error('planned remove failure');
        }
        values.delete(key);
      },
    },
  };
}

function createStore({ enabled = true, initial = {}, ids = [], authUserId = 'user-a' } = {}) {
  const storage = createStorage(initial);
  let idIndex = 0;
  let currentAuthUserId = authUserId;
  let authSequence = [];
  const store = loadModule('./deepWorkStore.js', {
    '@react-native-async-storage/async-storage': storage.api,
    './deepWorkSyncConfig': { isDeepWorkSyncEnabled: () => enabled },
    './deepWorkClientId': {
      createDeepWorkClientSessionId: () => ids[idIndex++] || `generated-${idIndex}`,
    },
    '../../../../services/supabaseClient': {
      supabase: { auth: { getSession: async () => {
        const resolvedUserId = authSequence.length ? authSequence.shift() : currentAuthUserId;
        return { data: { session: resolvedUserId ? { user: { id: resolvedUserId } } : null } };
      } } },
    },
  });
  return {
    store,
    storage,
    setAuthUserId: (userId) => { currentAuthUserId = userId; },
    setAuthSequence: (userIds) => { authSequence = [...userIds]; },
  };
}

const activeLegacy = {
  phase: 'paused', remaining: 60, totalSeconds: 120, taskName: 'Legacy', category: 'Fokus',
  updatedAt: Date.parse('2026-07-19T10:00:00.000Z'), endTimestamp: null,
};
const historyLegacy = {
  id: 'legacy-1', durationSeconds: 90, completedAt: '2026-07-19T10:05:00.000Z',
};
const queueEntry = {
  clientSessionId: 'session-a', durationSeconds: 90, completedAt: '2026-07-19T10:05:00.000Z', source: 'new',
};
const ownedActive = {
  ...activeLegacy,
  schemaVersion: 2,
  ownerUserId: 'user-a',
  clientSessionId: 'session-a',
  startedAt: '2026-07-19T10:00:00.000Z',
  legacyClaimEligible: false,
};

test('feature flag enables only the exact lowercase true string', () => {
  const config = loadModule('./deepWorkSyncConfig.js');
  const previous = process.env.EXPO_PUBLIC_DEEP_WORK_SYNC_ENABLED;
  try {
    delete process.env.EXPO_PUBLIC_DEEP_WORK_SYNC_ENABLED;
    assert.equal(config.isDeepWorkSyncEnabled(), false);
    process.env.EXPO_PUBLIC_DEEP_WORK_SYNC_ENABLED = 'false';
    assert.equal(config.isDeepWorkSyncEnabled(), false);
    process.env.EXPO_PUBLIC_DEEP_WORK_SYNC_ENABLED = 'true';
    assert.equal(config.isDeepWorkSyncEnabled(), true);
    process.env.EXPO_PUBLIC_DEEP_WORK_SYNC_ENABLED = 'TRUE';
    assert.equal(config.isDeepWorkSyncEnabled(), false);
  } finally {
    if (previous === undefined) delete process.env.EXPO_PUBLIC_DEEP_WORK_SYNC_ENABLED;
    else process.env.EXPO_PUBLIC_DEEP_WORK_SYNC_ENABLED = previous;
  }
});

test('client id prefers runtime randomUUID', () => {
  const ids = loadModule('./deepWorkClientId.js');
  assert.equal(ids.createDeepWorkClientSessionId({
    cryptoImpl: { randomUUID: () => 'runtime-uuid' },
  }), 'runtime-uuid');
});

test('client id fallback is deterministic, non-empty and bounded', () => {
  const ids = loadModule('./deepWorkClientId.js');
  const options = {
    cryptoImpl: null,
    now: () => 123456,
    random: () => 0.25,
    nextCounter: () => 7,
  };
  const first = ids.createDeepWorkClientSessionId(options);
  const second = ids.createDeepWorkClientSessionId(options);
  assert.equal(first, second);
  assert.ok(first.length > 0);
  assert.ok(first.length <= 128);
});

test('client id fallback produces many immediate IDs without duplicates', () => {
  const ids = loadModule('./deepWorkClientId.js');
  const generated = new Set();
  for (let index = 0; index < 2000; index += 1) {
    generated.add(ids.createDeepWorkClientSessionId({
      cryptoImpl: null,
      now: () => 123456,
      random: () => 0.5,
    }));
  }
  assert.equal(generated.size, 2000);
});

test('legacy active sessions remain readable without additive fields', async () => {
  const { store } = createStore({
    enabled: false,
    initial: { '@deep_work_session': JSON.stringify(activeLegacy) },
  });
  const session = await store.getSavedDeepWorkSession();
  assert.equal(session.taskName, 'Legacy');
  assert.equal(session.ownerUserId, undefined);
  assert.equal(session.clientSessionId, undefined);
});

test('legacy history remains readable without additive fields', async () => {
  const { store } = createStore({
    initial: { '@deep_work_history': JSON.stringify([historyLegacy]) },
  });
  assert.deepEqual(await store.getDeepWorkHistory(), [historyLegacy]);
});

test('queue uses a per-user namespace and separates users', async () => {
  const { store, storage, setAuthUserId } = createStore();
  await store.upsertPendingDeepWorkSyncEntry('user-a', queueEntry);
  setAuthUserId('user-b');
  await store.upsertPendingDeepWorkSyncEntry('user-b', { ...queueEntry, clientSessionId: 'session-b' });
  assert.ok(storage.values.has('@deep_work_sync_v1:user-a'));
  assert.ok(storage.values.has('@deep_work_sync_v1:user-b'));
  assert.equal((await store.getDeepWorkSyncQueue('user-b')).entries[0].clientSessionId, 'session-b');
  setAuthUserId('user-a');
  assert.equal((await store.getDeepWorkSyncQueue('user-a')).entries[0].clientSessionId, 'session-a');
});

test('queue rejects a document owned by another user without overwriting it', async () => {
  const key = '@deep_work_sync_v1:user-a';
  const original = JSON.stringify({ schemaVersion: 1, ownerUserId: 'user-b', entries: [] });
  const { store, storage } = createStore({ initial: { [key]: original } });
  await assert.rejects(store.getDeepWorkSyncQueue('user-a'), { code: 'DEEP_WORK_SYNC_OWNER_MISMATCH' });
  assert.equal(storage.values.get(key), original);
});

test('invalid queue JSON is rejected and remains byte-identical', async () => {
  const original = '{broken';
  const { store, storage } = createStore({ initial: { '@deep_work_sync_v1:user-a': original } });
  await assert.rejects(store.upsertPendingDeepWorkSyncEntry('user-a', queueEntry), {
    code: 'DEEP_WORK_SYNC_QUEUE_INVALID',
  });
  assert.equal(storage.values.get('@deep_work_sync_v1:user-a'), original);
});

test('semantically invalid queue is rejected without overwrite', async () => {
  const key = '@deep_work_sync_v1:user-a';
  const original = JSON.stringify({ schemaVersion: 1, ownerUserId: 'user-a', entries: [{ broken: true }] });
  const { store, storage } = createStore({ initial: { [key]: original } });
  await assert.rejects(store.upsertPendingDeepWorkSyncEntry('user-a', queueEntry), {
    code: 'DEEP_WORK_SYNC_QUEUE_INVALID',
  });
  assert.equal(storage.values.get(key), original);
});

test('identical queue upsert is idempotent and conflicting data is rejected', async () => {
  const { store } = createStore();
  await store.upsertPendingDeepWorkSyncEntry('user-a', queueEntry);
  await store.upsertPendingDeepWorkSyncEntry('user-a', queueEntry);
  assert.equal((await store.getDeepWorkSyncQueue('user-a')).entries.length, 1);
  await assert.rejects(
    store.upsertPendingDeepWorkSyncEntry('user-a', { ...queueEntry, durationSeconds: 91 }),
    { code: 'DEEP_WORK_SYNC_ENTRY_CONFLICT' }
  );
});

test('parallel queue upserts for one user retain every distinct entry', async () => {
  const { store } = createStore();
  await Promise.all(Array.from({ length: 25 }, (_, index) => (
    store.upsertPendingDeepWorkSyncEntry('user-a', {
      ...queueEntry,
      clientSessionId: `parallel-${index}`,
      completedAt: new Date(Date.UTC(2026, 6, 19, 10, 5, index)).toISOString(),
    })
  )));
  const queue = await store.getDeepWorkSyncQueue('user-a');
  assert.equal(queue.entries.length, 25);
  assert.equal(new Set(queue.entries.map((entry) => entry.clientSessionId)).size, 25);
});

test('queue entries can be found, marked terminal and removed', async () => {
  const { store } = createStore();
  await store.upsertPendingDeepWorkSyncEntry('user-a', queueEntry);
  assert.equal((await store.findDeepWorkSyncEntry('user-a', 'session-a')).status, 'pending');
  const terminal = await store.markDeepWorkSyncEntryTerminal('user-a', 'session-a', 'VALIDATION_ERROR');
  assert.equal(terminal.status, 'terminal');
  assert.equal(terminal.lastErrorCode, 'VALIDATION_ERROR');
  await store.removeDeepWorkSyncEntry('user-a', 'session-a');
  assert.equal(await store.findDeepWorkSyncEntry('user-a', 'session-a'), null);
});

test('first authenticated user claims legacy data and marker is written before queue', async () => {
  const { store, storage } = createStore({
    initial: {
      '@deep_work_history': JSON.stringify([historyLegacy]),
      '@deep_work_session': JSON.stringify(activeLegacy),
    },
  });
  const result = await store.claimLegacyDeepWorkData('user-a', {
    createId: (() => { let index = 0; return () => `claimed-${++index}`; })(),
    now: () => Date.parse('2026-07-19T12:00:00.000Z'),
  });
  assert.equal(result.marker.state, 'completed');
  assert.equal(result.queue.legacyImportCompleted, true);
  assert.equal(result.queue.entries.length, 1);
  const active = JSON.parse(storage.values.get('@deep_work_session'));
  assert.equal(active.ownerUserId, 'user-a');
  assert.equal(active.clientSessionId, 'claimed-2');
  const firstMarkerSet = storage.calls.findIndex(([action, key]) => action === 'set' && key === '@deep_work_legacy_owner_v1');
  const firstQueueSet = storage.calls.findIndex(([action, key]) => action === 'set' && key === '@deep_work_sync_v1:user-a');
  assert.ok(firstMarkerSet >= 0 && firstMarkerSet < firstQueueSet);
});

test('claim resumes after queue write failure without allowing another owner', async () => {
  const { store, storage, setAuthUserId } = createStore({
    initial: { '@deep_work_history': JSON.stringify([historyLegacy]) },
  });
  storage.failNextSet('@deep_work_sync_v1:user-a');
  await assert.rejects(store.claimLegacyDeepWorkData('user-a', { createId: () => 'first-id' }));
  assert.equal(JSON.parse(storage.values.get('@deep_work_legacy_owner_v1')).state, 'claiming');
  setAuthUserId('user-b');
  const other = await store.claimLegacyDeepWorkData('user-b', { createId: () => 'foreign-id' });
  assert.equal(other.claimed, false);
  assert.equal(storage.values.has('@deep_work_sync_v1:user-b'), false);
  setAuthUserId('user-a');
  const resumed = await store.claimLegacyDeepWorkData('user-a', { createId: () => 'resumed-id' });
  assert.equal(resumed.queue.entries.length, 1);
  assert.equal(resumed.marker.state, 'completed');
});

test('parallel claim attempts cannot transfer legacy data to a second user', async () => {
  const { store, storage, setAuthUserId } = createStore({
    initial: { '@deep_work_history': JSON.stringify([historyLegacy]) },
  });
  const first = store.claimLegacyDeepWorkData('user-a', { createId: () => 'owner-a-id' });
  setAuthUserId('user-b');
  const second = store.claimLegacyDeepWorkData('user-b', { createId: () => 'owner-b-id' });
  const [ownerResult, otherResult] = await Promise.allSettled([first, second]);
  assert.equal(ownerResult.status, 'rejected');
  assert.equal(ownerResult.reason.code, 'DEEP_WORK_SYNC_AUTH_MISMATCH');
  assert.equal(otherResult.status, 'fulfilled');
  assert.equal(otherResult.value.claimed, false);
  assert.equal(storage.values.has('@deep_work_sync_v1:user-a'), false);
  assert.equal(storage.values.has('@deep_work_sync_v1:user-b'), false);
});

test('invalid persisted owner marker blocks claim instead of reassigning legacy data', async () => {
  const original = '{broken';
  const { store, storage } = createStore({ initial: {
    '@deep_work_legacy_owner_v1': original,
    '@deep_work_history': JSON.stringify([historyLegacy]),
  } });
  await assert.rejects(
    store.claimLegacyDeepWorkData('user-a', { createId: () => 'new-id' }),
    { code: 'DEEP_WORK_LEGACY_OWNER_INVALID' }
  );
  assert.equal(storage.values.get('@deep_work_legacy_owner_v1'), original);
  assert.equal(storage.values.has('@deep_work_sync_v1:user-a'), false);
});

test('claim reuses prepared legacy IDs after crash before completed marker', async () => {
  const claiming = {
    schemaVersion: 1, ownerUserId: 'user-a', state: 'claiming',
    claimedAt: '2026-07-19T10:00:00.000Z', completedAt: null,
  };
  const legacyKey = 'legacy-1|2026-07-19T10:05:00.000Z|90|0';
  const preparedQueue = {
    schemaVersion: 1, ownerUserId: 'user-a', legacyImportCompleted: false,
    entries: [{ ...queueEntry, clientSessionId: 'prepared-id', source: 'legacy', legacyKey, status: 'pending', attempts: 0, nextAttemptAt: null, lastErrorCode: null }],
  };
  const { store } = createStore({ initial: {
    '@deep_work_legacy_owner_v1': JSON.stringify(claiming),
    '@deep_work_history': JSON.stringify([historyLegacy]),
    '@deep_work_sync_v1:user-a': JSON.stringify(preparedQueue),
  } });
  const result = await store.claimLegacyDeepWorkData('user-a', { createId: () => 'must-not-be-used' });
  assert.equal(result.queue.entries.length, 1);
  assert.equal(result.queue.entries[0].clientSessionId, 'prepared-id');
  assert.equal(result.marker.state, 'completed');
});

test('completed claim is idempotent and never duplicates legacy history', async () => {
  const { store, storage } = createStore({
    initial: { '@deep_work_history': JSON.stringify([historyLegacy]) },
  });
  await store.claimLegacyDeepWorkData('user-a', { createId: () => 'stable-legacy-id' });
  await store.claimLegacyDeepWorkData('user-a', { createId: () => 'new-id' });
  const queue = await store.getDeepWorkSyncQueue('user-a');
  assert.equal(queue.entries.length, 1);
  assert.equal(queue.entries[0].clientSessionId, 'stable-legacy-id');
  assert.equal(JSON.parse(storage.values.get('@deep_work_history')).length, 1);
});

test('claim never reassigns an active session already owned by another user', async () => {
  const owned = {
    ...activeLegacy, schemaVersion: 2, ownerUserId: 'user-a', clientSessionId: 'owned-id',
    startedAt: '2026-07-19T10:00:00.000Z',
  };
  const { store, storage } = createStore({ authUserId: 'user-b', initial: {
    '@deep_work_session': JSON.stringify(owned),
    '@deep_work_legacy_owner_v1': JSON.stringify({
      schemaVersion: 1, ownerUserId: 'user-b', state: 'claiming',
      claimedAt: '2026-07-19T11:00:00.000Z', completedAt: null,
    }),
  } });
  await store.claimLegacyDeepWorkData('user-b', { createId: () => 'other-id' });
  assert.equal(JSON.parse(storage.values.get('@deep_work_session')).ownerUserId, 'user-a');
});

test('cleanup remains legacy-compatible when disabled', async () => {
  const old = { id: 'old', durationSeconds: 60, completedAt: '2000-01-01T00:00:00.000Z' };
  const { store } = createStore({ enabled: false, initial: { '@deep_work_history': JSON.stringify([old]) } });
  assert.deepEqual(await store.cleanupDeepWorkHistory(), []);
});

test('cleanup protects history when marker is missing or claiming', async () => {
  const old = { id: 'old', durationSeconds: 60, completedAt: '2000-01-01T00:00:00.000Z' };
  for (const marker of [null, {
    schemaVersion: 1, ownerUserId: 'user-a', state: 'claiming',
    claimedAt: '2026-07-19T10:00:00.000Z', completedAt: null,
  }]) {
    const initial = { '@deep_work_history': JSON.stringify([old]) };
    if (marker) initial['@deep_work_legacy_owner_v1'] = JSON.stringify(marker);
    const { store } = createStore({ initial });
    assert.equal((await store.cleanupDeepWorkHistory()).length, 1);
  }
});

test('cleanup resumes after completed marker and never changes queue', async () => {
  const old = { id: 'old', durationSeconds: 60, completedAt: '2000-01-01T00:00:00.000Z' };
  const marker = {
    schemaVersion: 1, ownerUserId: 'user-a', state: 'completed',
    claimedAt: '2026-07-19T10:00:00.000Z', completedAt: '2026-07-19T10:01:00.000Z',
  };
  const queue = { schemaVersion: 1, ownerUserId: 'user-a', legacyImportCompleted: true, entries: [queueEntry] };
  const { store, storage } = createStore({ initial: {
    '@deep_work_history': JSON.stringify([old]),
    '@deep_work_legacy_owner_v1': JSON.stringify(marker),
    '@deep_work_sync_v1:user-a': JSON.stringify(queue),
  } });
  const before = storage.values.get('@deep_work_sync_v1:user-a');
  assert.deepEqual(await store.cleanupDeepWorkHistory(), []);
  assert.equal(storage.values.get('@deep_work_sync_v1:user-a'), before);
});

test('history entry cap never removes entries from the independent queue', async () => {
  const queue = { schemaVersion: 1, ownerUserId: 'user-a', legacyImportCompleted: true, entries: [queueEntry] };
  const { store } = createStore({ initial: {
    '@deep_work_sync_v1:user-a': JSON.stringify(queue),
  } });
  const history = Array.from({ length: 251 }, (_, index) => ({
    id: `history-${index}`,
    durationSeconds: 1,
    completedAt: new Date(Date.UTC(2026, 6, 19, 0, 0, index)).toISOString(),
  }));
  await store.saveDeepWorkHistory(history);
  assert.equal((await store.getDeepWorkHistory()).length, 250);
  assert.equal((await store.getDeepWorkSyncQueue('user-a')).entries.length, 1);
});

test('sync finalization persists intent, queue, history, then clears active session', async () => {
  const { store, storage } = createStore({ initial: { '@deep_work_session': JSON.stringify(ownedActive) } });
  await store.finalizeDeepWorkSession({
    session: ownedActive,
    expectedUserId: 'user-a',
    durationSeconds: 90,
    completedAt: queueEntry.completedAt,
  });
  const intentSet = storage.calls.findIndex(([action, key, value]) => (
    action === 'set' && key === '@deep_work_session' && typeof value === 'string' && value.includes('completionIntent')
  ));
  const queueSet = storage.calls.findIndex(([action, key]) => action === 'set' && key === '@deep_work_sync_v1:user-a');
  const historySet = storage.calls.findIndex(([action, key]) => action === 'set' && key === '@deep_work_history');
  const clear = storage.calls.findIndex(([action, key]) => action === 'remove' && key === '@deep_work_session');
  assert.ok(intentSet < queueSet && queueSet < historySet && historySet < clear);
});

test('restoring an expired owned session finalizes it idempotently', async () => {
  const expired = {
    phase: 'running', remaining: 60, totalSeconds: 60, taskName: 'Expired', category: 'Fokus',
    updatedAt: 1, endTimestamp: 2, schemaVersion: 2, ownerUserId: 'user-a',
    clientSessionId: 'expired-id', startedAt: '1970-01-01T00:00:00.001Z',
  };
  const { store, storage } = createStore({ initial: { '@deep_work_session': JSON.stringify(expired) } });
  assert.equal(await store.getSavedDeepWorkSession('user-a'), null);
  assert.equal((await store.getDeepWorkSyncQueue('user-a')).entries[0].clientSessionId, 'expired-id');
  assert.equal((await store.getDeepWorkHistory())[0].clientSessionId, 'expired-id');
  assert.equal(storage.values.has('@deep_work_session'), false);
});

test('queue failure preserves completion intent and prevents history write and active-session clear', async () => {
  const { store, storage } = createStore({ initial: { '@deep_work_session': JSON.stringify(ownedActive) } });
  storage.failNextSet('@deep_work_sync_v1:user-a');
  await assert.rejects(store.finalizeDeepWorkSession({
    session: ownedActive,
    expectedUserId: 'user-a',
    durationSeconds: 90,
    completedAt: queueEntry.completedAt,
  }));
  assert.equal(storage.values.has('@deep_work_session'), true);
  assert.equal(JSON.parse(storage.values.get('@deep_work_session')).completionIntent.durationSeconds, 90);
  assert.equal(storage.values.has('@deep_work_history'), false);
});

test('repeated finalization uses the same id without duplicate history', async () => {
  const { store, storage } = createStore({ initial: { '@deep_work_session': JSON.stringify(ownedActive) } });
  const request = {
    session: ownedActive,
    expectedUserId: 'user-a',
    durationSeconds: 90,
    completedAt: queueEntry.completedAt,
  };
  await store.finalizeDeepWorkSession(request);
  storage.values.set('@deep_work_session', JSON.stringify(ownedActive));
  await store.finalizeDeepWorkSession(request);
  assert.equal((await store.getDeepWorkSyncQueue('user-a')).entries.length, 1);
  assert.equal((await store.getDeepWorkHistory()).length, 1);
});

test('zero-duration finalization clears active state without queue, history or intent', async () => {
  const { store, storage } = createStore({ initial: { '@deep_work_session': JSON.stringify(ownedActive) } });
  await store.finalizeDeepWorkSession({
    session: ownedActive, expectedUserId: 'user-a', durationSeconds: 0,
  });
  assert.equal(storage.values.has('@deep_work_session'), false);
  assert.equal(storage.values.has('@deep_work_history'), false);
  assert.equal(storage.values.has('@deep_work_sync_v1:user-a'), false);
});

test('disabled finalization preserves the legacy local-only flow', async () => {
  const { store, storage } = createStore({ enabled: false, initial: { '@deep_work_session': JSON.stringify(activeLegacy) } });
  await store.finalizeDeepWorkSession({
    session: { ownerUserId: 'user-a', clientSessionId: 'session-a' }, durationSeconds: 90,
  });
  assert.equal(storage.values.has('@deep_work_sync_v1:user-a'), false);
  assert.equal((await store.getDeepWorkHistory()).length, 1);
  assert.equal(storage.values.has('@deep_work_session'), false);
});

test('history upsert keeps original order and replaces the same stable id', async () => {
  const first = { id: 'first', durationSeconds: 10, completedAt: '2026-07-19T09:00:00.000Z' };
  const { store } = createStore({ initial: { '@deep_work_history': JSON.stringify([first]) } });
  await store.upsertDeepWorkHistoryEntry({
    id: 'stable', clientSessionId: 'stable', ownerUserId: 'user-a',
    durationSeconds: 20, completedAt: '2026-07-19T10:00:00.000Z',
  });
  await store.upsertDeepWorkHistoryEntry({
    id: 'stable', clientSessionId: 'stable', ownerUserId: 'user-a',
    durationSeconds: 20, completedAt: '2026-07-19T10:00:00.000Z',
  });
  const history = await store.getDeepWorkHistory();
  assert.deepEqual(history.map((entry) => entry.id), ['first', 'stable']);
});

test('foreign active session is hidden and cannot be cleared or finalized', async () => {
  const original = JSON.stringify(ownedActive);
  const queue = JSON.stringify({
    schemaVersion: 1, ownerUserId: 'user-a', legacyImportCompleted: true, entries: [queueEntry],
  });
  const { store, storage } = createStore({ initial: {
    '@deep_work_session': original,
    '@deep_work_sync_v1:user-a': queue,
  } });
  assert.equal(await store.getSavedDeepWorkSession('user-b'), null);
  await assert.rejects(store.clearDeepWorkSession('user-b'), { code: 'DEEP_WORK_SESSION_OWNER_MISMATCH' });
  await assert.rejects(store.finalizeDeepWorkSession({
    session: ownedActive,
    expectedUserId: 'user-b',
    durationSeconds: 90,
  }), { code: 'DEEP_WORK_SESSION_OWNER_MISMATCH' });
  assert.equal(storage.values.get('@deep_work_session'), original);
  assert.equal(storage.values.get('@deep_work_sync_v1:user-a'), queue);
});

test('starting or persisting another user session cannot overwrite the active owner', async () => {
  const original = JSON.stringify(ownedActive);
  const { store, storage } = createStore({ initial: { '@deep_work_session': original } });
  await assert.rejects(store.saveDeepWorkSession({
    ...ownedActive,
    ownerUserId: 'user-b',
    clientSessionId: 'session-b',
  }), { code: 'DEEP_WORK_SESSION_OWNER_MISMATCH' });
  assert.equal(storage.values.get('@deep_work_session'), original);
});

test('ownerless v2 session is never legacy claimed', async () => {
  const ownerless = { ...ownedActive, ownerUserId: null, clientSessionId: 'ownerless-v2' };
  const { store, storage } = createStore({ authUserId: 'user-b', initial: {
    '@deep_work_session': JSON.stringify(ownerless),
  } });
  await store.claimLegacyDeepWorkData('user-b', { createId: () => 'claim-id' });
  const persisted = JSON.parse(storage.values.get('@deep_work_session'));
  assert.equal(persisted.schemaVersion, 2);
  assert.equal(persisted.ownerUserId, null);
  assert.equal(persisted.clientSessionId, 'ownerless-v2');
  assert.equal(persisted.legacyClaimEligible, false);
});

test('completion intent survives queue failure and restore reuses exact values', async () => {
  const { store, storage } = createStore({ initial: {
    '@deep_work_session': JSON.stringify(ownedActive),
  } });
  storage.failNextSet('@deep_work_sync_v1:user-a');
  await assert.rejects(store.finalizeDeepWorkSession({
    session: ownedActive,
    expectedUserId: 'user-a',
    durationSeconds: 37,
    completedAt: '2026-07-19T12:34:56.000Z',
    reason: 'manual',
  }));
  const intentSession = JSON.parse(storage.values.get('@deep_work_session'));
  assert.deepEqual(intentSession.completionIntent, {
    schemaVersion: 1,
    status: 'pending',
    reason: 'manual',
    durationSeconds: 37,
    completedAt: '2026-07-19T12:34:56.000Z',
  });
  assert.equal(await store.getSavedDeepWorkSession('user-a'), null);
  const queued = (await store.getDeepWorkSyncQueue('user-a')).entries[0];
  assert.equal(queued.durationSeconds, 37);
  assert.equal(queued.completedAt, '2026-07-19T12:34:56.000Z');
});

test('history failure after queue keeps active session and retry uses persisted intent', async () => {
  const { store, storage } = createStore({ initial: {
    '@deep_work_session': JSON.stringify(ownedActive),
  } });
  storage.failNextSet('@deep_work_history');
  await assert.rejects(store.finalizeDeepWorkSession({
    session: ownedActive,
    expectedUserId: 'user-a',
    durationSeconds: 45,
    completedAt: '2026-07-19T13:00:00.000Z',
  }));
  assert.equal((await store.getDeepWorkSyncQueue('user-a')).entries.length, 1);
  const persisted = JSON.parse(storage.values.get('@deep_work_session'));
  assert.equal(persisted.completionIntent.durationSeconds, 45);
  assert.equal(await store.getSavedDeepWorkSession('user-a'), null);
  assert.equal((await store.getDeepWorkHistory())[0].durationSeconds, 45);
});

test('clear failure after history keeps intent and retry remains idempotent', async () => {
  const { store, storage } = createStore({ initial: {
    '@deep_work_session': JSON.stringify(ownedActive),
  } });
  storage.failNextRemove('@deep_work_session');
  await assert.rejects(store.finalizeDeepWorkSession({
    session: ownedActive,
    expectedUserId: 'user-a',
    durationSeconds: 55,
    completedAt: '2026-07-19T14:00:00.000Z',
  }));
  assert.equal((await store.getDeepWorkHistory()).length, 1);
  assert.ok(JSON.parse(storage.values.get('@deep_work_session')).completionIntent);
  assert.equal(await store.getSavedDeepWorkSession('user-a'), null);
  assert.equal((await store.getDeepWorkHistory()).length, 1);
  assert.equal((await store.getDeepWorkSyncQueue('user-a')).entries.length, 1);
});

test('legacy import retries collisions across queue, history and current batch', async () => {
  const secondHistory = {
    id: 'legacy-2', durationSeconds: 80, completedAt: '2026-07-19T10:06:00.000Z',
  };
  const existing = { ...queueEntry, clientSessionId: 'queue-id' };
  const queue = { schemaVersion: 1, ownerUserId: 'user-a', legacyImportCompleted: false, entries: [existing] };
  const generated = ['queue-id', 'legacy-1', 'batch-id', 'batch-id', 'second-id'];
  const { store } = createStore({ initial: {
    '@deep_work_history': JSON.stringify([historyLegacy, secondHistory]),
    '@deep_work_sync_v1:user-a': JSON.stringify(queue),
  } });
  const result = await store.claimLegacyDeepWorkData('user-a', { createId: () => generated.shift() });
  assert.equal(result.queue.entries.length, 3);
  assert.deepEqual(result.queue.entries.map((entry) => entry.clientSessionId), ['queue-id', 'batch-id', 'second-id']);
});

test('raw whole-document queue save is not publicly exported', () => {
  const { store } = createStore();
  assert.equal(store.saveDeepWorkSyncQueue, undefined);
});

test('disabled history failure preserves the active session and never creates queue or intent', async () => {
  const { store, storage } = createStore({ enabled: false, initial: {
    '@deep_work_session': JSON.stringify(activeLegacy),
  } });
  storage.failNextSet('@deep_work_history');
  await assert.rejects(store.finalizeDeepWorkSession({ session: activeLegacy, durationSeconds: 30 }));
  assert.equal(storage.values.has('@deep_work_session'), true);
  assert.equal([...storage.values.keys()].some((key) => key.startsWith('@deep_work_sync_v1:')), false);
  assert.equal(JSON.parse(storage.values.get('@deep_work_session')).completionIntent, undefined);
});

test('disabled clear failure occurs only after legacy history write', async () => {
  const { store, storage } = createStore({ enabled: false, initial: {
    '@deep_work_session': JSON.stringify(activeLegacy),
  } });
  storage.failNextRemove('@deep_work_session');
  await assert.rejects(store.finalizeDeepWorkSession({ session: activeLegacy, durationSeconds: 30 }));
  const historySet = storage.calls.findIndex(([action, key]) => action === 'set' && key === '@deep_work_history');
  const clear = storage.calls.findIndex(([action, key]) => action === 'remove' && key === '@deep_work_session');
  assert.ok(historySet >= 0 && historySet < clear);
  assert.equal((await store.getDeepWorkHistory()).length, 1);
  assert.equal(storage.values.has('@deep_work_session'), true);
});

test('stale same-session save cannot remove a persisted completion intent', async () => {
  const { store, storage } = createStore({ initial: {
    '@deep_work_session': JSON.stringify(ownedActive),
  } });
  storage.failNextSet('@deep_work_sync_v1:user-a');
  await assert.rejects(store.finalizeDeepWorkSession({
    session: ownedActive,
    expectedUserId: 'user-a',
    durationSeconds: 37,
    completedAt: '2026-07-20T08:00:00.000Z',
    reason: 'manual',
  }));
  await store.saveDeepWorkSession({ ...ownedActive, remaining: 20 });
  const persisted = JSON.parse(storage.values.get('@deep_work_session'));
  assert.deepEqual(persisted.completionIntent, {
    schemaVersion: 1,
    status: 'pending',
    reason: 'manual',
    durationSeconds: 37,
    completedAt: '2026-07-20T08:00:00.000Z',
  });
  assert.equal(await store.getSavedDeepWorkSession('user-a'), null);
  const queued = (await store.getDeepWorkSyncQueue('user-a')).entries[0];
  assert.equal(queued.durationSeconds, 37);
  assert.equal(queued.completedAt, '2026-07-20T08:00:00.000Z');
});

test('different completion intent is rejected byte-identically while identical intent is idempotent', async () => {
  const intent = {
    schemaVersion: 1, status: 'pending', reason: 'manual',
    durationSeconds: 37, completedAt: '2026-07-20T08:00:00.000Z',
  };
  const activeWithIntent = { ...ownedActive, completionIntent: intent };
  const original = JSON.stringify(activeWithIntent);
  const { store, storage } = createStore({ initial: { '@deep_work_session': original } });
  await store.saveDeepWorkSession(activeWithIntent);
  const identicalBytes = storage.values.get('@deep_work_session');
  await assert.rejects(store.saveDeepWorkSession({
    ...activeWithIntent,
    completionIntent: { ...intent, durationSeconds: 38 },
  }), { code: 'DEEP_WORK_COMPLETION_INTENT_CONFLICT' });
  assert.equal(storage.values.get('@deep_work_session'), identicalBytes);
});

test('queue public boundaries require matching authentication and preserve foreign bytes', async () => {
  const key = '@deep_work_sync_v1:user-a';
  const original = JSON.stringify({
    schemaVersion: 1, ownerUserId: 'user-a', legacyImportCompleted: true, entries: [queueEntry],
  });
  const { store, storage, setAuthUserId } = createStore({ initial: { [key]: original } });
  assert.equal((await store.getDeepWorkSyncQueue('user-a')).entries.length, 1);
  await store.markDeepWorkSyncEntryTerminal('user-a', 'session-a', 'TEST');

  const authenticatedBytes = storage.values.get(key);
  setAuthUserId('user-b');
  await assert.rejects(store.getDeepWorkSyncQueue('user-a'), { code: 'DEEP_WORK_SYNC_AUTH_MISMATCH' });
  await assert.rejects(store.upsertPendingDeepWorkSyncEntry('user-a', {
    ...queueEntry, clientSessionId: 'foreign-write',
  }), { code: 'DEEP_WORK_SYNC_AUTH_MISMATCH' });
  assert.equal(storage.values.get(key), authenticatedBytes);

  setAuthUserId(null);
  await assert.rejects(store.getDeepWorkSyncQueue('user-a'), { code: 'DEEP_WORK_SYNC_AUTH_REQUIRED' });
  await assert.rejects(store.removeDeepWorkSyncEntry('user-a', 'session-a'), {
    code: 'DEEP_WORK_SYNC_AUTH_REQUIRED',
  });
  assert.equal(storage.values.get(key), authenticatedBytes);
});

test('auth loss after intent prevents queue write and preserves active recovery state', async () => {
  const { store, storage } = createStore({ authUserId: null, initial: {
    '@deep_work_session': JSON.stringify(ownedActive),
  } });
  await assert.rejects(store.finalizeDeepWorkSession({
    session: ownedActive,
    expectedUserId: 'user-a',
    durationSeconds: 42,
    completedAt: '2026-07-20T09:00:00.000Z',
  }), { code: 'DEEP_WORK_SYNC_AUTH_REQUIRED' });
  const persisted = JSON.parse(storage.values.get('@deep_work_session'));
  assert.equal(persisted.completionIntent.durationSeconds, 42);
  assert.equal(storage.values.has('@deep_work_sync_v1:user-a'), false);
  assert.equal(storage.values.has('@deep_work_history'), false);
});

test('auth switch between queue entry and write prevents the queued mutation', async () => {
  const key = '@deep_work_sync_v1:user-a';
  const original = JSON.stringify({
    schemaVersion: 1, ownerUserId: 'user-a', legacyImportCompleted: true, entries: [],
  });
  const { store, storage, setAuthSequence } = createStore({ initial: { [key]: original } });
  setAuthSequence(['user-a', 'user-b']);
  await assert.rejects(store.upsertPendingDeepWorkSyncEntry('user-a', queueEntry), {
    code: 'DEEP_WORK_SYNC_AUTH_MISMATCH',
  });
  assert.equal(storage.values.get(key), original);
});
