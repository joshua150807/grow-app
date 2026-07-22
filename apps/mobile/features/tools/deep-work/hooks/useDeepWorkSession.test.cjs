const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { transformFileSync } = require('@babel/core');
const transformModulesCommonJs = require('@babel/plugin-transform-modules-commonjs');

function loadHook({ enabled, session, stateOverrides = {}, executeEffects = false, savedSession = null, finalizeImpl }) {
  const filename = path.resolve(__dirname, './useDeepWorkSession.js');
  const code = transformFileSync(filename, {
    babelrc: false,
    configFile: false,
    plugins: [transformModulesCommonJs],
  }).code;
  const refs = [];
  const effects = [];
  const saved = [];
  const finalized = [];
  const legacyCompleted = [];
  let syncTriggers = 0;
  let authReads = 0;
  let authChangeHandler = null;
  const restoreOwners = [];
  let stateIndex = 0;
  const react = {
    useCallback: (callback) => callback,
    useEffect: (callback) => {
      if (executeEffects) effects.push(callback);
    },
    useRef: (initialValue) => {
      const ref = { current: initialValue };
      refs.push(ref);
      return ref;
    },
    useState: (initialValue) => {
      const index = stateIndex++;
      const value = Object.prototype.hasOwnProperty.call(stateOverrides, index)
        ? stateOverrides[index]
        : initialValue;
      return [value, () => {}];
    },
  };
  const animatedValue = { stopAnimation() {}, setValue() {} };
  const localRequire = (request) => {
    const mocks = {
      react,
      'react-native': {
        Animated: {
          Value: function Value() { return animatedValue; },
          loop: () => ({ start() {}, stop() {} }),
          sequence: () => ({}),
          timing: () => ({}),
        },
        AppState: {
          currentState: 'active',
          addEventListener: () => ({ remove() {} }),
        },
      },
      'expo-audio': { useAudioPlayer: () => ({ seekTo() {}, play() {} }) },
      '../../../../lib/logger': { logger: { debug() {} } },
      '../services/deepWorkStore': {
        saveDeepWorkSession: async (value) => { saved.push(value); },
        clearDeepWorkSession: async () => {},
        getSavedDeepWorkSession: async (owner) => {
          restoreOwners.push(owner);
          return typeof savedSession === 'function' ? savedSession(owner) : savedSession;
        },
        claimLegacyDeepWorkData: async () => ({ claimed: true }),
        finalizeDeepWorkSession: async (value) => {
          finalized.push(value);
          if (finalizeImpl) return finalizeImpl(value);
          return null;
        },
        addCompletedDeepWorkSession: async (value) => { legacyCompleted.push(value); },
      },
      '../services/deepWorkClientId': { createDeepWorkClientSessionId: () => 'stable-client-id' },
      '../services/deepWorkSyncConfig': { isDeepWorkSyncEnabled: () => enabled },
      '../services/deepWorkSyncWorker': {
        triggerDeepWorkSyncForCurrentUser: async () => { syncTriggers += 1; },
      },
      '../../../../services/supabaseClient': {
        supabase: { auth: {
          getSession: async () => { authReads += 1; return { data: { session } }; },
          onAuthStateChange: (handler) => {
            authChangeHandler = handler;
            return { data: { subscription: { unsubscribe() {} } } };
          },
        } },
      },
      '../utils/deepWorkUtils': { DEFAULT_SESSION_MINUTES: 25, EXAMPLE_CATEGORIES: ['Fokus'] },
      '../../../../assets/sounds/deepwork-done.mp3': 1,
    };
    if (Object.prototype.hasOwnProperty.call(mocks, request)) return mocks[request];
    return require(request);
  };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', '__filename', '__dirname', code)(
    localRequire, module, module.exports, filename, path.dirname(filename)
  );
  const originalSetInterval = global.setInterval;
  const originalClearInterval = global.clearInterval;
  global.setInterval = () => 1;
  global.clearInterval = () => {};
  const result = module.exports.useDeepWorkSession();
  for (const effect of effects) effect();
  global.setInterval = originalSetInterval;
  global.clearInterval = originalClearInterval;
  return {
    result, refs, saved, finalized, legacyCompleted, restoreOwners,
    emitAuthChange: (nextSession) => authChangeHandler?.('SIGNED_IN', nextSession),
    getAuthReads: () => authReads,
    getSyncTriggers: () => syncTriggers,
  };
}

test('disabled start preserves legacy shape and does not read auth', async () => {
  const harness = loadHook({ enabled: false, session: null });
  await harness.result.startSession();
  assert.equal(harness.getAuthReads(), 0);
  assert.equal(harness.saved.length, 1);
  assert.equal(harness.saved[0].ownerUserId, undefined);
  assert.equal(harness.saved[0].clientSessionId, undefined);
  assert.equal(harness.saved[0].startedAt, undefined);
});

