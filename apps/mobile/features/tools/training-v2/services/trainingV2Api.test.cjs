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

function inputSchema(validate) {
  return {
    safeParse(value) {
      return validate(value)
        ? { success: true, data: value }
        : { success: false, error: { issues: [{ path: ['name'], message: 'invalid input' }] } };
    },
  };
}

const listSchema = schema((value) => (
  value && Array.isArray(value.plans) && value.plans.every((plan) => typeof plan.id === 'string')
));
const detailSchema = schema((value) => (
  value?.plan && Array.isArray(value.plan.revision?.units)
));
const listTemplatesSchema = schema((value) => (
  value && Array.isArray(value.templates)
));
const templateDetailSchema = schema((value) => (
  value?.template && Array.isArray(value.template.revision?.units) && value?.userPlan !== undefined
));
const templateUserPlanSchema = schema((value) => value?.userPlan !== undefined);
const exerciseSchema = schema((value) => typeof value?.exercise?.name === 'string');
const listExercisesSchema = schema((value) => Array.isArray(value?.exercises));
const createInputSchema = inputSchema((value) => (
  typeof value?.name === 'string' && value.name.length > 0 && Array.isArray(value.units) && value.units.length > 0
));
const updateInputSchema = inputSchema((value) => (
  typeof value?.name === 'string' && value.name.length > 0 && typeof value?.expectedVersion === 'number'
));
const planVersionSchema = inputSchema((value) => typeof value?.expectedVersion === 'number');
const scheduleInputSchema = inputSchema((value) => (
  typeof value?.expectedVersion === 'number'
  && /^\d{4}-\d{2}-\d{2}$/.test(value?.startDate ?? '')
  && typeof value?.timeZone === 'string' && value.timeZone.length > 0
));
const weeklyGoalInputSchema = inputSchema((value) => (
  typeof value?.expectedVersion === 'number'
  && Number.isInteger(value?.weeklyGoal) && value.weeklyGoal > 0
));
const UI_MUSCLE_GROUP_VALUES = [
  'chest', 'back', 'legs', 'shoulders', 'biceps', 'triceps', 'abs', 'forearms', 'other',
];
const createExerciseInputSchema = inputSchema((value) => (
  typeof value?.name === 'string' && value.name.trim().length > 0
  && UI_MUSCLE_GROUP_VALUES.includes(value?.mainMuscle)
));

