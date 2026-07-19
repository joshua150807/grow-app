const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const { transformFileSync } = require('@babel/core');
const transformModulesCommonJs = require('@babel/plugin-transform-modules-commonjs');

function loadModule(relativePath, mocks = {}) {
  const filename = path.resolve(__dirname, relativePath);
  const code = transformFileSync(filename, {
    babelrc: false,
    configFile: false,
    plugins: [transformModulesCommonJs],
  }).code;
  const module = { exports: {} };
  const localRequire = (request) => {
    if (Object.prototype.hasOwnProperty.call(mocks, request)) return mocks[request];
    return require(request);
  };

  new Function('require', 'module', 'exports', '__filename', '__dirname', code)(
    localRequire,
    module,
    module.exports,
    filename,
    path.dirname(filename),
  );

  return module.exports;
}

class TestProfileApiError extends Error {
  constructor(message, { status = null, code = null } = {}) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const validPayload = {
  stats: {
    habit_streak: 4,
    todos_today: { completed: 2, total: 3 },
    todos_completed_all_time: 12,
    deep_work_seconds_all_time: 18240,
    training_sessions: 8,
    goals: 6,
    planned_days_current_week: 4,
  },
};

function loadStatsService({ enabled = true, requestImpl } = {}) {
  const calls = [];
  const requestProfileV1 = requestImpl ?? (async (requestPath, options, normalize) => {
    calls.push({ requestPath, options });
    return normalize(validPayload);
  });
  const service = loadModule('./profileStats.js', {
    './profiles': {
      isProfileApiV1Enabled: () => enabled,
      ProfileApiError: TestProfileApiError,
      requestProfileV1,
    },
  });

  return { calls, service };
}

test('maps all six profile stats from a valid response', () => {
  const { service } = loadStatsService();

  assert.deepEqual(service.normalizeProfileStats(validPayload), {
    habitStreak: 4,
    todosToday: { completed: 2, total: 3 },
    todosCompletedAllTime: 12,
    deepWorkSecondsAllTime: 18240,
    trainingSessions: 8,
    goals: 6,
    plannedDaysCurrentWeek: 4,
  });
});

test('clamps completed todos to total', () => {
  const { service } = loadStatsService();
  const payload = structuredClone(validPayload);
  payload.stats.todos_today = { completed: 5, total: 3 };

  assert.deepEqual(service.normalizeProfileStats(payload).todosToday, {
    completed: 3,
    total: 3,
  });
});

test('rejects null, negative, fractional and out-of-range values', () => {
  const { service } = loadStatsService();
  const mutations = [
    (payload) => { payload.stats.habit_streak = null; },
    (payload) => { payload.stats.todos_today.completed = -1; },
    (payload) => { payload.stats.todos_today.total = 1.5; },
    (payload) => { payload.stats.todos_completed_all_time = null; },
    (payload) => { payload.stats.todos_completed_all_time = -1; },
    (payload) => { payload.stats.todos_completed_all_time = 1.5; },
    (payload) => { payload.stats.deep_work_seconds_all_time = -1; },
    (payload) => { payload.stats.training_sessions = null; },
    (payload) => { payload.stats.goals = -1; },
    (payload) => { payload.stats.planned_days_current_week = 8; },
  ];

  for (const mutate of mutations) {
    const payload = structuredClone(validPayload);
    mutate(payload);
    assert.throws(
      () => service.normalizeProfileStats(payload),
      (error) => error.code === 'PROFILE_API_INVALID_RESPONSE',
    );
  }
});

test('normalizes invalid fallback values without exposing invalid numbers', () => {
  const { service } = loadStatsService();

  assert.deepEqual(service.normalizeProfileStatsFallback({
    habitStreak: -1,
    todosToday: { completed: 4, total: 2 },
    deepWorkSecondsAllTime: null,
    trainingSessions: -2,
    goals: Number.NaN,
    plannedDaysCurrentWeek: 9,
  }), {
    habitStreak: 0,
    todosToday: { completed: 2, total: 2 },
    deepWorkSecondsAllTime: 0,
    trainingSessions: 0,
    goals: 0,
    plannedDaysCurrentWeek: 0,
  });
});

test('requests the encoded device timezone without a user_id', async () => {
  const { calls, service } = loadStatsService();
  const result = await service.getMyProfileStatsV1('America/Argentina/Buenos_Aires');

  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].requestPath,
    '/v1/profile/me/stats?timezone=America%2FArgentina%2FBuenos_Aires',
  );
  assert.deepEqual(calls[0].options, { method: 'GET' });
  assert.equal(calls[0].requestPath.includes('user_id'), false);
  assert.equal(result.habitStreak, 4);
});

