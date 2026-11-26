const test = require('node:test'), assert = require('node:assert/strict');
const { loadJsxModule } = require('../testing/loadJsxModule.cjs');
const { analyticsAxisTicks, analyticsChartGeometry, analyticsPointValue, AnalyticsRecord } = loadJsxModule(__dirname, './TrainingV2AnalyticsViews.jsx', {
  'react-native': { StyleSheet: { create: value => value } }, 'expo-router': { router: { push: route => routes.push(route) } },
  '../../../../constants/colors': { COLORS: {} }, '../styles/trainingV2Styles': { styles: {} }, './TrainingV2HistoryViews': { historyNumber: new Intl.NumberFormat('de-DE') },
});
const routes = [];
test('analytics chart uses actual time spacing, no interpolated or missing observations', () => {
  const geometry = analyticsChartGeometry([{ date: '2026-01-01', value: 10 }, { date: '2026-01-02', value: 12 }, { date: '2026-01-31', value: 14 }, { date: '2026-01-16', value: null }]);
  assert.equal(geometry.points.length, 3); assert.equal(geometry.max, 14);
  assert.ok(geometry.points[1].x - geometry.points[0].x < (geometry.points[2].x - geometry.points[1].x) / 20);
  assert.deepEqual(analyticsChartGeometry([]).points, []);
});
test('analytics y axis starts at 0, covers the maximum and uses whole steps for counts', () => {
  assert.deepEqual(analyticsAxisTicks(1, { integer: true }), [0, 1]);
  assert.deepEqual(analyticsAxisTicks(3, { integer: true }), [0, 1, 2, 3]);
  assert.deepEqual(analyticsAxisTicks(5, { integer: true }), [0, 2, 4, 6]);
  assert.deepEqual(analyticsAxisTicks(14), [0, 5, 10, 15]);
  assert.deepEqual(analyticsAxisTicks(0.7), [0, 0.2, 0.4, 0.6, 0.8]);
  assert.deepEqual(analyticsAxisTicks(12500), [0, 5000, 10000, 15000]);
  const geometry = analyticsChartGeometry([{ date: '2026-01-05', value: 2 }, { date: '2026-01-12', value: 5 }], 300, { integer: true });
  assert.equal(geometry.axisMax, 6);
  assert.deepEqual(geometry.ticks.map(tick => tick.y), [130, 90, 50, 10]);
  assert.equal(geometry.points[1].y, 30);
});
test('exercise repetitions compare the selected load only; bodyweight never invents volume', () => {
  const point = { loads: [{ weightKg: 40, reps: 10 }, { weightKg: 60, reps: 5 }], volumeKg: 700, bestSetVolumeKg: 400 };
  assert.equal(analyticsPointValue(point, 'reps', 'total_weight', 60), 5);
  assert.equal(analyticsPointValue(point, 'reps', 'total_weight', 80), null);
  assert.equal(analyticsPointValue(point, 'load', 'per_hand'), 60);
  assert.equal(analyticsPointValue({ loads: [{ weightKg: null, reps: 15 }], volumeKg: null }, 'session_volume', 'bodyweight_only'), null);
});
test('record interaction opens its historical session rather than creating a new session', () => {
  const record = AnalyticsRecord({ record: { metric: 'load', value: 80, weightKg: 80, sessionId: 'historical', date: '2026-01-01T12:00:00Z', sessionName: 'Old plan', ties: 1 } });
  record.props.onPress(); assert.deepEqual(routes, [{ pathname: '/tools/training-v2-session-detail', params: { sessionId: 'historical' } }]);
});
