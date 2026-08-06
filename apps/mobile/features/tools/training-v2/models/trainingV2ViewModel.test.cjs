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

test('selectTrainingV2SavedPlans keeps every own plan (never tied to a template) regardless of status, plus only explicitly-saved Grow instances — an active-but-unsaved Grow instance is excluded just like any other unsaved Grow instance', () => {
  const plans = [
    { id: 'own-1', status: 'draft', sourceTemplateId: null, savedAt: null },
    { id: 'own-archived', status: 'archived', sourceTemplateId: null, savedAt: null },
    { id: 'grow-saved', status: 'draft', sourceTemplateId: 'template-a', savedAt: '2026-01-01T00:00:00Z' },
    { id: 'grow-unsaved-inactive', status: 'draft', sourceTemplateId: 'template-b', savedAt: null },
    { id: 'grow-unsaved-archived', status: 'archived', sourceTemplateId: 'template-c', savedAt: null },
    { id: 'grow-active-unsaved', status: 'active', sourceTemplateId: 'template-d', savedAt: null },
  ];
  const saved = viewModel.selectTrainingV2SavedPlans(plans);
  assert.deepEqual(saved.map((plan) => plan.id), ['own-1', 'own-archived', 'grow-saved']);
});

test('an active-but-unsaved Grow plan is missing from selectTrainingV2SavedPlans — it only ever shows in Grow-Trainingspläne (with its own Aktiv badge there), never in Gespeicherte Pläne', () => {
  const plans = [
    { id: 'grow-active-unsaved', status: 'active', sourceTemplateId: 'template-d', savedAt: null },
  ];
  assert.deepEqual(viewModel.selectTrainingV2SavedPlans(plans), []);
});

test('an active, saved Grow plan still appears in selectTrainingV2SavedPlans (savedAt is what decides membership here, not status)', () => {
  const plans = [
    { id: 'grow-active-saved', status: 'active', sourceTemplateId: 'template-d', savedAt: '2026-01-01T00:00:00Z' },
  ];
  assert.deepEqual(viewModel.selectTrainingV2SavedPlans(plans).map((plan) => plan.id), ['grow-active-saved']);
});

test('an own plan appears in selectTrainingV2SavedPlans regardless of status — draft/scheduled/active/archived all qualify purely because sourceTemplateId is null', () => {
  const plans = ['draft', 'scheduled', 'active', 'archived'].map((status) => ({
    id: `own-${status}`, status, sourceTemplateId: null, savedAt: null,
  }));
  assert.deepEqual(
    viewModel.selectTrainingV2SavedPlans(plans).map((plan) => plan.id),
    plans.map((plan) => plan.id),
  );
});

test('unsaving an active Grow plan drops it out of selectTrainingV2SavedPlans immediately (savedAt cleared), while it stays active — this view model never reads or infers activation from savedAt', () => {
  const beforeUnsave = [
    { id: 'grow-active', status: 'active', sourceTemplateId: 'template-d', savedAt: '2026-01-01T00:00:00Z' },
  ];
  const afterUnsave = [
    { id: 'grow-active', status: 'active', sourceTemplateId: 'template-d', savedAt: null },
  ];
  assert.deepEqual(viewModel.selectTrainingV2SavedPlans(beforeUnsave).map((plan) => plan.id), ['grow-active']);
  assert.deepEqual(viewModel.selectTrainingV2SavedPlans(afterUnsave), []);
  // Status is untouched by the filter itself — only the Grow-Trainingspläne list (driven by
  // the template's userPlan.isActive projection, not this array) is responsible for still
  // showing it as active after the unsave.
  assert.equal(afterUnsave[0].status, 'active');
});

test('mapTrainingV2TemplateDetail maps the per-user projection alongside the template content, with the same unit/exercise-name mapping as a plan', () => {
  const template = {
    id: 'template-a',
    name: 'Ganzkörper',
    revision: {
      revisionNumber: 1,
      units: [{
        id: 'unit',
        name: 'Ganzkörper A',
        unitType: 'strength',
        exercises: [{ id: 'target', exerciseId: 'exercise', targetSets: [] }],
      }],
    },
  };
  const mapped = viewModel.mapTrainingV2TemplateDetail(
    template,
    { isSaved: true, isActive: false, userPlanId: 'plan-1' },
    { exercise: 'Kniebeuge' },
  );
  assert.equal(mapped.isSaved, true);
  assert.equal(mapped.isActive, false);
  assert.equal(mapped.userPlanId, 'plan-1');
  assert.equal(mapped.units[0].unitTypeLabel, 'Kraft');
  assert.equal(mapped.units[0].exercises[0].exerciseName, 'Kniebeuge');
});

test('estimateTrainingV2UnitDurationMinutes sums each set\'s work time plus its own real rest, falling back to the 180s default (not 0) for a set with none', () => {
  const unit = {
    exercises: [
      {
        targetSets: [
          { plannedRestSeconds: 90 },
          { plannedRestSeconds: 90 },
        ],
      },
      {
        // 0 is the "no real value" sentinel (see trainingV2SessionModel.js) — must fall back
        // to the 180s default, not be treated as a genuine zero-second rest.
        targetSets: [{ plannedRestSeconds: 0 }],
      },
    ],
  };
  // (40 + 90) * 2 + (40 + 180) = 260 + 220 = 480s = 8 min.
  assert.equal(viewModel.estimateTrainingV2UnitDurationMinutes(unit), 8);
});

test('estimateTrainingV2UnitDurationMinutes never returns 0 for a unit with at least one set', () => {
  const unit = { exercises: [{ targetSets: [{ plannedRestSeconds: 0 }] }] };
  assert.ok(viewModel.estimateTrainingV2UnitDurationMinutes(unit) >= 1);
});
