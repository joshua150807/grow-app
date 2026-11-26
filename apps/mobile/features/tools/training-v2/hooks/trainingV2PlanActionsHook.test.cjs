const assert = require('node:assert/strict');
const test = require('node:test');

const { loadModule } = require('../testing/loadModule.cjs');

function createActionsHookHarness(planId, onSuccess, apiMocks) {
  const cells = [];
  let cellIndex = 0;
  const refs = [];
  let refIndex = 0;
  const react = {
    useCallback: (callback) => callback,
    useRef: (initial) => {
      const index = refIndex++;
      if (!refs[index]) refs[index] = { current: initial };
      return refs[index];
    },
    useState: (initial) => {
      const index = cellIndex++;
      if (!(index in cells)) cells[index] = typeof initial === 'function' ? initial() : initial;
      return [cells[index], (next) => {
        cells[index] = typeof next === 'function' ? next(cells[index]) : next;
      }];
    },
  };
  const module = loadModule(__dirname, './useTrainingV2PlanActions.js', {
    react,
    '../services/trainingV2Api': apiMocks,
  });

  function render() { cellIndex = 0; refIndex = 0; return module.useTrainingV2PlanActions(planId, onSuccess); }
  let result = render();

  return {
    get result() { return result; },
    rerender() { result = render(); return result; },
    get pending() { return cells[0]; },
    get error() { return cells[1]; },
    get conflict() { return cells[2]; },
  };
}

function fakeApi(overrides = {}) {
  return {
    activateTrainingV2Plan: async () => { throw new Error('not mocked'); },
    archiveTrainingV2Plan: async () => { throw new Error('not mocked'); },
    reactivateTrainingV2Plan: async () => { throw new Error('not mocked'); },
    scheduleTrainingV2Plan: async () => { throw new Error('not mocked'); },
    updateTrainingV2WeeklyGoal: async () => { throw new Error('not mocked'); },
    deleteTrainingV2Plan: async () => { throw new Error('not mocked'); },
    ...overrides,
  };
}

function apiError(message, { code, status = null } = {}) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

test('activate calls the API with planId and expectedVersion and hands the raw response to onSuccess', async () => {
  const calls = [];
  const successCalls = [];
  const harness = createActionsHookHarness('plan-1', async (plan) => { successCalls.push(plan); }, fakeApi({
    activateTrainingV2Plan: async (planId, expectedVersion) => {
      calls.push([planId, expectedVersion]);
      return { id: 'plan-1', status: 'active', version: 2 };
    },
  }));

  const outcome = await harness.result.activate(1);

  assert.equal(outcome.ok, true);
  assert.deepEqual(calls[0], ['plan-1', 1]);
  assert.deepEqual(successCalls, [{ id: 'plan-1', status: 'active', version: 2 }]);
  assert.equal(harness.pending, null);
});

test('schedule and weeklyGoal pass their extra arguments through unchanged', async () => {
  const scheduleCalls = [];
  const weeklyGoalCalls = [];
  const harness = createActionsHookHarness('plan-1', async () => {}, fakeApi({
    scheduleTrainingV2Plan: async (planId, expectedVersion, startDate, timeZone) => {
      scheduleCalls.push([planId, expectedVersion, startDate, timeZone]);
      return { id: 'plan-1' };
    },
    updateTrainingV2WeeklyGoal: async (planId, expectedVersion, weeklyGoal) => {
      weeklyGoalCalls.push([planId, expectedVersion, weeklyGoal]);
      return { id: 'plan-1' };
    },
  }));

  await harness.result.schedule(3, '2026-08-01', 'Europe/Berlin');
  await harness.result.updateWeeklyGoal(3, 4);

  assert.deepEqual(scheduleCalls[0], ['plan-1', 3, '2026-08-01', 'Europe/Berlin']);
  assert.deepEqual(weeklyGoalCalls[0], ['plan-1', 3, 4]);
});

test('a second concurrent action call is deduplicated while the first is in flight', async () => {
  let resolveFirst;
  const calls = [];
  const harness = createActionsHookHarness('plan-1', async () => {}, fakeApi({
    activateTrainingV2Plan: async () => {
      calls.push('call');
      return new Promise((resolve) => { resolveFirst = () => resolve({ id: 'plan-1' }); });
    },
  }));

  const firstCall = harness.result.activate(1);
  assert.equal(harness.pending, 'activate');
  const secondOutcome = await harness.result.archive(1);
  assert.equal(secondOutcome.ok, false);
  assert.equal(calls.length, 1);

  resolveFirst();
  const firstOutcome = await firstCall;
  assert.equal(firstOutcome.ok, true);
  assert.equal(harness.pending, null);
});

