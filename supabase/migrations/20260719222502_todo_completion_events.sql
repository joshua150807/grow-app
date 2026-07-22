create table public.todo_completion_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  todo_id uuid not null,
  completed_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint todo_completion_events_user_todo_key unique (user_id, todo_id)
);

create index todo_completion_events_user_completed_at_idx
  on public.todo_completion_events (user_id, completed_at desc);

alter table public.todo_completion_events enable row level security;

create function public.record_todo_first_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.completed is true
    and (tg_op = 'INSERT' or old.completed is distinct from true)
  then
    insert into public.todo_completion_events (user_id, todo_id, completed_at)
    values (new.user_id, new.id, clock_timestamp())
    on conflict (user_id, todo_id) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function public.record_todo_first_completion() from public;

create trigger record_todo_first_completion_trigger
after insert or update of completed on public.todos
for each row
execute function public.record_todo_first_completion();
