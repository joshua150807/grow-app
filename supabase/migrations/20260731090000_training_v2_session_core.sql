-- Additive persistence for terminal Training V2 sessions ('completed' | 'incomplete' — see
-- persistedSessionStatusSchema). No server-side in-progress status is ever stored: a session
-- is only ever written once, fully formed, by the API's atomic save-session service. Nothing
-- here alters training_plan_cycle_states_v2 (its 'session_completed' trigger value already
-- exists from 20260726180000) or any legacy training_* table.
--
-- Historical-snapshot design: plan_id / plan_revision_id / source_unit_id are informational
-- backlinks only (`on delete set null`) — a session must keep meaning what it meant even
-- after the source plan is edited (new revision) or hard-deleted (own plans can be). The
-- actually-performed plan name, revision number, unit name/type and every exercise's name
-- and main muscle are therefore copied onto the session rows themselves at save time, not
-- just referenced. Session-internal child rows (exercises, sets) use the same
-- ownership-enforcing composite-FK style as the plan tables, since tenant isolation across
-- that internal chain does matter structurally.

create table public.training_sessions_v2 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid references public.training_plans_v2(id) on delete set null,
  plan_revision_id uuid references public.training_plan_revisions_v2(id) on delete set null,
  source_unit_id uuid references public.training_plan_units_v2(id) on delete set null,
  plan_name text not null check (char_length(btrim(plan_name)) between 1 and 120),
  revision_number integer not null check (revision_number >= 1),
  logical_unit_key uuid not null,
  unit_name text not null check (char_length(btrim(unit_name)) between 1 and 120),
  unit_type text not null check (unit_type in ('strength', 'run', 'rest', 'mobility', 'stretching')),
  status text not null check (status in ('completed', 'incomplete')),
  idempotency_key uuid not null,
  -- sha256 hex digest of the full, canonicalized save-session request (see
  -- trainingSessionFingerprint.ts) -- lets a replay of the same idempotency key be verified
  -- as the same request, not merely assumed: a matching fingerprint returns the existing
  -- session, a differing one is rejected as a conflict instead of silently reusing stale data.
  request_fingerprint text not null check (char_length(request_fingerprint) = 64),
  created_at timestamptz not null default now(),
  constraint training_sessions_v2_id_user_key unique (id, user_id),
  constraint training_sessions_v2_user_idempotency_key_key unique (user_id, idempotency_key)
);

create table public.training_session_exercises_v2 (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid not null,
  exercise_id uuid not null references public.training_exercises_v2(id),
  exercise_name text not null check (char_length(btrim(exercise_name)) between 1 and 120),
  exercise_main_muscle text,
  source_target_exercise_id uuid references public.training_plan_exercises_v2(id) on delete set null,
  logical_target_exercise_key uuid,
  order_index integer not null check (order_index >= 0),
  note text,
  created_at timestamptz not null default now(),
  constraint training_session_exercises_v2_session_fkey
    foreign key (session_id, user_id)
    references public.training_sessions_v2(id, user_id) on delete cascade,
  constraint training_session_exercises_v2_id_session_user_key
    unique (id, session_id, user_id),
  constraint training_session_exercises_v2_position_key
    unique (session_id, order_index)
);

create table public.training_session_sets_v2 (
  id uuid primary key default gen_random_uuid(),
  session_exercise_id uuid not null,
  session_id uuid not null,
  user_id uuid not null,
  client_set_id uuid not null,
  logical_target_set_key uuid,
  order_index integer not null check (order_index >= 0),
  set_type text not null check (set_type in ('warmup', 'work', 'drop')),
  weight_kg numeric check (
    weight_kg is null
    or (weight_kg <> 'NaN'::numeric and weight_kg >= 0)
  ),
  reps integer check (reps is null or reps > 0),
  rir integer check (rir is null or rir between 0 and 10),
  note text,
  completed_at timestamptz not null,
  actual_rest_seconds integer check (actual_rest_seconds is null or actual_rest_seconds >= 0),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  constraint training_session_sets_v2_exercise_fkey
    foreign key (session_exercise_id, session_id, user_id)
    references public.training_session_exercises_v2(id, session_id, user_id) on delete cascade,
  constraint training_session_sets_v2_position_key
    unique (session_exercise_id, order_index),
  constraint training_session_sets_v2_client_set_id_key
    unique (session_exercise_id, client_set_id)
);

create index training_sessions_v2_user_created_at_idx
  on public.training_sessions_v2(user_id, created_at desc);
create index training_sessions_v2_plan_id_idx
  on public.training_sessions_v2(plan_id) where plan_id is not null;
create index training_session_exercises_v2_session_order_idx
  on public.training_session_exercises_v2(session_id, order_index);
create index training_session_sets_v2_exercise_order_idx
  on public.training_session_sets_v2(session_exercise_id, order_index);

-- A session is a terminal record: once saved it is never patched by application code (no
-- live per-set editing -- that is explicitly out of scope). Guarded the same defense-in-depth
-- way as plan/template revision content, but with its own, correctly-worded function rather
-- than reusing prevent_training_v2_revision_update(), whose message is specific to revisions.
--
-- One narrow, structural exception: `on delete set null` on the historical backlink columns
-- (training_sessions_v2.plan_id/plan_revision_id/source_unit_id,
-- training_session_exercises_v2.source_target_exercise_id -- see the design note above) is
-- itself implemented by Postgres as an UPDATE on the referencing row, which a blanket
-- BEFORE UPDATE trigger would otherwise block, making a session permanently undeletable-from
-- the moment its source plan is deleted. This function allows exactly that: a change is only
-- ever let through when every changed column is one of this table's own backlink columns and
-- its new value is null; any other change -- to any snapshot field, or setting a backlink to
-- anything other than null -- still raises, so the row's actual historical content stays as
-- immutable as before.
create function public.prevent_training_v2_session_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  allowed_null_columns text[] := case tg_table_name
    when 'training_sessions_v2' then array['plan_id', 'plan_revision_id', 'source_unit_id']
    when 'training_session_exercises_v2' then array['source_target_exercise_id']
    else array[]::text[]
  end;
  changed_key text;
begin
  for changed_key in select key from jsonb_each(to_jsonb(new)) loop
    if to_jsonb(old) -> changed_key is distinct from to_jsonb(new) -> changed_key then
      if not (
        changed_key = any(allowed_null_columns)
        and to_jsonb(new) -> changed_key = 'null'::jsonb
      ) then
        raise exception 'training sessions are immutable once recorded'
          using errcode = '55000';
      end if;
    end if;
  end loop;
  return new;
end;
$$;

create trigger training_sessions_v2_immutable
before update on public.training_sessions_v2
for each row execute function public.prevent_training_v2_session_update();
create trigger training_session_exercises_v2_immutable
before update on public.training_session_exercises_v2
for each row execute function public.prevent_training_v2_session_update();
create trigger training_session_sets_v2_immutable
before update on public.training_session_sets_v2
for each row execute function public.prevent_training_v2_session_update();

revoke all on function public.prevent_training_v2_session_update() from public, anon, authenticated;

alter table public.training_sessions_v2 enable row level security;
alter table public.training_session_exercises_v2 enable row level security;
alter table public.training_session_sets_v2 enable row level security;

revoke all on table
  public.training_sessions_v2,
  public.training_session_exercises_v2,
  public.training_session_sets_v2
from public, anon, authenticated;

grant select, insert, update, delete on table
  public.training_sessions_v2,
  public.training_session_exercises_v2,
  public.training_session_sets_v2
to service_role;
