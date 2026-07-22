const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { transformFileSync } = require('@babel/core');
const transformModulesCommonJs = require('@babel/plugin-transform-modules-commonjs');

function loadModule(relativePath, mocks) {
  const filename = path.resolve(__dirname, relativePath);
  const code = transformFileSync(filename, {
    babelrc: false,
    configFile: false,
    plugins: [transformModulesCommonJs],
  }).code;
  const module = { exports: {} };

  new Function('require', 'module', 'exports', '__filename', '__dirname', code)(
    (request) => Object.prototype.hasOwnProperty.call(mocks, request)
      ? mocks[request]
      : require(request),
    module,
    module.exports,
    filename,
    path.dirname(filename),
  );

  return module.exports;
}

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

async function flushPromises() {
  await new Promise((resolve) => setImmediate(resolve));
}

function createHookHarness({ enabled = true, getStats, getTimeZone = () => 'Europe/Berlin' }) {
  const stateSlots = [];
  const refSlots = [];
  let stateIndex = 0;
  let refIndex = 0;
  let focusCallback;
  let focusCleanup;

  const react = {
    useCallback: (callback) => callback,
    useEffect: (effect) => effect(),
    useMemo: (factory) => factory(),
    useRef: (initialValue) => {
      const index = refIndex++;
      if (!refSlots[index]) refSlots[index] = { current: initialValue };
      return refSlots[index];
    },
    useState: (initialValue) => {
      const index = stateIndex++;
      if (!(index in stateSlots)) stateSlots[index] = initialValue;
      return [stateSlots[index], (nextValue) => {
        stateSlots[index] = typeof nextValue === 'function'
          ? nextValue(stateSlots[index])
          : nextValue;
      }];
    },
  };
  const service = {
    getDeviceTimeZone: getTimeZone,
    getMyProfileStatsV1: getStats,
    normalizeProfileStatsFallback: (value) => value,
  };
  const hookModule = loadModule('./useProfileStats.js', {
    react,
    'expo-router': {
      useFocusEffect: (callback) => {
        focusCallback = callback;
        focusCleanup = callback();
      },
    },
    '../../../lib/logger': { logger: { debug: () => {} } },
    '../services/profileStats': service,
    '../services/profiles': { isProfileApiV1Enabled: () => enabled },
  });
  const fallback = {
    habitStreak: 2,
    todosToday: { completed: 1, total: 3 },
    deepWorkSecondsAllTime: 60,
    trainingSessions: 0,
    goals: 0,
    plannedDaysCurrentWeek: 0,
  };

  stateIndex = 0;
  refIndex = 0;
  const initialResult = hookModule.useProfileStats(fallback);

  return {
    fallback,
    getCurrentStats: () => stateSlots[0],
    initialResult,
    reload: () => {
      focusCleanup?.();
      focusCleanup = focusCallback();
    },
    unmount: () => focusCleanup?.(),
  };
}

test('uses the stable fallback and sends no request when disabled', () => {
  let calls = 0;
  const harness = createHookHarness({
    enabled: false,
    getStats: async () => {
      calls += 1;
    },
  });

  assert.deepEqual(harness.initialResult, harness.fallback);
  assert.equal(calls, 0);
});

test('loads server stats once for one focus', async () => {
  let calls = 0;
  const serverStats = { habitStreak: 7 };
  const harness = createHookHarness({
    getStats: async () => {
      calls += 1;
      return serverStats;
    },
  });

  assert.deepEqual(harness.initialResult, harness.fallback);
  await flushPromises();
  assert.equal(calls, 1);
  assert.deepEqual(harness.getCurrentStats(), serverStats);
});

test('keeps previous valid stats when a reload fails', async () => {
  const serverStats = { habitStreak: 7 };
  let calls = 0;
  const harness = createHookHarness({
    getStats: async () => {
      calls += 1;
      if (calls === 1) return serverStats;
      throw Object.assign(new Error('failed'), { code: 'PROFILE_API_NETWORK_ERROR' });
    },
  });

  await flushPromises();
  harness.reload();
  await flushPromises();
  assert.equal(calls, 2);
  assert.deepEqual(harness.getCurrentStats(), serverStats);
});

test('does not apply a response after unmount', async () => {
  const deferred = createDeferred();
  const harness = createHookHarness({ getStats: () => deferred.promise });

  harness.unmount();
  deferred.resolve({ habitStreak: 9 });
  await flushPromises();
  assert.deepEqual(harness.getCurrentStats(), harness.fallback);
});

test('does not let an older response overwrite a newer focus result', async () => {
  const first = createDeferred();
  const second = createDeferred();
  let calls = 0;
  const harness = createHookHarness({
    getStats: () => {
      calls += 1;
      return calls === 1 ? first.promise : second.promise;
    },
  });

  harness.reload();
  second.resolve({ habitStreak: 8 });
  await flushPromises();
  first.resolve({ habitStreak: 3 });
  await flushPromises();
  assert.deepEqual(harness.getCurrentStats(), { habitStreak: 8 });
});

test('does not request stats when the device timezone is invalid', async () => {
  let calls = 0;
  const harness = createHookHarness({
    getTimeZone: () => {
      throw Object.assign(new Error('timezone unavailable'), {
        code: 'PROFILE_TIMEZONE_UNAVAILABLE',
      });
    },
    getStats: async () => {
      calls += 1;
    },
  });

  await flushPromises();
  assert.equal(calls, 0);
  assert.deepEqual(harness.getCurrentStats(), harness.fallback);
});
