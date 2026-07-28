const assert = require('node:assert/strict');
const test = require('node:test');

const { loadModule } = require('../testing/loadModule.cjs');
const viewModel = loadModule(__dirname, './trainingV2ViewModel.js');

test('preserves API order while grouping active, scheduled, draft and archived plans', () => {
  const plans = [
    { id: 'active-1', status: 'active' },
    { id: 'scheduled-1', status: 'scheduled' },
    { id: 'draft-1', status: 'draft' },
    { id: 'draft-2', status: 'draft' },
    { id: 'archived-1', status: 'archived' },
  ];
  const groups = viewModel.groupTrainingV2Plans(plans);

  assert.deepEqual(groups.active.map(({ id }) => id), ['active-1']);
  assert.deepEqual(groups.scheduled.map(({ id }) => id), ['scheduled-1']);
  assert.deepEqual(groups.draft.map(({ id }) => id), ['draft-1', 'draft-2']);
  assert.deepEqual(groups.archived.map(({ id }) => id), ['archived-1']);
  assert.equal(viewModel.findActiveTrainingV2Plan(plans).id, 'active-1');
  assert.equal(
    viewModel.findActiveTrainingV2Plan(plans.filter((plan) => plan.status !== 'active')),
    null,
  );
});

test('maps ordered units, exercise names and individual target sets without mutation logic', () => {
  const plan = {
    id: 'plan',
    status: 'active',
    revision: {
      revisionNumber: 4,
      units: [{
        id: 'unit',
        name: 'Einheit',
        unitType: 'strength',
        exercises: [{
          id: 'target',
          exerciseId: 'exercise',
          targetSets: [
            { id: 'set-1', targetReps: { minimum: 8, maximum: 10 }, targetWeightKg: 60, targetRir: 2, plannedRestSeconds: 90 },
            { id: 'set-2', targetReps: null, targetWeightKg: null, targetRir: null, plannedRestSeconds: null, setType: 'warmup' },
          ],
        }],
      }],
    },
  };
  const mapped = viewModel.mapTrainingV2PlanDetail(plan, { exercise: 'Aufgelöster Name' });

  assert.equal(mapped.statusLabel, 'Active');
  assert.equal(mapped.units[0].unitTypeLabel, 'Kraft');
  assert.equal(mapped.units[0].exercises[0].exerciseName, 'Aufgelöster Name');
  assert.equal(
    viewModel.mapTrainingV2PlanDetail(plan, {}).units[0].exercises[0].exerciseName,
    'Unbekannte Übung',
  );
  assert.equal(viewModel.targetSetLabel(mapped.units[0].exercises[0].targetSets[0]), '8–10 Wdh. · 60 kg · RIR 2 · 90s Pause');
  assert.equal(viewModel.targetSetLabel(mapped.units[0].exercises[0].targetSets[1]), 'warmup');
});

test('available plan actions mirror the API status gates exactly for draft and scheduled', () => {
  for (const status of ['draft', 'scheduled']) {
    assert.deepEqual(viewModel.getAvailableTrainingV2PlanActions(status), {
      canActivate: true, canSchedule: true, canArchive: true, canReactivate: false, canEditWeeklyGoal: true,
    });
  }
});

test('an active plan can only have its weekly goal changed (API forbids activate/schedule/archive/reactivate)', () => {
  assert.deepEqual(viewModel.getAvailableTrainingV2PlanActions('active'), {
    canActivate: false, canSchedule: false, canArchive: false, canReactivate: false, canEditWeeklyGoal: true,
  });
});

test('an archived plan can only be reactivated', () => {
  assert.deepEqual(viewModel.getAvailableTrainingV2PlanActions('archived'), {
    canActivate: false, canSchedule: false, canArchive: false, canReactivate: true, canEditWeeklyGoal: false,
  });
});

test('an unknown status exposes no actions at all (fails closed, never fails open)', () => {
  assert.deepEqual(viewModel.getAvailableTrainingV2PlanActions('something-unexpected'), {
    canActivate: false, canSchedule: false, canArchive: false, canReactivate: false, canEditWeeklyGoal: false,
  });
});

test('a plan-action modal closes on success', () => {
  assert.equal(viewModel.shouldClosePlanActionModal({ ok: true, plan: {} }), true);
});

test('a plan-action modal closes on a stale-version conflict, so the screen reload path becomes reachable', () => {
  assert.equal(viewModel.shouldClosePlanActionModal({
    ok: false, error: { code: 'TRAINING_PLAN_VERSION_CONFLICT' },
  }), true);
});

test('a plan-action modal stays open for a normal error, so its own in-modal message stays visible', () => {
  for (const code of ['TRAINING_PLAN_VALIDATION_ERROR', 'TRAINING_PLAN_NOT_FOUND', 'TRAINING_V2_NETWORK_ERROR', 'TRAINING_V2_CONTRACT_ERROR']) {
    assert.equal(viewModel.shouldClosePlanActionModal({ ok: false, error: { code } }), false);
  }
});

test('a plan-action modal stays open for a non-version 409 (e.g. another plan already scheduled)', () => {
  assert.equal(viewModel.shouldClosePlanActionModal({
    ok: false, error: { code: 'TRAINING_SCHEDULE_CONFLICT' },
  }), false);
  assert.equal(viewModel.shouldClosePlanActionModal({
    ok: false, error: { code: 'TRAINING_PLAN_STATUS_CONFLICT' },
  }), false);
});
