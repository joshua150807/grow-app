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

function loadSessionDraftStorage(storage, supabaseMock) {
  return loadModule(__dirname, './trainingV2SessionDraftStorage.js', {
    '@react-native-async-storage/async-storage': storage.api,
    '../../../../services/supabaseClient': { supabase: supabaseMock.supabase },
  });
}

test('rejects reads and writes without an owner userId', async () => {
  const storage = createStorage();
  const supabaseMock = createSupabase();
  const module = loadSessionDraftStorage(storage, supabaseMock);
  supabaseMock.signIn('user-1');

  await assert.rejects(module.loadTrainingV2SessionDraft(null, 'plan-1', 'unit-1'), module.TrainingV2SessionDraftOwnerError);
  await assert.rejects(
    module.saveTrainingV2SessionDraft(undefined, 'plan-1', 'unit-1', {}),
    module.TrainingV2SessionDraftOwnerError,
  );
});

test('saves and loads a session draft keyed by owner, plan and unit', async () => {
  const storage = createStorage();
  const supabaseMock = createSupabase();
  const module = loadSessionDraftStorage(storage, supabaseMock);
  supabaseMock.signIn('user-1');

  await module.saveTrainingV2SessionDraft('user-1', 'plan-1', 'unit-1', { unitName: 'Push Day' });

  const draft = await module.loadTrainingV2SessionDraft('user-1', 'plan-1', 'unit-1');
  assert.deepEqual(draft, { unitName: 'Push Day' });
  // A different unit of the same plan never reads back this draft.
  assert.equal(await module.loadTrainingV2SessionDraft('user-1', 'plan-1', 'unit-2'), null);
});

test('clearTrainingV2SessionDraft removes exactly the key for that plan/unit', async () => {
  const storage = createStorage();
  const supabaseMock = createSupabase();
  const module = loadSessionDraftStorage(storage, supabaseMock);
  supabaseMock.signIn('user-1');

  await module.saveTrainingV2SessionDraft('user-1', 'plan-1', 'unit-1', { unitName: 'Push Day' });
  await module.saveTrainingV2SessionDraft('user-1', 'plan-1', 'unit-2', { unitName: 'Pull Day' });
  await module.clearTrainingV2SessionDraft('user-1', 'plan-1', 'unit-1');

  assert.equal(await module.loadTrainingV2SessionDraft('user-1', 'plan-1', 'unit-1'), null);
  assert.notEqual(await module.loadTrainingV2SessionDraft('user-1', 'plan-1', 'unit-2'), null);
});

test('never returns a foreign owner draft, even when asked for a userId that is not the live signed-in owner', async () => {
  const storage = createStorage();
  const supabaseMock = createSupabase();
  const module = loadSessionDraftStorage(storage, supabaseMock);
  supabaseMock.signIn('user-1');
  await module.saveTrainingV2SessionDraft('user-1', 'plan-1', 'unit-1', { unitName: 'Owner 1' });

  assert.equal(await module.loadTrainingV2SessionDraft('user-2', 'plan-1', 'unit-1'), null);

  supabaseMock.signIn('user-2');
  assert.equal(await module.loadTrainingV2SessionDraft('user-1', 'plan-1', 'unit-1'), null);
});

test('restores across a simulated app restart: a fresh module load with the same signed-in owner still reads the persisted draft', async () => {
  const storage = createStorage();
  const supabaseMock = createSupabase();
  const firstLoad = loadSessionDraftStorage(storage, supabaseMock);
  supabaseMock.signIn('user-1');
  await firstLoad.saveTrainingV2SessionDraft('user-1', 'plan-1', 'unit-1', { unitName: 'Push Day' });

  // A cold app restart re-executes the module from scratch (fresh module-level currentOwnerId,
  // fresh auth subscription) while AsyncStorage's underlying content survives — the same
  // `storage` instance stands in for that persisted disk state across the two loads.
  const restartedSupabase = createSupabase();
  const secondLoad = loadSessionDraftStorage(storage, restartedSupabase);
  restartedSupabase.signIn('user-1');

  const draft = await secondLoad.loadTrainingV2SessionDraft('user-1', 'plan-1', 'unit-1');
  assert.deepEqual(draft, { unitName: 'Push Day' });
});

