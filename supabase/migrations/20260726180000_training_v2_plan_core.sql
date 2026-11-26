create table public.training_exercises_v2 (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('system', 'user')),
  owner_user_id uuid references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'archived', 'unpublished')),
  category text not null check (category in ('strength', 'cardio', 'mobility', 'stretching')),
  load_type text not null check (load_type in (
    'total_weight', 'per_hand', 'per_side', 'added_weight_only',
    'bodyweight_only', 'no_weight_tracking'
  )),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  main_muscle text,
  supporting_muscles text[] not null default '{}',
  difficulty text check (difficulty is null or char_length(btrim(difficulty)) between 1 and 50),
  is_home boolean not null default false,
  is_gym boolean not null default false,
  is_bodyweight boolean not null default false,
  image_reference text,
  execution_instructions text,
  common_mistakes text,
  safety_notes text,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint training_exercises_v2_scope_owner_check check (
    (scope = 'system' and owner_user_id is null)
    or (scope = 'user' and owner_user_id is not null)
  ),
  constraint training_exercises_v2_private_status_check check (
    scope = 'system' or status in ('active', 'archived')
  ),
  constraint training_exercises_v2_id_scope_owner_key
    unique nulls not distinct (id, scope, owner_user_id)
);

create table public.training_exercise_alternatives_v2 (
  exercise_id uuid not null references public.training_exercises_v2(id) on delete cascade,
  alternative_exercise_id uuid not null references public.training_exercises_v2(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (exercise_id, alternative_exercise_id),
  constraint training_exercise_alternatives_v2_not_self_check
    check (exercise_id <> alternative_exercise_id)
);

create table public.training_templates_v2 (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text,
  status text not null default 'unpublished'
    check (status in ('active', 'archived', 'unpublished')),
  current_revision_id uuid,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.training_template_revisions_v2 (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.training_templates_v2(id) on delete cascade,
  revision_number integer not null check (revision_number >= 1),
  created_at timestamptz not null default now(),
  constraint training_template_revisions_v2_id_template_key unique (id, template_id),
  constraint training_template_revisions_v2_template_revision_key
    unique (template_id, revision_number)
);

alter table public.training_templates_v2
  add constraint training_templates_v2_current_revision_fkey
  foreign key (current_revision_id, id)
  references public.training_template_revisions_v2(id, template_id);

create table public.training_template_units_v2 (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null,
  template_id uuid not null,
  logical_unit_key uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  unit_type text not null check (unit_type in ('strength', 'run', 'rest', 'mobility', 'stretching')),
  order_index integer not null check (order_index >= 0),
  created_at timestamptz not null default now(),
  constraint training_template_units_v2_revision_fkey
    foreign key (revision_id, template_id)
    references public.training_template_revisions_v2(id, template_id) on delete cascade,
  constraint training_template_units_v2_id_revision_template_key
    unique (id, revision_id, template_id),
  constraint training_template_units_v2_logical_key
    unique (revision_id, logical_unit_key),
  constraint training_template_units_v2_position_key
    unique (revision_id, order_index)
);

create table public.training_template_exercises_v2 (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null,
  revision_id uuid not null,
  template_id uuid not null,
  exercise_id uuid not null,
  exercise_scope text not null default 'system' check (exercise_scope = 'system'),
  exercise_owner_user_id uuid,
  logical_target_exercise_key uuid not null,
  order_index integer not null check (order_index >= 0),
  note text,
  created_at timestamptz not null default now(),
  constraint training_template_exercises_v2_unit_fkey
    foreign key (unit_id, revision_id, template_id)
    references public.training_template_units_v2(id, revision_id, template_id) on delete cascade,
  constraint training_template_exercises_v2_exercise_owner_fkey
    foreign key (exercise_id, exercise_scope, exercise_owner_user_id)
    references public.training_exercises_v2(id, scope, owner_user_id),
  constraint training_template_exercises_v2_system_exercise_check
    check (exercise_scope = 'system' and exercise_owner_user_id is null),
  constraint training_template_exercises_v2_id_unit_revision_template_key
    unique (id, unit_id, revision_id, template_id),
  constraint training_template_exercises_v2_logical_key
    unique (unit_id, logical_target_exercise_key),
  constraint training_template_exercises_v2_position_key
    unique (unit_id, order_index)
);

create table public.training_template_target_sets_v2 (
  id uuid primary key default gen_random_uuid(),
  target_exercise_id uuid not null,
  unit_id uuid not null,
  revision_id uuid not null,
  template_id uuid not null,
  logical_target_set_key uuid not null,
  order_index integer not null check (order_index >= 0),
  set_type text not null check (set_type in ('warmup', 'work', 'drop')),
  target_weight_kg numeric check (
    target_weight_kg is null
    or (target_weight_kg <> 'NaN'::numeric and target_weight_kg >= 0)
  ),
  target_reps_min integer check (target_reps_min is null or target_reps_min > 0),
  target_reps_max integer check (target_reps_max is null or target_reps_max > 0),
  target_rir integer check (target_rir is null or target_rir between 0 and 10),
  planned_rest_seconds integer not null default 0 check (planned_rest_seconds >= 0),
  created_at timestamptz not null default now(),
  constraint training_template_target_sets_v2_target_exercise_fkey
    foreign key (target_exercise_id, unit_id, revision_id, template_id)
    references public.training_template_exercises_v2(id, unit_id, revision_id, template_id)
    on delete cascade,
  constraint training_template_target_sets_v2_rep_range_check
    check (
      (target_reps_min is null and target_reps_max is null)
      or (
        target_reps_min is not null
        and target_reps_max is not null
        and target_reps_min <= target_reps_max
      )
    ),
  constraint training_template_target_sets_v2_logical_key
    unique (target_exercise_id, logical_target_set_key),
  constraint training_template_target_sets_v2_position_key
    unique (target_exercise_id, order_index)
);

create table public.training_plans_v2 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'active', 'archived')),
  current_revision_id uuid,
  version integer not null default 1 check (version >= 1),
  source_template_id uuid references public.training_templates_v2(id) on delete set null,
  legacy_plan_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  activated_at timestamptz,
  archived_at timestamptz,
  constraint training_plans_v2_id_user_key unique (id, user_id),
  constraint training_plans_v2_archive_state_check check (
    (status = 'archived' and archived_at is not null) or status <> 'archived'
  )
);

