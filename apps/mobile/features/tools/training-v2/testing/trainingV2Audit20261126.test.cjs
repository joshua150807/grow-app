// Audit 2026-11-26 (Quality/Stress/Responsive). Characterization tests document current behavior;
// tests marked `todo` encode the expected behavior of an open audit finding and do not fail the suite.
const assert = require('node:assert/strict');
const test = require('node:test');
const { loadModule } = require('./loadModule.cjs');

const model = loadModule(__dirname, '../models/trainingV2SessionModel.js');
const history = loadModule(__dirname, '../hooks/useTrainingV2History.js', {
  'expo-router': { useFocusEffect: () => {} },
  '../services/trainingV2Api': { getTrainingV2Session: async () => null, getTrainingV2SessionStats: async () => null, listTrainingV2Sessions: async () => null },
});
const PG_INT_MAX = 2147483647;
// Fixplan 2026-11-26: F03/F04 fixed (blocks B2/B3) -- characterization inverted, todo tests are now real tests.

let keySeq = 0;
const key = () => `00000000-0000-4000-8000-${String(++keySeq).padStart(12, '0')}`;
function draftWith({ reps = 8, weight = '60', plannedRestSeconds = 90, created = '2026-11-25T08:00:00.000Z' } = {}) {
  const plan = { id: key(), name: 'Plan' };
  const unit = { id: key(), name: 'A', unitType: 'strength', exercises: [{ exerciseId: key(), logicalTargetExerciseKey: key(), orderIndex: 0,
    targetSets: [{ logicalTargetSetKey: key(), orderIndex: 0, setType: 'work', targetWeightKg: 60, targetReps: null, plannedRestSeconds }] }] };
  let state = model.createTrainingV2SessionDraft(plan, unit, {}, { now: () => new Date(created), logicalKeyFactory: key });
  state = model.updateSessionSetInput(state, 0, 0, { weightInput: weight, weightKg: model.parseSessionWeightInput(weight), reps });
  return state;
}

test('AUDIT-F03 fixed: a 10-digit reps entry no longer becomes a number that could reach the payload', () => {
  assert.equal(model.parseSessionRepsInput('3000000000'), null);
  let state = draftWith({ reps: 3_000_000_000 });
  state = model.completeSessionSet(state, 0, 0, { completedAt: '2026-11-25T08:10:00.000Z' }).state;
  assert.notEqual(model.getTrainingV2SessionSaveIssue(state, 'completed'), null, `a legacy value above ${PG_INT_MAX} blocks the save locally`);
});

test('AUDIT-F03 expected: reps above the storable integer range are rejected before the draft is locked as pendingSave', () => {
  let state = draftWith({ reps: null });
  state = model.updateSessionSetInput(state, 0, 0, { repsInput: '3000000000', reps: model.parseSessionRepsInput('3000000000') });
  state = model.completeSessionSet(state, 0, 0, { completedAt: '2026-11-25T08:10:00.000Z' }).state;
  assert.notEqual(model.getTrainingV2SessionSaveIssue(state, 'completed'), null);
});

test('AUDIT-F04 expected: implausible weights (e.g. 100000000000000000000 kg) are rejected', () => {
  assert.equal(model.parseSessionWeightInput('100000000000000000000'), null);
});

test('AUDIT-F07 characterization: measured duration = save time - draft creation, pause is always 0 (also after a 26 h resume)', () => {
  let state = draftWith({ created: '2026-11-25T08:00:00.000Z' });
  state = model.completeSessionSet(state, 0, 0, { completedAt: '2026-11-25T08:10:00.000Z' }).state;
  state = model.stampSessionEndedAt(state, '2026-11-26T10:00:00.000Z');
  const payload = model.buildTrainingV2SessionPayload(state, 'completed');
  const seconds = (Date.parse(payload.endedAt) - Date.parse(payload.startedAt)) / 1000 - payload.pausedDurationSeconds;
  assert.equal(payload.pausedDurationSeconds, 0);
  assert.equal(seconds, 26 * 3600, 'a resumed draft reports 26 h of training time');
});

test('AUDIT-F12 characterization: the rest timer always uses DEFAULT_REST_SECONDS, even when the plan defines a rest', () => {
  const state = draftWith({ plannedRestSeconds: 90 });
  const { plannedRestSeconds } = model.completeSessionSet(state, 0, 0, { completedAt: '2026-11-25T08:10:00.000Z' });
  assert.equal(plannedRestSeconds, model.DEFAULT_REST_SECONDS);
  assert.equal(plannedRestSeconds, 180);
});

test('AUDIT: offset pagination overlap after a new completion is deduplicated and keeps order', () => {
  const s = (n) => ({ id: `s${n}` });
  const page0 = { sessions: [s(30), s(29), s(28)], pagination: { page: 0, limit: 3, hasMore: true } };
  // one new session s31 was saved meanwhile -> page 1 now starts with s28 again
  const page1 = { sessions: [s(28), s(27), s(26)], pagination: { page: 1, limit: 3, hasMore: true } };
  const merged = history.appendHistoryPage(page0, page1);
  assert.deepEqual(merged.sessions.map((x) => x.id), ['s30', 's29', 's28', 's27', 's26']);
  assert.equal(merged.pagination.page, 1);
});

test('AUDIT: refresh after focus re-reads every visible page; a late response of a blurred generation is dropped', async () => {
  const published = [];
  let resolveFirst;
  const load = () => new Promise((resolve) => { resolveFirst = resolve; });
  const request = history.createHistoryRequest(load, (state) => published.push(state), null);
  const blur = request.focus();
  blur(); // user navigates away before the response arrives
  resolveFirst({ sessions: [{ id: 'late' }], pagination: { page: 0, hasMore: false } });
  await new Promise(setImmediate);
  assert.equal(published.some((state) => state.data?.sessions?.[0]?.id === 'late'), false);
});
