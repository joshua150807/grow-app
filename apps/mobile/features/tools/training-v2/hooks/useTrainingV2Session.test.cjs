const assert = require('node:assert/strict');
const test = require('node:test');

const { loadModule } = require('../testing/loadModule.cjs');

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
    useCallback: (callback) => callback,
  };

  const draftStore = new Map();
  const defaultDraftStorage = {
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
  const module = loadModule(__dirname, './useTrainingV2Session.js', {
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

const plan = {
  id: 'plan-1',
  name: 'Push/Pull/Legs',
  revision: {
    units: [
      {
        id: 'unit-1',
        name: 'Push Day',
        unitType: 'strength',
        exercises: [],
      },
    ],
  },
};

test('with no persisted draft, load() creates one and immediately persists it (armed for the leave-guard from the very first render)', async () => {
  const harness = createSessionHookHarness({
    api: { getTrainingV2Plan: async () => plan },
  });
  harness.render({ planId: 'plan-1', unitId: 'unit-1' });
  const result = await harness.settle();

  assert.ok(result.draft);
  assert.equal(result.draft.unitId, 'unit-1');
  assert.equal(harness.draftStore.get('user-1:plan-1:unit-1').unitId, 'unit-1');
});

test('updateNote() sets today\'s exercise-level note on the targeted exercise only, and immediately persists it to the draft store — never touching any set\'s own note', async () => {
  const planWithExercises = {
    id: 'plan-1',
    name: 'Push/Pull/Legs',
    revision: {
      units: [{
        id: 'unit-1',
        name: 'Push Day',
        unitType: 'strength',
        exercises: [
          {
            exerciseId: 'ex-1',
            logicalTargetExerciseKey: 'ltek-1',
            orderIndex: 0,
            targetSets: [{
              logicalTargetSetKey: 'ltsk-1', orderIndex: 0, setType: 'work',
              targetWeightKg: 80, targetReps: { minimum: 8, maximum: 10 }, plannedRestSeconds: 90,
            }],
          },
          {
            exerciseId: 'ex-2',
            logicalTargetExerciseKey: 'ltek-2',
            orderIndex: 1,
            targetSets: [{
              logicalTargetSetKey: 'ltsk-2', orderIndex: 0, setType: 'work',
              targetWeightKg: 40, targetReps: { minimum: 10, maximum: 12 }, plannedRestSeconds: 90,
            }],
          },
        ],
      }],
    },
  };
  const harness = createSessionHookHarness({
    api: { getTrainingV2Plan: async () => planWithExercises },
  });
  harness.render({ planId: 'plan-1', unitId: 'unit-1' });
  await harness.settle();

  harness.result.updateNote(0, 'Griff etwas breiter');
  const afterNote = harness.rerender();

  assert.equal(afterNote.draft.exercises[0].note, 'Griff etwas breiter');
  assert.equal(afterNote.draft.exercises[1].note, null);
  assert.equal(afterNote.draft.exercises[0].sets[0].note, null);
  assert.equal(harness.draftStore.get('user-1:plan-1:unit-1').exercises[0].note, 'Griff etwas breiter');
});

test('a resumable persisted draft takes precedence: load() restores it verbatim and never recreates/overwrites it from the plan', async () => {
  let planFetches = 0;
  const persisted = {
    planId: 'plan-1',
    unitId: 'unit-1',
    unitName: 'Push Day (in progress)',
    exercises: [{ exerciseId: 'ex-1', sets: [{ clientSetId: 's1', completed: true, weightKg: 80, reps: 5 }] }],
  };
  const harness = createSessionHookHarness({
    api: { getTrainingV2Plan: async () => { planFetches += 1; return plan; } },
    draftStorage: {
      loadTrainingV2SessionDraft: async (owner, planId, unitId) => (
        owner === 'user-1' && planId === 'plan-1' && unitId === 'unit-1' ? persisted : null
      ),
    },
  });
  harness.render({ planId: 'plan-1', unitId: 'unit-1' });
  const result = await harness.settle();

  assert.deepEqual(result.draft, persisted);
  // The plan (and a fresh draft skeleton) is only ever fetched to *create* a draft when none
  // is stored yet — resuming an existing one must never touch it.
  assert.equal(planFetches, 0);
});

test('a resumable persisted draft restores today\'s exercise note exactly as stored — never re-emptied and never re-derived from a "last note" lookup', async () => {
  const persistedWithNote = {
    planId: 'plan-1',
    unitId: 'unit-1',
    unitName: 'Push Day (in progress)',
    exercises: [
      { exerciseId: 'ex-1', note: 'Griff etwas breiter', sets: [{ clientSetId: 's1', completed: false, weightKg: null, reps: null }] },
    ],
  };
  const harness = createSessionHookHarness({
    api: { getTrainingV2Plan: async () => plan },
    draftStorage: {
      loadTrainingV2SessionDraft: async (owner, planId, unitId) => (
        owner === 'user-1' && planId === 'plan-1' && unitId === 'unit-1' ? persistedWithNote : null
      ),
    },
  });
  harness.render({ planId: 'plan-1', unitId: 'unit-1' });
  const result = await harness.settle();

  assert.equal(result.draft.exercises[0].note, 'Griff etwas breiter');
});

test('discard() — what "Training verwerfen" on back/hardware-back/iOS-swipe calls — clears the persisted draft for this owner/plan/unit and empties local state', async () => {
  const harness = createSessionHookHarness({
    api: { getTrainingV2Plan: async () => plan },
  });
  harness.render({ planId: 'plan-1', unitId: 'unit-1' });
  await harness.settle();
  assert.ok(harness.draftStore.has('user-1:plan-1:unit-1'), 'a draft was created and persisted on load');

  await harness.result.discard();
  const afterDiscard = harness.rerender();

  assert.equal(afterDiscard.draft, null);
  assert.equal(harness.draftStore.has('user-1:plan-1:unit-1'), false, 'discard must remove the persisted draft, not just clear local state');
});

test('a successful save() — "Unvollständig speichern" or "Training abschließen" — also clears the persisted draft; a failed save leaves it untouched', async () => {
  const outcomes = [];
  const harness = createSessionHookHarness({
    api: { getTrainingV2Plan: async () => plan },
    sessionSave: {
      saveTrainingV2Session: async (draft, status) => {
        const outcome = outcomes.shift();
        return outcome ?? { ok: true, session: { ...draft, status } };
      },
    },
  });
  harness.render({ planId: 'plan-1', unitId: 'unit-1' });
  await harness.settle();
  assert.ok(harness.draftStore.has('user-1:plan-1:unit-1'));

  outcomes.push({ ok: false, error: new Error('Netzwerkfehler') });
  const failed = await harness.result.save('incomplete');
  assert.equal(failed.ok, false);
  assert.ok(harness.draftStore.has('user-1:plan-1:unit-1'), 'a failed save must never delete the draft');
  const afterFailure = harness.rerender();
  assert.ok(afterFailure.draft, 'draft stays available so the user can retry');

  const ok = await harness.result.save('completed');
  assert.equal(ok.ok, true);
  assert.equal(harness.draftStore.has('user-1:plan-1:unit-1'), false, 'a successful save must clear the persisted draft');
  const afterSuccess = harness.rerender();
  assert.equal(afterSuccess.draft, null);
});

test('save() stamps endedAt once on the first attempt and a retry after failure reuses the exact same value', async () => {
  const calls = [];
  const outcomes = [];
  let clock = new Date('2026-08-01T09:30:00.000Z');
  const harness = createSessionHookHarness({
    api: { getTrainingV2Plan: async () => plan },
    sessionSave: {
      saveTrainingV2Session: async (draft, status) => {
        calls.push(draft.endedAt);
        const outcome = outcomes.shift();
        return outcome ?? { ok: true, session: { ...draft, status } };
      },
    },
  });
  harness.render({ planId: 'plan-1', unitId: 'unit-1' });
  await harness.settle();

  outcomes.push({ ok: false, error: new Error('Netzwerkfehler') });
  const failed = await harness.result.save('incomplete', { now: () => clock });
  assert.equal(failed.ok, false);
  assert.equal(harness.draftStore.get('user-1:plan-1:unit-1').endedAt, calls[0], 'the stamped endedAt is persisted to the draft store before the network call');
  // settle() (not a single rerender()) — this harness's load() effect re-fires on every render
  // (it has no real dependency-array memoization), so a single rerender leaves an
  // already-in-flight load() call still pending; settling lets it converge on the
  // just-persisted draft before the retry reads it.
  await harness.settle();

  // A later retry passes a different "now" — the already-stamped endedAt must still win.
  clock = new Date('2026-08-01T09:35:00.000Z');
  const ok = await harness.result.save('completed', { now: () => clock });
  assert.equal(ok.ok, true);

  assert.equal(calls.length, 2);
  assert.equal(calls[0], calls[1], 'retry reuses the exact same endedAt as the first attempt');
});

test('a save error leaves today\'s already-entered exercise note in place for the user to retry — it is never cleared or reset by the failed attempt', async () => {
  const planWithExercise = {
    id: 'plan-1',
    name: 'Push/Pull/Legs',
    revision: {
      units: [{
        id: 'unit-1',
        name: 'Push Day',
        unitType: 'strength',
        exercises: [{
          exerciseId: 'ex-1',
          logicalTargetExerciseKey: 'ltek-1',
          orderIndex: 0,
          targetSets: [{
            logicalTargetSetKey: 'ltsk-1', orderIndex: 0, setType: 'work',
            targetWeightKg: 80, targetReps: { minimum: 8, maximum: 10 }, plannedRestSeconds: 90,
          }],
        }],
      }],
    },
  };
  const harness = createSessionHookHarness({
    api: { getTrainingV2Plan: async () => planWithExercise },
    sessionSave: {
      saveTrainingV2Session: async () => ({ ok: false, error: new Error('Netzwerkfehler') }),
    },
  });
  harness.render({ planId: 'plan-1', unitId: 'unit-1' });
  await harness.settle();

  harness.result.updateNote(0, 'Griff etwas breiter');
  harness.rerender();

  const outcome = await harness.result.save('incomplete');
  assert.equal(outcome.ok, false);
  const afterFailure = harness.rerender();
  assert.equal(afterFailure.draft.exercises[0].note, 'Griff etwas breiter');
});

test('an unsupported (non-strength) unit is never turned into a session draft — load() surfaces an error instead of silently starting one', async () => {
  const restUnitPlan = {
    ...plan,
    revision: { units: [{ id: 'unit-2', name: 'Ruhetag', unitType: 'rest', exercises: [] }] },
  };
  const harness = createSessionHookHarness({
    api: { getTrainingV2Plan: async () => restUnitPlan },
  });
  harness.render({ planId: 'plan-1', unitId: 'unit-2' });
  const result = await harness.settle();

  assert.equal(result.draft, null);
  assert.ok(result.error);
  assert.equal(harness.draftStore.has('user-1:plan-1:unit-2'), false);
});
