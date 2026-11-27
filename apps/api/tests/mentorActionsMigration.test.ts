import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

async function migration() {
  return (await readFile(
    new URL('../../../supabase/migrations/20261127140000_mentor_actions.sql', import.meta.url),
    'utf8',
  )).toLowerCase();
}

describe('mentor actions migration', () => {
  it('is additive and only touches mentor_actions', async () => {
    const sql = await migration();
    expect(sql).not.toMatch(/\bdrop\s+(table|column|constraint|policy|function)\b/);
    expect(sql).not.toMatch(/\b(truncate|delete\s+from)\b/);
    expect(sql).not.toMatch(/\balter\s+table\s+public\.(?!mentor_actions)/);
  });

  it('is owner-bound, keeps an audit trail and is closed to clients', async () => {
    const sql = await migration();
    expect(sql).toContain('references auth.users(id) on delete cascade');
    expect(sql).toContain('references public.mentor_conversations(id) on delete set null');
    expect(sql).toContain('references public.mentor_messages(id) on delete set null');
    expect(sql).toContain("'proposed', 'executing', 'executed', 'rejected', 'failed', 'expired'");
    expect(sql).toContain('alter table public.mentor_actions enable row level security');
    expect(sql).toContain('revoke all on table public.mentor_actions from anon, authenticated');
    expect(sql).not.toMatch(/grant[^;]*to[^;]*\b(anon|authenticated)\b/);
    expect(sql).not.toContain('create policy');
  });
});
