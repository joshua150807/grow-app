const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { transformFileSync } = require('@babel/core');
const transformModulesCommonJs = require('@babel/plugin-transform-modules-commonjs');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise(resolve => setImmediate(resolve));
}

async function createHarness({ completed = false } = {}) {
  const filename = path.resolve(__dirname, './useHabits.js');
  const code = transformFileSync(filename, {
    babelrc: false,
    configFile: false,
    plugins: [transformModulesCommonJs],
  }).code;
  const effects = [];
  const stateWrites = [];
  const completionKey = 'habitCompletions:user-a:2026-07-21';
  const cache = new Map([
    ['habits:user-a', [{ id: 'habit-a', name: 'Habit', days: [0] }]],
    [completionKey, completed ? ['habit-a'] : []],
  ]);
  const requests = [];
  let stateIndex = 0;
  let currentUserId = 'user-a';
  let authHandler = null;
  let authGate = null;
  let activeRequests = 0;
  let maxActiveRequests = 0;

  const react = {
    useCallback: callback => callback,
    useEffect: callback => effects.push(callback),
    useMemo: callback => callback(),
    useRef: initialValue => ({ current: initialValue }),
    useState: initialValue => {
      const index = stateIndex++;
      let value = typeof initialValue === 'function' ? initialValue() : initialValue;
      return [value, update => {
        value = typeof update === 'function' ? update(value) : update;
        stateWrites.push({ index, value });
      }];
    },
  };
  const localRequire = request => {
    const mocks = {
      react,
      '../../../tools/habits/services/habits': {
        getHabits: async () => [],
        getCompletionsForDate: async () => [],
        addHabit: async () => null,
        updateHabit: async () => null,
        deleteHabit: async () => {},
        toggleCompletion: async (habitId, localDate, targetState, ownerUserId) => {
          const gate = deferred();
          const entry = { habitId, localDate, targetState, ownerUserId, gate };
          requests.push(entry);
          activeRequests += 1;
          maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
          try {
            return await gate.promise;
          } finally {
            activeRequests -= 1;
          }
        },
      },
      '../../../../services/authUser': {
        getCurrentUserId: async () => authGate ? authGate.promise : currentUserId,
      },
      '../../../../services/supabaseClient': {
        supabase: { auth: { onAuthStateChange: handler => {
          authHandler = handler;
          return { data: { subscription: { unsubscribe() {} } } };
        } } },
      },
      '../utils/habitUtils': { getDateForDayIndex: () => '2026-07-21' },
      '../services/habitCache': {
        getHabitsCacheKey: userId => userId ? `habits:${userId}` : null,
        getHabitCompletionsCacheKey: (userId, date) => userId && date ? `habitCompletions:${userId}:${date}` : null,
        getHabitPendingCacheKey: (userId, date) => userId && date ? `habitCompletions:${userId}:${date}:pending` : null,
        getOwnerCache: key => key && cache.has(key) ? cache.get(key) : null,
        setOwnerCache: (key, value) => { if (key) cache.set(key, value); },
        isCurrentOwnerRequest: (active, owner, current, response) => Boolean(active && active === owner && current === response),
        ownsHabit: (habits, id) => habits.some(habit => habit.id === id),
      },
    };
    if (Object.prototype.hasOwnProperty.call(mocks, request)) return mocks[request];
    return require(request);
  };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', '__filename', '__dirname', code)(
    localRequire, module, module.exports, filename, path.dirname(filename)
  );
  const result = module.exports.useHabits(0);
  effects.forEach(effect => effect());
  await flush();
  stateWrites.length = 0;

  return {
    result,
    stateWrites,
    cache,
    requests,
    completionKey,
    setAuthGate(gate) { authGate = gate; },
    emitUser(userId) {
      currentUserId = userId;
      authHandler?.('SIGNED_IN', userId ? { user: { id: userId } } : null);
    },
    completedWrites: () => stateWrites.filter(write => write.index === 2),
    errorWrites: () => stateWrites.filter(write => write.index === 5),
    maxActiveRequests: () => maxActiveRequests,
  };
}

test('single tap updates visible state before auth and network', async () => {
  const harness = await createHarness();
  const authGate = deferred();
  harness.setAuthGate(authGate);
  harness.result.toggle('habit-a');
  assert.deepEqual([...harness.completedWrites()[0].value], ['habit-a']);
  assert.equal(harness.requests.length, 0);
  authGate.resolve('user-a');
  await flush();
  assert.equal(harness.requests.length, 1);
  assert.equal(harness.requests[0].targetState, true);
  harness.requests[0].gate.resolve();
  await flush();
  assert.equal(harness.completedWrites().length, 1);
});