test('logout never deletes a persisted session draft — it only clears the live in-memory owner pointer', async () => {
  const storage = createStorage();
  const supabaseMock = createSupabase();
  const module = loadSessionDraftStorage(storage, supabaseMock);
  supabaseMock.signIn('user-1');

  await module.saveTrainingV2SessionDraft('user-1', 'plan-1', 'unit-1', { unitName: 'Push Day' });
  await module.saveTrainingV2SessionDraft('user-1', 'plan-2', 'unit-9', { unitName: 'Legs Day' });
  assert.equal(storage.values.size, 2);

  supabaseMock.signOut();
  await flushMicrotasks();

  // Nothing on disk was touched by the sign-out itself.
  assert.equal(storage.values.size, 2);
  // But while signed out there is no live owner, so even the original owner's own userId
  // cannot read it back yet — "nur Memory/aktive Referenzen leeren", not a data loss.
  assert.equal(await module.loadTrainingV2SessionDraft('user-1', 'plan-1', 'unit-1'), null);
});

test('a signed-out owner\'s persisted session draft is untouched by, and unreadable to, a different user who signs in next — the plan editor\'s own draft module keys are unrelated and also unaffected', async () => {
  const storage = createStorage({
    'training-v2:draft:user-1:create': JSON.stringify({ schemaVersion: 1, userId: 'user-1', mode: 'create', editorState: {} }),
  });
  const supabaseMock = createSupabase();
  const module = loadSessionDraftStorage(storage, supabaseMock);
  supabaseMock.signIn('user-1');
  await module.saveTrainingV2SessionDraft('user-1', 'plan-1', 'unit-1', { unitName: 'Own draft' });

  supabaseMock.signOut();
  await flushMicrotasks();
  supabaseMock.signIn('user-2');

  assert.equal(storage.values.has('training-v2:draft:session:user-1:plan-1:unit-1'), true, 'user-1\'s draft must still be on disk');
  assert.equal(await module.loadTrainingV2SessionDraft('user-1', 'plan-1', 'unit-1'), null, 'not readable while user-2 is the live owner');
  assert.equal(await module.findTrainingV2SessionDraftForPlan('user-2', 'plan-1'), null, 'user-2 sees none of user-1\'s drafts');
  // Not this module's own key namespace ('training-v2:draft:session:') — must survive untouched.
  assert.equal(storage.values.has('training-v2:draft:user-1:create'), true);
});

test('full round trip: Logout -> ein anderer Nutzer meldet sich an -> der ursprüngliche Nutzer meldet sich erneut an und erhält seinen Draft unverändert zurück', async () => {
  const storage = createStorage();
  const supabaseMock = createSupabase();
  const module = loadSessionDraftStorage(storage, supabaseMock);

  supabaseMock.signIn('user-1');
  await module.saveTrainingV2SessionDraft('user-1', 'plan-1', 'unit-1', { unitName: 'Push Day', weightKg: 80 });

  // Logout: draft must survive, but nobody (not even user-1's own id) can load it while signed out.
  supabaseMock.signOut();
  await flushMicrotasks();
  assert.equal(await module.loadTrainingV2SessionDraft('user-1', 'plan-1', 'unit-1'), null);

  // A different user signs in on the same device: must never see user-1's draft, in either direction.
  supabaseMock.signIn('user-2');
  assert.equal(await module.loadTrainingV2SessionDraft('user-1', 'plan-1', 'unit-1'), null);
  assert.equal(await module.loadTrainingV2SessionDraft('user-2', 'plan-1', 'unit-1'), null);
  assert.equal(await module.findTrainingV2SessionDraftForPlan('user-1', 'plan-1'), null);

  // user-2 signs out again, then the original owner signs back in: their draft comes back byte-identical.
  supabaseMock.signOut();
  await flushMicrotasks();
  supabaseMock.signIn('user-1');

  const restored = await module.loadTrainingV2SessionDraft('user-1', 'plan-1', 'unit-1');
  assert.deepEqual(restored, { unitName: 'Push Day', weightKg: 80 });
});

