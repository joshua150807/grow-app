-- Creator System V1
--
-- This migration prepares creator applications, creator status, and the atomic
-- review RPC used by the Grow backend.
--
-- Important security boundary:
-- The backend must verify Supabase JWTs and call requireAdminOrCeo before
-- invoking public.review_creator_application. This RPC intentionally accepts
-- input_reviewer_id because backend authorization is the source of truth for
-- admin/CEO actions.

create extension if not exists pgcrypto;

create or replace function public.creator_system_jsonb_is_string_array(input jsonb)
returns boolean
language sql
immutable
as $$
  select
    input is not null
    and jsonb_typeof(input) = 'array'
    and coalesce(
      (
        select bool_and(jsonb_typeof(item.value) = 'string')
        from jsonb_array_elements(input) as item(value)
      ),
      true
    );
$$;

create table if not exists public.creator_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  motivation text not null,
  experience text,
  content_focus text,
  social_links jsonb,

  status text not null default 'pending',
  rejection_reason text,

  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint creator_applications_status_check
    check (status in ('pending', 'requested', 'approved', 'rejected')),

  constraint creator_applications_motivation_length_check
    check (char_length(trim(motivation)) between 20 and 1000),

  constraint creator_applications_experience_length_check
    check (experience is null or char_length(trim(experience)) between 1 and 1000),

  constraint creator_applications_content_focus_length_check
    check (content_focus is null or char_length(trim(content_focus)) between 1 and 300),

  constraint creator_applications_rejection_reason_length_check
    check (rejection_reason is null or char_length(trim(rejection_reason)) between 1 and 500),

  constraint creator_applications_rejected_reason_check
    check (status <> 'rejected' or rejection_reason is not null),

  constraint creator_applications_review_fields_check
    check (
      (
        status in ('pending', 'requested')
        and reviewed_by is null
        and reviewed_at is null
      )
      or
      (
        status in ('approved', 'rejected')
        and reviewed_by is not null
        and reviewed_at is not null
      )
    ),

  constraint creator_applications_social_links_array_check
    check (
      social_links is null
      or (
        public.creator_system_jsonb_is_string_array(social_links)
        and jsonb_array_length(social_links) <= 5
      )
    )
);

create unique index if not exists creator_applications_one_open_per_user_idx
  on public.creator_applications (user_id)
  where status in ('pending', 'requested');

create index if not exists creator_applications_user_created_idx
  on public.creator_applications (user_id, created_at desc);

create index if not exists creator_applications_status_created_idx
  on public.creator_applications (status, created_at desc);

create index if not exists creator_applications_reviewed_by_idx
  on public.creator_applications (reviewed_by)
  where reviewed_by is not null;

create table if not exists public.creators (
  user_id uuid primary key references auth.users(id) on delete cascade,

  status text not null default 'approved',
  approved_application_id uuid references public.creator_applications(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz not null default now(),

  suspended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint creators_status_check
    check (status in ('approved', 'suspended')),

  constraint creators_suspended_at_check
    check (
      (status = 'suspended' and suspended_at is not null)
      or
      (status = 'approved' and suspended_at is null)
    )
);

create index if not exists creators_status_idx
  on public.creators (status);

create or replace function public.set_creator_system_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_creator_applications_updated_at on public.creator_applications;
create trigger set_creator_applications_updated_at
before update on public.creator_applications
for each row
execute function public.set_creator_system_updated_at();

drop trigger if exists set_creators_updated_at on public.creators;
create trigger set_creators_updated_at
before update on public.creators
for each row
execute function public.set_creator_system_updated_at();

alter table public.creator_applications enable row level security;
alter table public.creators enable row level security;

drop policy if exists "Users can read own creator applications" on public.creator_applications;
create policy "Users can read own creator applications"
on public.creator_applications
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can create own creator applications" on public.creator_applications;
create policy "Users can create own creator applications"
on public.creator_applications
for insert
to authenticated
with check (
  auth.uid() = user_id
  and status in ('pending', 'requested')
  and reviewed_by is null
  and reviewed_at is null
  and not exists (
    select 1
    from public.creators c
    where c.user_id = auth.uid()
  )
);

drop policy if exists "Admins can read creator applications" on public.creator_applications;
create policy "Admins can read creator applications"
on public.creator_applications
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'ceo')
  )
);

drop policy if exists "Users can read own creator status" on public.creators;
create policy "Users can read own creator status"
on public.creators
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Admins can read creators" on public.creators;
create policy "Admins can read creators"
on public.creators
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'ceo')
  )
);

create or replace function public.review_creator_application(
  input_application_id uuid,
  input_decision text,
  input_rejection_reason text default null,
  input_reviewer_id uuid default null
)
returns public.creator_applications
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  application_row public.creator_applications;
  updated_application public.creator_applications;
begin
  if input_reviewer_id is null then
    raise exception 'input_reviewer_id is required.'
      using errcode = '22023';
  end if;

  if input_decision not in ('approved', 'rejected') then
    raise exception 'Invalid creator application decision.'
      using errcode = '22023';
  end if;

  if input_decision = 'rejected'
     and (
       input_rejection_reason is null
       or char_length(trim(input_rejection_reason)) = 0
     ) then
    raise exception 'rejection_reason is required when rejecting.'
      using errcode = '22023';
  end if;

  select *
    into application_row
  from public.creator_applications
  where id = input_application_id
  for update;

  if not found then
    raise exception 'Creator application not found.'
      using errcode = 'P0002';
  end if;

  if application_row.status in ('approved', 'rejected') then
    raise exception 'Creator application has already been reviewed.'
      using errcode = '23505';
  end if;

  update public.creator_applications
  set
    status = input_decision,
    rejection_reason = case
      when input_decision = 'rejected' then trim(input_rejection_reason)
      else null
    end,
    reviewed_by = input_reviewer_id,
    reviewed_at = now()
  where id = input_application_id
  returning *
  into updated_application;

  if input_decision = 'approved' then
    insert into public.creators (
      user_id,
      status,
      approved_application_id,
      approved_by,
      approved_at,
      suspended_at
    )
    values (
      updated_application.user_id,
      'approved',
      updated_application.id,
      input_reviewer_id,
      now(),
      null
    )
    on conflict (user_id) do update
    set
      status = 'approved',
      approved_application_id = excluded.approved_application_id,
      approved_by = excluded.approved_by,
      approved_at = excluded.approved_at,
      suspended_at = null,
      updated_at = now();
  end if;

  return updated_application;
end;
$$;

comment on function public.review_creator_application(uuid, text, text, uuid)
  is 'Backend-only creator review RPC. Backend must verify admin/CEO with requireAdminOrCeo before calling. Uses input_reviewer_id instead of auth.uid().';

revoke all on function public.review_creator_application(uuid, text, text, uuid) from public;
revoke all on function public.review_creator_application(uuid, text, text, uuid) from anon;
revoke all on function public.review_creator_application(uuid, text, text, uuid) from authenticated;
grant execute on function public.review_creator_application(uuid, text, text, uuid) to service_role;
