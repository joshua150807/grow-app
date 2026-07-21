const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { transformFileSync } = require('@babel/core');
const transformModulesCommonJs = require('@babel/plugin-transform-modules-commonjs');

function loadLogout({ signOut }) {
  const filename = path.resolve(__dirname, 'authSession.js');
  const code = transformFileSync(filename, {
    babelrc: false,
    configFile: false,
    plugins: [transformModulesCommonJs],
  }).code;
  const module = { exports: {} };
  const routes = [];
  const localRequire = (request) => {
    if (request === 'expo-router') return { router: { replace: (route) => routes.push(route) } };
    if (request === './supabaseClient') return { supabase: { auth: { signOut } } };
    return require(request);
  };
  new Function('require', 'module', 'exports', code)(localRequire, module, module.exports);
  return { service: module.exports, routes };
}

test('central logout signs out and navigates only on success', async () => {
  let beforeCalls = 0;
  const { service, routes } = loadLogout({ signOut: async () => ({ error: null }) });
  await service.logoutCurrentUser({ beforeSignOut: () => { beforeCalls += 1; } });
  assert.equal(beforeCalls, 1);
  assert.deepEqual(routes, ['/login']);
});

test('central logout preserves navigation and exposes a sign-out error', async () => {
  const expected = new Error('planned');
  const { service, routes } = loadLogout({ signOut: async () => ({ error: expected }) });
  await assert.rejects(service.logoutCurrentUser(), expected);
  assert.deepEqual(routes, []);
});

test('central logout is single-flight', async () => {
  let resolveSignOut;
  let calls = 0;
  const { service } = loadLogout({
    signOut: () => {
      calls += 1;
      return new Promise((resolve) => { resolveSignOut = resolve; });
    },
  });
  const first = service.logoutCurrentUser();
  const second = service.logoutCurrentUser();
  assert.equal(first, second);
  assert.equal(calls, 1);
  resolveSignOut({ error: null });
  await first;
});
