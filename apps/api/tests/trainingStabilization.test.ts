import { describe, expect, it, vi } from 'vitest';
import { createTrainingPlanRepository } from '../src/modules/trainingPlans/trainingPlanRepository.js';

describe('training stabilization B04 and B05', () => {
  it('projects the next strength unit relative to the cycle position, with wraparound', async () => {
    const query = vi.fn(async (_sql: string, _params?: unknown[]) => ({ rows: [] }));
    const repository = createTrainingPlanRepository({ query } as never);
    await repository.list('owner');
    const sql = query.mock.calls[0]![0];
    expect(sql).toMatch(/order by\s+case when unit.order_index >= coalesce\(cycle.next_order_index, 0\)/);
    expect(sql).toContain("and unit.unit_type='strength'");
  });

  it('refuses mutation of a template-derived user plan under the existing plan lock', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('select plan.version')) return { rows: [{
        version: 1, current_revision_id: 'revision', revision_number: 1,
        source_template_revision_id: 'template-revision', source_template_id: 'template',
      }] };
      return { rows: [], rowCount: 0 };
    });
    const release = vi.fn();
    const repository = createTrainingPlanRepository({ connect: async () => ({ query, release }) } as never);
    const result = await repository.update('owner', 'plan', { expectedVersion: 1, name: 'changed', units: [] });
    expect(result).toEqual({ outcome: 'status_conflict' });
    expect(query.mock.calls.some(([sql]) => /insert into|update public/.test(sql))).toBe(false);
    expect(release).toHaveBeenCalledOnce();
  });
});
