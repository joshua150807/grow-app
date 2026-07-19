import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const migrationUrl = new URL(
  '../../../supabase/migrations/20260719222502_todo_completion_events.sql',
  import.meta.url,
);

describe('todo completion events migration', () => {
  it('is additive, trigger-managed and contains no unsafe backfill', async () => {
    const sql = (await readFile(migrationUrl, 'utf8')).toLowerCase();

    expect(sql).toContain('create table public.todo_completion_events');
    expect(sql).toContain('todo_id uuid not null');
    expect(sql).toContain('unique (user_id, todo_id)');
    expect(sql).toContain('after insert or update of completed on public.todos');
    expect(sql).toContain('on conflict (user_id, todo_id) do nothing');
    expect(sql).toContain("security definer\nset search_path = ''");
    expect(sql).toContain('alter table public.todo_completion_events enable row level security');
    expect(sql).not.toContain('references public.todos');
    expect(sql).not.toContain('insert into public.todo_completion_events select');
    expect(sql).not.toMatch(/\bdrop\s+(table|column)\b/);
    expect(sql).not.toMatch(/\b(update|delete)\s+public\.todos\b/);
  });
});
