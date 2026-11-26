import { describe, expect, it } from 'vitest';
import {
  createTrainingPlanInputSchema,
  listTrainingPlansResponseSchema,
  planTargetExerciseInputSchema,
  scheduleTrainingPlanInputSchema,
  trainingPlanDetailResponseSchema,
  trainingPlanScheduleSchema,
  trainingPlanSchema,
  trainingPlanSummarySchema,
  trainingTemplateUserProjectionSchema,
  updateTrainingPlanInputSchema,
  updateWeeklyGoalInputSchema,
} from '../index.js';

const ids = Array.from({ length: 8 }, (_, index) => (
  `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`
));

function planInput() {
  return {
    name: 'Strength',
    weeklyGoal: 3,
    units: [{
      logicalUnitKey: ids[0],
      name: 'Day 1',
      unitType: 'strength',
      orderIndex: 0,
      exercises: [{
        logicalTargetExerciseKey: ids[1],
        exerciseId: ids[2],
        orderIndex: 0,
        note: null,
        targetSets: [{
          logicalTargetSetKey: ids[3],
          orderIndex: 0,
          setType: 'work',
          targetWeightKg: 80,
          targetReps: { minimum: 8, maximum: 10 },
          targetRir: 2,
          plannedRestSeconds: 120,
          importedFromLegacyPlan: false,
        }],
      }],
    }],
  };
}

function exerciseDraft(overrides: Partial<{ logicalKey: string; name: string; mainMuscle: string; category: string }> = {}) {
  return { logicalKey: ids[6], name: 'Kabelrudern eng', mainMuscle: 'back', category: 'strength', ...overrides };
}