test('a direct A -> B switch without an intervening sign-out preserves A\'s persisted session drafts, but B can never read them', async () => {
  const storage = createStorage();
  const supabaseMock = createSupabase();
  const module = loadSessionDraftStorage(storage, supabaseMock);
  supabaseMock.signIn('user-1');
  await module.saveTrainingV2SessionDraft('user-1', 'plan-1', 'unit-1', { unitName: 'User 1 draft' });

  supabaseMock.signIn('user-2');

  assert.equal(storage.values.has('training-v2:draft:session:user-1:plan-1:unit-1'), true, 'still on disk, in case user-1 signs back in');
  assert.equal(await module.loadTrainingV2SessionDraft('user-1', 'plan-1', 'unit-1'), null, 'unreadable once the live session moved on');
});

test('findTrainingV2SessionDraftForPlan returns the most recently updated draft among this owner\'s drafts for the given plan only', async () => {
  const storage = createStorage();
  const supabaseMock = createSupabase();
  const module = loadSessionDraftStorage(storage, supabaseMock);
  supabaseMock.signIn('user-1');

  await module.saveTrainingV2SessionDraft('user-1', 'plan-1', 'unit-1', { unitName: 'Older' });
  await new Promise((resolve) => setTimeout(resolve, 2));
  await module.saveTrainingV2SessionDraft('user-1', 'plan-1', 'unit-2', { unitName: 'Newer' });
  // A draft for a different plan must never be returned, even if it is the most recent overall.
  await new Promise((resolve) => setTimeout(resolve, 2));
  await module.saveTrainingV2SessionDraft('user-1', 'plan-2', 'unit-3', { unitName: 'Different plan' });

  const found = await module.findTrainingV2SessionDraftForPlan('user-1', 'plan-1');
  assert.equal(found.unitId, 'unit-2');
  assert.deepEqual(found.session, { unitName: 'Newer' });
});

test('findTrainingV2SessionDraftForPlan resolves to null when there is nothing to resume, and never sees a foreign owner\'s draft', async () => {
  const storage = createStorage();
  const supabaseMock = createSupabase();
  const module = loadSessionDraftStorage(storage, supabaseMock);
  supabaseMock.signIn('user-1');

  assert.equal(await module.findTrainingV2SessionDraftForPlan('user-1', 'plan-1'), null);

  await module.saveTrainingV2SessionDraft('user-1', 'plan-1', 'unit-1', { unitName: 'Mine' });
  supabaseMock.signIn('user-2');
  assert.equal(await module.findTrainingV2SessionDraftForPlan('user-2', 'plan-1'), null);
});

test('a missing draft resolves to null, and a corrupted or owner-mismatched stored document is treated as absent', async () => {
  const storage = createStorage({
    'training-v2:draft:session:user-1:plan-1:unit-1': 'not json',
  });
  const supabaseMock = createSupabase();
  const module = loadSessionDraftStorage(storage, supabaseMock);
  supabaseMock.signIn('user-1');

  assert.equal(await module.loadTrainingV2SessionDraft('user-1', 'plan-missing', 'unit-missing'), null);
  assert.equal(await module.loadTrainingV2SessionDraft('user-1', 'plan-1', 'unit-1'), null);

  await storage.api.setItem(
    'training-v2:draft:session:user-1:plan-1:unit-1',
    JSON.stringify({ schemaVersion: 1, userId: 'someone-else', planId: 'plan-1', unitId: 'unit-1', session: {} }),
  );
  assert.equal(await module.loadTrainingV2SessionDraft('user-1', 'plan-1', 'unit-1'), null);
});
