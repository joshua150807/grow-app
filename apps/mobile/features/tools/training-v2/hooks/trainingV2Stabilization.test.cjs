const assert = require('node:assert/strict');
const test = require('node:test');
const { loadModule } = require('../testing/loadModule.cjs');
const { createHookHarness } = require('../testing/createHookHarness.cjs');
const model = loadModule(__dirname, '../models/trainingV2SessionModel.js');

function draft(completed = true) {
  return {
    planId: 'plan', unitId: 'unit', unitType: 'strength', planName: 'Plan', unitName: 'Unit',
    idempotencyKey: 'stable-key', startedAt: '2026-11-23T10:00:00.000Z', restTimer: null,
    exercises: [{ exerciseId: 'exercise', logicalTargetExerciseKey: 'exercise-key', orderIndex: 0, note: null,
      sets: [{ clientSetId: 'set', logicalTargetSetKey: 'set-key', orderIndex: 0, setType: 'work',
        weightKg: 12.5, reps: 8, note: null, completed,
        completedAt: completed ? '2026-11-23T10:01:00.000Z' : null, actualRestSeconds: null }],
    }],
  };
}
function sessionHarness({ initial = draft(), storage = {}, save = async () => ({ ok: true }) } = {}) {
  let saved = initial;
  let calls = 0;
  const harness = createHookHarness((react) => {
    const { useTrainingV2Session } = loadModule(__dirname, './useTrainingV2Session.js', {
      react,
      '../../../../services/authUser': { requireCurrentUserId: async () => 'owner' },
      '../models/trainingV2SessionModel': model,
      '../services/trainingV2Api': {},
      '../services/trainingV2SessionDraftStorage': {
        requireTrainingV2SessionOwner: async () => 'owner',
        loadTrainingV2SessionDraft: async () => saved,
        saveTrainingV2SessionDraft: async (_owner, _plan, _unit, value) => { saved = value; },
        clearTrainingV2SessionDraft: async () => { saved = null; },
        ...storage,
      },
      '../services/trainingV2SessionSave': { saveTrainingV2Session: async (...args) => { calls += 1; return save(...args); } },
    });
    return () => useTrainingV2Session('plan', 'unit');
  });
  harness.render();
  return { harness, get saved() { return saved; }, get calls() { return calls; } };
}

test('B01: incomplete save preserves unconfirmed entered values by refusing a lossy terminal save', async () => {
  const testCase = sessionHarness({ initial: draft(false) });
  await testCase.harness.settle();
  const result = await testCase.harness.result.save('incomplete');
  assert.equal(result.ok, false);
  assert.equal(testCase.calls, 0);
  assert.equal(testCase.harness.render().draft.exercises[0].sets[0].weightKg, 12.5);
});

test('B02: zero and partially completed strength sessions cannot be saved as completed', async () => {
  for (const initial of [{ ...draft(), exercises: [] }, draft(false)]) {
    const testCase = sessionHarness({ initial });
    await testCase.harness.settle();
    assert.equal((await testCase.harness.result.save('completed')).ok, false);
    assert.equal(testCase.calls, 0);
  }
});

test('B09: failed local save releases pending state and reports the storage error without sending', async () => {
  const testCase = sessionHarness({ storage: { saveTrainingV2SessionDraft: async () => { throw new Error('disk full'); } } });
  await testCase.harness.settle();
  const result = await testCase.harness.result.save('completed');
  assert.equal(result.ok, false);
  assert.equal(testCase.harness.render().saving, false);
  assert.match(testCase.harness.result.saveError.message, /disk full/);
  assert.equal(testCase.calls, 0);
});

test('B09: successful server save with failed cleanup is retryable without losing or duplicating the request', async () => {
  const testCase = sessionHarness({ storage: { clearTrainingV2SessionDraft: async () => { throw new Error('remove failed'); } } });
  await testCase.harness.settle();
  assert.equal((await testCase.harness.result.save('completed')).ok, false);
  assert.equal(testCase.harness.render().saving, false);
  assert.match(testCase.harness.result.saveError.message, /remove failed/);
  assert.ok(testCase.harness.result.draft);
});

test('B10: concurrent save only sends once and edit callbacks cannot mutate its snapshot', { timeout: 1000 }, async () => {
  let finish;
  const testCase = sessionHarness({ save: () => new Promise((resolve) => { finish = resolve; }) });
  await testCase.harness.settle();
  const first = testCase.harness.result.save('completed');
  const second = await testCase.harness.result.save('incomplete');
  assert.equal(second.ok, false);
  await new Promise(setImmediate);
  testCase.harness.result.updateNote(0, 'must not replace sent snapshot');
  assert.equal(testCase.harness.render().draft.exercises[0].note, null);
  assert.equal(testCase.calls, 1);
  finish({ ok: true });
  assert.equal((await first).ok, true);
});

test('B10: failed unknown response freezes original status and bytes for the next save', async () => {
  const requests = [];
  const testCase = sessionHarness({ save: async (snapshot, status) => {
    requests.push(model.buildTrainingV2SessionPayload(snapshot, status));
    return { ok: false, error: new Error('offline') };
  } });
  await testCase.harness.settle();
  await testCase.harness.result.save('incomplete');
  testCase.harness.render();
  testCase.harness.result.updateNote(0, 'changed');
  await testCase.harness.result.save('completed');
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[0], requests[1]);
});

test('B09/B13: a discard finishing after unmount cannot authorize stale navigation', async () => {
  let finish;
  const testCase = sessionHarness({ storage: { clearTrainingV2SessionDraft: () => new Promise((resolve) => { finish = resolve; }) } });
  await testCase.harness.settle();
  const pending = testCase.harness.result.discard();
  testCase.harness.unmount();
  finish();
  assert.equal((await pending).ok, false);
});

test('B09/B10: an oversized legacy note is rejected before freezing/sending and remains editable', async () => {
  const initial = draft(); initial.exercises[0].note = 'x'.repeat(1001);
  const testCase = sessionHarness({ initial });
  await testCase.harness.settle();
  assert.equal((await testCase.harness.result.save('completed')).ok, false);
  testCase.harness.result.updateNote(0, 'corrected');
  assert.equal(testCase.harness.render().draft.exercises[0].note, 'corrected');
  assert.equal(testCase.calls, 0);
});
