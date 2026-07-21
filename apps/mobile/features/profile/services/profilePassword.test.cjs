const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { transformFileSync } = require('@babel/core');
const transformModulesCommonJs = require('@babel/plugin-transform-modules-commonjs');

function loadPasswordService({ sessions = [], reauth, update } = {}) {
  const filename = path.resolve(__dirname, 'profilePassword.js');
  const code = transformFileSync(filename, {
    babelrc: false,
    configFile: false,
    plugins: [transformModulesCommonJs],
  }).code;
  const module = { exports: {} };
  const calls = { reauth: [], update: [] };
  let sessionIndex = 0;
  const auth = {
    getSession: async () => sessions[Math.min(sessionIndex++, sessions.length - 1)],
    signInWithPassword: async (input) => {
      calls.reauth.push(input);
      return reauth ?? { data: { user: { id: 'user-1' } }, error: null };
    },
    updateUser: async (input) => {
      calls.update.push(input);
      return update ?? { data: { user: { id: 'user-1' } }, error: null };
    },
  };
  const localRequire = (request) => {
    if (request === '../../../services/supabaseClient') return { supabase: { auth } };
    return require(request);
  };
  new Function('require', 'module', 'exports', code)(localRequire, module, module.exports);
  return { service: module.exports, calls };
}

const input = { currentPassword: 'old-pass', newPassword: 'new-pass', confirmPassword: 'new-pass' };
const emailUser = { id: 'user-1', email: 'grower@example.com', app_metadata: { provider: 'email', providers: ['email'] } };
const validSession = { data: { session: { user: emailUser } }, error: null };

test('password validation covers required, length, confirmation and unchanged values', () => {
  const { service } = loadPasswordService();
  assert.equal(service.validatePasswordChange({ currentPassword: '', newPassword: '', confirmPassword: '' }), 'PASSWORD_FIELDS_REQUIRED');
  assert.equal(service.validatePasswordChange({ currentPassword: 'old', newPassword: '12345', confirmPassword: '12345' }), 'PASSWORD_TOO_SHORT');
  assert.equal(service.validatePasswordChange({ currentPassword: 'old', newPassword: '123456', confirmPassword: '654321' }), 'PASSWORD_CONFIRMATION_MISMATCH');
  assert.equal(service.validatePasswordChange({ currentPassword: '123456', newPassword: '123456', confirmPassword: '123456' }), 'PASSWORD_UNCHANGED');
});

test('missing or expired session stops before reauth', async () => {
  const { service, calls } = loadPasswordService({ sessions: [{ data: { session: null }, error: null }] });
  await assert.rejects(service.changeCurrentUserPassword(input), (error) => error.code === 'PASSWORD_SESSION_MISSING');
  assert.equal(calls.reauth.length, 0);
});

test('missing email stops before reauth', async () => {
  const user = { ...emailUser, email: null };
  const { service, calls } = loadPasswordService({ sessions: [{ data: { session: { user } }, error: null }] });
  await assert.rejects(service.changeCurrentUserPassword(input), (error) => error.code === 'PASSWORD_EMAIL_MISSING');
  assert.equal(calls.reauth.length, 0);
});

test('non-password provider stops before reauth', async () => {
  const user = { ...emailUser, app_metadata: { provider: 'google', providers: ['google'] } };
  const { service, calls } = loadPasswordService({ sessions: [{ data: { session: { user } }, error: null }] });
  await assert.rejects(service.changeCurrentUserPassword(input), (error) => error.code === 'PASSWORD_PROVIDER_UNSUPPORTED');
  assert.equal(calls.reauth.length, 0);
});

test('wrong current password fails without update', async () => {
  const { service, calls } = loadPasswordService({ sessions: [validSession], reauth: { data: { user: null }, error: new Error('invalid') } });
  await assert.rejects(service.changeCurrentUserPassword(input), (error) => error.code === 'PASSWORD_CURRENT_INVALID');
  assert.equal(calls.update.length, 0);
});

test('reauthenticated different user fails without update', async () => {
  const { service, calls } = loadPasswordService({ sessions: [validSession], reauth: { data: { user: { id: 'user-2' } }, error: null } });
  await assert.rejects(service.changeCurrentUserPassword(input), (error) => error.code === 'PASSWORD_REAUTH_USER_MISMATCH');
  assert.equal(calls.update.length, 0);
});

test('auth loss after reauth fails before update', async () => {
  const { service, calls } = loadPasswordService({ sessions: [validSession, { data: { session: null }, error: null }] });
  await assert.rejects(service.changeCurrentUserPassword(input), (error) => error.code === 'PASSWORD_SESSION_MISSING');
  assert.equal(calls.update.length, 0);
});

test('auth switch after reauth fails before update', async () => {
  const otherSession = { data: { session: { user: { ...emailUser, id: 'user-2' } } }, error: null };
  const { service, calls } = loadPasswordService({ sessions: [validSession, otherSession] });
  await assert.rejects(service.changeCurrentUserPassword(input), (error) => error.code === 'PASSWORD_AUTH_CHANGED');
  assert.equal(calls.update.length, 0);
});

test('successful reauth updates password without transforming it', async () => {
  const { service, calls } = loadPasswordService({ sessions: [validSession, validSession, validSession] });
  await service.changeCurrentUserPassword(input);
  assert.deepEqual(calls.reauth, [{ email: emailUser.email, password: input.currentPassword }]);
  assert.deepEqual(calls.update, [{ password: input.newPassword }]);
});

test('update failure is controlled', async () => {
  const { service } = loadPasswordService({ sessions: [validSession, validSession], update: { data: { user: null }, error: new Error('planned') } });
  await assert.rejects(service.changeCurrentUserPassword(input), (error) => error.code === 'PASSWORD_UPDATE_FAILED');
});

test('password service contains no persistence or logging calls', () => {
  const source = require('node:fs').readFileSync(path.resolve(__dirname, 'profilePassword.js'), 'utf8');
  assert.doesNotMatch(source, /AsyncStorage|console\.|logger\./);
});
