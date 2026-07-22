const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const mobileRoot = path.resolve(__dirname, '..');
const easConfig = JSON.parse(fs.readFileSync(path.join(mobileRoot, 'eas.json'), 'utf8'));
const appConfig = JSON.parse(fs.readFileSync(path.join(mobileRoot, 'app.json'), 'utf8'));

test('beta builds use the production EAS environment without duplicating public values', () => {
  const beta = easConfig.build?.beta;

  assert.ok(beta, 'build.beta must exist');
  assert.equal(beta.environment, 'production');
  assert.equal(beta.channel, 'beta');
  assert.equal(beta.autoIncrement, true);
  assert.equal(easConfig.cli?.appVersionSource, 'remote');
  assert.deepEqual(appConfig.expo?.runtimeVersion, { policy: 'appVersion' });
  assert.equal(Object.hasOwn(beta.env ?? {}, 'EXPO_PUBLIC_API_URL'), false);
  assert.equal(Object.hasOwn(beta.env ?? {}, 'EXPO_PUBLIC_PROFILE_API_V1_ENABLED'), false);
});
