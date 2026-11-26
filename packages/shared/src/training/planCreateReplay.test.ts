import { describe, expect, it } from 'vitest';
import { createTrainingPlanInputSchema, updateTrainingPlanInputSchema } from './plans.js';
const key = '11111111-1111-4111-8111-111111111111';
const body = { name: 'Plan', weeklyGoal: 3, units: [{ logicalUnitKey: key, name: 'Pause', unitType: 'rest', orderIndex: 0, exercises: [] }] };
describe('B11 additive create request identity', () => {
  it('preserves a supplied UUID and normalizes existing defaults', () => {
    const input = createTrainingPlanInputSchema.parse({ ...body, idempotencyKey: key });
    expect(input.idempotencyKey).toBe(key); expect(input.activateImmediately).toBe(false);
  });
  it('continues accepting legacy creates without pretending they have an identity', () => {
    expect(createTrainingPlanInputSchema.parse(body).idempotencyKey).toBeUndefined();
  });
  it.each(['bad', '', null, 123])('rejects an invalid identity %j', (idempotencyKey) => {
    expect(createTrainingPlanInputSchema.safeParse({ ...body, idempotencyKey }).success).toBe(false);
  });
  it('does not widen the update or ownership contracts', () => {
    expect(createTrainingPlanInputSchema.safeParse({ ...body, idempotencyKey: key, userId: key }).success).toBe(false);
    expect(updateTrainingPlanInputSchema.safeParse({ name: body.name, units: body.units, expectedVersion: 1, idempotencyKey: key }).success).toBe(false);
  });
});
