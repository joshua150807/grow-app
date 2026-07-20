const assert = require('node:assert/strict');
const fs = require('node:fs');
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

class TestProfileApiError extends Error {
  constructor(message, { status = null, code = null } = {}) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const baseEntry = {
  clientSessionId: 'stable-id',
  durationSeconds: 1500,
  completedAt: '2026-07-20T10:00:00.000Z',
  status: 'pending',
  attempts: 0,
  nextAttemptAt: null,
  lastErrorCode: null,
  source: 'new',
};

function createWorker({ entries = [baseEntry], enabled = true, authUserId = 'user-a', authSequence = [] } = {}) {
  let queueEntries = entries.map((entry) => ({ ...entry }));
  let currentAuthUserId = authUserId;
  const authIds = [...authSequence];
  const removed = [];
  const retried = [];
  const terminal = [];
  const store = {
    getDeepWorkSyncQueue: async (userId) => ({ ownerUserId: userId, entries: queueEntries.map((entry) => ({ ...entry })) }),
    removeDeepWorkSyncEntry: async (_userId, id) => {
      removed.push(id);
      queueEntries = queueEntries.filter((entry) => entry.clientSessionId !== id);
    },
    scheduleDeepWorkSyncEntryRetry: async (_userId, id, metadata) => {
      retried.push({ id, ...metadata });
      queueEntries = queueEntries.map((entry) => entry.clientSessionId === id
        ? { ...entry, attempts: entry.attempts + 1, nextAttemptAt: metadata.nextAttemptAt }
        : entry);
    },
    markDeepWorkSyncEntryTerminal: async (_userId, id, code) => {
      terminal.push({ id, code });
      queueEntries = queueEntries.map((entry) => entry.clientSessionId === id
        ? { ...entry, status: 'terminal', lastErrorCode: code }
        : entry);
    },
  };
  const worker = loadModule('./deepWorkSyncWorker.js', {
    '../../../../services/supabaseClient': {
      supabase: { auth: { getSession: async () => {
        const id = authIds.length ? authIds.shift() : currentAuthUserId;
        return { data: { session: id ? { user: { id } } : null }, error: null };
      } } },
    },
    './deepWorkSessionApi': { postDeepWorkSession: async () => ({}) },
    './deepWorkSyncConfig': { isDeepWorkSyncEnabled: () => enabled },
    './deepWorkStore': store,
  });
  return {
    worker, removed, retried, terminal,
    entries: () => queueEntries,
    setAuthUserId: (id) => { currentAuthUserId = id; },
  };
}

function httpError(status, code = `HTTP_${status}`) {
  return new TestProfileApiError('request failed', { status, code });
}

test('API service uses requestProfileV1 with stable body and accepts successful response', async () => {
  let request;
  const api = loadModule('./deepWorkSessionApi.js', {
    '../../../profile/services/profiles': {
      ProfileApiError: TestProfileApiError,
      requestProfileV1: async (...args) => {
        request = args;
        return args[2]({ session: { id: 'server-id' } });
      },
    },
  });
  await api.postDeepWorkSession(baseEntry, { setTimeoutFn: () => 1, clearTimeoutFn() {} });
  assert.equal(request[0], '/v1/profile/me/deep-work/sessions');
  assert.deepEqual(JSON.parse(request[1].body), {
    client_session_id: 'stable-id', duration_seconds: 1500, completed_at: baseEntry.completedAt,
  });
  assert.equal(request[1].method, 'POST');
  assert.ok(request[1].signal);
});

test('API service turns an aborted 15 second request into a timeout error', async () => {
  const api = loadModule('./deepWorkSessionApi.js', {
    '../../../profile/services/profiles': {
      ProfileApiError: TestProfileApiError,
      requestProfileV1: async (_path, options) => {
        assert.equal(options.signal.aborted, true);
        throw new TestProfileApiError('network', { code: 'PROFILE_API_NETWORK_ERROR' });
      },
    },
  });
  await assert.rejects(
    api.postDeepWorkSession(baseEntry, { setTimeoutFn: (callback) => { callback(); return 1; }, clearTimeoutFn() {} }),
    (error) => error.code === 'DEEP_WORK_SYNC_TIMEOUT',
  );
});

for (const status of [201, 200]) {
  test(`${status} removes the stable queue entry`, async () => {
    const harness = createWorker();
    const sent = [];
    await harness.worker.runDeepWorkSync('user-a', { postSession: async (entry) => { sent.push({ ...entry }); return { status }; } });
    assert.deepEqual(harness.removed, ['stable-id']);
    assert.equal(sent[0].clientSessionId, 'stable-id');
  });
}

test('lost response keeps immutable data and a later 200 removes the same entry', async () => {
  const harness = createWorker();
  let now = Date.parse('2026-07-20T10:00:00.000Z');
  const sent = [];
  await harness.worker.runDeepWorkSync('user-a', {
    now: () => now, random: () => 0.5,
    postSession: async (entry) => { sent.push({ ...entry }); throw new TestProfileApiError('lost', { code: 'PROFILE_API_NETWORK_ERROR' }); },
  });
  now += 5_000;
  await harness.worker.runDeepWorkSync('user-a', {
    now: () => now, postSession: async (entry) => { sent.push({ ...entry }); return { status: 200 }; },
  });
  assert.equal(sent.length, 2);
  assert.deepEqual(
    sent.map(({ clientSessionId, durationSeconds, completedAt }) => ({ clientSessionId, durationSeconds, completedAt })),
    [0, 1].map(() => ({ clientSessionId: 'stable-id', durationSeconds: 1500, completedAt: baseEntry.completedAt })),
  );
  assert.deepEqual(harness.removed, ['stable-id']);
});

test('network, timeout, 408, 429 and 5xx are retryable with persisted backoff', async () => {
  const errors = [
    new TestProfileApiError('network', { code: 'PROFILE_API_NETWORK_ERROR' }),
    new TestProfileApiError('timeout', { code: 'DEEP_WORK_SYNC_TIMEOUT' }),
    httpError(408), httpError(429), httpError(500), httpError(599),
  ];
  for (const error of errors) {
    const harness = createWorker();
    await harness.worker.runDeepWorkSync('user-a', {
      now: () => 1_000, random: () => 0.5, postSession: async () => { throw error; },
    });
    assert.equal(harness.retried.length, 1);
    assert.equal(harness.retried[0].nextAttemptAt, new Date(6_000).toISOString());
  }
});

test('401 stops the run and preserves every queue entry', async () => {
  const entries = [baseEntry, { ...baseEntry, clientSessionId: 'second' }];
  const harness = createWorker({ entries });
  let calls = 0;
  const result = await harness.worker.runDeepWorkSync('user-a', {
    postSession: async () => { calls += 1; throw httpError(401, 'UNAUTHORIZED'); },
  });
  assert.deepEqual(result, { processed: 1, stopped: 'auth' });
  assert.equal(calls, 1);
  assert.equal(harness.entries().length, 2);
});

test('400, 409 and other non-retryable 4xx become terminal', async () => {
  for (const status of [400, 409, 403, 422]) {
    const harness = createWorker();
    await harness.worker.runDeepWorkSync('user-a', { postSession: async () => { throw httpError(status); } });
    assert.equal(harness.terminal.length, 1);
    assert.equal(harness.removed.length, 0);
  }
});

test('backoff is exponential, capped and injectable while future and terminal entries are skipped', async () => {
  const harness = createWorker({ entries: [
    { ...baseEntry, status: 'terminal' },
    { ...baseEntry, clientSessionId: 'future', nextAttemptAt: '2026-07-20T11:00:00.000Z' },
    { ...baseEntry, clientSessionId: 'due', nextAttemptAt: '2026-07-20T09:00:00.000Z' },
  ] });
  const calls = [];
  await harness.worker.runDeepWorkSync('user-a', {
    now: () => Date.parse('2026-07-20T10:00:00.000Z'), postSession: async (entry) => { calls.push(entry.clientSessionId); },
  });
  assert.deepEqual(calls, ['due']);
  assert.equal(harness.worker.calculateDeepWorkRetryDelay(0, { random: () => 0.5 }), 5_000);
  assert.equal(harness.worker.calculateDeepWorkRetryDelay(30, { random: () => 1 }), 900_000);
});

test('a run processes at most 25 entries', async () => {
  const harness = createWorker({ entries: Array.from({ length: 30 }, (_, index) => ({
    ...baseEntry, clientSessionId: `id-${index}`,
  })) });
  let calls = 0;
  await harness.worker.runDeepWorkSync('user-a', { postSession: async () => { calls += 1; } });
  assert.equal(calls, 25);
  assert.equal(harness.entries().length, 5);
});

test('single-flight returns one promise and sends one request', async () => {
  const harness = createWorker();
  let release;
  let calls = 0;
  const pending = new Promise((resolve) => { release = resolve; });
  const options = { postSession: async () => { calls += 1; await pending; } };
  const first = harness.worker.runDeepWorkSync('user-a', options);
  const second = harness.worker.runDeepWorkSync('user-a', options);
  assert.equal(first, second);
  release();
  await first;
  assert.equal(calls, 1);
});

test('auth loss during a run stops safely and user B never processes queue A', async () => {
  const lost = createWorker({ authSequence: ['user-a', 'user-a', null] });
  const result = await lost.worker.runDeepWorkSync('user-a', { postSession: async () => ({ status: 201 }) });
  assert.deepEqual(result, { processed: 1, stopped: 'auth' });
  assert.equal(lost.entries().length, 1);

  const switched = createWorker({ authUserId: 'user-b' });
  let called = false;
  assert.deepEqual(
    await switched.worker.runDeepWorkSync('user-a', { postSession: async () => { called = true; } }),
    { processed: 0, stopped: 'auth' },
  );
  assert.equal(called, false);
  assert.equal(switched.entries().length, 1);
});

test('disabled flag performs no auth read, request or worker mutation', async () => {
  const harness = createWorker({ enabled: false });
  let called = false;
  const result = await harness.worker.runDeepWorkSync('user-a', { postSession: async () => { called = true; } });
  assert.deepEqual(result, { processed: 0, stopped: 'disabled' });
  assert.equal(called, false);
  assert.equal(harness.entries().length, 1);
});

test('root source wires startup, auth-state and active AppState triggers without UI changes', () => {
  const root = fs.readFileSync(path.resolve(__dirname, '../../../../app/_layout.jsx'), 'utf8');
  assert.match(root, /session\?\.user\?\.id/);
  assert.match(root, /session\?\.access_token/);
  assert.match(root, /claimLegacyDeepWorkData\(userId\)[\s\S]*triggerDeepWorkSyncForCurrentUser/);
  assert.match(root, /AppState\.addEventListener\('change'/);
  assert.match(root, /nextState !== 'active'/);
});
