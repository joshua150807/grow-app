const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildTrainingV2SessionPayload,
  completeSessionSet,
  createTrainingV2SessionDraft,
  hasSessionProgress,
  parseSessionRepsInput,
  parseSessionWeightInput,
  recordRestSecondsForSet,
  sessionProgressSummary,
  setRestTimer,
  uncompleteSessionSet,
  updateSessionSetInput,
} = require('../testing/loadModule.cjs').loadModule(__dirname, './trainingV2SessionModel.js');

function sequentialKeyFactory() {
  let count = 0;
  return () => `key-${(count += 1)}`;
}

function planUnit() {
  return {
    id: 'unit-db-id',
    name: 'Push Day',
    unitType: 'strength',
    exercises: [
      {
        exerciseId: 'exercise-1',
        logicalTargetExerciseKey: 'ltek-1',
        orderIndex: 0,
        targetSets: [
          {
            logicalTargetSetKey: 'ltsk-1', orderIndex: 0, setType: 'work',
            targetWeightKg: 80, targetReps: { minimum: 8, maximum: 10 }, plannedRestSeconds: 90,
          },
          {
            // 0, not null: training_plan_target_sets_v2.planned_rest_seconds is `not null
            // default 0` — a set that never got a real rest value always persists as 0, never
            // as null, so that is the realistic "missing" fixture here.
            logicalTargetSetKey: 'ltsk-2', orderIndex: 1, setType: 'work',
            targetWeightKg: 80, targetReps: { minimum: 8, maximum: 10 }, plannedRestSeconds: 0,
          },
        ],
      },
      {
        exerciseId: 'exercise-2',
        logicalTargetExerciseKey: 'ltek-2',
        orderIndex: 1,
        targetSets: [
          {
            logicalTargetSetKey: 'ltsk-3', orderIndex: 0, setType: 'work',
            targetWeightKg: null, targetReps: null, plannedRestSeconds: 60,
          },
        ],
      },
    ],
  };
}

function plan() {
  return { id: 'plan-1', name: 'Ganzkörper' };
}

const names = { 'exercise-1': 'Bankdrücken', 'exercise-2': 'Kniebeuge' };

test('createTrainingV2SessionDraft takes a full start snapshot, carrying the plan\'s target values as untouched starting state', () => {
  const draft = createTrainingV2SessionDraft(plan(), planUnit(), names, {
    now: () => new Date('2026-08-01T09:00:00.000Z'),
    logicalKeyFactory: sequentialKeyFactory(),
  });

  assert.equal(draft.planId, 'plan-1');
  assert.equal(draft.unitId, 'unit-db-id');
  assert.equal(draft.planName, 'Ganzkörper');
  assert.equal(draft.unitName, 'Push Day');
  assert.equal(draft.unitType, 'strength');
  assert.equal(draft.startedAt, '2026-08-01T09:00:00.000Z');
  assert.equal(draft.idempotencyKey, 'key-1');
  assert.equal(draft.restTimer, null);
  assert.equal(draft.exercises.length, 2);

  const firstExercise = draft.exercises[0];
  assert.equal(firstExercise.exerciseName, 'Bankdrücken');
  assert.equal(firstExercise.logicalTargetExerciseKey, 'ltek-1');
  assert.equal(firstExercise.sets.length, 2);
  const firstSet = firstExercise.sets[0];
  assert.equal(firstSet.targetWeightKg, 80);
  assert.deepEqual(firstSet.targetReps, { minimum: 8, maximum: 10 });
  assert.equal(firstSet.plannedRestSeconds, 90);
  assert.equal(firstSet.completed, false);
  assert.equal(firstSet.weightKg, null);
  assert.equal(firstSet.reps, null);
  assert.equal(firstSet.completedAt, null);
  // clientSetId/logicalTargetSetKey both come from the injected factory / the plan's own
  // logical key respectively, and must never collide with each other.
  assert.equal(firstSet.logicalTargetSetKey, 'ltsk-1');

  const namesByFallback = createTrainingV2SessionDraft(plan(), planUnit(), {}, {
    logicalKeyFactory: sequentialKeyFactory(),
  });
  assert.equal(namesByFallback.exercises[0].exerciseName, 'Unbekannte Übung');
});

test('parseSessionWeightInput accepts a finite, non-negative number (comma or dot decimal), otherwise null', () => {
  assert.equal(parseSessionWeightInput(''), null);
  assert.equal(parseSessionWeightInput('   '), null);
  assert.equal(parseSessionWeightInput('abc'), null);
  assert.equal(parseSessionWeightInput('-5'), null);
  assert.equal(parseSessionWeightInput('0'), 0);
  assert.equal(parseSessionWeightInput('82.5'), 82.5);
  assert.equal(parseSessionWeightInput('82,5'), 82.5);
});