create table public.training_plan_revisions_v2 (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null,
  user_id uuid not null,
  revision_number integer not null check (revision_number >= 1),
  created_at timestamptz not null default now(),
  constraint training_plan_revisions_v2_plan_owner_fkey
    foreign key (plan_id, user_id)
    references public.training_plans_v2(id, user_id) on delete cascade,
  constraint training_plan_revisions_v2_id_plan_user_key
    unique (id, plan_id, user_id),
  constraint training_plan_revisions_v2_plan_revision_key
    unique (plan_id, revision_number)
);

alter table public.training_plans_v2
  add constraint training_plans_v2_current_revision_owner_fkey
  foreign key (current_revision_id, id, user_id)
  references public.training_plan_revisions_v2(id, plan_id, user_id);

create table public.training_plan_units_v2 (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null,
  plan_id uuid not null,
  user_id uuid not null,
  logical_unit_key uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  unit_type text not null check (unit_type in ('strength', 'run', 'rest', 'mobility', 'stretching')),
  order_index integer not null check (order_index >= 0),
  created_at timestamptz not null default now(),
  constraint training_plan_units_v2_revision_owner_fkey
    foreign key (revision_id, plan_id, user_id)
    references public.training_plan_revisions_v2(id, plan_id, user_id) on delete cascade,
  constraint training_plan_units_v2_id_revision_plan_user_key
    unique (id, revision_id, plan_id, user_id),
  constraint training_plan_units_v2_logical_key
    unique (revision_id, logical_unit_key),
  constraint training_plan_units_v2_position_key
    unique (revision_id, order_index)
);

