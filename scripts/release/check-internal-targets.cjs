// Public, read-only probes only. No credentials, deployment, or migration.
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const assert = require('node:assert/strict');
const mobile = resolve(__dirname, '../../apps/mobile');
const app = JSON.parse(readFileSync(resolve(mobile, 'app.json'))).expo;
const eas = JSON.parse(readFileSync(resolve(mobile, 'eas.json')));
const profile = eas.build['training-v2-internal'];
assert.equal(app.ios.bundleIdentifier, 'app.joingrow.grow');
assert.equal(app.extra.eas.projectId, '8c1e8833-6b65-4b94-9720-956f8564da1d');
assert.equal(eas.build.beta.channel, 'beta');
assert.equal(profile.channel, 'training-v2-internal');
assert.equal(profile.environment, 'production');
assert.equal(profile.distribution, 'store');
assert.equal(profile.env.EXPO_PUBLIC_TRAINING_V2_ENABLED, 'true');
assert.equal(profile.env.EXPO_PUBLIC_USERNAME_LOGIN_API_ENABLED, 'true');
const supabase = new URL(process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://wuilllpzdnnalavqkopx.supabase.co');
assert.equal(supabase.origin, 'https://wuilllpzdnnalavqkopx.supabase.co');
const base = new URL(process.env.EXPO_PUBLIC_API_URL || 'https://grow-api-production-4995.up.railway.app');
assert.equal(base.protocol, 'https:');
assert.equal(base.username + base.password, '');
assert.equal(base.pathname, '/');
const endpoints = [
  ['/v1/health', 200], ['/v1/me', 401], ['/v1/training/plans', 401],
  ['/v1/training/session-history', 401], ['/v1/training/analytics/records', 401],
  ['/v1/training/analytics/progress', 401],
];
(async () => {
  let failed = false;
  for (const [path, expected] of endpoints) {
    const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(10_000) });
    console.log(`${response.status === expected ? 'PASS' : 'BLOCKED'} ${path}: ${response.status} (expected ${expected})`);
    if (response.status !== expected) failed = true;
  }
  // Invalid input never performs an account lookup or authentication attempt.
  const login = await fetch(new URL('/v1/auth/username-login', base), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(10_000),
  });
  console.log(`${login.status === 400 ? 'PASS' : 'BLOCKED'} username-login validation: ${login.status} (expected 400)`);
  if (login.status !== 400) failed = true;
  console.log('Backup/restore, DB schema, authorized account E2E, iPhone and App Store group gates require separate evidence. This command never authorizes a build.');
  process.exitCode = failed ? 1 : 0;
})().catch(() => { console.error('BLOCKED: backend probe failed; no credentials were sent'); process.exitCode = 1; });