test('parseSessionRepsInput accepts a positive integer only', () => {
  assert.equal(parseSessionRepsInput(''), null);
  assert.equal(parseSessionRepsInput('0'), null);
  assert.equal(parseSessionRepsInput('-1'), null);
  assert.equal(parseSessionRepsInput('10.5'), null);
  assert.equal(parseSessionRepsInput('abc'), null);
  assert.equal(parseSessionRepsInput('10'), 10);
});

test('updateSessionSetInput merges a patch into exactly the targeted set, leaving every other set untouched', () => {
  const draft = createTrainingV2SessionDraft(plan(), planUnit(), names, { logicalKeyFactory: sequentialKeyFactory() });
  const next = updateSessionSetInput(draft, 0, 1, { weightKg: 85, reps: 6 });
  assert.equal(next.exercises[0].sets[1].weightKg, 85);
  assert.equal(next.exercises[0].sets[1].reps, 6);
  assert.equal(next.exercises[0].sets[0].weightKg, null);
  // Immutable update: the original draft is never mutated in place.
  assert.equal(draft.exercises[0].sets[1].weightKg, null);
});

test('completeSessionSet stamps completedAt once and always starts the rest timer at 180s, ignoring the target set\'s own plannedRestSeconds entirely — 0, 90 and 180 as that stale input all produce the same 180s start, since V1\'s plan editor has no rest-seconds field to set it with', () => {
  const draft = createTrainingV2SessionDraft(plan(), planUnit(), names, { logicalKeyFactory: sequentialKeyFactory() });
  // Sanity-check the fixture actually carries the varied plannedRestSeconds inputs this test claims to cover.
  assert.equal(draft.exercises[0].sets[0].plannedRestSeconds, 90);
  assert.equal(draft.exercises[0].sets[1].plannedRestSeconds, 0);
  const withValue = updateSessionSetInput(draft, 0, 0, { weightKg: 80, reps: 8 });

  const first = completeSessionSet(withValue, 0, 0, { completedAt: '2026-08-01T09:05:00.000Z' });
  assert.equal(first.plannedRestSeconds, 180);
  assert.equal(first.state.exercises[0].sets[0].completed, true);
  assert.equal(first.state.exercises[0].sets[0].completedAt, '2026-08-01T09:05:00.000Z');

  const second = completeSessionSet(first.state, 0, 1, { completedAt: '2026-08-01T09:07:00.000Z' });
  assert.equal(second.plannedRestSeconds, 180);

  const with180 = {
    ...second.state,
    exercises: second.state.exercises.map((exercise, index) => (index !== 1 ? exercise : {
      ...exercise, sets: exercise.sets.map((set) => ({ ...set, plannedRestSeconds: 180 })),
    })),
  };
  const third = completeSessionSet(with180, 1, 0, { completedAt: '2026-08-01T09:09:00.000Z' });
  assert.equal(third.plannedRestSeconds, 180);
});

test('uncompleteSessionSet resets completed/completedAt/actualRestSeconds but keeps the entered weight/reps', () => {
  const draft = createTrainingV2SessionDraft(plan(), planUnit(), names, { logicalKeyFactory: sequentialKeyFactory() });
  const withValue = updateSessionSetInput(draft, 0, 0, { weightKg: 80, reps: 8 });
  const { state: completed } = completeSessionSet(withValue, 0, 0, { completedAt: '2026-08-01T09:05:00.000Z' });
  const withRest = recordRestSecondsForSet(completed, 0, 0, 87);
  const reverted = uncompleteSessionSet(withRest, 0, 0);

  const set = reverted.exercises[0].sets[0];
  assert.equal(set.completed, false);
  assert.equal(set.completedAt, null);
  assert.equal(set.actualRestSeconds, null);
  assert.equal(set.weightKg, 80);
  assert.equal(set.reps, 8);
});

test('setRestTimer only ever replaces the top-level restTimer field', () => {
  const draft = createTrainingV2SessionDraft(plan(), planUnit(), names, { logicalKeyFactory: sequentialKeyFactory() });
  const timer = { endsAt: 1000, plannedSeconds: 90, exerciseIndex: 0, setIndex: 0 };
  const next = setRestTimer(draft, timer);
  assert.deepEqual(next.restTimer, timer);
  assert.equal(setRestTimer(next, null).restTimer, null);
});

test('hasSessionProgress is true once anything is completed or entered, false on a fresh draft', () => {
  const draft = createTrainingV2SessionDraft(plan(), planUnit(), names, { logicalKeyFactory: sequentialKeyFactory() });
  assert.equal(hasSessionProgress(draft), false);
  assert.equal(hasSessionProgress(updateSessionSetInput(draft, 0, 0, { weightKg: 80 })), true);
  assert.equal(hasSessionProgress(updateSessionSetInput(draft, 0, 0, { note: 'gut gelaufen' })), true);
  const { state: completed } = completeSessionSet(draft, 1, 0, { completedAt: '2026-08-01T09:00:00.000Z' });
  assert.equal(hasSessionProgress(completed), true);
});

