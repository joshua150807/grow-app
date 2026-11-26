const assert = require('node:assert/strict');
const test = require('node:test');
const { randomUUID } = require('node:crypto');
const { loadModule } = require('../testing/loadModule.cjs');
const { createHookHarness } = require('../testing/createHookHarness.cjs');

function fixture({ failWrite = false, loseResponse = true, initialAuth = true } = {}) {
  let owner = 'A'; let auth; let calls = 0; let writes = 0;
  const memory = new Map(); const server = new Map();
  const storage = loadModule(__dirname, '../services/trainingV2DraftStorage.js', {
    '@react-native-async-storage/async-storage': {
      getItem: async (key) => memory.get(key) ?? null,
      setItem: async (key, value) => { if (failWrite) throw Error('disk'); writes++; memory.set(key, value); },
      removeItem: async (key) => memory.delete(key), getAllKeys: async () => [...memory.keys()],
      multiRemove: async (keys) => keys.forEach((key) => memory.delete(key)),
    },
    '../../../../services/supabaseClient': { supabase: { auth: {
      onAuthStateChange: (callback) => { auth = callback; },
      getSession: async () => ({ data: { session: { user: { id: owner } } } }),
    } } },
  });
  if (initialAuth) auth('SIGNED_IN', { user: { id: owner } });
  const model = loadModule(__dirname, '../models/trainingV2EditorModel.js');
  const valid = model.createEmptyEditorState(); valid.name = 'B11'; valid.weeklyGoal = '3';
  valid.units[0] = { ...valid.units[0], name: 'Pause', unitType: 'rest' };
  const mount = (state = valid) => {
    const harness = createHookHarness((react) => {
      const module = loadModule(__dirname, './useTrainingV2PlanEditor.js', {
        react, '../models/trainingV2EditorModel': model,
        '../services/trainingV2DraftStorage': storage,
        '../services/trainingV2Api': { TrainingV2ConflictError: class extends Error {},
          createTrainingV2Plan: async (input) => {
            calls++;
            const key = `${owner}:${input.idempotencyKey ?? randomUUID()}`;
            if (!server.has(key)) server.set(key, { id: randomUUID() });
            if (loseResponse) { loseResponse = false; throw Error('response lost after commit'); }
            return server.get(key);
          },
        },
      });
      return () => module.useTrainingV2PlanEditor(null);
    });
    harness.render(); harness.result.dispatch({ type: 'HYDRATE', state }); harness.render();
    return harness;
  };
  return { storage, mount, valid, memory, server, get calls() { return calls; }, get writes() { return writes; },
    switchOwner(next) { owner = next; auth('SIGNED_IN', { user: { id: next } }); } };
}

test('B11: lost create response persists its original snapshot before POST and retry creates one plan', async () => {
  const f = fixture(); const h = f.mount();
  assert.equal((await h.result.save()).ok, false);
  assert.ok(f.writes > 0, 'intent must reach persistent storage before POST');
  const first = [...f.server.values()][0].id;
  h.render(); h.result.dispatch({ type: 'SET_NAME', name: 'must not change an uncertain request' }); h.render();
  assert.equal(h.result.state.name, 'B11');
  assert.equal((await h.result.save()).plan.id, first);
  assert.equal(f.server.size, 1);
});

test('B11: process restart restores the same key/request, and explicit clear permits a genuinely new plan', async () => {
  const f = fixture(); let h = f.mount(); await h.result.save(); h.unmount();
  const saved = await f.storage.loadTrainingV2Draft('A', 'create');
  h = f.mount(saved?.editorState ?? f.valid);
  assert.equal((await h.result.save()).ok, true);
  assert.equal(f.server.size, 1);
  h.unmount(); await f.storage.clearTrainingV2Draft('A', 'create');
  h = f.mount(f.valid); assert.equal((await h.result.save()).ok, true);
  assert.equal(f.server.size, 2);
});

test('B11: failed local persistence prevents sending and releases the save lock', async () => {
  const f = fixture({ failWrite: true }); const h = f.mount();
  assert.equal((await h.result.save()).ok, false); h.render();
  assert.equal(f.calls, 0); assert.equal(h.result.saving, false);
});

test('B11: an older autosave cannot overwrite an uncertain persisted create snapshot', async () => {
  const f = fixture(); const h = f.mount(); await h.result.save();
  const before = await f.storage.loadTrainingV2Draft('A', 'create');
  await f.storage.saveTrainingV2Draft('A', 'create', null, { editorState: { ...f.valid, name: 'stale autosave' } });
  assert.deepEqual((await f.storage.loadTrainingV2Draft('A', 'create')).editorState, before.editorState);
});

test('B11: another account cannot resume the previous owner create request', async () => {
  const f = fixture(); const h = f.mount(); await h.result.save(); h.unmount();
  f.switchOwner('B');
  assert.equal(await f.storage.loadTrainingV2Draft('A', 'create'), null);
  const other = f.mount(f.valid); assert.equal((await other.result.save()).ok, true);
  assert.equal(f.server.size, 2);
});

test('B11: first local auth resolution can persist a create before the initial auth event', async () => {
  const f = fixture({ initialAuth: false, loseResponse: false });
  const h = f.mount(); assert.equal((await h.result.save()).ok, true);
  assert.equal(f.server.size, 1); assert.equal(f.writes, 1);
});