test('does not request stats when the profile feature flag is disabled', async () => {
  const { calls, service } = loadStatsService({ enabled: false });

  await assert.rejects(
    service.getMyProfileStatsV1('Europe/Berlin'),
    (error) => error.code === 'PROFILE_API_V1_DISABLED',
  );
  assert.equal(calls.length, 0);
});

test('rejects an unavailable timezone before sending a request', async () => {
  const { calls, service } = loadStatsService();

  await assert.rejects(
    service.getMyProfileStatsV1(''),
    (error) => error.code === 'PROFILE_TIMEZONE_UNAVAILABLE',
  );
  assert.equal(calls.length, 0);
});

test('rejects an invalid IANA timezone before sending a request', async () => {
  const { calls, service } = loadStatsService();

  await assert.rejects(
    service.getMyProfileStatsV1('Not/A_Timezone'),
    (error) => error.code === 'PROFILE_TIMEZONE_INVALID',
  );
  assert.equal(calls.length, 0);
});

test('uses the existing bearer-token request path', async (context) => {
  const originalApiUrl = process.env.EXPO_PUBLIC_API_URL;
  const originalFetch = global.fetch;
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
  context.after(() => {
    process.env.EXPO_PUBLIC_API_URL = originalApiUrl;
    global.fetch = originalFetch;
  });

  let fetchCall;
  global.fetch = async (...args) => {
    fetchCall = args;
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify(validPayload),
    };
  };
  const profiles = loadModule('./profiles.js', {
    '../../../services/supabaseClient': {
      supabase: {
        auth: {
          getSession: async () => ({
            data: { session: { access_token: 'test-access-token' } },
            error: null,
          }),
        },
      },
    },
  });

  await profiles.requestProfileV1(
    '/v1/profile/me/stats?timezone=Europe%2FBerlin',
    { method: 'GET' },
    (payload) => payload,
  );

  assert.equal(fetchCall[0], 'https://api.example.test/v1/profile/me/stats?timezone=Europe%2FBerlin');
  assert.equal(fetchCall[1].headers.Authorization, 'Bearer test-access-token');
  assert.equal(JSON.stringify(fetchCall).includes('user_id'), false);
});

test('preserves existing API errors for 400, 401 and 500 responses', async (context) => {
  const originalApiUrl = process.env.EXPO_PUBLIC_API_URL;
  const originalFetch = global.fetch;
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
  context.after(() => {
    process.env.EXPO_PUBLIC_API_URL = originalApiUrl;
    global.fetch = originalFetch;
  });
  const profiles = loadModule('./profiles.js', {
    '../../../services/supabaseClient': {
      supabase: {
        auth: {
          getSession: async () => ({
            data: { session: { access_token: 'test-access-token' } },
            error: null,
          }),
        },
      },
    },
  });

  for (const status of [400, 401, 500]) {
    global.fetch = async () => ({
      ok: false,
      status,
      text: async () => JSON.stringify({ error: { code: `ERROR_${status}` } }),
    });

    await assert.rejects(
      profiles.requestProfileV1('/v1/profile/me/stats?timezone=Europe%2FBerlin'),
      (error) => error.status === status && error.code === `ERROR_${status}`,
    );
  }
});

test('rejects a missing API URL before reading the session', async (context) => {
  const originalApiUrl = process.env.EXPO_PUBLIC_API_URL;
  delete process.env.EXPO_PUBLIC_API_URL;
  context.after(() => {
    process.env.EXPO_PUBLIC_API_URL = originalApiUrl;
  });
  let sessionRead = false;
  const profiles = loadModule('./profiles.js', {
    '../../../services/supabaseClient': {
      supabase: {
        auth: {
          getSession: async () => {
            sessionRead = true;
            return { data: { session: null }, error: null };
          },
        },
      },
    },
  });

  await assert.rejects(
    profiles.requestProfileV1('/v1/profile/me/stats?timezone=Europe%2FBerlin'),
    (error) => error.code === 'PROFILE_API_URL_MISSING',
  );
  assert.equal(sessionRead, false);
});

test('does not send a request without a Supabase session', async (context) => {
  const originalApiUrl = process.env.EXPO_PUBLIC_API_URL;
  const originalFetch = global.fetch;
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
  context.after(() => {
    process.env.EXPO_PUBLIC_API_URL = originalApiUrl;
    global.fetch = originalFetch;
  });
  let fetchCalled = false;
  global.fetch = async () => {
    fetchCalled = true;
  };
  const profiles = loadModule('./profiles.js', {
    '../../../services/supabaseClient': {
      supabase: {
        auth: {
          getSession: async () => ({ data: { session: null }, error: null }),
        },
      },
    },
  });

  await assert.rejects(
    profiles.requestProfileV1('/v1/profile/me/stats?timezone=Europe%2FBerlin'),
    (error) => error.code === 'PROFILE_API_SESSION_MISSING',
  );
  assert.equal(fetchCalled, false);
});