test('sessionProgressSummary counts completed sets against the draft\'s total set count', () => {
  const draft = createTrainingV2SessionDraft(plan(), planUnit(), names, { logicalKeyFactory: sequentialKeyFactory() });
  assert.deepEqual(sessionProgressSummary(draft), { completedSets: 0, totalSets: 3 });
  const { state: completed } = completeSessionSet(draft, 0, 0, { completedAt: '2026-08-01T09:00:00.000Z' });
  assert.deepEqual(sessionProgressSummary(completed), { completedSets: 1, totalSets: 3 });
});

test('buildTrainingV2SessionPayload only ever includes completed sets, drops exercises left with none, and never sends an RIR value', () => {
  const draft = createTrainingV2SessionDraft(plan(), planUnit(), names, { logicalKeyFactory: sequentialKeyFactory() });
  const withValue = updateSessionSetInput(draft, 0, 0, { weightKg: 80, reps: 8 });
  const { state: completed } = completeSessionSet(withValue, 0, 0, { completedAt: '2026-08-01T09:05:00.000Z' });

  const payload = buildTrainingV2SessionPayload(completed, 'incomplete');
  assert.equal(payload.planId, 'plan-1');
  assert.equal(payload.unitId, 'unit-db-id');
  assert.equal(payload.status, 'incomplete');
  assert.equal(payload.idempotencyKey, 'key-1');
  // Exercise 2 (index 1) never had a set completed, so it is dropped entirely rather than
  // sent with an empty sets array.
  assert.equal(payload.exercises.length, 1);
  assert.equal(payload.exercises[0].exerciseId, 'exercise-1');
  assert.equal(payload.exercises[0].sets.length, 1);
  const sentSet = payload.exercises[0].sets[0];
  assert.equal(sentSet.weightKg, 80);
  assert.equal(sentSet.reps, 8);
  assert.equal(sentSet.rir, null);
  assert.equal(sentSet.completedAt, '2026-08-01T09:05:00.000Z');
});

test('buildTrainingV2SessionPayload carries actualRestSeconds through to the exact set it was recorded on, leaving an undismissed set null', () => {
  const draft = createTrainingV2SessionDraft(plan(), planUnit(), names, { logicalKeyFactory: sequentialKeyFactory() });
  const withFirstValue = updateSessionSetInput(draft, 0, 0, { weightKg: 80, reps: 8 });
  const { state: firstCompleted } = completeSessionSet(withFirstValue, 0, 0, { completedAt: '2026-08-01T09:05:00.000Z' });
  const firstWithRest = recordRestSecondsForSet(firstCompleted, 0, 0, 87);

  const withSecondValue = updateSessionSetInput(firstWithRest, 0, 1, { weightKg: 80, reps: 6 });
  const { state: secondCompleted } = completeSessionSet(withSecondValue, 0, 1, { completedAt: '2026-08-01T09:08:00.000Z' });
  // Second set's rest timer is still running (never dismissed) — its actualRestSeconds must
  // stay null rather than pick up the first set's value.

  const payload = buildTrainingV2SessionPayload(secondCompleted, 'incomplete');
  const [firstSet, secondSet] = payload.exercises[0].sets;
  assert.equal(firstSet.actualRestSeconds, 87);
  assert.equal(secondSet.actualRestSeconds, null);
});

test('completing sets in different exercises never lets one set\'s rest timer or completion touch another\'s (no cross-set contamination on quick, successive completions)', () => {
  const draft = createTrainingV2SessionDraft(plan(), planUnit(), names, { logicalKeyFactory: sequentialKeyFactory() });

  const { state: afterFirst } = completeSessionSet(draft, 0, 0, { completedAt: '2026-08-01T09:00:00.000Z' });
  const firstTimer = { endsAt: 1_000, plannedSeconds: 90, exerciseIndex: 0, setIndex: 0 };
  const withFirstTimer = setRestTimer(afterFirst, firstTimer);
  const afterFirstDismissed = setRestTimer(recordRestSecondsForSet(withFirstTimer, 0, 0, 45), null);

  // A second, unrelated set (different exercise) is completed right after — its own timer
  // must be scoped to its own (exerciseIndex, setIndex), never reusing or overwriting the
  // first set's already-recorded actualRestSeconds.
  const { state: afterSecond, plannedRestSeconds: secondPlanned } = completeSessionSet(
    afterFirstDismissed, 1, 0, { completedAt: '2026-08-01T09:02:00.000Z' },
  );
  const secondTimer = { endsAt: 2_000, plannedSeconds: secondPlanned, exerciseIndex: 1, setIndex: 0 };
  const withSecondTimer = setRestTimer(afterSecond, secondTimer);

  assert.equal(withSecondTimer.restTimer.exerciseIndex, 1);
  assert.equal(withSecondTimer.restTimer.setIndex, 0);
  // The first exercise's set keeps its own recorded rest, untouched by the second set's timer.
  assert.equal(withSecondTimer.exercises[0].sets[0].actualRestSeconds, 45);
  assert.equal(withSecondTimer.exercises[1].sets[0].actualRestSeconds, null);
});
