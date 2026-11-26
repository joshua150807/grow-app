const assert = require('node:assert/strict');
const test = require('node:test');
const { loadModule } = require('../testing/loadModule.cjs');
for (const scenario of ['changed owner', 'same owner', 'old API rejects key']) {
  test(`B11: create ${scenario} never removes the key or silently retries`, async (context) => {
    const oldFetch = global.fetch; const oldUrl = process.env.EXPO_PUBLIC_API_URL;
    context.after(() => { global.fetch = oldFetch; if (oldUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL; else process.env.EXPO_PUBLIC_API_URL = oldUrl; });
    process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test'; let calls = 0;
    const body = { idempotencyKey: '11111111-1111-4111-8111-111111111111' };
    const identity = { safeParse: (data) => ({ success: true, data }) };
    const api = loadModule(__dirname, './trainingV2Api.js', {
      '@grow/shared': { createTrainingPlanInputSchema: identity, trainingPlanDetailResponseSchema: identity },
      '../../../../services/supabaseClient': { supabase: { auth: { getSession: async () => ({ data: { session: { user: { id: scenario === 'changed owner' ? 'B' : 'A' }, access_token: 'test' } } }) } } },
    });
    global.fetch = async (_url, options) => {
      calls++; assert.equal(JSON.parse(options.body).idempotencyKey, body.idempotencyKey);
      const ok = scenario !== 'old API rejects key';
      return { ok, status: ok ? 201 : 400, text: async () => JSON.stringify(ok ? { plan: { id: 'plan' } } : { error: { code: 'TRAINING_PLAN_VALIDATION_ERROR' } }) };
    };
    if (scenario === 'same owner') assert.equal((await api.createTrainingV2Plan(body, { ownerId: 'A' })).id, 'plan');
    else await assert.rejects(api.createTrainingV2Plan(body, { ownerId: 'A' }));
    assert.equal(calls, scenario === 'changed owner' ? 0 : 1);
  });
}
