const assert = require('node:assert/strict');
const test = require('node:test');

const { loadModule } = require('../testing/loadModule.cjs');

function schema(validate) {
  return {
    safeParse(value) {
      return validate(value) ? { success: true, data: value } : { success: false };
    },
  };
}

const listSchema = schema((value) => (
  value && Array.isArray(value.plans) && value.plans.every((plan) => typeof plan.id === 'string')
));
const detailSchema = schema((value) => (
  value?.plan && Array.isArray(value.plan.revision?.units)
));
const exerciseSchema = schema((value) => typeof value?.exercise?.name === 'string');

function loadApi() {
  return loadModule(__dirname, './trainingV2Api.js', {
    '@grow/shared': {
      listTrainingPlansResponseSchema: listSchema,
      trainingPlanDetailResponseSchema: detailSchema,
      trainingExerciseDetailResponseSchema: exerciseSchema,
    },
    '../../../../services/supabaseClient': {
      supabase: {
        auth: {
          getSession: async () => ({
            data: { session: { access_token: 'mobile-token' } },
            error: null,
          }),
        },
      },
    },
  });
}

function response(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload),
  };
}

test('parses list and detail responses and sends the existing bearer authentication', async (context) => {
  const previousUrl = process.env.EXPO_PUBLIC_API_URL;
  const previousFetch = global.fetch;
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test/';
  context.after(() => {
    process.env.EXPO_PUBLIC_API_URL = previousUrl;
    global.fetch = previousFetch;
  });
  const calls = [];
  global.fetch = async (...args) => {
    calls.push(args);
    if (args[0].endsWith('/v1/training/plans')) return response(200, { plans: [{ id: 'plan-1' }] });
    return response(200, { plan: { id: 'plan-1', revision: { units: [] } } });
  };
  const api = loadApi();

  assert.deepEqual(await api.listTrainingV2Plans(), [{ id: 'plan-1' }]);
  assert.equal((await api.getTrainingV2Plan('plan/id')).id, 'plan-1');
  assert.equal(calls[0][1].method, 'GET');
  assert.equal(calls[0][1].headers.Authorization, 'Bearer mobile-token');
  assert.equal(calls[1][0].endsWith('/v1/training/plans/plan%2Fid'), true);
});

test('classifies 401, 404, 409, network and internal contract errors', async (context) => {
  const previousUrl = process.env.EXPO_PUBLIC_API_URL;
  const previousFetch = global.fetch;
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
  context.after(() => {
    process.env.EXPO_PUBLIC_API_URL = previousUrl;
    global.fetch = previousFetch;
  });
  const api = loadApi();
  const cases = [
    [401, api.TrainingV2AuthError],
    [404, api.TrainingV2NotFoundError],
    [409, api.TrainingV2ConflictError],
    [500, api.TrainingV2ContractError],
  ];
  for (const [status, ErrorClass] of cases) {
    global.fetch = async () => response(status, { error: { code: `ERROR_${status}` } });
    await assert.rejects(api.listTrainingV2Plans(), (error) => error instanceof ErrorClass);
  }

  global.fetch = async () => { throw new Error('offline'); };
  await assert.rejects(api.listTrainingV2Plans(), (error) => error instanceof api.TrainingV2NetworkError);

  global.fetch = async () => response(200, { plans: [{ invalid: true }] });
  await assert.rejects(api.listTrainingV2Plans(), (error) => error instanceof api.TrainingV2ContractError);
});

test('deduplicates exercise-name requests within and across detail reloads using the screen cache', async (context) => {
  const previousUrl = process.env.EXPO_PUBLIC_API_URL;
  const previousFetch = global.fetch;
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
  context.after(() => {
    process.env.EXPO_PUBLIC_API_URL = previousUrl;
    global.fetch = previousFetch;
  });
  const calls = [];
  global.fetch = async (url) => {
    calls.push(url);
    const id = decodeURIComponent(url.split('/').at(-1));
    return response(200, { exercise: { id, name: `Name ${id}` } });
  };
  const api = loadApi();
  const plan = {
    revision: {
      units: [
        { exercises: [{ exerciseId: 'same-id' }, { exerciseId: 'other-id' }] },
        { exercises: [{ exerciseId: 'same-id' }] },
      ],
    },
  };
  const cache = new Map();

  assert.deepEqual(await api.resolveTrainingV2ExerciseNames(plan, cache), {
    'same-id': 'Name same-id',
    'other-id': 'Name other-id',
  });
  await api.resolveTrainingV2ExerciseNames(plan, cache);
  assert.equal(calls.length, 2);
});

test('keeps successful exercise names when one exercise returns 404', async (context) => {
  const previousUrl = process.env.EXPO_PUBLIC_API_URL;
  const previousFetch = global.fetch;
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
  context.after(() => {
    process.env.EXPO_PUBLIC_API_URL = previousUrl;
    global.fetch = previousFetch;
  });
  global.fetch = async (url) => {
    const id = decodeURIComponent(url.split('/').at(-1));
    if (id === 'missing-id') {
      return response(404, { error: { code: 'TRAINING_EXERCISE_NOT_FOUND' } });
    }
    return response(200, { exercise: { id, name: `Name ${id}` } });
  };
  const api = loadApi();
  const plan = {
    revision: {
      units: [{
        exercises: [{ exerciseId: 'visible-id' }, { exerciseId: 'missing-id' }],
      }],
    },
  };

  assert.deepEqual(await api.resolveTrainingV2ExerciseNames(plan, new Map()), {
    'visible-id': 'Name visible-id',
    'missing-id': undefined,
  });
});

test('caches multiple Exercise 404 fallbacks without repeating requests', async (context) => {
  const previousUrl = process.env.EXPO_PUBLIC_API_URL;
  const previousFetch = global.fetch;
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
  context.after(() => {
    process.env.EXPO_PUBLIC_API_URL = previousUrl;
    global.fetch = previousFetch;
  });
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    return response(404, { error: { code: 'TRAINING_EXERCISE_NOT_FOUND' } });
  };
  const api = loadApi();
  const plan = {
    revision: {
      units: [{
        exercises: [{ exerciseId: 'missing-1' }, { exerciseId: 'missing-2' }],
      }],
    },
  };
  const cache = new Map();

  assert.deepEqual(await api.resolveTrainingV2ExerciseNames(plan, cache), {
    'missing-1': undefined,
    'missing-2': undefined,
  });
  await api.resolveTrainingV2ExerciseNames(plan, cache);
  assert.equal(calls, 2);
});

test('propagates Exercise 401 and contract failures as whole-detail errors', async (context) => {
  const previousUrl = process.env.EXPO_PUBLIC_API_URL;
  const previousFetch = global.fetch;
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
  context.after(() => {
    process.env.EXPO_PUBLIC_API_URL = previousUrl;
    global.fetch = previousFetch;
  });
  const api = loadApi();
  const plan = {
    revision: {
      units: [{ exercises: [{ exerciseId: 'exercise-id' }] }],
    },
  };

  global.fetch = async () => response(401, { error: { code: 'UNAUTHORIZED' } });
  await assert.rejects(
    api.resolveTrainingV2ExerciseNames(plan, new Map()),
    (error) => error instanceof api.TrainingV2AuthError,
  );

  global.fetch = async () => response(200, { exercise: { invalid: true } });
  await assert.rejects(
    api.resolveTrainingV2ExerciseNames(plan, new Map()),
    (error) => error instanceof api.TrainingV2ContractError,
  );
});