function loadApi() {
  return loadModule(__dirname, './trainingV2Api.js', {
    '@grow/shared': {
      listTrainingPlansResponseSchema: listSchema,
      trainingPlanDetailResponseSchema: detailSchema,
      listTrainingTemplatesResponseSchema: listTemplatesSchema,
      trainingTemplateDetailResponseSchema: templateDetailSchema,
      templateUserPlanResponseSchema: templateUserPlanSchema,
      trainingExerciseDetailResponseSchema: exerciseSchema,
      listTrainingExercisesResponseSchema: listExercisesSchema,
      createTrainingPlanInputSchema: createInputSchema,
      updateTrainingPlanInputSchema: updateInputSchema,
      planVersionInputSchema: planVersionSchema,
      scheduleTrainingPlanInputSchema: scheduleInputSchema,
      updateWeeklyGoalInputSchema: weeklyGoalInputSchema,
      createTrainingExerciseInputSchema: createExerciseInputSchema,
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

test('resolveTrainingV2ExerciseDetails resolves { name, mainMuscle } per exercise, reusing the same cache resolveTrainingV2ExerciseNames builds on', async (context) => {
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
    return response(200, { exercise: { id, name: `Name ${id}`, mainMuscle: 'chest' } });
  };
  const api = loadApi();
  const plan = {
    revision: {
      units: [{ exercises: [{ exerciseId: 'exercise-1' }] }],
    },
  };
  const cache = new Map();

  assert.deepEqual(await api.resolveTrainingV2ExerciseDetails(plan, cache), {
    'exercise-1': { name: 'Name exercise-1', mainMuscle: 'chest' },
  });
  // resolveTrainingV2ExerciseNames sharing the same cache must not re-fetch.
  assert.deepEqual(await api.resolveTrainingV2ExerciseNames(plan, cache), { 'exercise-1': 'Name exercise-1' });
  assert.equal(calls.length, 1);
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

test('listTrainingV2Exercises builds a query string from provided filters and drops empty ones', async (context) => {
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
    return response(200, { exercises: [{ id: 'exercise-1' }], pagination: { page: 0, limit: 50, hasMore: false } });
  };
  const api = loadApi();

  const result = await api.listTrainingV2Exercises({
    search: 'bank', category: 'strength', equipment: '', environment: undefined, page: 0,
  });

  assert.deepEqual(result.exercises, [{ id: 'exercise-1' }]);
  const [url] = calls[0].split('?');
  const params = new URLSearchParams(calls[0].split('?')[1]);
  assert.equal(url.endsWith('/v1/training/exercises'), true);
  assert.equal(params.get('search'), 'bank');
  assert.equal(params.get('category'), 'strength');
  assert.equal(params.has('equipment'), false);
  assert.equal(params.has('environment'), false);
});

test('createTrainingV2Plan validates the request against the shared input schema before sending, then posts it', async (context) => {
  const previousUrl = process.env.EXPO_PUBLIC_API_URL;
  const previousFetch = global.fetch;
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
  context.after(() => {
    process.env.EXPO_PUBLIC_API_URL = previousUrl;
    global.fetch = previousFetch;
  });
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push([url, init]);
    return response(201, { plan: { id: 'new-plan', revision: { units: [] } } });
  };
  const api = loadApi();
  const validInput = { name: 'Plan', weeklyGoal: 3, units: [{ name: 'Tag 1' }] };

  const plan = await api.createTrainingV2Plan(validInput);

  assert.equal(plan.id, 'new-plan');
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1].method, 'POST');
  assert.equal(calls[0][1].headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(calls[0][1].body), validInput);
  assert.equal(calls[0][0].endsWith('/v1/training/plans'), true);
});

test('createTrainingV2Plan rejects an invalid request locally without ever calling fetch', async (context) => {
  const previousUrl = process.env.EXPO_PUBLIC_API_URL;
  const previousFetch = global.fetch;
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
  context.after(() => {
    process.env.EXPO_PUBLIC_API_URL = previousUrl;
    global.fetch = previousFetch;
  });
  let fetchCalls = 0;
  global.fetch = async () => { fetchCalls += 1; return response(201, { plan: {} }); };
  const api = loadApi();

  await assert.rejects(
    api.createTrainingV2Plan({ name: '', units: [] }),
    (error) => error instanceof api.TrainingV2ValidationError,
  );
  assert.equal(fetchCalls, 0);
});

test('updateTrainingV2Plan sends a PATCH to the plan id with the validated body', async (context) => {
  const previousUrl = process.env.EXPO_PUBLIC_API_URL;
  const previousFetch = global.fetch;
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
  context.after(() => {
    process.env.EXPO_PUBLIC_API_URL = previousUrl;
    global.fetch = previousFetch;
  });
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push([url, init]);
    return response(200, { plan: { id: 'plan-1', revision: { units: [] } } });
  };
  const api = loadApi();
  const validInput = { name: 'Plan', expectedVersion: 2 };

  const plan = await api.updateTrainingV2Plan('plan/1', validInput);

  assert.equal(plan.id, 'plan-1');
  assert.equal(calls[0][1].method, 'PATCH');
  assert.deepEqual(JSON.parse(calls[0][1].body), validInput);
  assert.equal(calls[0][0].endsWith('/v1/training/plans/plan%2F1'), true);
});

