const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { transformFileSync } = require('@babel/core');
const transformModulesCommonJs = require('@babel/plugin-transform-modules-commonjs');

function loadContextHelpers() {
  const filename = path.resolve(__dirname, 'ProfileContext.js');
  const code = transformFileSync(filename, {
    babelrc: false,
    configFile: false,
    plugins: [transformModulesCommonJs],
  }).code;
  const module = { exports: {} };
  const localRequire = (request) => {
    if (request === 'react') {
      return { createContext: () => null, useContext: () => null };
    }
    return require(request);
  };
  new Function('require', 'module', 'exports', code)(localRequire, module, module.exports);
  return module.exports;
}

const helpers = loadContextHelpers();

test('full confirmed profile replaces every supported field for the current user', () => {
  const current = { id: 'user-1', username: 'old', bio: '', avatarUrl: null, growPoints: 1, role: 'user' };
  const confirmed = {
    id: 'user-1', username: 'new', bio: 'Bio', avatarUrl: 'https://avatar', growPoints: 2,
    role: 'user', createdAt: 'created', updatedAt: 'updated',
  };
  assert.deepEqual(helpers.mergeConfirmedProfile(current, confirmed, 'user-1'), confirmed);
});

test('partial confirmed profile preserves omitted and undefined fields', () => {
  const current = { id: 'user-1', username: 'old', bio: 'keep', avatarUrl: 'keep-avatar' };
  assert.deepEqual(
    helpers.mergeConfirmedProfile(current, { username: 'new', bio: undefined }, 'user-1'),
    { ...current, username: 'new' },
  );
});

test('confirmed profile for another user is rejected byte-identically', () => {
  const current = { id: 'user-1', username: 'old' };
  assert.equal(
    helpers.mergeConfirmedProfile(current, { id: 'user-2', username: 'foreign' }, 'user-1'),
    current,
  );
});

test('root applyProfile reads the latest auth identity from the auth-state ref', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../../../app/_layout.jsx'), 'utf8');
  assert.match(source, /activeSessionUserIdRef\.current = newSession\?\.user\?\.id \?\? null/);
  assert.match(source, /const expectedUserId = activeSessionUserIdRef\.current/);
  assert.doesNotMatch(source, /const expectedUserId = session\?\.user\?\.id/);
});

test('confirmed mutation applies immediately and successful reload remains best effort', async () => {
  const applied = [];
  const reloaded = [];
  const confirmed = { id: 'user-1', username: 'new' };
  const result = helpers.applyConfirmedProfileResponse(
    confirmed,
    (profile) => applied.push(profile),
    async () => { reloaded.push(true); },
  );
  assert.deepEqual(applied, [confirmed]);
  assert.equal(result.profile, confirmed);
  await result.reloadPromise;
  assert.equal(reloaded.length, 1);
});

test('confirmed mutation remains successful when the background reload fails', async () => {
  const applied = [];
  const confirmed = { id: 'user-1', avatarUrl: 'https://avatar' };
  const result = helpers.applyConfirmedProfileResponse(
    confirmed,
    (profile) => applied.push(profile),
    async () => { throw new Error('planned reload failure'); },
  );
  assert.deepEqual(applied, [confirmed]);
  assert.equal(await result.reloadPromise, null);
});
