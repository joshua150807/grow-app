do $$
begin
  if exists (
    select 1
    from public.training_exercises_v2
    where scope = 'system'
  ) then
    raise exception
      'training V2 A1 requires an authoritative system-key mapping before migrating existing system exercises'
      using errcode = '55000';
  end if;
end;
$$;

alter table public.training_exercises_v2
  add column system_key text,
  add column equipment text[] not null default '{}';

alter table public.training_exercises_v2
  add constraint training_exercises_v2_scope_system_key_check check (
    (scope = 'system' and system_key is not null)
    or (scope = 'user' and system_key is null)
  ),
  add constraint training_exercises_v2_system_key_format_check check (
    system_key is null
    or (
      system_key = btrim(system_key)
      and char_length(system_key) between 1 and 120
      and system_key ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'
    )
  );

create function public.is_training_v2_clean_text_array(items text[])
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select
    count(*) = count(item)
    and coalesce(bool_and(
      item = btrim(item, ' ' || chr(9) || chr(10) || chr(13) || chr(12) || chr(11))
      and item <> ''
    ), true)
    and count(*) = count(distinct item)
  from unnest(items) as item;
$$;

alter table public.training_exercises_v2
  add constraint training_exercises_v2_equipment_check
  check (public.is_training_v2_clean_text_array(equipment));

create unique index training_exercises_v2_system_key_idx
  on public.training_exercises_v2(system_key)
  where scope = 'system';

create index training_exercises_v2_active_system_name_idx
  on public.training_exercises_v2(lower(name), id)
  where scope = 'system' and status = 'active';

create index training_exercises_v2_active_user_name_idx
  on public.training_exercises_v2(owner_user_id, lower(name), id)
  where scope = 'user' and status = 'active';

create index training_exercises_v2_supporting_muscles_gin_idx
  on public.training_exercises_v2 using gin(supporting_muscles);

create index training_exercises_v2_equipment_gin_idx
  on public.training_exercises_v2 using gin(equipment);

create function public.prevent_training_v2_exercise_identity_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.scope is distinct from old.scope
    or new.owner_user_id is distinct from old.owner_user_id
    or new.system_key is distinct from old.system_key
  then
    raise exception 'training exercise identity is immutable'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

create trigger training_exercises_v2_identity_immutable
before update on public.training_exercises_v2
for each row execute function public.prevent_training_v2_exercise_identity_update();

revoke all on function public.is_training_v2_clean_text_array(text[])
  from public, anon, authenticated;
revoke all on function public.prevent_training_v2_exercise_identity_update()
  from public, anon, authenticated;
grant execute on function public.is_training_v2_clean_text_array(text[])
  to service_role;
