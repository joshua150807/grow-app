import { createHash } from 'node:crypto';
import { createTrainingPlanInputSchema, type CreateTrainingPlanInput } from '@grow/shared/src/training/plans.js';

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) {
    const ordered = value.every((item) => item && typeof item === 'object' && 'orderIndex' in item)
      ? [...value].sort((a, b) => a.orderIndex - b.orderIndex) : value;
    return ordered.map(canonical);
  }
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.entries(value).sort(([a], [b]) => a === b ? 0 : a < b ? -1 : 1).map(([key, item]) => [key, canonical(item)]),
  );
  return value;
}

export function fingerprintTrainingPlanCreate(input: CreateTrainingPlanInput): string {
  const { idempotencyKey: _key, ...body } = createTrainingPlanInputSchema.parse(input);
  return createHash('sha256').update('training-plan-create:v1\n').update(JSON.stringify(canonical(body))).digest('hex');
}

export class TrainingPlanCreateConflictError extends Error {
  constructor() {
    super('This create key was already used with different plan content.');
    this.name = 'TrainingPlanCreateConflictError';
  }
}
