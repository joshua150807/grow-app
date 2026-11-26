-- Fixplan B8 (2026-11-26, audit F08 + F14): a completed session only advances the plan cycle when it
-- is not older than the most recent session that already advanced it. Additive and nullable:
-- null means "no session has advanced this cycle since (re)activation" and behaves exactly like the
-- previous logic. No backfill on purpose -- existing ended_at values may lie in the future (F14) and
-- must not freeze a cycle. The API stores least(ended_at, now()) here, never a future timestamp.
alter table public.training_plan_cycle_states_v2
  add column last_completed_session_at timestamptz;

comment on column public.training_plan_cycle_states_v2.last_completed_session_at is
  'least(ended_at, now()) of the newest completed session that advanced this cycle; null after (re)activation.';
