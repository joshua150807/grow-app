const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { transformFileSync } = require('@babel/core');
const transformModulesCommonJs = require('@babel/plugin-transform-modules-commonjs');

function loadHabitCache() {
  const filename = path.resolve(__dirname, './habitCache.js');
  const code = transformFileSync(filename, {
    babelrc: false,
    configFile: false,
    plugins: [transformModulesCommonJs],
  }).code;
  const cache = new Map();
  const localRequire = (request) => {
    if (request === '../../../../lib/preloadedTools') {
      return {
        getPreloadedToolData: key => cache.has(key) ? cache.get(key) : null,
        setPreloadedToolData: (key, value) => cache.set(key, value),
      };
    }
    return require(request);
  };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', '__filename', '__dirname', code)(
    localRequire, module, module.exports, filename, path.dirname(filename)
  );
  return { ...module.exports, cache };
}

const hookSource = fs.readFileSync(path.resolve(__dirname, '../hooks/useHabits.js'), 'utf8');
const serviceSource = fs.readFileSync(path.resolve(__dirname, './habits.js'), 'utf8');

test('1 user A habits use only the A cache key', () => {
  const api = loadHabitCache();
  assert.equal(api.getHabitsCacheKey('user-a'), 'habits:user-a');
});

test('2 user A completions include owner and local date', () => {
  const api = loadHabitCache();
  assert.equal(api.getHabitCompletionsCacheKey('user-a', '2026-07-21'), 'habitCompletions:user-a:2026-07-21');
});

test('3 user B never reads the A habits cache', () => {
  const api = loadHabitCache();
  api.setOwnerCache(api.getHabitsCacheKey('user-a'), ['a']);
  assert.equal(api.getOwnerCache(api.getHabitsCacheKey('user-b')), null);
});

test('4 user B never reads the A completions cache', () => {
  const api = loadHabitCache();
  api.setOwnerCache(api.getHabitCompletionsCacheKey('user-a', '2026-07-21'), ['a']);
  assert.equal(api.getOwnerCache(api.getHabitCompletionsCacheKey('user-b', '2026-07-21')), null);
});

test('5 a late response from A is rejected while B is active', () => {
  const api = loadHabitCache();
  assert.equal(api.isCurrentOwnerRequest('user-b', 'user-a', 1, 1), false);
});

test('6 a late completion response from A is rejected while B is active', () => {
  const api = loadHabitCache();
  assert.equal(api.isCurrentOwnerRequest('user-b', 'user-a', 7, 7), false);
});

test('7 an older reload cannot replace the latest owner response', () => {
  const api = loadHabitCache();
  assert.equal(api.isCurrentOwnerRequest('user-a', 'user-a', 2, 1), false);
  assert.equal(api.isCurrentOwnerRequest('user-a', 'user-a', 2, 2), true);
});

test('8 logout has no valid cache key or accepted response', () => {
  const api = loadHabitCache();
  assert.equal(api.getHabitsCacheKey(null), null);
  assert.equal(api.isCurrentOwnerRequest(null, 'user-a', 1, 1), false);
});

test('9 returning to A reads only the retained A cache', () => {
  const api = loadHabitCache();
  api.setOwnerCache(api.getHabitsCacheKey('user-a'), ['a']);
  api.setOwnerCache(api.getHabitsCacheKey('user-b'), ['b']);
  assert.deepEqual(api.getOwnerCache(api.getHabitsCacheKey('user-a')), ['a']);
});

test('10 completion caches are separated by both owner and date', () => {
  const api = loadHabitCache();
  const keys = new Set([
    api.getHabitCompletionsCacheKey('user-a', '2026-07-20'),
    api.getHabitCompletionsCacheKey('user-a', '2026-07-21'),
    api.getHabitCompletionsCacheKey('user-b', '2026-07-21'),
  ]);
  assert.equal(keys.size, 3);
});

test('11 optimistic pending completions are owner-bound', () => {
  const api = loadHabitCache();
  assert.equal(api.getHabitPendingCacheKey('user-a', '2026-07-21'), 'habitCompletions:user-a:2026-07-21:pending');
  assert.notEqual(api.getHabitPendingCacheKey('user-a', '2026-07-21'), api.getHabitPendingCacheKey('user-b', '2026-07-21'));
});

test('12 rollback storage is addressed through the worker owner and original date key', () => {
  assert.match(hookSource, /getHabitCompletionsCacheKey\([\s\S]*worker\.ownerUserId,[\s\S]*worker\.localDate/);
  assert.match(hookSource, /setOwnerCache\(completionsKey, Array\.from\(confirmedIds\)\)/);
  assert.match(hookSource, /ownerRef\.current === worker\.ownerUserId/);
});

test('13 mutation without current auth is rejected', () => {
  assert.match(hookSource, /if \(!expectedOwnerId\) throw new Error\('Nicht eingeloggt'\)/);
  assert.match(hookSource, /currentUserId !== expectedOwnerId/);
});

test('14 a habit from a foreign owner state cannot be mutated', () => {
  const api = loadHabitCache();
  assert.equal(api.ownsHabit([{ id: 'habit-a' }], 'habit-b'), false);
  assert.match(hookSource, /!ownsHabit\(habitsRef\.current, habitId\)/);
});

test('15 create writes only the resolved owner cache', () => {
  assert.match(hookSource, /setOwnerCache\(getHabitsCacheKey\(mutationOwnerId\), nextHabits\)/);
  assert.match(hookSource, /addHabit\([\s\S]*mutationOwnerId/);
});

test('16 update writes only the resolved owner cache', () => {
  assert.match(hookSource, /updateHabit\([\s\S]*mutationOwnerId/);
  assert.match(serviceSource, /\.eq\('user_id', userId\)/);
});

test('17 delete is explicitly scoped to the resolved owner', () => {
  assert.match(serviceSource, /export async function deleteHabit\(id, expectedUserId = null\)[\s\S]*\.eq\('user_id', userId\)/);
});

test('18 single-user cache reads and writes retain their values', () => {
  const api = loadHabitCache();
  const key = api.getHabitsCacheKey('user-a');
  api.setOwnerCache(key, [{ id: 'habit-a' }]);
  assert.deepEqual(api.getOwnerCache(key), [{ id: 'habit-a' }]);
});

test('19 duplicate completion idempotency remains unchanged', () => {
  assert.match(serviceSource, /error\.code !== '23505'/);
});

test('20 auth changes only reset local owner state and perform no server delete', () => {
  const authHandler = hookSource.match(/onAuthStateChange[\s\S]*?resolveInitialOwner\(\);/)?.[0] ?? '';
  assert.match(authHandler, /activateOwner/);
  assert.doesNotMatch(authHandler, /deleteHabit|toggleCompletion|\.delete\(/);
  assert.doesNotMatch(hookSource, /getPreloadedToolData\('habits'\)/);
  assert.doesNotMatch(hookSource, /`habitCompletions:\$\{selectedDate\}`/);
});

test('21 owner cache subscriptions are key-scoped and removable', () => {
  const api = loadHabitCache();
  const observed = [];
  const unsubscribe = api.subscribeToOwnerCache('habitCompletions:user-a:2026-07-21', value => {
    observed.push(value);
  });

  api.setOwnerCache('habitCompletions:user-b:2026-07-21', ['habit-b']);
  api.setOwnerCache('habitCompletions:user-a:2026-07-21', ['habit-a']);
  unsubscribe();
  api.setOwnerCache('habitCompletions:user-a:2026-07-21', []);

  assert.deepEqual(observed, [['habit-a']]);
});
