const assert = require('node:assert/strict');
const test = require('node:test');
const { createHookHarness } = require('../testing/createHookHarness.cjs');
const { loadJsxModule } = require('../testing/loadJsxModule.cjs');
const { loadModule } = require('../testing/loadModule.cjs');

test('B13: account boundary hides signed-out data and remounts private screens even for A -> B -> A', async () => {
  let auth;
  let initial;
  const harness = createHookHarness((react) => {
    const { TrainingV2OwnerBoundary } = loadJsxModule(__dirname, './TrainingV2OwnerBoundary.jsx', {
      react, 'react-native': { View: 'View' },
      './TrainingV2StateView': { TrainingV2StateView: 'StateView' },
      '../../../../services/supabaseClient': { supabase: { auth: {
        onAuthStateChange: (callback) => { auth = callback; return { data: { subscription: { unsubscribe() {} } } }; },
        getSession: () => new Promise((resolve) => { initial = resolve; }),
      } } },
    });
    return () => TrainingV2OwnerBoundary({ children: 'private state' });
  });
  assert.equal(harness.render(), null);
  auth('SIGNED_IN', { user: { id: 'A' } });
  const first = harness.render().key;
  auth('SIGNED_IN', { user: { id: 'B' } });
  const second = harness.render().key;
  assert.notEqual(first, second);
  initial({ data: { session: { user: { id: 'A' } } } });
  await harness.settle();
  assert.equal(harness.result.key, second, 'late initial session cannot switch back to A');
  auth('SIGNED_OUT', null);
  assert.equal(harness.render(), null);
  auth('SIGNED_IN', { user: { id: 'A' } });
  assert.notEqual(harness.render().key, first);
});

for (const session of [true, false]) {
  test(`B13: ${session ? 'session' : 'plan'} storage rejects a delayed read after account change`, async () => {
    let auth;
    let finish;
    const store = loadModule(__dirname, session ? '../services/trainingV2SessionDraftStorage.js' : '../services/trainingV2DraftStorage.js', {
      '@react-native-async-storage/async-storage': { getItem: () => new Promise((resolve) => { finish = resolve; }) },
      '../../../../services/supabaseClient': { supabase: { auth: { onAuthStateChange: (callback) => { auth = callback; } } } },
    });
    auth('SIGNED_IN', { user: { id: 'A' } });
    const pending = session ? store.loadTrainingV2SessionDraft('A', 'plan', 'unit') : store.loadTrainingV2Draft('A', 'edit', 'plan');
    await new Promise(setImmediate);
    auth('SIGNED_IN', { user: { id: 'B' } });
    finish(JSON.stringify({ schemaVersion: 1, userId: 'A', planId: 'plan', unitId: 'unit', mode: 'edit', session: { note: 'private' }, editorState: { name: 'private' } }));
    assert.equal(await pending, null);
  });
}

test('B08: session owner resolution uses cached getSession and never requires getUser', async () => {
  let auth;
  const store = loadModule(__dirname, '../services/trainingV2SessionDraftStorage.js', {
    '@react-native-async-storage/async-storage': {},
    '../../../../services/supabaseClient': { supabase: { auth: {
      onAuthStateChange: (callback) => { auth = callback; },
      getSession: async () => ({ data: { session: { user: { id: 'A' } } } }),
      getUser: () => { throw Error('must not access network'); },
    } } },
  });
  auth('SIGNED_IN', { user: { id: 'A' } });
  assert.equal(await store.requireTrainingV2SessionOwner(), 'A');
});

for (const session of [true, false]) {
  test(`B09: queued ${session ? 'session' : 'plan'} writes finish before discard and cannot resurrect the draft`, async () => {
    let auth;
    let finish;
    let first = true;
    const values = new Map();
    const store = loadModule(__dirname, session ? '../services/trainingV2SessionDraftStorage.js' : '../services/trainingV2DraftStorage.js', {
      '@react-native-async-storage/async-storage': {
        setItem: async (key, value) => { if (first) { first = false; await new Promise((resolve) => { finish = resolve; }); } values.set(key, value); },
        removeItem: async (key) => { values.delete(key); },
      },
      '../../../../services/supabaseClient': { supabase: { auth: { onAuthStateChange: (callback) => { auth = callback; } } } },
    });
    auth('SIGNED_IN', { user: { id: 'A' } });
    const save = session
      ? (value) => store.saveTrainingV2SessionDraft('A', 'plan', 'unit', value)
      : (value) => store.saveTrainingV2Draft('A', 'edit', 'plan', { editorState: value });
    const one = save({ value: 1 });
    await new Promise(setImmediate);
    const two = save({ value: 2 });
    const clear = session ? store.clearTrainingV2SessionDraft('A', 'plan', 'unit') : store.clearTrainingV2Draft('A', 'edit', 'plan');
    finish();
    await Promise.all([one, two, clear]);
    assert.equal(values.size, 0);
  });
}

test('B13: API rejects a response after account change and accepts token refresh for the same owner', async (context) => {
  const previousFetch = global.fetch;
  const previousUrl = process.env.EXPO_PUBLIC_API_URL;
  context.after(() => { global.fetch = previousFetch; if (previousUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL; else process.env.EXPO_PUBLIC_API_URL = previousUrl; });
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
  let owner = 'A';
  let finish;
  const api = loadModule(__dirname, '../services/trainingV2Api.js', {
    '@grow/shared': { listTrainingPlansResponseSchema: { safeParse: (value) => ({ success: true, data: value }) } },
    '../../../../services/supabaseClient': { supabase: { auth: { getSession: async () => ({ data: { session: { user: { id: owner }, access_token: 'test-token' } } }) } } },
  });
  global.fetch = () => new Promise((resolve) => { finish = resolve; });
  const pending = api.listTrainingV2Plans();
  await new Promise(setImmediate);
  owner = 'B';
  finish({ ok: true, text: async () => JSON.stringify({ plans: [] }) });
  await assert.rejects(pending, (error) => error.code === 'TRAINING_V2_OWNER_CHANGED');
  global.fetch = async () => ({ ok: true, text: async () => JSON.stringify({ plans: [] }) });
  assert.deepEqual(await api.listTrainingV2Plans(), []);
});

test('B13: local auth read failure shows retry instead of silently hiding the entire screen', async () => {
  let calls = 0;
  const harness = createHookHarness((react) => {
    const { TrainingV2OwnerBoundary } = loadJsxModule(__dirname, './TrainingV2OwnerBoundary.jsx', {
      react, 'react-native': { View: 'View' }, './TrainingV2StateView': { TrainingV2StateView: 'StateView' },
      '../../../../services/supabaseClient': { supabase: { auth: {
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
        getSession: async () => ++calls === 1 ? { error: new Error('disk') } : { data: { session: { user: { id: 'A' } } } },
      } } },
    });
    return () => TrainingV2OwnerBoundary({ children: 'private' });
  });
  harness.render();
  await harness.settle();
  assert.equal(harness.result.type, 'StateView');
  harness.result.props.onRetry();
  harness.render();
  await harness.settle();
  assert.equal(harness.result.props.children, 'private');
});