test('open to done to open updates twice immediately and serializes insert then delete', async () => {
  const harness = await createHarness();
  harness.result.toggle('habit-a');
  harness.result.toggle('habit-a');
  assert.deepEqual(harness.completedWrites().map(write => [...write.value]), [['habit-a'], []]);
  await flush();
  assert.equal(harness.requests.length, 1);
  assert.equal(harness.requests[0].targetState, true);
  harness.requests[0].gate.resolve();
  await flush();
  assert.equal(harness.requests.length, 2);
  assert.equal(harness.requests[1].targetState, false);
  assert.equal(harness.maxActiveRequests(), 1);
  harness.requests[1].gate.resolve();
  await flush();
  assert.deepEqual(harness.cache.get(harness.completionKey), []);
  assert.equal(harness.completedWrites().length, 2);
});

test('open to done to open to done coalesces to the first insert', async () => {
  const harness = await createHarness();
  harness.result.toggle('habit-a');
  harness.result.toggle('habit-a');
  harness.result.toggle('habit-a');
  assert.deepEqual([...harness.completedWrites().at(-1).value], ['habit-a']);
  await flush();
  assert.equal(harness.requests.length, 1);
  harness.requests[0].gate.resolve();
  await flush();
  assert.equal(harness.requests.length, 1);
  assert.deepEqual(harness.cache.get(harness.completionKey), ['habit-a']);
});

test('done to open to done coalesces to the first delete', async () => {
  const harness = await createHarness({ completed: true });
  harness.result.toggle('habit-a');
  harness.result.toggle('habit-a');
  assert.deepEqual([...harness.completedWrites().at(-1).value], ['habit-a']);
  await flush();
  assert.equal(harness.requests[0].targetState, false);
  harness.requests[0].gate.resolve();
  await flush();
  assert.equal(harness.requests.length, 2);
  assert.equal(harness.requests[1].targetState, true);
  harness.requests[1].gate.resolve();
  await flush();
  assert.deepEqual(harness.cache.get(harness.completionKey), ['habit-a']);
});

test('done to open to done to open ends open without parallel requests', async () => {
  const harness = await createHarness({ completed: true });
  harness.result.toggle('habit-a');
  harness.result.toggle('habit-a');
  harness.result.toggle('habit-a');
  await flush();
  assert.equal(harness.requests[0].targetState, false);
  harness.requests[0].gate.resolve();
  await flush();
  assert.equal(harness.requests.length, 1);
  assert.equal(harness.maxActiveRequests(), 1);
  assert.deepEqual(harness.cache.get(harness.completionKey), []);
});

test('failed unmet desired state rolls back exactly once and stops', async () => {
  const harness = await createHarness();
  harness.result.toggle('habit-a');
  await flush();
  harness.requests[0].gate.reject(new Error('network'));
  await flush();
  assert.deepEqual(harness.completedWrites().map(write => [...write.value]), [['habit-a'], []]);
  assert.equal(harness.errorWrites().length, 1);
  assert.equal(harness.requests.length, 1);
});

test('failed request needs no rollback when desired already equals confirmed', async () => {
  const harness = await createHarness();
  harness.result.toggle('habit-a');
  harness.result.toggle('habit-a');
  await flush();
  harness.requests[0].gate.reject(new Error('network'));
  await flush();
  assert.deepEqual(harness.completedWrites().map(write => [...write.value]), [['habit-a'], []]);
  assert.equal(harness.errorWrites().length, 0);
  assert.equal(harness.requests.length, 1);
});

test('failed follow-up restores the last confirmed server state once', async () => {
  const harness = await createHarness();
  harness.result.toggle('habit-a');
  harness.result.toggle('habit-a');
  await flush();
  harness.requests[0].gate.resolve();
  await flush();
  harness.requests[1].gate.reject(new Error('network'));
  await flush();
  assert.deepEqual([...harness.completedWrites().at(-1).value], ['habit-a']);
  assert.equal(harness.completedWrites().length, 3);
  assert.equal(harness.errorWrites().length, 1);
});

test('auth switch during request never writes rollback or response into user B state', async () => {
  const harness = await createHarness();
  harness.result.toggle('habit-a');
  harness.result.toggle('habit-a');
  await flush();
  harness.emitUser('user-b');
  const writesAfterSwitch = harness.completedWrites().length;
  harness.requests[0].gate.resolve();
  await flush();
  assert.equal(harness.completedWrites().length, writesAfterSwitch);
  assert.equal(harness.requests.length, 1);
  assert.equal(harness.cache.has('habitCompletions:user-b:2026-07-21'), false);
});

test('worker key is cleaned after success so a later tap starts a fresh reconciliation', async () => {
  const harness = await createHarness();
  harness.result.toggle('habit-a');
  await flush();
  harness.requests[0].gate.resolve();
  await flush();
  harness.result.toggle('habit-a');
  await flush();
  assert.equal(harness.requests.length, 2);
  assert.equal(harness.requests[1].targetState, false);
  harness.requests[1].gate.resolve();
  await flush();
});