create table public.training_plan_exercises_v2 (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null,
  revision_id uuid not null,
  plan_id uuid not null,
  user_id uuid not null,
  exercise_id uuid not null,
  exercise_scope text not null check (exercise_scope in ('system', 'user')),
  exercise_owner_user_id uuid,
  logical_target_exercise_key uuid not null,
  order_index integer not null check (order_index >= 0),
  note text,
  created_at timestamptz not null default now(),
  constraint training_plan_exercises_v2_unit_owner_fkey
    foreign key (unit_id, revision_id, plan_id, user_id)
    references public.training_plan_units_v2(id, revision_id, plan_id, user_id) on delete cascade,
  constraint training_plan_exercises_v2_exercise_owner_fkey
    foreign key (exercise_id, exercise_scope, exercise_owner_user_id)
    references public.training_exercises_v2(id, scope, owner_user_id),
  constraint training_plan_exercises_v2_exercise_scope_owner_check check (
    (exercise_scope = 'system' and exercise_owner_user_id is null)
    or (exercise_scope = 'user' and exercise_owner_user_id = user_id)
  ),
  constraint training_plan_exercises_v2_id_unit_revision_plan_user_key
    unique (id, unit_id, revision_id, plan_id, user_id),
  constraint training_plan_exercises_v2_logical_key
    unique (unit_id, logical_target_exercise_key),
  constraint training_plan_exercises_v2_position_key
    unique (unit_id, order_index)
);

create table public.training_plan_target_sets_v2 (
  id uuid primary key default gen_random_uuid(),
  target_exercise_id uuid not null,
  unit_id uuid not null,
  revision_id uuid not null,
  plan_id uuid not null,
  user_id uuid not null,
  logical_target_set_key uuid not null,
  order_index integer not null check (order_index >= 0),
  set_type text not null check (set_type in ('warmup', 'work', 'drop')),
  target_weight_kg numeric check (
    target_weight_kg is null
    or (target_weight_kg <> 'NaN'::numeric and target_weight_kg >= 0)
  ),
  target_reps_min integer check (target_reps_min is null or target_reps_min > 0),
  target_reps_max integer check (target_reps_max is null or target_reps_max > 0),
  target_rir integer check (target_rir is null or target_rir between 0 and 10),
  planned_rest_seconds integer not null default 0 check (planned_rest_seconds >= 0),
  imported_from_legacy_plan boolean not null default false,
  created_at timestamptz not null default now(),
  constraint training_plan_target_sets_v2_target_exercise_owner_fkey
    foreign key (target_exercise_id, unit_id, revision_id, plan_id, user_id)
    references public.training_plan_exercises_v2(id, unit_id, revision_id, plan_id, user_id)
    on delete cascade,
  constraint training_plan_target_sets_v2_rep_range_check
    check (
      (target_reps_min is null and target_reps_max is null)
      or (
        target_reps_min is not null
        and target_reps_max is not null
        and target_reps_min <= target_reps_max
      )
    ),
  constraint training_plan_target_sets_v2_logical_key
    unique (target_exercise_id, logical_target_set_key),
  constraint training_plan_target_sets_v2_position_key
    unique (target_exercise_id, order_index)
);

create table public.training_plan_activations_v2 (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null,
  revision_id uuid not null,
  user_id uuid not null,
  effective_at timestamptz not null,
  timezone text not null check (char_length(btrim(timezone)) between 1 and 255),
  status text not null default 'pending' check (status in ('pending', 'applied', 'cancelled')),
  expected_plan_version integer not null check (expected_plan_version >= 1),
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  cancelled_at timestamptz,
  constraint training_plan_activations_v2_plan_owner_fkey
    foreign key (plan_id, user_id)
    references public.training_plans_v2(id, user_id) on delete cascade,
  constraint training_plan_activations_v2_revision_owner_fkey
    foreign key (revision_id, plan_id, user_id)
    references public.training_plan_revisions_v2(id, plan_id, user_id),
  constraint training_plan_activations_v2_status_time_check check (
    (status = 'pending' and applied_at is null and cancelled_at is null)
    or (status = 'applied' and applied_at is not null and cancelled_at is null)
    or (status = 'cancelled' and cancelled_at is not null and applied_at is null)
  )
);

