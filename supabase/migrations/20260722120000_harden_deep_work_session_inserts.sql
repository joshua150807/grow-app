drop policy if exists "Grow deep work sessions insert own"
on public.deep_work_sessions;

revoke insert on table public.deep_work_sessions from authenticated;

grant insert, select on table public.deep_work_sessions to service_role;
