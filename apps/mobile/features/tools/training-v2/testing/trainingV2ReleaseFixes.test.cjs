// Release-Blocker-Fixplan 2026-11-26 -- mobile regression tests (blocks B2/B3/B10).
// Covers: limit drift guard vs. packages/shared, reps/weight parsing, pre-save checks, rest clamping,
// and the session hook's unlock-only-on-definitive-rejection rule (no new data-loss path).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { loadModule } = require('./loadModule.cjs');

async function flushMicrotasks() {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}

// Mirrors the fake-hooks harness convention used by useTrainingV2PlanDraft.test.cjs /
// trainingV2EditorHooks.test.cjs: a hand-rolled useState/useRef/useEffect so the hook's own
// effects (its load() on mount) run deterministically under node:test instead of needing a
// real renderer.
function createSessionHookHarness({
  ownerId = 'user-1',
  draftStorage = {},
  api = {},
  sessionSave = {},
} = {}) {
  const cells = [];
  const refs = [];
  let cellIndex = 0;
  let refIndex = 0;
  const pendingEffects = [];
  const callbacks = [];
  let callbackIndex = 0;
  const react = {
    useState: (initial) => {
      const index = cellIndex++;
      if (!(index in cells)) cells[index] = typeof initial === 'function' ? initial() : initial;
      return [cells[index], (next) => {
        cells[index] = typeof next === 'function' ? next(cells[index]) : next;
      }];
    },
    useRef: (initial) => {
      const index = refIndex++;
      if (!refs[index]) refs[index] = { current: initial };
      return refs[index];
    },
    useEffect: (effect, deps) => {
      pendingEffects.push({ effect, deps });
    },
    useCallback: (callback, deps) => {
      const index = callbackIndex++;
      const old = callbacks[index];
      if (!old || deps.some((value, i) => value !== old.deps[i])) callbacks[index] = { callback, deps };
      return callbacks[index].callback;
    },
  };

  const draftStore = new Map();
  const defaultDraftStorage = {
    requireTrainingV2SessionOwner: async () => ownerId,
    loadTrainingV2SessionDraft: async (owner, planId, unitId) => draftStore.get(`${owner}:${planId}:${unitId}`) ?? null,
    saveTrainingV2SessionDraft: async (owner, planId, unitId, session) => {
      draftStore.set(`${owner}:${planId}:${unitId}`, session);
    },
    clearTrainingV2SessionDraft: async (owner, planId, unitId) => {
      draftStore.delete(`${owner}:${planId}:${unitId}`);
    },
  };

  const defaultApi = {
    getTrainingV2Plan: async () => { throw new Error('getTrainingV2Plan not stubbed for this test'); },
    resolveTrainingV2ExerciseNames: async () => ({}),
  };

  const defaultSessionSave = {
    saveTrainingV2Session: async () => { throw new Error('saveTrainingV2Session not stubbed for this test'); },
  };

  const sessionModel = loadModule(__dirname, '../models/trainingV2SessionModel.js', {
    '../services/trainingV2LogicalId': { createTrainingV2LogicalKey: () => `key-${Math.random()}` },
  });
  const module = loadModule(__dirname, '../hooks/useTrainingV2Session.js', {
    react,
    '../../../../services/authUser': { requireCurrentUserId: async () => ownerId },
    '../models/trainingV2SessionModel': sessionModel,
    '../services/trainingV2Api': { ...defaultApi, ...api },
    '../services/trainingV2SessionDraftStorage': { ...defaultDraftStorage, ...draftStorage },
    '../services/trainingV2SessionSave': { ...defaultSessionSave, ...sessionSave },
  });

  let props;
  let result;
  let previousDeps = [];
  let previousCleanups = [];

  function render(nextProps) {
    props = nextProps;
    cellIndex = 0;
    refIndex = 0;
    callbackIndex = 0;
    pendingEffects.length = 0;
    result = module.useTrainingV2Session(props.planId, props.unitId);
    const nextCleanups = [];
    pendingEffects.forEach((entry, index) => {
      const changed = !previousDeps[index]
        || !entry.deps
        || entry.deps.length !== previousDeps[index].length
        || entry.deps.some((dep, depIndex) => dep !== previousDeps[index][depIndex]);
      if (changed) {
        if (typeof previousCleanups[index] === 'function') previousCleanups[index]();
        nextCleanups[index] = entry.effect();
      } else {
        nextCleanups[index] = previousCleanups[index];
      }
    });
    previousDeps = pendingEffects.map((entry) => entry.deps);
    previousCleanups = nextCleanups;
    return result;
  }

  return {
    draftStore,
    render,
    rerender: () => render(props),
    get result() { return result; },
    async settle() {
      let current = result;
      for (let iteration = 0; iteration < 5; iteration += 1) {
        await flushMicrotasks();
        current = render(props);
      }
      return current;
    },
  };
}