test('create and update classify 400/404/409/network/contract failures distinctly', async (context) => {
  const previousUrl = process.env.EXPO_PUBLIC_API_URL;
  const previousFetch = global.fetch;
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
  context.after(() => {
    process.env.EXPO_PUBLIC_API_URL = previousUrl;
    global.fetch = previousFetch;
  });
  const api = loadApi();
  const validCreateInput = { name: 'Plan', weeklyGoal: 3, units: [{ name: 'Tag 1' }] };
  const validUpdateInput = { name: 'Plan', expectedVersion: 4 };

  global.fetch = async () => response(400, {
    error: { code: 'TRAINING_PLAN_VALIDATION_ERROR', details: { fieldErrors: { name: ['too short'] } } },
  });
  await assert.rejects(api.createTrainingV2Plan(validCreateInput), (error) => (
    error instanceof api.TrainingV2ValidationError && error.fieldErrors.name?.[0] === 'too short'
  ));

  global.fetch = async () => response(404, { error: { code: 'TRAINING_PLAN_NOT_FOUND' } });
  await assert.rejects(
    api.updateTrainingV2Plan('missing', validUpdateInput),
    (error) => error instanceof api.TrainingV2NotFoundError,
  );

  global.fetch = async () => response(409, { error: { code: 'TRAINING_PLAN_VERSION_CONFLICT' } });
  await assert.rejects(
    api.updateTrainingV2Plan('plan-1', validUpdateInput),
    (error) => error instanceof api.TrainingV2ConflictError,
  );

  global.fetch = async () => { throw new Error('offline'); };
  await assert.rejects(
    api.createTrainingV2Plan(validCreateInput),
    (error) => error instanceof api.TrainingV2NetworkError,
  );

  global.fetch = async () => response(200, { plan: { invalid: true } });
  await assert.rejects(
    api.createTrainingV2Plan(validCreateInput),
    (error) => error instanceof api.TrainingV2ContractError,
  );
});

test('createTrainingV2Exercise validates the request, then posts it and returns the created exercise', async (context) => {
  const previousUrl = process.env.EXPO_PUBLIC_API_URL;
  const previousFetch = global.fetch;
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
  context.after(() => {
    process.env.EXPO_PUBLIC_API_URL = previousUrl;
    global.fetch = previousFetch;
  });
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push([url, init]);
    return response(201, { exercise: { id: 'new-exercise', name: 'Kabelrudern eng', mainMuscle: 'back' } });
  };
  const api = loadApi();
  const validInput = { name: 'Kabelrudern eng', mainMuscle: 'back', category: 'mobility' };

  const exercise = await api.createTrainingV2Exercise(validInput);

  assert.equal(exercise.id, 'new-exercise');
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1].method, 'POST');
  assert.deepEqual(JSON.parse(calls[0][1].body), validInput);
  assert.equal(calls[0][0].endsWith('/v1/training/exercises'), true);
});

test('createTrainingV2Exercise rejects an invalid request locally without ever calling fetch', async (context) => {
  const previousUrl = process.env.EXPO_PUBLIC_API_URL;
  const previousFetch = global.fetch;
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
  context.after(() => {
    process.env.EXPO_PUBLIC_API_URL = previousUrl;
    global.fetch = previousFetch;
  });
  let fetchCalls = 0;
  global.fetch = async () => { fetchCalls += 1; return response(201, { exercise: {} }); };
  const api = loadApi();

  await assert.rejects(
    api.createTrainingV2Exercise({ name: '', mainMuscle: 'back' }),
    (error) => error instanceof api.TrainingV2ValidationError,
  );
  await assert.rejects(
    api.createTrainingV2Exercise({ name: 'Übung', mainMuscle: 'quads' }),
    (error) => error instanceof api.TrainingV2ValidationError,
  );
  assert.equal(fetchCalls, 0);
});

