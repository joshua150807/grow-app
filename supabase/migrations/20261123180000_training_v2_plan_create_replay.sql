-- B11: additive, server-only request identity. No existing rows are rewritten.
-- Keep reservations for the owner's lifetime, including after plan tombstoning.
-- A claim, its plan/revision tree, goal and optional activation commit together.
create table public.training_plan_create_requests_v2 (
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key uuid not null,
  request_fingerprint text not null check (request_fingerprint ~ '^[0-9a-f]{64}$'),
  plan_id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  primary key (user_id, idempotency_key),
  unique (plan_id),
  foreign key (plan_id, user_id) references public.training_plans_v2(id, user_id)
    deferrable initially deferred
);

alter table public.training_plan_create_requests_v2 enable row level security;
revoke all on table public.training_plan_create_requests_v2 from public, anon, authenticated;
grant select, insert on table public.training_plan_create_requests_v2 to service_role;
