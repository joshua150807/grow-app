const assert = require('node:assert/strict');
const test = require('node:test');
const { loadJsxModule } = require('../testing/loadJsxModule.cjs');
const { createHookHarness } = require('../testing/createHookHarness.cjs');
function editor({ saving = false, clear = async () => {} } = {}) {
  let guard;
  const alerts = [];
  const events = [];
  const harness = createHookHarness((react) => {
    const screen = loadJsxModule(__dirname, './TrainingV2PlanEditorScreen.jsx', {
      react,
      'react-native': { Alert: { alert: (...args) => alerts.push(args) } },
      'expo-router': { useLocalSearchParams: () => ({ planId: 'plan' }), router: { replace: () => events.push('replace'), back() {} } },
      '@react-navigation/native': { useNavigation: () => ({ dispatch: () => events.push('navigate') }),
        usePreventRemove: (enabled, callback) => { guard = { enabled, callback }; } },
      '../../../../constants/colors': { COLORS: {} },
      '../components/TrainingV2StateView': {}, '../components/TrainingV2UnitEditorCard': {},
      '../styles/trainingV2Styles': { styles: {} },
      '../hooks/useTrainingV2PlanEditor': { useTrainingV2PlanEditor: () => ({
        mode: 'edit', state: { name: 'Edited', weeklyGoal: '3', units: [] },
        initialState: { name: 'Original', weeklyGoal: '3', units: [] }, dirty: true, saving,
        dispatch: () => events.push('reset'), save: async () => ({ ok: true, plan: { id: 'plan' } }),
      }) },
      '../hooks/useTrainingV2PlanDraft': { useTrainingV2PlanDraft: () => ({ clearDraft: async () => { events.push('clear'); await clear(); } }) },
    }).default;
    return () => screen();
  });
  harness.render();
  return { harness, alerts, events, get guard() { return guard; } };
}

test('B06: confirmed editor discard clears persisted draft before navigation', async () => {
  const screen = editor();
  screen.guard.callback({ data: { action: {} } });
  const discard = screen.alerts[0][2].find((button) => button.text === 'Verwerfen');
  await discard.onPress();
  assert.ok(screen.events.indexOf('clear') >= 0);
  assert.ok(screen.events.indexOf('clear') < screen.events.indexOf('navigate'));
});

test('B06/B09: cleanup failure keeps editor and reports a recoverable error', async () => {
  const screen = editor({ clear: async () => { throw new Error('disk error'); } });
  screen.guard.callback({ data: { action: {} } });
  await screen.alerts[0][2].find((button) => button.text === 'Verwerfen').onPress();
  assert.equal(screen.events.includes('navigate'), false);
  assert.equal(screen.alerts.length, 2);
});

test('B12: editor removal guard remains armed during save and blocks another navigation silently', () => {
  const screen = editor({ saving: true });
  assert.equal(screen.guard.enabled, true);
  screen.guard.callback({ data: { action: {} } });
  assert.equal(screen.alerts.length, 0);
  assert.equal(screen.events.length, 0);
});

function nodes(node) {
  if (Array.isArray(node)) return node.flatMap(nodes);
  return node && typeof node === 'object' ? [node, ...nodes(node.props?.children)] : [];
}
function dashboard({ plan = null, summary = null, resumable = null, error = null } = {}) {
  const pushes = [];
  let refreshed = 0;
  const harness = createHookHarness((react) => {
    const screen = loadJsxModule(__dirname, './TrainingV2MyTrainingScreen.jsx', {
      react, 'react-native': {},
      'expo-router': { router: { push: (route) => pushes.push(route), back() {} }, useFocusEffect: (effect) => react.useEffect(effect, [effect]) },
      '@expo/vector-icons': {}, '../../../../constants/colors': { COLORS: {} }, '../../../../constants/layout': { s: (v) => v },
      '../../../../constants/toolAssets': { TRAINING_V2_MY_TRAINING_ASSETS: {} },
      '../../../../services/authUser': { requireCurrentUserId: async () => 'owner' },
      '../components/TrainingV2HistoryViews': {}, '../components/TrainingV2StateView': {}, '../styles/trainingV2Styles': { styles: {} },
      '../hooks/useTrainingV2History': { useTrainingV2RecentSessions: () => ({ data: [], refresh() {} }) },
      '../hooks/useTrainingV2ContentStyle': { useTrainingV2ContentStyle: () => [] },
      '../hooks/useTrainingV2Plans': { useTrainingV2Plans: () => ({ plans: summary ? [summary] : [], initialLoading: false, error,
        refresh: async () => { refreshed += 1; }, retry() {} }) },
      '../hooks/useTrainingV2PlanDetail': { useTrainingV2PlanDetail: () => ({ plan, loading: false, refresh: async () => {}, retry() {} }) },
      '../models/trainingV2ViewModel': { findActiveTrainingV2Plan: (plans) => plans[0] ?? null, estimateTrainingV2UnitDurationMinutes: () => 1 },
      '../services/trainingV2SessionDraftStorage': { requireTrainingV2SessionOwner: async () => 'owner', findTrainingV2SessionDraftForPlan: async () => resumable },
    }).default;
    return () => screen();
  });
  harness.render();
  return { harness, pushes, get refreshed() { return refreshed; } };
}

