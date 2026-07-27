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
  assert.equal(viewModel.getTrainingV2HubRedirect({
    plans,
    loading: false,
    error: null,
  }), null);
  assert.equal(viewModel.getTrainingV2HubRedirect({
    plans: plans.filter((plan) => plan.status !== 'active'),
    loading: false,
    error: null,
  }), '/tools/training-v2-plans');
  assert.equal(viewModel.getTrainingV2HubRedirect({
    plans: [],
    loading: true,
    error: null,
  }), null);
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
