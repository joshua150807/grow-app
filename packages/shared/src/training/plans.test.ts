import { describe, expect, it } from 'vitest';
import {
  createTrainingPlanInputSchema,
  scheduleTrainingPlanInputSchema,
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

describe('training plan API contracts', () => {
  it('accepts a complete plan and defaults immediate activation to false', () => {
    expect(createTrainingPlanInputSchema.parse(planInput()).activateImmediately).toBe(false);
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
});