test('createTrainingV2Exercise classifies 400/409/network/contract failures distinctly', async (context) => {
  const previousUrl = process.env.EXPO_PUBLIC_API_URL;
  const previousFetch = global.fetch;
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
  context.after(() => {
    process.env.EXPO_PUBLIC_API_URL = previousUrl;
    global.fetch = previousFetch;
  });
  const api = loadApi();
  const validInput = { name: 'Kabelrudern eng', mainMuscle: 'back' };

  global.fetch = async () => response(400, {
    error: { code: 'TRAINING_EXERCISE_VALIDATION_ERROR', details: { fieldErrors: { name: ['too short'] } } },
  });
  await assert.rejects(api.createTrainingV2Exercise(validInput), (error) => (
    error instanceof api.TrainingV2ValidationError && error.fieldErrors.name?.[0] === 'too short'
  ));

  global.fetch = async () => response(409, { error: { code: 'TRAINING_EXERCISE_CONFLICT' } });
  await assert.rejects(api.createTrainingV2Exercise(validInput), (error) => (
    error instanceof api.TrainingV2ConflictError && error.code === 'TRAINING_EXERCISE_CONFLICT'
  ));

  global.fetch = async () => { throw new Error('offline'); };
  await assert.rejects(api.createTrainingV2Exercise(validInput), (error) => error instanceof api.TrainingV2NetworkError);

  global.fetch = async () => response(200, { exercise: { invalid: true } });
  await assert.rejects(api.createTrainingV2Exercise(validInput), (error) => error instanceof api.TrainingV2ContractError);
});

function withEnv(context) {
  const previousUrl = process.env.EXPO_PUBLIC_API_URL;
  const previousFetch = global.fetch;
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
  context.after(() => {
    process.env.EXPO_PUBLIC_API_URL = previousUrl;
    global.fetch = previousFetch;
  });
}

test('activateTrainingV2Plan posts to /activate with only the expectedVersion', async (context) => {
  withEnv(context);
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push([url, init]);
    return response(200, { plan: { id: 'plan-1', revision: { units: [] } } });
  };
  const api = loadApi();

  const plan = await api.activateTrainingV2Plan('plan-1', 5);

  assert.equal(plan.id, 'plan-1');
  assert.equal(calls[0][1].method, 'POST');
  assert.equal(calls[0][0].endsWith('/v1/training/plans/plan-1/activate'), true);
  assert.deepEqual(JSON.parse(calls[0][1].body), { expectedVersion: 5 });
});

test('reactivateTrainingV2Plan posts to /reactivate with only the expectedVersion', async (context) => {
  withEnv(context);
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push([url, init]);
    return response(200, { plan: { id: 'plan-1', revision: { units: [] } } });
  };
  const api = loadApi();

  await api.reactivateTrainingV2Plan('plan-1', 5);

  assert.equal(calls[0][1].method, 'POST');
  assert.equal(calls[0][0].endsWith('/v1/training/plans/plan-1/reactivate'), true);
  assert.deepEqual(JSON.parse(calls[0][1].body), { expectedVersion: 5 });
});

test('archiveTrainingV2Plan posts to /archive with only the expectedVersion', async (context) => {
  withEnv(context);
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push([url, init]);
    return response(200, { plan: { id: 'plan-1', revision: { units: [] } } });
  };
  const api = loadApi();

  await api.archiveTrainingV2Plan('plan-1', 5);

  assert.equal(calls[0][1].method, 'POST');
  assert.equal(calls[0][0].endsWith('/v1/training/plans/plan-1/archive'), true);
  assert.deepEqual(JSON.parse(calls[0][1].body), { expectedVersion: 5 });
});

test('scheduleTrainingV2Plan posts the local date and IANA zone (no UTC instant) with the expectedVersion', async (context) => {
  withEnv(context);
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push([url, init]);
    return response(200, { plan: { id: 'plan-1', revision: { units: [] } } });
  };
  const api = loadApi();

  await api.scheduleTrainingV2Plan('plan-1', 5, '2026-08-01', 'Europe/Berlin');

  assert.equal(calls[0][1].method, 'POST');
  assert.equal(calls[0][0].endsWith('/v1/training/plans/plan-1/schedule'), true);
  const body = JSON.parse(calls[0][1].body);
  assert.deepEqual(body, { expectedVersion: 5, startDate: '2026-08-01', timeZone: 'Europe/Berlin' });
  assert.equal('effectiveAt' in body, false);
});