describe('training plan API contracts', () => {
  it('accepts a complete plan and defaults immediate activation to false', () => {
    expect(createTrainingPlanInputSchema.parse(planInput()).activateImmediately).toBe(false);
  });

  it('still accepts a plain exerciseId row exactly as before (legacy input stays green)', () => {
    const row = planInput().units[0].exercises[0];
    expect(planTargetExerciseInputSchema.parse(row)).toEqual(row);
    expect(createTrainingPlanInputSchema.safeParse(planInput()).success).toBe(true);
  });

  it('accepts an exerciseDraft row in place of exerciseId, defaulting mainMuscle and category', () => {
    const row = {
      logicalTargetExerciseKey: ids[1],
      exerciseDraft: { logicalKey: ids[6], name: 'Neue Übung' },
      orderIndex: 0,
      note: null,
      targetSets: planInput().units[0].exercises[0].targetSets,
    };
    const parsed = planTargetExerciseInputSchema.parse(row);
    expect(parsed.exerciseId).toBeUndefined();
    expect(parsed.exerciseDraft).toEqual({
      logicalKey: ids[6], name: 'Neue Übung', mainMuscle: 'other', category: 'strength',
    });
  });

  it('rejects a row with both exerciseId and exerciseDraft, and a row with neither', () => {
    const base = planInput().units[0].exercises[0];
    expect(planTargetExerciseInputSchema.safeParse({
      ...base, exerciseDraft: exerciseDraft(),
    }).success).toBe(false);
    const { exerciseId: _exerciseId, ...withoutId } = base;
    expect(planTargetExerciseInputSchema.safeParse(withoutId).success).toBe(false);
  });

  it('rejects an exerciseDraft with an unknown muscle group or category', () => {
    expect(planTargetExerciseInputSchema.safeParse({
      logicalTargetExerciseKey: ids[1],
      exerciseDraft: exerciseDraft({ mainMuscle: 'quads' }),
      orderIndex: 0, note: null, targetSets: planInput().units[0].exercises[0].targetSets,
    }).success).toBe(false);
    expect(planTargetExerciseInputSchema.safeParse({
      logicalTargetExerciseKey: ids[1],
      exerciseDraft: exerciseDraft({ category: 'yoga' }),
      orderIndex: 0, note: null, targetSets: planInput().units[0].exercises[0].targetSets,
    }).success).toBe(false);
  });

  it('allows several rows to share one draft logicalKey only when the draft is identical, rejecting a mismatch', () => {
    const secondTargetSets = [{ ...planInput().units[0].exercises[0].targetSets[0], logicalTargetSetKey: ids[7] }];

    const plan = planInput();
    plan.units[0].exercises = [
      {
        ...plan.units[0].exercises[0],
        logicalTargetExerciseKey: ids[1],
        exerciseId: undefined,
        exerciseDraft: exerciseDraft(),
      },
      {
        ...plan.units[0].exercises[0],
        logicalTargetExerciseKey: ids[4],
        exerciseId: undefined,
        exerciseDraft: exerciseDraft(),
        orderIndex: 1,
        targetSets: secondTargetSets,
      },
    ] as never;
    expect(createTrainingPlanInputSchema.safeParse(plan).success).toBe(true);

    const mismatched = planInput();
    mismatched.units[0].exercises = [
      {
        ...mismatched.units[0].exercises[0],
        logicalTargetExerciseKey: ids[1],
        exerciseId: undefined,
        exerciseDraft: exerciseDraft(),
      },
      {
        ...mismatched.units[0].exercises[0],
        logicalTargetExerciseKey: ids[4],
        exerciseId: undefined,
        exerciseDraft: exerciseDraft({ mainMuscle: 'chest' }),
        orderIndex: 1,
        targetSets: secondTargetSets,
      },
    ] as never;
    expect(createTrainingPlanInputSchema.safeParse(mismatched).success).toBe(false);
  });

  it.each([
    { ...planInput(), userId: ids[4] },
    { ...planInput(), name: ' ' },
    { ...planInput(), units: [] },
    { ...planInput(), weeklyGoal: 0 },
  ])('rejects invalid or non-canonical create input %#', (input) => {
    expect(createTrainingPlanInputSchema.safeParse(input).success).toBe(false);
  });

  it('requires unique logical keys and positions throughout the plan', () => {
    const input = planInput();
    input.units.push({ ...input.units[0], name: 'Duplicate' });
    expect(createTrainingPlanInputSchema.safeParse(input).success).toBe(false);
  });

  it('requires exercises for strength and excludes exercises from rest', () => {
    const emptyStrength = planInput();
    emptyStrength.units[0].exercises = [];
    expect(createTrainingPlanInputSchema.safeParse(emptyStrength).success).toBe(false);
    const rest = planInput();
    rest.units[0].unitType = 'rest';
    expect(createTrainingPlanInputSchema.safeParse(rest).success).toBe(false);
  });

  it('requires expectedVersion for complete edits and rejects userId', () => {
    const { weeklyGoal: _weeklyGoal, ...tree } = planInput();
    expect(updateTrainingPlanInputSchema.safeParse({ ...tree, expectedVersion: 1 }).success).toBe(true);
    expect(updateTrainingPlanInputSchema.safeParse({ ...tree, expectedVersion: 1, userId: ids[4] }).success).toBe(false);
  });

  it('validates scheduling and weekly-goal mutation inputs strictly', () => {
    expect(scheduleTrainingPlanInputSchema.safeParse({
      expectedVersion: 1, startDate: '2026-07-27', timeZone: 'Europe/Berlin',
    }).success).toBe(true);
    expect(updateWeeklyGoalInputSchema.safeParse({ expectedVersion: 1, weeklyGoal: 0 }).success).toBe(false);
    expect(updateWeeklyGoalInputSchema.safeParse({
      expectedVersion: 1, weeklyGoal: 3, userId: ids[4],
    }).success).toBe(false);
  });

  it('exports the canonical nullable schedule on plan summaries and full plans', () => {
    const summary = {
      id: ids[4],
      name: 'Scheduled plan',
      status: 'scheduled',
      version: 1,
      currentRevisionId: ids[5],
      weeklyGoal: 3,
      createdAt: '2026-07-27T00:00:00.000Z',
      updatedAt: '2026-07-27T00:00:00.000Z',
      activatedAt: null,
      archivedAt: null,
      schedule: {
        startDate: '2026-10-25',
        timeZone: 'Europe/Berlin',
        effectiveAt: '2026-10-24T22:00:00.000Z',
      },
    };
    expect(trainingPlanScheduleSchema.parse(summary.schedule)).toEqual(summary.schedule);
    expect(trainingPlanScheduleSchema.parse({
      ...summary.schedule,
      timeZone: 'America/New_York',
    }).timeZone).toBe('America/New_York');
    expect(trainingPlanSummarySchema.parse(summary).schedule).toEqual(summary.schedule);
    expect(trainingPlanSummarySchema.parse({
      ...summary, status: 'draft', schedule: null,
    }).schedule).toBeNull();
    expect(trainingPlanSummarySchema.safeParse({
      ...summary, status: 'draft',
    }).success).toBe(false);
    expect(trainingPlanSummarySchema.safeParse({
      ...summary, schedule: null,
    }).success).toBe(false);
    expect(trainingPlanSchema.parse({
      ...summary,
      revision: {
        id: ids[5],
        revisionNumber: 1,
        createdAt: '2026-07-27T00:00:00.000Z',
        units: [],
      },
    }).schedule).toEqual(summary.schedule);
  });

  it.each([
    { startDate: '2026/02/30', timeZone: 'Europe/Berlin', effectiveAt: '2026-03-01T00:00:00.000Z' },
    { startDate: '2026-07-27', timeZone: '', effectiveAt: '2026-07-26T22:00:00.000Z' },
    { startDate: '2026-07-27', timeZone: 'Invalid/Stored_Zone', effectiveAt: '2026-07-26T22:00:00.000Z' },
    { startDate: '2026-07-27', timeZone: 'Europe/Berlin', effectiveAt: 'not-a-time' },
  ])('rejects an invalid schedule contract %#', (schedule) => {
    expect(trainingPlanScheduleSchema.safeParse(schedule).success).toBe(false);
  });

  it('validates strict list and detail response envelopes', () => {
    const summary = {
      id: ids[4],
      name: 'Draft plan',
      status: 'draft',
      version: 1,
      currentRevisionId: ids[5],
      weeklyGoal: 3,
      createdAt: '2026-07-27T00:00:00.000Z',
      updatedAt: '2026-07-27T00:00:00.000Z',
      activatedAt: null,
      archivedAt: null,
      schedule: null,
    };
    const plan = {
      ...summary,
      revision: {
        id: ids[5],
        revisionNumber: 1,
        createdAt: '2026-07-27T00:00:00.000Z',
        units: [],
      },
    };

    const normalizedProvenance = {
      sourceTemplateId: null,
      savedAt: null,
      sourceTemplateImageReference: null,
      nextUnit: null,
    };

    expect(listTrainingPlansResponseSchema.parse({ plans: [summary] })).toEqual({
      plans: [{ ...summary, ...normalizedProvenance }],
    });
    expect(trainingPlanDetailResponseSchema.parse({ plan })).toEqual({
      plan: { ...plan, ...normalizedProvenance, revision: { ...plan.revision, sourceTemplateRevisionId: null } },
    });
    expect(listTrainingPlansResponseSchema.safeParse({ plans: [summary], legacy: [] }).success).toBe(false);
    expect(trainingPlanDetailResponseSchema.safeParse({ plan: { ...plan, schedule: {} } }).success).toBe(false);
  });

  it('parses legacy plan objects that predate template provenance and normalizes the new fields to null', () => {
    const legacySummary = {
      id: ids[4],
      name: 'Legacy plan',
      status: 'draft',
      version: 1,
      currentRevisionId: ids[5],
      weeklyGoal: 3,
      createdAt: '2026-07-27T00:00:00.000Z',
      updatedAt: '2026-07-27T00:00:00.000Z',
      activatedAt: null,
      archivedAt: null,
      schedule: null,
    };

    const parsed = trainingPlanSummarySchema.parse(legacySummary);
    expect(parsed.sourceTemplateId).toBeNull();
    expect(parsed.savedAt).toBeNull();
    expect(parsed.sourceTemplateImageReference).toBeNull();
    expect(parsed.nextUnit).toBeNull();
    expect('sourceTemplateId' in parsed).toBe(true);
    expect('savedAt' in parsed).toBe(true);
    expect('sourceTemplateImageReference' in parsed).toBe(true);
    expect('nextUnit' in parsed).toBe(true);

    const legacyPlan = {
      ...legacySummary,
      revision: {
        id: ids[5],
        revisionNumber: 1,
        createdAt: '2026-07-27T00:00:00.000Z',
        units: [],
      },
    };
    const parsedPlan = trainingPlanSchema.parse(legacyPlan);
    expect(parsedPlan.revision.sourceTemplateRevisionId).toBeNull();
    expect('sourceTemplateRevisionId' in parsedPlan.revision).toBe(true);
  });

  it('preserves concrete template provenance values when supplied', () => {
    const summary = {
      id: ids[4],
      name: 'Saved plan',
      status: 'draft',
      version: 1,
      currentRevisionId: ids[5],
      weeklyGoal: 3,
      createdAt: '2026-07-27T00:00:00.000Z',
      updatedAt: '2026-07-27T00:00:00.000Z',
      activatedAt: null,
      archivedAt: null,
      schedule: null,
      sourceTemplateId: ids[6],
      savedAt: '2026-07-27T00:00:00.000Z',
      sourceTemplateImageReference: 'templates/strength.png',
    };

    const parsed = trainingPlanSummarySchema.parse(summary);
    expect(parsed.sourceTemplateId).toBe(ids[6]);
    expect(parsed.savedAt).toBe('2026-07-27T00:00:00.000Z');
    expect(parsed.sourceTemplateImageReference).toBe('templates/strength.png');

    const plan = {
      ...summary,
      revision: {
        id: ids[5],
        revisionNumber: 1,
        createdAt: '2026-07-27T00:00:00.000Z',
        sourceTemplateRevisionId: ids[7],
        units: [],
      },
    };
    expect(trainingPlanSchema.parse(plan).revision.sourceTemplateRevisionId).toBe(ids[7]);

    expect(trainingPlanSummarySchema.safeParse({ ...summary, sourceTemplateId: null }).success).toBe(false);
    expect(trainingPlanSummarySchema.safeParse({
      ...summary, savedAt: null, sourceTemplateImageReference: null,
    }).success).toBe(true);
  });

  it('yields null template/save fields for a hand-authored own plan', () => {
    const ownPlan = {
      id: ids[4],
      name: 'My own plan',
      status: 'active',
      version: 1,
      currentRevisionId: ids[5],
      weeklyGoal: 4,
      createdAt: '2026-07-27T00:00:00.000Z',
      updatedAt: '2026-07-27T00:00:00.000Z',
      activatedAt: '2026-07-27T00:00:00.000Z',
      archivedAt: null,
      schedule: null,
      sourceTemplateId: null,
      savedAt: null,
      sourceTemplateImageReference: null,
    };
    const parsed = trainingPlanSummarySchema.parse(ownPlan);
    expect(parsed.sourceTemplateId).toBeNull();
    expect(parsed.savedAt).toBeNull();
    expect(parsed.sourceTemplateImageReference).toBeNull();
  });
});

describe('training template user projection contract', () => {
  it.each([
    [null, false, false, true],
    [ids[4], false, false, true],
    [ids[4], true, false, true],
    [ids[4], false, true, true],
    [ids[4], true, true, true],
    [null, true, false, false],
    [null, false, true, false],
  ])('userPlanId=%s isSaved=%s isActive=%s -> valid=%s', (userPlanId, isSaved, isActive, valid) => {
    expect(trainingTemplateUserProjectionSchema.safeParse({
      isSaved, isActive, userPlanId,
    }).success).toBe(valid);
  });
});
