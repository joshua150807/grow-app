const test = require('node:test'), assert = require('node:assert/strict');
const { loadJsxModule } = require('../testing/loadJsxModule.cjs');
const { recordHighlights, recordWeightText, sessionBests } = loadJsxModule(__dirname, './TrainingV2RecordCard.jsx', {
  'react-native': {}, '@expo/vector-icons': {}, '../../../../constants/colors': { COLORS: {} },
  '../../../../constants/layout': { s: v => v }, '../styles/trainingV2Styles': { styles: {} },
});
const rec = (metric, value, weightKg, date) => ({ metric, value, weightKg, date, sessionId: 's', sessionName: 'Push', ties: 0 });

test('records show only max weight and max reps; volume metrics are ignored', () => {
  const h = recordHighlights({ loadType: 'total_weight', records: [
    rec('load', 85, 85, '2026-11-19T12:00:00Z'), rec('reps', 10, 55, '2026-09-25T12:00:00Z'), rec('reps', 11, 60, '2026-10-09T12:00:00Z'),
    rec('reps', 11, 81.25, '2026-11-12T12:00:00Z'), rec('reps', 11, 81.25, '2026-10-01T12:00:00Z'), rec('set_volume', 1787.5, null, '2026-11-12T12:00:00Z'),
  ] });
  assert.equal(h.maxWeight.value, '85 kg'); assert.equal(h.maxWeight.date, '19.11.26');
  // tie on 11 reps -> heavier weight wins, then the more recent set
  assert.equal(h.maxReps.value, '11 Wdh.'); assert.equal(h.maxReps.detail, 'bei 81,25 kg'); assert.equal(h.maxReps.date, '12.11.26');
});
test('load types are labelled as logged; bodyweight has reps but no max weight', () => {
  assert.equal(recordWeightText(20, 'per_hand'), '20 kg pro Hand');
  assert.equal(recordWeightText(15, 'per_side'), '15 kg pro Seite');
  assert.equal(recordWeightText(10, 'added_weight_only'), '+10 kg');
  assert.equal(recordWeightText(null, 'added_weight_only'), 'Körpergewicht');
  const body = recordHighlights({ loadType: 'bodyweight_only', records: [rec('reps', 25, null, '2026-11-01T12:00:00Z')] });
  assert.equal(body.maxWeight, null); assert.equal(body.maxReps.detail, 'bei Körpergewicht');
  assert.deepEqual(recordHighlights({ loadType: 'total_weight', records: [] }), { maxWeight: null, maxReps: null });
});
test('per training: heaviest set and most reps (ties -> heavier); bodyweight sets have no heaviest weight', () => {
  const b = sessionBests({ loads: [{ weightKg: 82.5, reps: 8 }, { weightKg: 80, reps: 11 }, { weightKg: 77.5, reps: 11 }] });
  assert.deepEqual(b.heaviest, { weightKg: 82.5, reps: 8 }); assert.deepEqual(b.mostReps, { weightKg: 80, reps: 11 });
  const body = sessionBests({ loads: [{ weightKg: null, reps: 20 }] });
  assert.equal(body.heaviest, null); assert.equal(body.mostReps.reps, 20);
  assert.deepEqual(sessionBests({ loads: [] }), { heaviest: null, mostReps: null });
});
