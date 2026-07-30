const assert = require('node:assert/strict');
const test = require('node:test');

const { loadModule } = require('../testing/loadModule.cjs');

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    api: {
      async getItem(key) { return values.has(key) ? values.get(key) : null; },
      async setItem(key, value) { values.set(key, value); },
      async removeItem(key) { values.delete(key); },
      async getAllKeys() { return [...values.keys()]; },
      async multiRemove(keys) { keys.forEach((key) => values.delete(key)); },
    },
  };
}

async function flushMicrotasks() {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}

function createSupabase() {
  let authCallback = null;
  return {
    supabase: {
      auth: {
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

function loadDraftStorage(storage, supabaseMock) {
  return loadModule(__dirname, './trainingV2DraftStorage.js', {
    '@react-native-async-storage/async-storage': storage.api,
    '../../../../services/supabaseClient': { supabase: supabaseMock.supabase },
  });
}

test('rejects reads and writes without an owner userId', async () => {
  const storage = createStorage();
  const supabaseMock = createSupabase();
  const module = loadDraftStorage(storage, supabaseMock);
  supabaseMock.signIn('user-1');

  await assert.rejects(module.loadTrainingV2Draft(null, 'create', null), module.TrainingV2DraftOwnerError);
  await assert.rejects(
    module.saveTrainingV2Draft(undefined, 'create', null, { editorState: {} }),
    module.TrainingV2DraftOwnerError,
  );
});

test('saves and loads a create-mode draft under the exact key training-v2:draft:<userId>:create', async () => {
  const storage = createStorage();
  const supabaseMock = createSupabase();
  const module = loadDraftStorage(storage, supabaseMock);
  supabaseMock.signIn('user-1');

  await module.saveTrainingV2Draft('user-1', 'create', null, { editorState: { name: 'Entwurf' } });

  assert.ok(storage.values.has('training-v2:draft:user-1:create'));
  const draft = await module.loadTrainingV2Draft('user-1', 'create', null);
  assert.equal(draft.userId, 'user-1');
  assert.equal(draft.mode, 'create');
  assert.equal(draft.planId, null);
  assert.equal(draft.basePlanVersion, null);
  assert.deepEqual(draft.editorState, { name: 'Entwurf' });
  assert.equal(typeof draft.updatedAt, 'string');
  assert.equal(typeof draft.schemaVersion, 'number');
});

test('saves and loads an edit-mode draft under training-v2:draft:<userId>:edit:<planId>, carrying basePlanVersion', async () => {
  const storage = createStorage();
  const supabaseMock = createSupabase();
  const module = loadDraftStorage(storage, supabaseMock);
  supabaseMock.signIn('user-1');

  await module.saveTrainingV2Draft('user-1', 'edit', 'plan-1', { basePlanVersion: 4, editorState: { name: 'X' } });

  assert.ok(storage.values.has('training-v2:draft:user-1:edit:plan-1'));
  const draft = await module.loadTrainingV2Draft('user-1', 'edit', 'plan-1');
  assert.equal(draft.planId, 'plan-1');
  assert.equal(draft.basePlanVersion, 4);
});

test('clearTrainingV2Draft removes exactly the key for that mode/plan', async () => {
  const storage = createStorage();
  const supabaseMock = createSupabase();
  const module = loadDraftStorage(storage, supabaseMock);
  supabaseMock.signIn('user-1');

  await module.saveTrainingV2Draft('user-1', 'create', null, { editorState: {} });
  await module.clearTrainingV2Draft('user-1', 'create', null);

  assert.equal(await module.loadTrainingV2Draft('user-1', 'create', null), null);
});

test('never returns a foreign owner draft, even when asked for a userId that is not the live signed-in owner', async () => {
  const storage = createStorage();
  const supabaseMock = createSupabase();
  const module = loadDraftStorage(storage, supabaseMock);
  supabaseMock.signIn('user-1');
  await module.saveTrainingV2Draft('user-1', 'create', null, { editorState: { name: 'Owner 1' } });

  // A stale read for a different (never-signed-in) user must never see user-1's draft, even
  // though the raw AsyncStorage key is namespaced per user and technically absent for them.
  assert.equal(await module.loadTrainingV2Draft('user-2', 'create', null), null);

  // Switching the live session away from user-1 must also stop reads made "as user-1".
  supabaseMock.signIn('user-2');
  assert.equal(await module.loadTrainingV2Draft('user-1', 'create', null), null);
});

test('a write attempted after the live session has moved to a different owner is silently skipped', async () => {
  const storage = createStorage();
  const supabaseMock = createSupabase();
  const module = loadDraftStorage(storage, supabaseMock);
  supabaseMock.signIn('user-1');
  supabaseMock.signIn('user-2');

  await module.saveTrainingV2Draft('user-1', 'create', null, { editorState: { name: 'Stale write' } });

  assert.equal(storage.values.has('training-v2:draft:user-1:create'), false);
});

test('a missing draft resolves to null, and a corrupted or owner-mismatched stored document is treated as absent', async () => {
  const storage = createStorage({
    'training-v2:draft:user-1:create': 'not json',
  });
  const supabaseMock = createSupabase();
  const module = loadDraftStorage(storage, supabaseMock);
  supabaseMock.signIn('user-1');

  assert.equal(await module.loadTrainingV2Draft('user-1', 'edit', 'plan-missing'), null);
  assert.equal(await module.loadTrainingV2Draft('user-1', 'create', null), null);

  await storage.api.setItem(
    'training-v2:draft:user-1:create',
    JSON.stringify({ schemaVersion: 1, userId: 'someone-else', mode: 'create', editorState: {} }),
  );
  assert.equal(await module.loadTrainingV2Draft('user-1', 'create', null), null);
});

test('logout actually deletes every persisted draft of the signed-out owner (create and all edit:<planId> drafts), not just blocking further access', async () => {
  const storage = createStorage();
  const supabaseMock = createSupabase();
  const module = loadDraftStorage(storage, supabaseMock);
  supabaseMock.signIn('user-1');

  await module.saveTrainingV2Draft('user-1', 'create', null, { editorState: { name: 'Create draft' } });
  await module.saveTrainingV2Draft('user-1', 'edit', 'plan-1', { basePlanVersion: 1, editorState: { name: 'Edit draft A' } });
  await module.saveTrainingV2Draft('user-1', 'edit', 'plan-2', { basePlanVersion: 2, editorState: { name: 'Edit draft B' } });
  assert.equal(storage.values.size, 3);

  supabaseMock.signOut();
  await flushMicrotasks();

  assert.equal(storage.values.size, 0);
});

test('logout deletion never touches a different, unrelated owner\'s leftover persisted draft', async () => {
  // Seeds a pre-existing key directly (bypassing sign-in/sign-out) to represent a leftover
  // from a different owner's earlier device session — the scenario the prefix-scoped
  // deletion must protect regardless of how that key came to exist.
  const storage = createStorage({
    'training-v2:draft:user-2:create': JSON.stringify({
      schemaVersion: 1, userId: 'user-2', mode: 'create', planId: null, basePlanVersion: null, editorState: { name: 'Other owner draft' },
    }),
  });
  const supabaseMock = createSupabase();
  const module = loadDraftStorage(storage, supabaseMock);

  supabaseMock.signIn('user-1');
  await module.saveTrainingV2Draft('user-1', 'create', null, { editorState: { name: 'Own draft' } });

  supabaseMock.signOut();
  await flushMicrotasks();

  assert.equal(storage.values.has('training-v2:draft:user-1:create'), false);
  assert.equal(storage.values.has('training-v2:draft:user-2:create'), true);
});

test('a direct A -> B switch without an intervening sign-out preserves A\'s persisted drafts (only a real logout deletes)', async () => {
  const storage = createStorage();
  const supabaseMock = createSupabase();
  const module = loadDraftStorage(storage, supabaseMock);
  supabaseMock.signIn('user-1');
  await module.saveTrainingV2Draft('user-1', 'create', null, { editorState: { name: 'User 1 draft' } });

  // A direct switch — the auth listener receives 'user-1' -> 'user-2' with no null in
  // between, exactly as some re-authentication flows can swap sessions directly.
  supabaseMock.signIn('user-2');
  await flushMicrotasks();
  await module.saveTrainingV2Draft('user-2', 'create', null, { editorState: { name: 'User 2 draft' } });

  assert.equal(storage.values.has('training-v2:draft:user-1:create'), true, 'A\'s draft must survive a direct switch, in case A signs back in later');
  assert.equal(storage.values.has('training-v2:draft:user-2:create'), true);
});

test('if the real auth flow for an account switch fires an actual sign-out (null) before the new sign-in, the resulting deletion is correct', async () => {
  const storage = createStorage();
  const supabaseMock = createSupabase();
  const module = loadDraftStorage(storage, supabaseMock);
  supabaseMock.signIn('user-1');
  await module.saveTrainingV2Draft('user-1', 'create', null, { editorState: { name: 'User 1 draft' } });

  // Some auth flows genuinely sign out before signing the next account in — from this
  // module's point of view that IS a real logout, so the deletion it triggers is correct,
  // not a bug to work around.
  supabaseMock.signOut();
  await flushMicrotasks();
  supabaseMock.signIn('user-2');
  await flushMicrotasks();

  assert.equal(storage.values.has('training-v2:draft:user-1:create'), false);
});

test('user B can never read user A\'s persisted draft after a direct A -> B switch, even though it was not deleted', async () => {
  const storage = createStorage();
  const supabaseMock = createSupabase();
  const module = loadDraftStorage(storage, supabaseMock);
  supabaseMock.signIn('user-1');
  await module.saveTrainingV2Draft('user-1', 'create', null, { editorState: { name: 'User 1 draft' } });

  supabaseMock.signIn('user-2');
  await flushMicrotasks();

  // B's own key is naturally different (per-owner namespacing), but this also guards a
  // caller that (through a bug) still holds a reference to A's id.
  assert.equal(await module.loadTrainingV2Draft('user-1', 'create', null), null);
  assert.equal(storage.values.has('training-v2:draft:user-1:create'), true, 'still on disk, just unreadable');
});
