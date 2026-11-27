import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const migrationUrl = new URL(
  '../../../supabase/migrations/20261127120000_mentor_foundation.sql',
  import.meta.url,
);

const mentorTables = [
  'mentor_conversations',
  'mentor_messages',
  'mentor_usage_daily',
  'mentor_settings',
];

async function migration() {
  return (await readFile(migrationUrl, 'utf8')).toLowerCase();
}

describe('mentor foundation migration', () => {
  it('is additive and does not touch existing tables', async () => {
    const sql = await migration();
    expect(sql).not.toMatch(/\bdrop\s+(table|column|constraint|policy|function)\b/);
    expect(sql).not.toMatch(/\btruncate\b/);
    expect(sql).not.toMatch(/\bdelete\s+from\b/);
    expect(sql).not.toMatch(/\balter\s+table\s+public\.(?!mentor_)/);
    expect(sql).not.toMatch(/\b(insert\s+into|update)\s+public\.(?!mentor_)/);
  });

  it('creates every mentor table owned by auth.users with cascade delete', async () => {
    const sql = await migration();
    for (const table of mentorTables) {
      expect(sql).toContain(`create table public.${table}`);
    }
    expect(sql.match(/references auth\.users\(id\) on delete cascade/g)).toHaveLength(4);
  });

  it('binds messages to a conversation of the same user', async () => {
    const sql = await migration();
    expect(sql).toContain('mentor_conversations_id_user_id_key unique (id, user_id)');
    expect(sql).toContain('foreign key (conversation_id, user_id)');
    expect(sql).toContain('references public.mentor_conversations(id, user_id)');
    expect(sql).toContain("role in ('user', 'assistant')");
    expect(sql).toContain('char_length(btrim(content)) between 1 and 20000');
  });

  it('enables RLS and grants nothing to anon or authenticated', async () => {
    const sql = await migration();
    for (const table of mentorTables) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toContain(`revoke all on table public.${table} from anon, authenticated`);
      expect(sql).toContain(`grant all on table public.${table} to service_role`);
    }
    expect(sql).not.toMatch(/grant[^;]*to[^;]*\b(anon|authenticated)\b/);
    expect(sql).not.toContain('create policy');
  });

  it('hardens trigger functions', async () => {
    const sql = await migration();
    expect(sql.match(/set search_path = ''/g)).toHaveLength(2);
    expect(sql.match(/from public, anon, authenticated/g)).toHaveLength(2);
    expect(sql).not.toContain('security definer');
  });
});
