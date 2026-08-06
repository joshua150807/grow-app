const assert = require('node:assert/strict');
const test = require('node:test');

const { loadModule } = require('../testing/loadModule.cjs');

// trainingV2SessionSave.js imports two real, further-nested modules
// ('../models/trainingV2SessionModel' and './trainingV2Api'). loadModule's plain-require
// fallback for a non-mocked request loads native ESM source directly (bypassing the Babel
// transform this harness otherwise applies), where a *sibling* module's own extensionless
// relative imports fail strict ESM resolution — so, exactly like useTrainingV2PlanDraft.test.cjs
// does for its own dependency, the session model is pre-loaded through loadModule itself (CJS-
// safe) and injected as a mock; trainingV2Api is stubbed outright since every test here already
// injects its own `createSession` and never needs the real network-calling implementation.
const sessionModel = loadModule(__dirname, '../models/trainingV2SessionModel.js');

function loadSessionSave() {
  return loadModule(__dirname, './trainingV2SessionSave.js', {
    '../models/trainingV2SessionModel': sessionModel,
    './trainingV2Api': { createTrainingV2Session: async () => { throw new Error('not stubbed'); } },
  });
}

function draft(overrides = {}) {
  return {
    planId: 'plan-1',
    unitId: 'unit-1',
    idempotencyKey: 'key-1',
    exercises: [{
      exerciseId: 'exercise-1',
      logicalTargetExerciseKey: 'ltek-1',
      orderIndex: 0,
      sets: [{
        clientSetId: 'set-1',
        logicalTargetSetKey: 'ltsk-1',
        orderIndex: 0,
        setType: 'work',
        targetWeightKg: null,
        targetReps: null,
        plannedRestSeconds: 90,
        weightKg: 80,
        reps: 8,
        note: null,
        completed: true,
        completedAt: '2026-08-01T09:05:00.000Z',
        actualRestSeconds: 91,
      }],
    }],
    ...overrides,
  };
}

test('saveTrainingV2Session builds the payload once and returns { ok, session, created } on success', async () => {
  const calls = [];
  const { saveTrainingV2Session } = loadSessionSave();
  const createSession = async (payload) => {
    calls.push(payload);
    return { session: { id: 'session-1' }, created: true };
  };

  const outcome = await saveTrainingV2Session(draft(), 'incomplete', { createSession });

  assert.equal(outcome.ok, true);
  assert.deepEqual(outcome.session, { id: 'session-1' });
  assert.equal(outcome.created, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].idempotencyKey, 'key-1');
  assert.equal(calls[0].status, 'incomplete');
});

test('a failed attempt never throws — it resolves { ok: false, error } and leaves the draft to the caller', async () => {
  const { saveTrainingV2Session } = loadSessionSave();
  const networkError = new Error('offline');
  const createSession = async () => { throw networkError; };

  const outcome = await saveTrainingV2Session(draft(), 'incomplete', { createSession });

  assert.equal(outcome.ok, false);
  assert.equal(outcome.error, networkError);
});

test('retrying after a failure sends the exact same idempotencyKey and payload — a byte-identical replay, not a new request', async () => {
  const { saveTrainingV2Session } = loadSessionSave();
  const calls = [];
  let failNext = true;
  const createSession = async (payload) => {
    calls.push(payload);
    if (failNext) { failNext = false; throw new Error('network blip'); }
    return { session: { id: 'session-1' }, created: true };
  };

  const state = draft();
  const first = await saveTrainingV2Session(state, 'incomplete', { createSession });
  assert.equal(first.ok, false);

  const second = await saveTrainingV2Session(state, 'incomplete', { createSession });
  assert.equal(second.ok, true);

  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], calls[1]);
  assert.equal(calls[0].idempotencyKey, calls[1].idempotencyKey);
});

test('an idempotent server-side replay (created: false) is surfaced to the caller, not treated as an error', async () => {
  const { saveTrainingV2Session } = loadSessionSave();
  const createSession = async () => ({ session: { id: 'session-1' }, created: false });

  const outcome = await saveTrainingV2Session(draft(), 'completed', { createSession });

  assert.equal(outcome.ok, true);
  assert.equal(outcome.created, false);
});