const numeric = loadModule(__dirname, '../utils/trainingV2NumericInput.js');
const model = loadModule(__dirname, '../models/trainingV2SessionModel.js');

const saveablePlan = {
  id: 'plan-1', name: 'Plan',
  revision: { units: [{ id: 'unit-1', name: 'A', unitType: 'strength', exercises: [{
    exerciseId: 'exercise-1', logicalTargetExerciseKey: 'exercise-key', orderIndex: 0,
    targetSets: [{ logicalTargetSetKey: 'set-key', orderIndex: 0, setType: 'work', targetWeightKg: null, targetReps: null, plannedRestSeconds: 0 }],
  }] }] },
};
const rejection = Object.assign(new Error('Bitte überprüfe deine Eingaben.'), { status: 400, code: 'TRAINING_SESSION_VALIDATION_ERROR' });

async function startedSession(saveTrainingV2Session) {
  const harness = createSessionHookHarness({ api: { getTrainingV2Plan: async () => saveablePlan }, sessionSave: { saveTrainingV2Session } });
  harness.render({ planId: 'plan-1', unitId: 'unit-1' });
  await harness.settle();
  harness.result.updateInput(0, 0, { weightInput: '60', weightKg: 60, repsInput: '8', reps: 8 });
  await harness.settle();
  harness.result.completeSet(0, 0, { now: () => new Date('2026-11-26T10:00:00.000Z') });
  await harness.settle();
  return harness;
}

test('drift guard: mobile limit mirror equals packages/shared TRAINING_V2_LIMITS', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../../../../../../packages/shared/src/training/primitives.ts'), 'utf8');
  const block = source.slice(source.indexOf('export const TRAINING_V2_LIMITS'));
  for (const [name, value] of Object.entries(numeric.TRAINING_V2_LIMITS)) {
    const match = block.match(new RegExp(`${name}:\\s*([^,\\n]+),`));
    assert.ok(match, `${name} missing in shared`);
    assert.equal(Function(`return (${match[1].replace(/_/g, '')})`)(), value, name);
  }
});

test('reps text: 1-1000 valid; empty is an incomplete entry; anything else invalid but kept as text', () => {
  assert.deepEqual(numeric.parseTrainingV2RepsText('1000'), { valid: true, value: 1000 });
  assert.deepEqual(numeric.parseTrainingV2RepsText(''), { valid: true, value: null });
  for (const text of ['1001', '3000000000', '0', '8,5', 'abc', '-3']) assert.equal(numeric.parseTrainingV2RepsText(text).valid, false, text);
  assert.equal(model.parseSessionRepsInput('3000000000'), null);
});

test('weight text: 0-1500 kg with up to 3 decimals', () => {
  for (const [text, value] of [['1500', 1500], ['0,125', 0.125], ['22,75', 22.75], ['1499,999', 1499.999]]) {
    assert.deepEqual(numeric.parseTrainingV2WeightText(text), { valid: true, value }, text);
  }
  for (const text of ['1500,5', '100000000000000000000', '12,3456', '1e3']) assert.equal(numeric.parseTrainingV2WeightText(text).valid, false, text);
});