create table public.training_plan_cycle_states_v2 (
  plan_id uuid primary key,
  user_id uuid not null,
  revision_id uuid not null,
  next_unit_id uuid not null,
  next_order_index integer not null check (next_order_index >= 0),
  last_trigger text not null check (last_trigger in (
    'plan_activated', 'plan_reactivated', 'session_completed',
    'alternative_unit_completed', 'rest_completed', 'rest_skipped',
    'plan_revision_remapped'
  )),
  version integer not null default 1 check (version >= 1),
  advanced_at timestamptz not null default now(),
  constraint training_plan_cycle_states_v2_plan_owner_fkey
    foreign key (plan_id, user_id)
    references public.training_plans_v2(id, user_id) on delete cascade,
  constraint training_plan_cycle_states_v2_revision_owner_fkey
    foreign key (revision_id, plan_id, user_id)
    references public.training_plan_revisions_v2(id, plan_id, user_id),
  constraint training_plan_cycle_states_v2_next_unit_owner_fkey
    foreign key (next_unit_id, revision_id, plan_id, user_id)
    references public.training_plan_units_v2(id, revision_id, plan_id, user_id),
  constraint training_plan_cycle_states_v2_plan_user_key unique (plan_id, user_id)
);

create table public.training_weekly_goal_versions_v2 (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null,
  user_id uuid not null,
  target_sessions_per_week integer not null check (target_sessions_per_week > 0),
  effective_from timestamptz not null,
  created_at timestamptz not null default now(),
  constraint training_weekly_goal_versions_v2_plan_owner_fkey
    foreign key (plan_id, user_id)
    references public.training_plans_v2(id, user_id) on delete cascade,
  constraint training_weekly_goal_versions_v2_effective_key
    unique (plan_id, effective_from)
);

create unique index training_plans_v2_one_active_per_user_idx
  on public.training_plans_v2(user_id) where status = 'active';
create unique index training_plans_v2_one_scheduled_per_user_idx
  on public.training_plans_v2(user_id) where status = 'scheduled';
create unique index training_plan_activations_v2_one_pending_per_user_idx
  on public.training_plan_activations_v2(user_id) where status = 'pending';

create index training_exercises_v2_owner_status_idx
  on public.training_exercises_v2(owner_user_id, status);
create index training_exercises_v2_scope_category_idx
  on public.training_exercises_v2(scope, category);
create index training_template_units_v2_revision_order_idx
  on public.training_template_units_v2(revision_id, order_index);
create index training_template_exercises_v2_unit_order_idx
  on public.training_template_exercises_v2(unit_id, order_index);
create index training_template_target_sets_v2_exercise_order_idx
  on public.training_template_target_sets_v2(target_exercise_id, order_index);
create index training_plans_v2_user_status_idx
  on public.training_plans_v2(user_id, status);
create index training_plan_revisions_v2_plan_revision_idx
  on public.training_plan_revisions_v2(plan_id, revision_number);
create index training_plan_units_v2_revision_order_idx
  on public.training_plan_units_v2(revision_id, order_index);
create index training_plan_exercises_v2_unit_order_idx
  on public.training_plan_exercises_v2(unit_id, order_index);
create index training_plan_target_sets_v2_exercise_order_idx
  on public.training_plan_target_sets_v2(target_exercise_id, order_index);
create index training_plan_activations_v2_user_status_effective_idx
  on public.training_plan_activations_v2(user_id, status, effective_at);
create index training_weekly_goal_versions_v2_plan_effective_idx
  on public.training_weekly_goal_versions_v2(plan_id, effective_from desc);

