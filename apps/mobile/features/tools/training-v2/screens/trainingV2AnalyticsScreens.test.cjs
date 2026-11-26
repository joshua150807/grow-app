const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { loadJsxModule } = require('../testing/loadJsxModule.cjs');
const { createHookHarness } = require('../testing/createHookHarness.cjs');
const nodes = node => Array.isArray(node) ? node.flatMap(nodes) : node && typeof node === 'object' ? [node, ...nodes(node.props?.children)] : [];
function render(file, hook, data, extra = {}) {
  const pushes = [], periods = [], props = { exerciseId: 'stable-id' };
  const harness = createHookHarness(react => {
    const component = loadJsxModule(__dirname, file, {
      react, 'react-native': {}, '@expo/vector-icons': {}, '../../../../constants/layout': { s: v => v },
      '../components/TrainingV2RecordCard': { TrainingV2RecordCard: () => null, RecordStat: () => null, recordNumber: new Intl.NumberFormat('de-DE'), recordShortDate: String, recordWeightText: v => `${v} kg`,
        recordHighlights: () => ({ maxWeight: { value: '80 kg', sessionId: 'w' }, maxReps: { value: '12 Wdh.', sessionId: 'r' } }),
        sessionBests: point => ({ heaviest: { weightKg: point.loads[0].weightKg, reps: 5 }, mostReps: { weightKg: null, reps: point.loads[0].reps } }) }, 'expo-router': { router: { push: route => pushes.push(route) } },
      '../styles/trainingV2Styles': { styles: {} }, '../../../../constants/colors': { COLORS: {} },
      '../components/TrainingV2HistoryViews': { historyNumber: new Intl.NumberFormat('de-DE'), formatTrainingDuration: String },
      '../components/TrainingV2StateView': {}, '../components/TrainingV2AnalyticsViews': { a: {}, loadLabels: {}, metricLabels: { load: 'Last', reps: 'Wiederholungen', set_volume: 'Satzvolumen', session_volume: 'Volumen' },
        analyticsDate: String, recordUnit: String, analyticsPointValue: () => 10 },
      '../hooks/useTrainingV2ContentStyle': { useTrainingV2ContentStyle: () => [] },
      '../hooks/useTrainingV2Analytics': { trainingDeviceTimeZone: () => 'Europe/Berlin', [hook]: (...args) => { periods.push(args); return { data, loading: false, refreshing: false, refresh() {}, loadMore() {}, ...extra }; } },
    }).default;
    return () => component(props);
  }); harness.render();
  return { harness, pushes, periods };
}
test('records list renders stable IDs and opens the selected exercise; empty/error states do not fabricate records', () => {
  const data = { exercises: [{ exerciseId: 'one', name: 'Press', loadType: 'total_weight', records: [], sessionCount: 2 }], pagination: { page: 0, total: 1, hasMore: false } };
  const screen = render('./TrainingV2RecordsScreen.jsx', 'useTrainingRecords', data);
  assert.equal(screen.harness.result.props.keyExtractor(data.exercises[0]), 'one');
  const item = screen.harness.result.props.renderItem({ item: data.exercises[0] }); assert.equal(item.props.exercise, data.exercises[0]); item.props.onPress();
  assert.deepEqual(screen.pushes[0], { pathname: '/tools/training-v2-exercise-progress', params: { exerciseId: 'one' } }); screen.harness.unmount();
  const empty = render('./TrainingV2RecordsScreen.jsx', 'useTrainingRecords', { exercises: [], pagination: { total: 0 } }, { error: Error('offline') });
  assert.equal(empty.harness.result.props.ListEmptyComponent, null); empty.harness.unmount();
});
test('progress screen exposes four periods and a stable exercise-selection route, including no timing data', () => {
  const data = { from: '2026-01-01', through: '2026-01-30', completedSessions: 0, activeDays: 0, durationSeconds: null, volumeKg: null, measuredSessions: 0, unmeasuredSessions: 0, timeZone: 'Europe/Berlin', weeks: [], months: [] };
  const screen = render('./TrainingV2ProgressScreen.jsx', 'useTrainingProgress', data);
  const period = nodes(screen.harness.result).find(node => node.props?.period === '30'); assert.ok(period);
  period.props.onChange('all'); screen.harness.render(); assert.equal(screen.periods.at(-1)[0], 'all');
  nodes(screen.harness.result).find(node => node.props?.onPress)?.props.onPress(); assert.equal(screen.pushes[0].params.mode, 'progress'); screen.harness.unmount();
});
test('exercise detail keeps bodyweight to repetitions and weighted changes remain local selections', () => {
  const data = { exercise: { exerciseId: 'stable-id', name: 'Pushup', loadType: 'bodyweight_only', sessionCount: 1, records: [{ metric: 'reps', value: 12, weightKg: null }] }, points: [], pagination: { total: 0, hasMore: false } };
  const screen = render('./TrainingV2ExerciseProgressScreen.jsx', 'useTrainingExerciseProgress', data);
  const all = nodes(screen.harness.result);
  assert.equal(all.filter(node => node.props?.accessibilityState).length, 0, 'bodyweight has no weight/reps switch');
  assert.equal(all.find(node => node.props?.points).props.unit, 'Wdh.');
  assert.equal(all.filter(node => node.props?.label).length, 2, 'exactly two best values: max weight and max reps'); screen.harness.unmount();

  const weighted = { exercise: { exerciseId: 'stable-id', name: 'Press', loadType: 'total_weight', sessionCount: 1, records: [] }, points: [{ sessionId: 's1', date: '2026-01-01T12:00:00Z', sessionName: 'Push', loads: [{ weightKg: 80, reps: 8 }] }], pagination: { total: 1, hasMore: false } };
  const detail = render('./TrainingV2ExerciseProgressScreen.jsx', 'useTrainingExerciseProgress', weighted);
  let chart = nodes(detail.harness.result).find(node => node.props?.points);
  assert.equal(chart.props.points[0].value, 80); assert.equal(chart.props.unit, 'kg');
  nodes(detail.harness.result).find(node => node.props?.accessibilityState && node.key === 'reps').props.onPress(); detail.harness.render();
  chart = nodes(detail.harness.result).find(node => node.props?.points);
  assert.equal(chart.props.points[0].value, 8); assert.equal(chart.props.integer, true); assert.equal(detail.periods.at(-1)[1], 'all');
  detail.harness.unmount();
});
test('new routes stay flat and reuse the owner-isolated background without adding a navigator', () => {
  for (const route of ['records', 'progress', 'exercise-progress']) {
    const source = fs.readFileSync(path.resolve(__dirname, `../../../../app/(tabs)/tools/training-v2-${route}.jsx`), 'utf8');
    assert.match(source, /TrainingV2Background/); assert.doesNotMatch(source, /<Stack|replace\(|reload/);
  }
});