test('pre-save check flags invalid text and legacy numeric values on confirmed sets (draft stays intact)', () => {
  const draft = { exercises: [{ note: null, sets: [{ completed: true, weightKg: 60, reps: 3_000_000_000, note: null }] }] };
  assert.match(model.getTrainingV2SessionSaveIssue(draft, 'completed'), /Wiederholungen/);
  const typed = { exercises: [{ note: null, sets: [{ completed: false, weightKg: null, reps: null, repsInput: '3000000000', note: null }] }] };
  assert.match(model.getTrainingV2SessionSaveIssue(typed, 'incomplete'), /Wiederholungen/);
  assert.equal(model.getSessionSetInputIssue({ weightKg: 1e20, reps: 8 }), 'weight');
  assert.equal(model.getSessionSetInputIssue({ weightKg: 60, reps: 8, weightInput: '60', repsInput: '8' }), null);
});

test('measured rest above 24 h is recorded as not measured instead of an API-rejected value', () => {
  const state = { exercises: [{ sets: [{ actualRestSeconds: null }] }] };
  assert.equal(model.recordRestSecondsForSet(state, 0, 0, 86_400).exercises[0].sets[0].actualRestSeconds, 86_400);
  assert.equal(model.recordRestSecondsForSet(state, 0, 0, 90_000).exercises[0].sets[0].actualRestSeconds, null);
});

test('completeSet refuses a set with too many reps and keeps the typed text', async () => {
  const harness = createSessionHookHarness({ api: { getTrainingV2Plan: async () => saveablePlan } });
  harness.render({ planId: 'plan-1', unitId: 'unit-1' });
  await harness.settle();
  harness.result.updateInput(0, 0, { repsInput: '3000000000', reps: model.parseSessionRepsInput('3000000000') });
  await harness.settle();
  harness.result.completeSet(0, 0);
  const result = await harness.settle();
  const set = result.draft.exercises[0].sets[0];
  assert.equal(set.completed, false);
  assert.equal(set.repsInput, '3000000000');
  assert.match(result.saveError.message, /Wiederholungen/);
});

test('definitive 400 TRAINING_SESSION_VALIDATION_ERROR unlocks the draft with the SAME key, values and endedAt', async () => {
  const sent = [];
  const harness = await startedSession(async (snapshot) => { sent.push(snapshot); return { ok: false, error: rejection }; });
  const outcome = await harness.result.save('completed', { now: () => new Date('2026-11-26T11:00:00.000Z') });
  const result = await harness.settle();
  assert.equal(outcome.unlocked, true);
  assert.equal(result.locked, false);
  assert.equal(result.draft.pendingSave, undefined);
  assert.equal(result.draft.idempotencyKey, sent[0].idempotencyKey);
  assert.equal(result.draft.endedAt, '2026-11-26T11:00:00.000Z');
  assert.equal(result.draft.exercises[0].sets[0].reps, 8);
  const stored = harness.draftStore.get('user-1:plan-1:unit-1');
  assert.equal(stored.pendingSave, undefined, 'unlocked state is persisted, so an app restart keeps it editable');
  assert.equal(stored.idempotencyKey, sent[0].idempotencyKey);
});

for (const [name, error] of [
  ['network error', Object.assign(new Error('offline'), { code: 'TRAINING_V2_NETWORK_ERROR' })],
  ['5xx / contract error', Object.assign(new Error('server'), { code: 'TRAINING_V2_CONTRACT_ERROR' })],
  ['400 with another code', Object.assign(new Error('unit'), { status: 400, code: 'TRAINING_SESSION_UNIT_NOT_AVAILABLE' })],
  ['409 conflict', Object.assign(new Error('conflict'), { status: 409, code: 'TRAINING_SESSION_CONFLICT' })],
]) {
  test(`${name}: the draft stays locked as the identical pendingSave replay`, async () => {
    const harness = await startedSession(async () => ({ ok: false, error }));
    await harness.result.save('completed', { now: () => new Date('2026-11-26T11:00:00.000Z') });
    const result = await harness.settle();
    assert.equal(result.locked, true);
    assert.deepEqual(result.draft.pendingSave, { status: 'completed' });
    assert.deepEqual(harness.draftStore.get('user-1:plan-1:unit-1').pendingSave, { status: 'completed' });
  });
}