test('a TRAINING_PLAN_VERSION_CONFLICT sets conflict and does not call onSuccess', async () => {
  let successCalled = false;
  const harness = createActionsHookHarness('plan-1', async () => { successCalled = true; }, fakeApi({
    archiveTrainingV2Plan: async () => { throw apiError('stale', { code: 'TRAINING_PLAN_VERSION_CONFLICT', status: 409 }); },
  }));

  const outcome = await harness.result.archive(1);

  assert.equal(outcome.ok, false);
  assert.equal(harness.conflict, true);
  assert.ok(harness.error);
  assert.equal(successCalled, false);
});

test('a non-version 409 (e.g. another plan already scheduled) surfaces as an error but is not reload-eligible', async () => {
  const harness = createActionsHookHarness('plan-1', async () => {}, fakeApi({
    scheduleTrainingV2Plan: async () => { throw apiError('taken', { code: 'TRAINING_SCHEDULE_CONFLICT', status: 409 }); },
  }));

  const outcome = await harness.result.schedule(1, '2026-08-01', 'Europe/Berlin');

  assert.equal(outcome.ok, false);
  assert.equal(harness.conflict, false);
  assert.ok(harness.error);
});

test('400/404/network/contract failures surface as a plain error without setting conflict', async () => {
  const harness = createActionsHookHarness('plan-1', async () => {}, fakeApi({
    updateTrainingV2WeeklyGoal: async () => { throw apiError('bad request', { code: 'TRAINING_PLAN_VALIDATION_ERROR', status: 400 }); },
  }));

  const outcome = await harness.result.updateWeeklyGoal(1, 4);

  assert.equal(outcome.ok, false);
  assert.equal(harness.conflict, false);
  assert.ok(harness.error);
});

test('remove calls deleteTrainingV2Plan with just planId and never calls onSuccess — there is no server plan left to apply', async () => {
  const calls = [];
  const successCalls = [];
  const harness = createActionsHookHarness('plan-1', async (plan) => { successCalls.push(plan); }, fakeApi({
    deleteTrainingV2Plan: async (planId) => { calls.push(planId); },
  }));

  const outcome = await harness.result.remove();

  assert.equal(outcome.ok, true);
  assert.deepEqual(calls, ['plan-1']);
  assert.deepEqual(successCalls, []);
  assert.equal(harness.pending, null);
});

test('remove shares the same single-flight guard as every other action', async () => {
  let resolveDelete;
  const harness = createActionsHookHarness('plan-1', async () => {}, fakeApi({
    deleteTrainingV2Plan: async () => new Promise((resolve) => { resolveDelete = () => resolve(); }),
  }));

  const firstCall = harness.result.remove();
  assert.equal(harness.pending, 'delete');
  const secondOutcome = await harness.result.activate(1);
  assert.equal(secondOutcome.ok, false);

  resolveDelete();
  const firstOutcome = await firstCall;
  assert.equal(firstOutcome.ok, true);
  assert.equal(harness.pending, null);
});

test('a failed remove surfaces the error, sets pending back to null, and never calls onSuccess', async () => {
  let successCalled = false;
  const harness = createActionsHookHarness('plan-1', async () => { successCalled = true; }, fakeApi({
    deleteTrainingV2Plan: async () => { throw apiError('nope', { code: 'TRAINING_PLAN_NOT_FOUND', status: 404 }); },
  }));

  const outcome = await harness.result.remove();

  assert.equal(outcome.ok, false);
  assert.ok(harness.error);
  assert.equal(harness.pending, null);
  assert.equal(successCalled, false);
});

test('clearError resets both error and conflict', async () => {
  const harness = createActionsHookHarness('plan-1', async () => {}, fakeApi({
    archiveTrainingV2Plan: async () => { throw apiError('stale', { code: 'TRAINING_PLAN_VERSION_CONFLICT', status: 409 }); },
  }));
  await harness.result.archive(1);
  assert.equal(harness.conflict, true);

  harness.result.clearError();
  harness.rerender();

  assert.equal(harness.conflict, false);
  assert.equal(harness.error, null);
});