test('updateTrainingV2WeeklyGoal sends a PUT with the expectedVersion and the new goal', async (context) => {
  withEnv(context);
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push([url, init]);
    return response(200, { plan: { id: 'plan-1', revision: { units: [] } } });
  };
  const api = loadApi();

  await api.updateTrainingV2WeeklyGoal('plan-1', 5, 4);

  assert.equal(calls[0][1].method, 'PUT');
  assert.equal(calls[0][0].endsWith('/v1/training/plans/plan-1/weekly-goal'), true);
  assert.deepEqual(JSON.parse(calls[0][1].body), { expectedVersion: 5, weeklyGoal: 4 });
});

test('every plan-action mutation rejects locally on an invalid expectedVersion without calling fetch', async (context) => {
  withEnv(context);
  let fetchCalls = 0;
  global.fetch = async () => { fetchCalls += 1; return response(200, { plan: {} }); };
  const api = loadApi();

  await assert.rejects(
    api.activateTrainingV2Plan('plan-1', 'not-a-version'),
    (error) => error instanceof api.TrainingV2ValidationError,
  );
  await assert.rejects(api.scheduleTrainingV2Plan('plan-1', 5, 'not-a-date', 'Europe/Berlin'));
  await assert.rejects(api.updateTrainingV2WeeklyGoal('plan-1', 5, -1));
  assert.equal(fetchCalls, 0);
});

test('plan-action mutations classify 400/404/409/network/contract failures distinctly', async (context) => {
  withEnv(context);
  const api = loadApi();

  global.fetch = async () => response(400, {
    error: { code: 'TRAINING_PLAN_VALIDATION_ERROR', details: { fieldErrors: { weeklyGoal: ['must be positive'] } } },
  });
  await assert.rejects(api.updateTrainingV2WeeklyGoal('plan-1', 5, 4), (error) => (
    error instanceof api.TrainingV2ValidationError && error.fieldErrors.weeklyGoal?.[0] === 'must be positive'
  ));

  global.fetch = async () => response(404, { error: { code: 'TRAINING_PLAN_NOT_FOUND' } });
  await assert.rejects(api.activateTrainingV2Plan('missing', 1), (error) => error instanceof api.TrainingV2NotFoundError);

  global.fetch = async () => response(409, { error: { code: 'TRAINING_PLAN_VERSION_CONFLICT' } });
  await assert.rejects(api.archiveTrainingV2Plan('plan-1', 1), (error) => (
    error instanceof api.TrainingV2ConflictError && error.code === 'TRAINING_PLAN_VERSION_CONFLICT'
  ));

  // A 409 caused by another plan already being scheduled is still a TrainingV2ConflictError,
  // but with a different code — callers distinguish reload-eligible version conflicts by code.
  global.fetch = async () => response(409, { error: { code: 'TRAINING_SCHEDULE_CONFLICT' } });
  await assert.rejects(api.scheduleTrainingV2Plan('plan-1', 1, '2026-08-01', 'Europe/Berlin'), (error) => (
    error instanceof api.TrainingV2ConflictError && error.code === 'TRAINING_SCHEDULE_CONFLICT'
  ));

  global.fetch = async () => { throw new Error('offline'); };
  await assert.rejects(api.reactivateTrainingV2Plan('plan-1', 1), (error) => error instanceof api.TrainingV2NetworkError);

  global.fetch = async () => response(200, { plan: { invalid: true } });
  await assert.rejects(api.activateTrainingV2Plan('plan-1', 1), (error) => error instanceof api.TrainingV2ContractError);
});

test('listTrainingV2Templates GETs the template list and returns the templates array', async (context) => {
  withEnv(context);
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push([url, init]);
    return response(200, {
      templates: [{ template: { id: 'template-1' }, userPlan: { isSaved: false, isActive: false, userPlanId: null } }],
    });
  };
  const api = loadApi();

  const templates = await api.listTrainingV2Templates();

  assert.equal(templates.length, 1);
  assert.equal(templates[0].template.id, 'template-1');
  assert.equal(calls[0][1].method, 'GET');
  assert.equal(calls[0][0].endsWith('/v1/training/templates'), true);
});

