const assert = require('node:assert/strict');
const test = require('node:test');
const { loadModule } = require('../features/tools/training-v2/testing/loadModule.cjs');
function setup(context, enabled, response) {
  const previous = { flag: process.env.EXPO_PUBLIC_USERNAME_LOGIN_API_ENABLED, url: process.env.EXPO_PUBLIC_API_URL, fetch: global.fetch };
  process.env.EXPO_PUBLIC_USERNAME_LOGIN_API_ENABLED = enabled;
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.invalid';
  const calls = [];
  const client = {
    rpc: async (...args) => { calls.push(['rpc', ...args]); return { data: 'private@example.invalid' }; },
    auth: {
      signInWithPassword: async input => { calls.push(['legacy', input]); return { error: null }; },
      setSession: async input => { calls.push(['session', input]); return { error: null }; },
    },
  };
  global.fetch = async (url, options) => { calls.push(['fetch', url, JSON.parse(options.body)]); return response; };
  context.after(() => {
    if (previous.flag === undefined) delete process.env.EXPO_PUBLIC_USERNAME_LOGIN_API_ENABLED; else process.env.EXPO_PUBLIC_USERNAME_LOGIN_API_ENABLED = previous.flag;
    if (previous.url === undefined) delete process.env.EXPO_PUBLIC_API_URL; else process.env.EXPO_PUBLIC_API_URL = previous.url;
    global.fetch = previous.fetch;
  });
  return { calls, login: loadModule(__dirname, './usernameLogin.js', { './supabaseClient': { supabase: client } }).signInWithUsername };
}
test('default preserves the legacy username contract', async c => {
  const { calls, login } = setup(c, 'false');
  await login('grower', ' exact ');
  assert.deepEqual(calls, [['rpc', 'get_auth_email_for_username', { input_username: 'grower' }], ['legacy', { email: 'private@example.invalid', password: ' exact ' }]]);
});
test('new build uses API tokens without public email lookup', async c => {
  const { calls, login } = setup(c, 'true', { ok: true, status: 200, json: async () => ({ access_token: 'access', refresh_token: 'refresh' }) });
  await login('grower', ' exact ');
  assert.deepEqual(calls, [['fetch', 'https://api.example.invalid/v1/auth/username-login', { username: 'grower', password: ' exact ' }], ['session', { access_token: 'access', refresh_token: 'refresh' }]]);
});
for (const status of [404, 429, 503]) test('no insecure fallback or retry after HTTP ' + status, async c => {
  const { calls, login } = setup(c, 'true', { ok: false, status });
  await assert.rejects(login('grower', 'password'));
  assert.equal(calls.length, 1); assert.equal(calls[0][0], 'fetch');
});
test('invalid credentials do not change persisted session', async c => {
  const { calls, login } = setup(c, 'true', { ok: false, status: 401 });
  assert.ok((await login('grower', 'password')).error);
  assert.equal(calls.length, 1);
});
test('malformed success does not change session', async c => {
  const { calls, login } = setup(c, 'true', { ok: true, status: 200, json: async () => ({ email: 'unexpected' }) });
  await assert.rejects(login('grower', 'password'), /Loginantwort/);
  assert.equal(calls.length, 1);
});
test('refuses cleartext credential transport', async c => {
  const { calls, login } = setup(c, 'true');
  process.env.EXPO_PUBLIC_API_URL = 'http://example.invalid';
  await assert.rejects(login('grower', 'password'), /nicht konfiguriert/);
  assert.equal(calls.length, 0);
});
