create table public.deep_work_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_session_id text not null,
  duration_seconds integer not null,
  completed_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint deep_work_sessions_client_session_id_not_blank_check
    check (char_length(btrim(client_session_id)) > 0),
  constraint deep_work_sessions_client_session_id_length_check
    check (char_length(client_session_id) <= 128),
  constraint deep_work_sessions_duration_seconds_check
    check (duration_seconds > 0 and duration_seconds <= 86340),
  constraint deep_work_sessions_user_client_session_id_key
    unique (user_id, client_session_id)
);

create index deep_work_sessions_user_completed_at_idx
  on public.deep_work_sessions (user_id, completed_at desc);

alter table public.deep_work_sessions enable row level security;

create policy "Grow deep work sessions select own"
on public.deep_work_sessions
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Grow deep work sessions insert own"
on public.deep_work_sessions
for insert
to authenticated
with check ((select auth.uid()) = user_id);