create function public.set_training_v2_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger training_exercises_v2_set_updated_at
before update on public.training_exercises_v2
for each row execute function public.set_training_v2_updated_at();

create trigger training_templates_v2_set_updated_at
before update on public.training_templates_v2
for each row execute function public.set_training_v2_updated_at();

create trigger training_plans_v2_set_updated_at
before update on public.training_plans_v2
for each row execute function public.set_training_v2_updated_at();

create function public.prevent_training_v2_revision_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'training plan and template revisions are immutable'
    using errcode = '55000';
end;
$$;

create trigger training_template_revisions_v2_immutable
before update on public.training_template_revisions_v2
for each row execute function public.prevent_training_v2_revision_update();
create trigger training_template_units_v2_immutable
before update on public.training_template_units_v2
for each row execute function public.prevent_training_v2_revision_update();
create trigger training_template_exercises_v2_immutable
before update on public.training_template_exercises_v2
for each row execute function public.prevent_training_v2_revision_update();
create trigger training_template_target_sets_v2_immutable
before update on public.training_template_target_sets_v2
for each row execute function public.prevent_training_v2_revision_update();
create trigger training_plan_revisions_v2_immutable
before update on public.training_plan_revisions_v2
for each row execute function public.prevent_training_v2_revision_update();
create trigger training_plan_units_v2_immutable
before update on public.training_plan_units_v2
for each row execute function public.prevent_training_v2_revision_update();
create trigger training_plan_exercises_v2_immutable
before update on public.training_plan_exercises_v2
for each row execute function public.prevent_training_v2_revision_update();
create trigger training_plan_target_sets_v2_immutable
before update on public.training_plan_target_sets_v2
for each row execute function public.prevent_training_v2_revision_update();

revoke all on function public.set_training_v2_updated_at() from public, anon, authenticated;
revoke all on function public.prevent_training_v2_revision_update() from public, anon, authenticated;

alter table public.training_exercises_v2 enable row level security;
alter table public.training_exercise_alternatives_v2 enable row level security;
alter table public.training_templates_v2 enable row level security;
alter table public.training_template_revisions_v2 enable row level security;
alter table public.training_template_units_v2 enable row level security;
alter table public.training_template_exercises_v2 enable row level security;
alter table public.training_template_target_sets_v2 enable row level security;
alter table public.training_plans_v2 enable row level security;
alter table public.training_plan_revisions_v2 enable row level security;
alter table public.training_plan_units_v2 enable row level security;
alter table public.training_plan_exercises_v2 enable row level security;
alter table public.training_plan_target_sets_v2 enable row level security;
alter table public.training_plan_activations_v2 enable row level security;
alter table public.training_plan_cycle_states_v2 enable row level security;
alter table public.training_weekly_goal_versions_v2 enable row level security;

revoke all on table
  public.training_exercises_v2,
  public.training_exercise_alternatives_v2,
  public.training_templates_v2,
  public.training_template_revisions_v2,
  public.training_template_units_v2,
  public.training_template_exercises_v2,
  public.training_template_target_sets_v2,
  public.training_plans_v2,
  public.training_plan_revisions_v2,
  public.training_plan_units_v2,
  public.training_plan_exercises_v2,
  public.training_plan_target_sets_v2,
  public.training_plan_activations_v2,
  public.training_plan_cycle_states_v2,
  public.training_weekly_goal_versions_v2
from public, anon, authenticated;

grant select, insert, update, delete on table
  public.training_exercises_v2,
  public.training_exercise_alternatives_v2,
  public.training_templates_v2,
  public.training_template_revisions_v2,
  public.training_template_units_v2,
  public.training_template_exercises_v2,
  public.training_template_target_sets_v2,
  public.training_plans_v2,
  public.training_plan_revisions_v2,
  public.training_plan_units_v2,
  public.training_plan_exercises_v2,
  public.training_plan_target_sets_v2,
  public.training_plan_activations_v2,
  public.training_plan_cycle_states_v2,
  public.training_weekly_goal_versions_v2
to service_role;