test('enabled start reads existing auth and persists owner and stable id before start', async () => {
  const harness = loadHook({ enabled: true, session: { user: { id: 'user-a' } } });
  await harness.result.startSession();
  assert.equal(harness.getAuthReads(), 1);
  assert.equal(harness.saved.length, 1);
  assert.equal(harness.saved[0].schemaVersion, 2);
  assert.equal(harness.saved[0].ownerUserId, 'user-a');
  assert.equal(harness.saved[0].clientSessionId, 'stable-client-id');
  assert.match(harness.saved[0].startedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('enabled start without auth persists a non-claimable ownerless v2 session', async () => {
  const harness = loadHook({ enabled: true, session: null });
  await harness.result.startSession();
  assert.equal(harness.saved.length, 1);
  assert.equal(harness.saved[0].schemaVersion, 2);
  assert.equal(harness.saved[0].ownerUserId, null);
  assert.equal(harness.saved[0].clientSessionId, 'stable-client-id');
  assert.equal(harness.saved[0].legacyClaimEligible, false);
});

test('manual completion forwards positive elapsed duration to central finalization', async () => {
  const harness = loadHook({ enabled: true, session: { user: { id: 'user-a' } } });
  harness.refs[5].current = {
    phase: 'paused', remaining: 30, totalMinutes: 1, taskName: 'Task', category: 'Fokus',
    endTimestamp: null, ownerUserId: 'user-a', clientSessionId: 'stable-client-id',
    startedAt: '2026-07-19T10:00:00.000Z', completionTimestamp: null,
  };
  await harness.result.endSession();
  assert.equal(harness.finalized.length, 1);
  assert.equal(harness.finalized[0].durationSeconds, 30);
  assert.equal(harness.finalized[0].session.clientSessionId, 'stable-client-id');
});

test('manual completion with zero elapsed duration delegates zero without creating another path', async () => {
  const harness = loadHook({ enabled: true, session: { user: { id: 'user-a' } } });
  harness.refs[5].current = {
    phase: 'paused', remaining: 60, totalMinutes: 1, taskName: 'Task', category: 'Fokus',
    endTimestamp: null, ownerUserId: 'user-a', clientSessionId: 'stable-client-id',
    startedAt: '2026-07-19T10:00:00.000Z', completionTimestamp: null,
  };
  await harness.result.endSession();
  assert.equal(harness.finalized.length, 1);
  assert.equal(harness.finalized[0].durationSeconds, 0);
});

test('natural timer expiry delegates once to central finalization', async () => {
  const harness = loadHook({
    enabled: true,
    session: null,
    executeEffects: true,
    stateOverrides: { 0: 'running', 3: 1, 4: 0, 5: 1, 6: 'active' },
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(harness.finalized.length, 1);
  assert.equal(harness.finalized[0].durationSeconds, 60);
});

test('disabled natural expiry preserves independent legacy history and clear path', async () => {
  const harness = loadHook({
    enabled: false,
    session: null,
    executeEffects: true,
    stateOverrides: { 0: 'running', 3: 1, 4: 0, 5: 1, 6: 'active' },
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(harness.legacyCompleted, [60]);
  assert.equal(harness.finalized.length, 0);
  assert.equal(harness.getAuthReads(), 0);
});

test('restore requests only the current owner and does not expose a foreign session', async () => {
  const harness = loadHook({
    enabled: true,
    session: { user: { id: 'user-b' } },
    savedSession: null,
    executeEffects: true,
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(harness.restoreOwners.includes('user-b'));
  assert.equal(harness.result.phase, 'idle');
});

test('foreign user cannot pause, resume or manually finalize the stored owner session', async () => {
  const harness = loadHook({ enabled: true, session: { user: { id: 'user-b' } } });
  harness.refs[5].current = {
    phase: 'paused', remaining: 30, totalMinutes: 1, taskName: 'A', category: 'Fokus',
    endTimestamp: null, ownerUserId: 'user-a', clientSessionId: 'session-a',
  };
  await harness.result.togglePause();
  await harness.result.endSession();
  assert.equal(harness.saved.length, 0);
  assert.equal(harness.finalized.length, 0);
});

test('auth changes hide foreign state and reload only the matching owner session', async () => {
  const ownerSession = {
    phase: 'paused', remaining: 30, totalSeconds: 60, taskName: 'A', category: 'Fokus',
    ownerUserId: 'user-a', clientSessionId: 'session-a',
  };
  const harness = loadHook({
    enabled: true,
    session: { user: { id: 'user-a' } },
    executeEffects: true,
    savedSession: (owner) => (owner === 'user-a' ? ownerSession : null),
  });
  await new Promise((resolve) => setImmediate(resolve));
  harness.emitAuthChange(null);
  harness.emitAuthChange({ user: { id: 'user-b' } });
  harness.emitAuthChange({ user: { id: 'user-a' } });
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(harness.restoreOwners.includes(null));
  assert.ok(harness.restoreOwners.includes('user-b'));
  assert.equal(harness.restoreOwners.at(-1), 'user-a');
  assert.equal(harness.saved.length, 0);
  assert.equal(harness.finalized.length, 0);
});

test('natural and manual completion share one in-flight finalization', async () => {
  let release;
  const blocked = new Promise((resolve) => { release = resolve; });
  const harness = loadHook({
    enabled: true,
    session: null,
    finalizeImpl: () => blocked,
    executeEffects: true,
    stateOverrides: { 0: 'running', 3: 1, 4: 0, 5: 1, 6: 'active' },
  });
  const manual = harness.result.endSession();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(harness.finalized.length, 1);
  release();
  await manual;
  assert.equal(harness.finalized.length, 1);
});

test('successful local finalization immediately triggers background sync', async () => {
  const harness = loadHook({ enabled: true, session: { user: { id: 'user-a' } } });
  await harness.result.startSession();
  await harness.result.endSession();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(harness.getSyncTriggers(), 1);
});
