import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { createTrainingPlanRepository } from '../src/modules/trainingPlans/trainingPlanRepository.js';
import { createTrainingPlanInputSchema } from '@grow/shared';

const owner = randomUUID();
const input = () => ({ name: 'B11', weeklyGoal: 3, activateImmediately: false,
  idempotencyKey: randomUUID(), units: [{ logicalUnitKey: randomUUID(), name: 'Pause', unitType: 'rest' as const, orderIndex: 0, exercises: [] }] });
function database() {
  const requests = new Map<string, { plan_id: string; request_fingerprint: string }>();
  const plans: string[] = [];
  const query = vi.fn(async (sql: string, values: unknown[] = []) => {
    if (sql.includes('insert into public.training_plan_create_requests_v2')) {
      const key = `${values[0]}:${values[1]}`;
      if (requests.has(key)) return { rows: [] };
      const record = { plan_id: randomUUID(), request_fingerprint: String(values[2]) };
      requests.set(key, record); return { rows: [record] };
    }
    if (sql.includes('from public.training_plan_create_requests_v2')) return { rows: [requests.get(`${values[0]}:${values[1]}`)] };
    if (sql.includes('insert into public.training_plans_v2(')) {
      const id = typeof values[3] === 'string' ? values[3] : randomUUID();
      plans.push(id); return { rows: [{ id }] };
    }
    if (sql.includes('returning id')) return { rows: [{ id: randomUUID() }] };
    return { rows: [] };
  });
  return { plans, repository: createTrainingPlanRepository({ connect: async () => ({ query, release() {} }) } as never) };
}
describe('B11 create replay', () => {
  it('retries a committed create after its response was lost without inserting another plan', async () => {
    const db = database(); const request = input();
    let committed: string | undefined;
    await expect((async () => { committed = await db.repository.create(owner, request); throw new Error('response lost after commit'); })()).rejects.toThrow('response lost');
    const replay = await db.repository.create(owner, structuredClone(request));
    expect(replay).toBe(committed); expect(db.plans).toHaveLength(1);
  });
  it('allows an explicitly new operation with identical content', async () => {
    const db = database(); const request = input();
    const first = await db.repository.create(owner, request);
    const second = await db.repository.create(owner, { ...request, idempotencyKey: randomUUID() });
    expect(second).not.toBe(first); expect(db.plans).toHaveLength(2);
  });
  it('rejects changed content under the same owner/key before any second plan insert', async () => {
    const db = database(); const request = input(); await db.repository.create(owner, request);
    await expect(db.repository.create(owner, { ...request, name: 'changed' })).rejects.toMatchObject({ name: 'TrainingPlanCreateConflictError' });
    expect(db.plans).toHaveLength(1);
  });
  it('scopes the key to the authenticated owner', async () => {
    const db = database(); const request = input();
    const first = await db.repository.create(owner, request);
    expect(await db.repository.create(randomUUID(), request)).not.toBe(first);
  });
  it('accepts optional UUID keys while preserving strict legacy and update contracts', () => {
    expect(createTrainingPlanInputSchema.safeParse(input()).success).toBe(true);
    expect(createTrainingPlanInputSchema.safeParse({ ...input(), idempotencyKey: 'bad' }).success).toBe(false);
    const { idempotencyKey: _key, ...legacy } = input();
    expect(createTrainingPlanInputSchema.safeParse(legacy).success).toBe(true);
  });
});
