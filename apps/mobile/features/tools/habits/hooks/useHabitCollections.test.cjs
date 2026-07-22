const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { transformSync } = require('@babel/core');
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

async function createOwnerHarness({ initialOwner = 'owner-a', initialCache = [] } = {}) {
  const filename = path.resolve(__dirname, './useHabitCollections.js');
  const source = `${fs.readFileSync(filename, 'utf8')}\nexport const __ownerCachesForTest = ownerCaches;`;
  const code = transformSync(source, {
    babelrc: false,
    configFile: false,
    filename,
    plugins: [transformModulesCommonJs],
  }).code;
  const effects = [];
  const stateWrites = [];
  const listGate = deferred();
  let stateIndex = 0;
  let currentOwner = initialOwner;
  let authHandler = null;

  const react = {
    useCallback: callback => callback,
    useEffect: callback => effects.push(callback),
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
      '../services/habitCollections': {
        listHabitCollections: () => listGate.promise,
        updateHabitCollection: async () => null,
        createHabitCollection: async () => null,
        deleteHabitCollection: async () => {},
      },
      '../../../../services/authUser': {
        getCurrentUserId: async () => currentOwner,
      },
      '../../../../services/supabaseClient': {
        supabase: { auth: { onAuthStateChange: handler => {
          authHandler = handler;
          return { data: { subscription: { unsubscribe() {} } } };
        } } },
      },
    };
    if (Object.prototype.hasOwnProperty.call(mocks, request)) return mocks[request];
    return require(request);
  };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', '__filename', '__dirname', code)(
    localRequire, module, module.exports, filename, path.dirname(filename)
  );
  initialCache.forEach(([key, value]) => module.exports.__ownerCachesForTest.set(key, value));
  const result = module.exports.useHabitCollections();
  effects.forEach(effect => effect());
  await flush();

  return {
    cache: module.exports.__ownerCachesForTest,
    listGate,
    result,
    stateWrites,
    emitOwner(ownerId) {
      currentOwner = ownerId;
      authHandler?.(ownerId ? 'SIGNED_IN' : 'SIGNED_OUT', ownerId ? { user: { id: ownerId } } : null);
    },
  };
}

test('useHabitCollections.js exports hook', () => {
  const source = require('fs').readFileSync(
    require('path').resolve(__dirname, './useHabitCollections.js'),
    'utf8'
  );

  assert.match(source, /export\s+function\s+useHabitCollections/);
  assert.match(source, /useCallback/);
  assert.match(source, /useEffect/);
  assert.match(source, /useRef/);
});

test('useHabitCollections.js returns required state and functions', () => {
  const source = require('fs').readFileSync(
    require('path').resolve(__dirname, './useHabitCollections.js'),
    'utf8'
  );

  assert.match(source, /collections/);
  assert.match(source, /loading/);
  assert.match(source, /loadError/);
  assert.match(source, /add/);
  assert.match(source, /update/);
  assert.match(source, /remove/);
  assert.match(source, /loadCollections/);
});

test('useHabitCollections.js implements user isolation', () => {
  const source = require('fs').readFileSync(
    require('path').resolve(__dirname, './useHabitCollections.js'),
    'utf8'
  );

  assert.match(source, /getCurrentUserId/);
  assert.match(source, /onAuthStateChange/);
  assert.match(source, /mountedRef/);
  assert.match(source, /ownerRef/);
});

test('useHabitCollections.js delegates to service', () => {
  const source = require('fs').readFileSync(
    require('path').resolve(__dirname, './useHabitCollections.js'),
    'utf8'
  );

  assert.match(source, /createHabitCollection/);
  assert.match(source, /updateHabitCollection/);
  assert.match(source, /deleteHabitCollection/);
  assert.match(source, /listHabitCollections/);
});

test('collection detail invalidates requests and visible state on owner change', () => {
  const detailSource = require('fs').readFileSync(
    require('path').resolve(__dirname, './useHabitCollection.js'),
    'utf8'
  );

  assert.match(detailSource, /loadRequestRef\.current \+= 1/);
  assert.match(detailSource, /completionRequestRef\.current \+= 1/);
  assert.match(detailSource, /setCollection\(null\)/);
  assert.match(detailSource, /sequence !== authSequence/);
});

test('collection cache survives initial activation and a repeated activation for the same owner', async () => {
  const cacheKey = 'collections:owner-a:list';
  const cachedCollections = [{ id: 'collection-a' }];
  const harness = await createOwnerHarness({ initialCache: [[cacheKey, cachedCollections]] });

  assert.equal(harness.cache.get(cacheKey), cachedCollections);
  harness.emitOwner('owner-a');
  assert.equal(harness.cache.get(cacheKey), cachedCollections);
});

test('owner switch evicts only the previous collection cache', async () => {
  const ownerAKey = 'collections:owner-a:list';
  const ownerBKey = 'collections:owner-b:list';
  const ownerBCollections = [{ id: 'collection-b' }];
  const harness = await createOwnerHarness({
    initialCache: [
      [ownerAKey, [{ id: 'collection-a' }]],
      [ownerBKey, ownerBCollections],
    ],
  });

  harness.emitOwner('owner-b');
  assert.equal(harness.cache.has(ownerAKey), false);
  assert.equal(harness.cache.get(ownerBKey), ownerBCollections);
});

test('logout evicts the previous collection cache and keeps visible state reset', async () => {
  const ownerAKey = 'collections:owner-a:list';
  const harness = await createOwnerHarness({
    initialCache: [[ownerAKey, [{ id: 'collection-a' }]]],
  });

  harness.stateWrites.length = 0;
  harness.emitOwner(null);
  assert.equal(harness.cache.has(ownerAKey), false);
  assert.deepEqual(harness.stateWrites.filter(write => write.index === 1).at(-1)?.value, []);
});

test('late owner response cannot restore an evicted cache or overwrite the next owner state', async () => {
  const ownerAKey = 'collections:owner-a:list';
  const harness = await createOwnerHarness();
  const pendingLoad = harness.result.loadCollections();
  await flush();
  harness.emitOwner('owner-b');
  const collectionWritesAfterSwitch = harness.stateWrites.filter(write => write.index === 1).length;

  harness.listGate.resolve([{ id: 'late-a' }]);
  await pendingLoad;
  await flush();

  assert.equal(harness.cache.has(ownerAKey), false);
  assert.equal(
    harness.stateWrites.filter(write => write.index === 1).length,
    collectionWritesAfterSwitch
  );
});