test('a draft locked by an older build (reps 3e9, pendingSave) is unlocked by the new server 400 and can be corrected and saved once', async () => {
  const calls = [];
  const harness = createSessionHookHarness({
    api: { getTrainingV2Plan: async () => saveablePlan },
    sessionSave: { saveTrainingV2Session: async (snapshot) => {
      calls.push(snapshot);
      return calls.length === 1 ? { ok: false, error: rejection } : { ok: true, session: { id: 's' }, created: true };
    } },
  });
  let seq = 0;
  const legacy = model.createTrainingV2SessionDraft(saveablePlan, saveablePlan.revision.units[0], {}, {
    now: () => new Date('2026-11-26T09:00:00.000Z'), logicalKeyFactory: () => `legacy-${++seq}`,
  });
  legacy.exercises[0].sets[0] = { ...legacy.exercises[0].sets[0], weightKg: 60, reps: 3_000_000_000, completed: true, completedAt: '2026-11-26T09:30:00.000Z' };
  harness.draftStore.set('user-1:plan-1:unit-1', { ...legacy, endedAt: '2026-11-26T10:00:00.000Z', pendingSave: { status: 'completed' } });
  harness.render({ planId: 'plan-1', unitId: 'unit-1' });
  let result = await harness.settle();
  assert.equal(result.locked, true);
  await result.save('completed');
  result = await harness.settle();
  assert.equal(result.locked, false);
  assert.match(result.saveError.message, /Wiederholungen/);
  result.uncompleteSet(0, 0);
  result = await harness.settle();
  result.updateInput(0, 0, { repsInput: '30', reps: 30 });
  result = await harness.settle();
  result.completeSet(0, 0, { now: () => new Date('2026-11-26T09:31:00.000Z') });
  result = await harness.settle();
  const outcome = await result.save('completed');
  result = await harness.settle();
  assert.equal(outcome.ok, true);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].idempotencyKey, calls[0].idempotencyKey, 'same logical request -> no duplicate session possible');
  assert.equal(calls[1].endedAt, '2026-11-26T10:00:00.000Z');
  assert.equal(calls[1].exercises[0].sets[0].reps, 30);
  assert.equal(result.draft, null);
});

test('plan editor blocks out-of-limit values locally (weekly goal, reps, legacy weight, caps) without touching the draft', () => {
  const editor = loadModule(__dirname, '../models/trainingV2EditorModel.js');
  const state = editor.createEmptyEditorState();
  state.name = 'Plan'; state.weeklyGoal = '8';
  state.units[0].name = 'A';
  state.units[0].exercises = [{ ...editor.createEmptyTargetExercise(), exerciseId: 'exercise', exerciseName: 'Squat' }];
  const target = state.units[0].exercises[0].targetSets[0];
  target.targetReps = { minimum: 1001, maximum: 1001 };
  target.targetWeightKg = 5000;
  const paths = editor.getEditorValidationIssues(state, { mode: 'create' }).map((issue) => issue.path);
  assert.ok(paths.includes('weeklyGoal'));
  assert.ok(paths.some((p) => p.endsWith('targetReps')));
  assert.ok(paths.some((p) => p.endsWith('targetWeightKg')));
  state.weeklyGoal = '7'; target.targetReps = { minimum: 10, maximum: 10 }; target.targetWeightKg = 1500;
  assert.deepEqual(editor.getEditorValidationIssues(state, { mode: 'create' }), []);
  state.units = Array.from({ length: 15 }, () => ({ ...state.units[0] }));
  assert.ok(editor.getEditorValidationIssues(state, { mode: 'create' }).some((issue) => issue.path === 'units'));
});
