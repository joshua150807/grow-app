import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

async function migration() {
  return (await readFile(
    new URL('../../../supabase/migrations/20261127130000_mentor_memories.sql', import.meta.url),
    'utf8',
  )).toLowerCase();
}

describe('mentor memories migration', () => {
  it('is additive and only touches mentor_memories', async () => {
    const sql = await migration();
    expect(sql).not.toMatch(/\bdrop\s+(table|column|constraint|policy|function)\b/);
    expect(sql).not.toMatch(/\b(truncate|delete\s+from)\b/);
    expect(sql).not.toMatch(/\balter\s+table\s+public\.(?!mentor_memories)/);
  });

  it('is owner-bound, constrained and closed to clients', async () => {
    const sql = await migration();
    expect(sql).toContain('references auth.users(id) on delete cascade');
    expect(sql).toContain('references public.mentor_messages(id) on delete set null');
    expect(sql).toContain("status in ('active', 'resolved')");
    expect(sql).toContain('char_length(btrim(content)) between 1 and 300');
    expect(sql).toContain('alter table public.mentor_memories enable row level security');
    expect(sql).toContain('revoke all on table public.mentor_memories from anon, authenticated');
    expect(sql).not.toMatch(/grant[^;]*to[^;]*\b(anon|authenticated)\b/);
    expect(sql).not.toContain('create policy');
  });
});