test('B07: a draft from a previous revision has an independent resume route with its original IDs', async () => {
  const summary = { id: 'plan', status: 'active' };
  const screen = dashboard({ summary, plan: { ...summary, weeklyGoal: 3, nextUnit: { id: 'new' }, units: [{ id: 'new', unitType: 'strength', exercises: [] }] },
    resumable: { planId: 'plan', unitId: 'old', session: { unitName: 'Old A', planName: 'Plan' } } });
  await screen.harness.settle();
  const resume = nodes(screen.harness.result).find((node) => node.props?.accessibilityLabel === 'Gespeicherten Trainingsentwurf fortsetzen');
  assert.ok(resume);
  resume.props.onPress();
  assert.deepEqual(screen.pushes[0].params, { planId: 'plan', unitId: 'old' });
});

test('B08: saved session remains reachable even when no plan data can be loaded', async () => {
  const screen = dashboard({ error: new Error('offline'), resumable: { planId: 'plan', unitId: 'old', session: { unitName: 'A', planName: 'Plan' } } });
  await screen.harness.settle();
  assert.ok(nodes(screen.harness.result).some((node) => node.props?.accessibilityLabel === 'Gespeicherten Trainingsentwurf fortsetzen'));
});

test('B17: dashboard refresh also reloads the plan list that determines the active plan', async () => {
  const screen = dashboard();
  screen.harness.result.props.refreshControl.props.onRefresh();
  assert.equal(screen.refreshed, 1);
});

test('B05: dashboard opens a Grow instance by template identity', async () => {
  const summary = { id: 'plan', status: 'active' };
  const screen = dashboard({ summary, plan: { ...summary, sourceTemplateId: 'template', weeklyGoal: 3, nextUnit: { id: 'new' }, units: [{ id: 'new', unitType: 'strength', exercises: [] }] } });
  await screen.harness.settle();
  const card = nodes(screen.harness.result).find((node) => node.props?.accessibilityLabel === 'Aktiven Trainingsplan ansehen');
  assert.ok(card);
  card.props.onPress();
  assert.deepEqual(screen.pushes[0].params, { templateId: 'template', planId: 'plan' });
});

test('B05: direct instance details never offer editing/deletion for Grow content', () => {
  for (const sourceTemplateId of ['template', null]) {
    const harness = createHookHarness((react) => {
      const screen = loadJsxModule(__dirname, './TrainingV2OwnPlanDetail.jsx', {
        react, 'react-native': {}, 'expo-router': { router: {} },
        '../../../../constants/colors': { COLORS: {} }, '../styles/trainingV2Styles': { styles: {} },
        '../hooks/useTrainingV2PlanDetail': { useTrainingV2PlanDetail: () => ({ plan: { id: 'plan', sourceTemplateId, status: 'active', revision: { revisionNumber: 1 }, units: [] } }) },
        '../hooks/useTrainingV2PlanActions': { useTrainingV2PlanActions: () => ({ pending: null }) },
        '../hooks/useTrainingV2ContentStyle': { useTrainingV2ContentStyle: () => [] },
        '../hooks/useTrainingV2Plans': { useTrainingV2Plans: () => ({ plans: [] }) },
        '../models/trainingV2ViewModel': {}, '../components/TrainingV2StateView': {},
        '../services/trainingV2DraftStorage': {}, '../services/trainingV2PlansCache': {},
      }).default;
      return () => screen({ planId: 'plan' });
    });
    harness.render();
    const text = nodes(harness.result).map((node) => node.props?.children).filter((value) => typeof value === 'string');
    assert.equal(text.includes('Bearbeiten'), sourceTemplateId === null);
    assert.equal(text.includes('Plan löschen'), sourceTemplateId === null);
  }
});

test('B05: withdrawn template falls back only to its owner-scoped instance detail', () => {
  const ownDetail = () => null;
  const harness = createHookHarness((react) => {
    const screen = loadJsxModule(__dirname, './TrainingV2GrowPlanDetail.jsx', {
      react, 'react-native': {}, 'expo-router': { router: {} },
      '../../../../constants/colors': { COLORS: {} }, '../styles/trainingV2Styles': { styles: {} },
      '../hooks/useTrainingV2TemplateDetail': { useTrainingV2TemplateDetail: () => ({ loading: false, error: { status: 404 } }) },
      '../hooks/useTrainingV2TemplateActions': { useTrainingV2TemplateActions: () => ({}) },
      '../hooks/useTrainingV2ContentStyle': { useTrainingV2ContentStyle: () => [] },
      '../hooks/useTrainingV2Plans': { useTrainingV2Plans: () => ({ plans: [] }) },
      '../models/trainingV2ViewModel': {}, '../components/TrainingV2StateView': {},
      './TrainingV2OwnPlanDetail': ownDetail,
    }).default;
    return () => screen({ templateId: 'template', planId: 'owned-plan' });
  });
  harness.render();
  assert.equal(harness.result.type, ownDetail);
  assert.equal(harness.result.props.planId, 'owned-plan');
});
