const assert = require('node:assert/strict'), test = require('node:test');
const { loadModule } = require('../testing/loadModule.cjs');
test('analytics transport validates replies, keeps bearer/owner checks and encodes pagination/identity', async context => {
  const originalFetch = global.fetch, originalUrl = process.env.EXPO_PUBLIC_API_URL;
  context.after(() => { global.fetch = originalFetch; if (originalUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL; else process.env.EXPO_PUBLIC_API_URL = originalUrl; });
  process.env.EXPO_PUBLIC_API_URL = 'http://127.0.0.1:1234';
  let owner = 'A', body = { completedSessions: 1 }, status = 200;
  const calls = [];
  global.fetch = async (url, options) => { calls.push({ url, options }); return { ok: status === 200, status, text: async () => JSON.stringify(body) }; };
  const valid = { safeParse: value => typeof value.completedSessions === 'number' ? { success: true, data: value } : { success: false } };
  const api = loadModule(__dirname, './trainingV2Api.js', {
    '@grow/shared': { trainingProgressResponseSchema: valid, trainingRecordsResponseSchema: valid, trainingExerciseProgressResponseSchema: valid },
    '../../../../services/supabaseClient': { supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'local-test', user: { id: owner } } } }) } } },
  });
  await api.getTrainingV2ExerciseProgress('id/with/slashes', { page: 1, period: 'all', timeZone: 'Europe/Berlin' });
  assert.ok(calls[0].url.includes('id%2Fwith%2Fslashes')); assert.ok(calls[0].url.includes('page=1')); assert.equal(calls[0].options.headers.Authorization, 'Bearer local-test');
  body = { unexpected: true }; await assert.rejects(api.getTrainingV2Progress(), error => error.code === 'TRAINING_V2_CONTRACT_ERROR');
  status = 404; body = { error: { code: 'NOT_FOUND' } }; await assert.rejects(api.getTrainingV2Records(), error => error.code === 'TRAINING_ANALYTICS_UNAVAILABLE');
  status = 200; body = { completedSessions: 1 };
  global.fetch = async () => { owner = 'B'; return { ok: true, status: 200, text: async () => JSON.stringify(body) }; };
  await assert.rejects(api.getTrainingV2Progress(), error => error.code === 'TRAINING_V2_OWNER_CHANGED');
});
