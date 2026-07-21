const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { transformFileSync } = require('@babel/core');
const transformModulesCommonJs = require('@babel/plugin-transform-modules-commonjs');

function loadService({ currentUserId = 'user-a', queryResult = { data: [], error: null } } = {}) {
  const filename = path.resolve(__dirname, './habits.js');
  const code = transformFileSync(filename, {
    babelrc: false,
    configFile: false,
    plugins: [transformModulesCommonJs],
  }).code;
  const calls = [];
  const chain = new Proxy({}, {
    get: (_target, property) => {
      if (property === 'then') {
        return resolve => Promise.resolve(queryResult).then(resolve);
      }
      return (...args) => {
        calls.push([property, ...args]);
        return chain;
      };
    },
  });
  const localRequire = (request) => {
    if (request === '../../../../services/supabaseClient') {
      return { supabase: { from: (...args) => { calls.push(['from', ...args]); return chain; } } };
    }
    if (request === '../../../../services/authUser') {
      return { getCurrentUserId: async () => currentUserId };
    }
    return require(request);
  };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', '__filename', '__dirname', code)(
    localRequire, module, module.exports, filename, path.dirname(filename)
  );
  return { service: module.exports, calls };
}

test('expected owner mismatch rejects before any Supabase query', async () => {
  const { service, calls } = loadService({ currentUserId: 'user-b' });
  await assert.rejects(service.toggleCompletion('habit-a', '2026-07-21', true, 'user-a'), /Nicht eingeloggt/);
  assert.deepEqual(calls, []);
});

test('delete is filtered by both habit and authenticated owner', async () => {
  const { service, calls } = loadService();
  await service.deleteHabit('habit-a', 'user-a');
  assert.ok(calls.some(call => call[0] === 'eq' && call[1] === 'id' && call[2] === 'habit-a'));
  assert.ok(calls.some(call => call[0] === 'eq' && call[1] === 'user_id' && call[2] === 'user-a'));
});

test('create persists the authenticated owner and preserves the existing payload', async () => {
  const { service, calls } = loadService({ queryResult: { data: { id: 'habit-a', days: [0] }, error: null } });
  await service.addHabit('Habit', [0], null, 'user-a');
  const insert = calls.find(call => call[0] === 'insert');
  assert.equal(insert[1].user_id, 'user-a');
  assert.equal(insert[1].name, 'Habit');
  assert.deepEqual(insert[1].days, [0]);
});

test('duplicate completion remains an idempotent success', async () => {
  const { service } = loadService({ queryResult: { data: null, error: { code: '23505' } } });
  await assert.doesNotReject(service.toggleCompletion('habit-a', '2026-07-21', true, 'user-a'));
});
