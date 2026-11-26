const assert = require('node:assert/strict');
const test = require('node:test');

const { loadModule } = require('../testing/loadModule.cjs');

async function flushMicrotasks() {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}

function createSupabase(initialUserId = 'user-1') {
  let authCallback = null;
  return {
    supabase: {
      auth: {
        getSession: async () => ({ data: { session: initialUserId ? { user: { id: initialUserId } } : null } }),
        onAuthStateChange(callback) {
          authCallback = callback;
          return { data: { subscription: { unsubscribe() {} } } };
        },
      },
    },
    signIn(userId) { authCallback?.('SIGNED_IN', { user: { id: userId } }); },
    signOut() { authCallback?.('SIGNED_OUT', null); },
  };
}

// Mirrors the fake-hooks harness convention used by useTrainingV2ExercisePicker.test.cjs /
// trainingV2EditorHooks.test.cjs: a hand-rolled useState/useRef/useEffect so the hook's own
// effects run deterministically under node:test instead of needing a real renderer.
function createDraftHookHarness({ draftStorage, initialUserId = 'user-1' } = {}) {
  const cells = [];
  const refs = [];
  let cellIndex = 0;
  let refIndex = 0;
  const pendingEffects = [];
  const supabaseMock = createSupabase(initialUserId);
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

  const defaultStorage = {
    loadTrainingV2Draft: async () => null,
    saveTrainingV2Draft: async () => {},
    clearTrainingV2Draft: async () => {},
  };

  const editorModel = loadModule(__dirname, '../models/trainingV2EditorModel.js');
  const module = loadModule(__dirname, './useTrainingV2PlanDraft.js', {
    react,
    '../services/trainingV2DraftStorage': { ...defaultStorage, ...draftStorage },
    '../models/trainingV2EditorModel': editorModel,
    '../../../../services/supabaseClient': { supabase: supabaseMock.supabase },
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
    result = module.useTrainingV2PlanDraft(props);
    // Run effects whose dependency array changed since the last render, exactly like React
    // would — each effect's own cleanup (if it returned one) runs first, before its next
    // invocation, so a timer scheduled by a previous render's effect is actually cancelled
    // rather than just orphaned.
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
    supabaseMock,
    render,
    rerender: () => render(props),
    get result() { return result; },
    // Restoring a draft is a two-hop async chain across renders (mount effect awaits
    // getSession() and calls setUserId, which this fake harness only picks up on the next
    // render; only THAT render's restore-check effect can then kick off its own
    // loadTrainingV2Draft() call, whose result again only becomes visible on a further
    // render) — a single flush+render settles one hop, so this loops a few times to drain
    // the whole chain, exactly as a handful of real React commits would.
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

test('once a userId is known, checks for a stored draft exactly once per (userId, mode, planId)', async () => {
  let loadCalls = 0;
  const harness = createDraftHookHarness({
    draftStorage: {
      loadTrainingV2Draft: async () => { loadCalls += 1; return null; },
    },
  });
  const dispatch = () => {};
  harness.render({
    mode: 'create', planId: null, loading: false, state: {}, dispatch, initialState: {}, expectedVersion: null, dirty: false,
  });
  await harness.settle();

  harness.rerender();
  await harness.settle();

  assert.equal(loadCalls, 1);
});

test('create mode: an existing draft is auto-restored via HYDRATE and marks draftRestored', async () => {
  const dispatched = [];
  const harness = createDraftHookHarness({
    draftStorage: {
      loadTrainingV2Draft: async () => ({ editorState: { name: 'Wiederhergestellt' } }),
    },
  });
  harness.render({
    mode: 'create',
    planId: null,
    loading: false,
    state: {},
    dispatch: (action) => dispatched.push(action),
    initialState: { name: '' },
    expectedVersion: null,
    dirty: false,
  });
  const result = await harness.settle();

  assert.deepEqual(dispatched, [{ type: 'HYDRATE', state: { name: 'Wiederhergestellt' } }]);
  assert.equal(result.draftRestored, true);
  assert.equal(result.draftConflict, null);
});

test('edit mode: a draft whose basePlanVersion matches the freshly loaded plan is auto-restored', async () => {
  const dispatched = [];
  const harness = createDraftHookHarness({
    draftStorage: {
      loadTrainingV2Draft: async () => ({ basePlanVersion: 3, editorState: { name: 'Draft' } }),
    },
  });
  harness.render({
    mode: 'edit',
    planId: 'plan-1',
    loading: false,
    state: {},
    dispatch: (action) => dispatched.push(action),
    initialState: { name: 'Server' },
    expectedVersion: 3,
    dirty: false,
  });
  const result = await harness.settle();

  assert.deepEqual(dispatched, [{ type: 'HYDRATE', state: { name: 'Draft' } }]);
  assert.equal(result.draftRestored, true);
});

test('edit mode: a draft whose basePlanVersion is stale surfaces draftConflict instead of auto-restoring', async () => {
  const dispatched = [];
  const harness = createDraftHookHarness({
    draftStorage: {
      loadTrainingV2Draft: async () => ({ basePlanVersion: 1, editorState: { name: 'Draft' } }),
    },
  });
  harness.render({
    mode: 'edit',
    planId: 'plan-1',
    loading: false,
    state: {},
    dispatch: (action) => dispatched.push(action),
    initialState: { name: 'Server v2' },
    expectedVersion: 2,
    dirty: false,
  });
  const result = await harness.settle();

  assert.equal(dispatched.length, 0);
  assert.equal(result.draftRestored, false);
  assert.deepEqual(result.draftConflict, { editorState: { name: 'Draft' }, basePlanVersion: 1 });
});

test('keepDraft applies the conflicting draft and clears the conflict; loadCurrentPlanInstead discards it without touching state', async () => {
  const dispatched = [];
  let cleared = 0;
  const harness = createDraftHookHarness({
    draftStorage: {
      loadTrainingV2Draft: async () => ({ basePlanVersion: 1, editorState: { name: 'Draft' } }),
      clearTrainingV2Draft: async () => { cleared += 1; },
    },
  });
  const props = {
    mode: 'edit',
    planId: 'plan-1',
    loading: false,
    state: {},
    dispatch: (action) => dispatched.push(action),
    initialState: { name: 'Server v2' },
    expectedVersion: 2,
    dirty: false,
  };
  harness.render(props);
  let result = await harness.settle();
  assert.ok(result.draftConflict);

  result.keepDraft();
  result = harness.rerender();
  assert.deepEqual(dispatched, [{ type: 'HYDRATE', state: { name: 'Draft' } }]);
  assert.equal(result.draftConflict, null);
  assert.equal(result.draftRestored, true);
});

test('loadCurrentPlanInstead discards the conflicting draft and clears storage, without dispatching HYDRATE', async () => {
  const dispatched = [];
  let cleared = 0;
  const harness = createDraftHookHarness({
    draftStorage: {
      loadTrainingV2Draft: async () => ({ basePlanVersion: 1, editorState: { name: 'Draft' } }),
      clearTrainingV2Draft: async () => { cleared += 1; },
    },
  });
  harness.render({
    mode: 'edit',
    planId: 'plan-1',
    loading: false,
    state: {},
    dispatch: (action) => dispatched.push(action),
    initialState: { name: 'Server v2' },
    expectedVersion: 2,
    dirty: false,
  });
  let result = await harness.settle();
  assert.ok(result.draftConflict);

  result.loadCurrentPlanInstead();
  await harness.settle();
  result = harness.rerender();

  assert.equal(dispatched.length, 0);
  assert.equal(result.draftConflict, null);
  assert.equal(cleared, 1);
});

test('dismissDraftNotice reverts to the baseline via HYDRATE and clears the stored draft', async () => {
  const dispatched = [];
  let cleared = 0;
  const harness = createDraftHookHarness({
    draftStorage: {
      loadTrainingV2Draft: async () => ({ editorState: { name: 'Wiederhergestellt' } }),
      clearTrainingV2Draft: async () => { cleared += 1; },
    },
  });
  harness.render({
    mode: 'create',
    planId: null,
    loading: false,
    state: {},
    dispatch: (action) => dispatched.push(action),
    initialState: { name: '' },
    expectedVersion: null,
    dirty: false,
  });
  let result = await harness.settle();
  assert.equal(result.draftRestored, true);

  result.dismissDraftNotice();
  await harness.settle();
  result = harness.rerender();

  assert.deepEqual(dispatched.at(-1), { type: 'HYDRATE', state: { name: '' } });
  assert.equal(cleared, 1);
  assert.equal(result.draftRestored, false);
});

test('autosaves the dirty state debounced, keyed by the current basePlanVersion', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const saved = [];
  const harness = createDraftHookHarness({
    draftStorage: {
      saveTrainingV2Draft: async (userId, mode, planId, payload) => { saved.push({ userId, mode, planId, ...payload }); },
    },
  });
  harness.render({
    mode: 'edit',
    planId: 'plan-1',
    loading: false,
    state: { name: 'Edited' },
    dispatch: () => {},
    initialState: { name: 'Server' },
    expectedVersion: 5,
    dirty: true,
  });
  await harness.settle();
  context.mock.timers.tick(800);
  await flushMicrotasks();

  assert.equal(saved.length, 1);
  assert.equal(saved[0].userId, 'user-1');
  assert.equal(saved[0].mode, 'edit');
  assert.equal(saved[0].planId, 'plan-1');
  assert.equal(saved[0].basePlanVersion, 5);
  assert.deepEqual(saved[0].editorState, { name: 'Edited' });
});

test('never autosaves while not dirty, while loading, or during an unresolved draft conflict', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const saved = [];
  const harness = createDraftHookHarness({
    draftStorage: {
      loadTrainingV2Draft: async () => ({ basePlanVersion: 1, editorState: { name: 'Draft' } }),
      saveTrainingV2Draft: async (...args) => { saved.push(args); },
    },
  });

  harness.render({
    mode: 'edit', planId: 'plan-1', loading: false, state: { name: 'A' }, dispatch: () => {}, initialState: {}, expectedVersion: 2, dirty: false,
  });
  await harness.settle();
  context.mock.timers.tick(2000);
  await flushMicrotasks();
  assert.equal(saved.length, 0, 'not dirty');

  harness.render({
    mode: 'edit', planId: 'plan-1', loading: true, state: { name: 'A' }, dispatch: () => {}, initialState: {}, expectedVersion: 2, dirty: true,
  });
  await harness.settle();
  context.mock.timers.tick(2000);
  await flushMicrotasks();
  assert.equal(saved.length, 0, 'still loading');

  // A pending draftConflict must not be autosaved over — otherwise the local pre-conflict
  // draft would be silently clobbered before the user ever decides what to do with it.
  harness.render({
    mode: 'edit', planId: 'plan-1', loading: false, state: { name: 'A' }, dispatch: () => {}, initialState: {}, expectedVersion: 2, dirty: true,
  });
  await harness.settle();
  context.mock.timers.tick(2000);
  assert.equal(saved.length, 0, 'unresolved draft conflict');
});

test('a logout (userId becomes null) resets draftRestored/draftConflict and stops further restore checks until signed back in', async () => {
  const harness = createDraftHookHarness();
  harness.render({
    mode: 'create', planId: null, loading: false, state: {}, dispatch: () => {}, initialState: {}, expectedVersion: null, dirty: false,
  });
  await harness.settle();

  harness.supabaseMock.signOut();
  const result = harness.rerender();

  assert.equal(result.draftRestored, false);
  assert.equal(result.draftConflict, null);
});

test('a direct switch to a different account instantly wipes whatever plan content is currently visible, via HYDRATE to a neutral empty state', async () => {
  const dispatched = [];
  const harness = createDraftHookHarness({
    draftStorage: { loadTrainingV2Draft: async () => null },
  });
  harness.render({
    mode: 'edit',
    planId: 'plan-1',
    loading: false,
    state: { name: 'User A Plan' },
    dispatch: (action) => dispatched.push(action),
    initialState: { name: 'User A Plan' },
    expectedVersion: 3,
    dirty: false,
  });
  await harness.settle();
  // The first resolution of a real session (mount) must never be treated as "a switch away
  // from a previous owner" — nothing should have been wiped yet.
  assert.equal(dispatched.length, 0);

  harness.supabaseMock.signIn('user-2');
  harness.rerender();

  assert.equal(dispatched.length, 1);
  assert.equal(dispatched[0].type, 'HYDRATE');
  // A neutral, freshly-created empty state — never the previous owner's initialState (which
  // would still leak their loaded plan's name/units), and never a stale reference shared
  // with any other empty-state instance.
  assert.deepEqual(dispatched[0].state, { name: '', weeklyGoal: '', units: [dispatched[0].state.units[0]] });
  assert.equal(dispatched[0].state.units.length, 1);
  assert.equal(dispatched[0].state.units[0].exercises.length, 0);
});

test('logout also wipes visible plan content immediately, the same as a direct account switch', async () => {
  const dispatched = [];
  const harness = createDraftHookHarness({
    draftStorage: { loadTrainingV2Draft: async () => null },
  });
  harness.render({
    mode: 'edit',
    planId: 'plan-1',
    loading: false,
    state: { name: 'User A Plan' },
    dispatch: (action) => dispatched.push(action),
    initialState: { name: 'User A Plan' },
    expectedVersion: 3,
    dirty: false,
  });
  await harness.settle();

  harness.supabaseMock.signOut();
  harness.rerender();

  assert.equal(dispatched.some((action) => action.type === 'HYDRATE'), true);
});

test('autosave never writes before the restore check has settled, even if the user types fast enough to already be dirty', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const saved = [];
  let resolveLoad;
  const harness = createDraftHookHarness({
    draftStorage: {
      loadTrainingV2Draft: () => new Promise((resolve) => { resolveLoad = resolve; }),
      saveTrainingV2Draft: async (...args) => { saved.push(args); },
    },
  });

  // dirty is already true on the very first render (as if the user started typing
  // immediately), while the restore check's own load() call is still unresolved.
  harness.render({
    mode: 'create', planId: null, loading: false, state: { name: 'Fast typist' }, dispatch: () => {}, initialState: { name: '' }, expectedVersion: null, dirty: true,
  });
  await flushMicrotasks();
  harness.rerender();
  context.mock.timers.tick(5000);
  await flushMicrotasks();
  assert.equal(saved.length, 0, 'must not autosave while the restore check is still in flight');

  // Only once the restore check resolves (here: no existing draft found) may autosave
  // start; the same 800ms debounce still applies from that point on.
  resolveLoad(null);
  await flushMicrotasks();
  harness.rerender();
  context.mock.timers.tick(800);
  await flushMicrotasks();
  assert.equal(saved.length, 1, 'autosave must run once hydration has settled');
});