test('getTrainingV2Template GETs the template detail by id and returns the whole {template, userPlan} envelope', async (context) => {
  withEnv(context);
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push([url, init]);
    return response(200, {
      template: { id: 'template-1', revision: { units: [] } },
      userPlan: { isSaved: true, isActive: false, userPlanId: 'plan-1' },
    });
  };
  const api = loadApi();

  const result = await api.getTrainingV2Template('template/1');

  assert.equal(result.template.id, 'template-1');
  assert.equal(result.userPlan.userPlanId, 'plan-1');
  assert.equal(calls[0][1].method, 'GET');
  assert.equal(calls[0][0].endsWith('/v1/training/templates/template%2F1'), true);
});

test('saveTrainingV2Template PUTs to /save with no body and returns the refreshed userPlan projection', async (context) => {
  withEnv(context);
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push([url, init]);
    return response(200, { userPlan: { isSaved: true, isActive: false, userPlanId: 'plan-1' } });
  };
  const api = loadApi();

  const userPlan = await api.saveTrainingV2Template('template-1');

  assert.equal(userPlan.isSaved, true);
  assert.equal(calls[0][1].method, 'PUT');
  assert.equal(calls[0][0].endsWith('/v1/training/templates/template-1/save'), true);
  assert.equal('body' in calls[0][1], false);
  assert.equal('Content-Type' in calls[0][1].headers, false);
});

test('unsaveTrainingV2Template DELETEs /save with no body and returns the refreshed userPlan projection', async (context) => {
  withEnv(context);
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push([url, init]);
    return response(200, { userPlan: { isSaved: false, isActive: false, userPlanId: 'plan-1' } });
  };
  const api = loadApi();

  const userPlan = await api.unsaveTrainingV2Template('template-1');

  assert.equal(userPlan.isSaved, false);
  assert.equal(calls[0][1].method, 'DELETE');
  assert.equal(calls[0][0].endsWith('/v1/training/templates/template-1/save'), true);
});

test('activateTrainingV2Template POSTs to /activate with no body — activating a Grow template never auto-saves it', async (context) => {
  withEnv(context);
  const calls = [];
  global.fetch = async (url, init) => {
    calls.push([url, init]);
    return response(200, { userPlan: { isSaved: false, isActive: true, userPlanId: 'plan-1' } });
  };
  const api = loadApi();

  const userPlan = await api.activateTrainingV2Template('template-1');

  assert.equal(userPlan.isActive, true);
  assert.equal(userPlan.isSaved, false);
  assert.equal(calls[0][1].method, 'POST');
  assert.equal(calls[0][0].endsWith('/v1/training/templates/template-1/activate'), true);
  assert.equal('body' in calls[0][1], false);
});

test('template mutations classify 401/404/409/network/contract failures the same way plan mutations do', async (context) => {
  withEnv(context);
  const api = loadApi();

  global.fetch = async () => response(401, { error: { code: 'UNAUTHORIZED' } });
  await assert.rejects(api.saveTrainingV2Template('template-1'), (error) => error instanceof api.TrainingV2AuthError);

  global.fetch = async () => response(404, { error: { code: 'TRAINING_TEMPLATE_NOT_FOUND' } });
  await assert.rejects(api.getTrainingV2Template('missing'), (error) => error instanceof api.TrainingV2NotFoundError);

  global.fetch = async () => { throw new Error('offline'); };
  await assert.rejects(api.activateTrainingV2Template('template-1'), (error) => error instanceof api.TrainingV2NetworkError);

  global.fetch = async () => response(200, { templates: 'not-an-array' });
  await assert.rejects(api.listTrainingV2Templates(), (error) => error instanceof api.TrainingV2ContractError);
});