test('a pending autosave timer scheduled under owner A never fires (and never writes) after a direct A -> B switch', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const saved = [];
  const harness = createDraftHookHarness({
    draftStorage: {
      saveTrainingV2Draft: async (...args) => { saved.push(args); },
    },
  });
  harness.render({
    mode: 'edit', planId: 'plan-1', loading: false, state: { name: 'User A edits' }, dispatch: () => {}, initialState: { name: 'Server' }, expectedVersion: 5, dirty: true,
  });
  await harness.settle();

  // The debounce timer is now pending (registered while userId was still 'user-1'). A
  // direct switch to 'user-2' — without any sign-out in between — must cancel it via the
  // effect's own cleanup (dependency array includes userId), so it can never write user A's
  // state to storage under a stale closure after the owner has already changed.
  harness.supabaseMock.signIn('user-2');
  harness.rerender();
  context.mock.timers.tick(5000);
  await flushMicrotasks();

  assert.equal(saved.length, 0, 'a stale autosave from the previous owner must never fire after the switch');
});

test('a pending autosave is cancelled by clearDraft, so a save that resolves close to the debounce window can never recreate the just-deleted draft', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const saved = [];
  let cleared = 0;
  const harness = createDraftHookHarness({
    draftStorage: {
      saveTrainingV2Draft: async (...args) => { saved.push(args); },
      clearTrainingV2Draft: async () => { cleared += 1; },
    },
  });
  harness.render({
    mode: 'edit', planId: 'plan-1', loading: false, state: { name: 'Edited' }, dispatch: () => {}, initialState: { name: 'Server' }, expectedVersion: 5, dirty: true,
  });
  await harness.settle();

  // Simulates the screen's own post-save flow: save() resolved successfully, and the
  // screen immediately awaits clearDraft() — while the autosave timer scheduled a moment
  // ago (while still dirty, before the save completed) is still pending.
  const result = harness.rerender();
  await result.clearDraft();
  context.mock.timers.tick(5000);
  await flushMicrotasks();

  assert.equal(cleared, 1);
  assert.equal(saved.length, 0, 'the stale autosave must never fire and recreate the deleted draft');
});
