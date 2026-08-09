-- Additive timing columns for terminal Training V2 sessions (see the session-core migration,
-- 20260731090000). Nothing here retroactively invents timing for pre-existing rows: an
-- existing session simply gets started_at/ended_at = null and paused_duration_seconds = 0,
-- meaning "duration unknown" -- never a guessed value derived from created_at or any set's own
-- completed_at.
--
-- started_at/ended_at are independently nullable columns, but the both-or-neither check below
-- keeps them from ever going meaningfully partial: a session row is only ever written once (id
-- is immutable -- see training_sessions_v2_immutable), so the pair is always written together
-- by the same save-session request, or not written at all.
alter table public.training_sessions_v2
  add column started_at timestamptz,
  add column ended_at timestamptz,
  add column paused_duration_seconds integer not null default 0;

alter table public.training_sessions_v2
  add constraint training_sessions_v2_paused_duration_seconds_check
    check (paused_duration_seconds >= 0);

alter table public.training_sessions_v2
  add constraint training_sessions_v2_timing_both_or_neither_check
    check ((started_at is null) = (ended_at is null));

-- Vacuously true whenever either timestamp is null (an unknown-duration legacy row, or a
-- request from a client build that predates timing) -- never raising on that case.
alter table public.training_sessions_v2
  add constraint training_sessions_v2_timing_order_check
    check (started_at is null or ended_at is null or ended_at >= started_at);

alter table public.training_sessions_v2
  add constraint training_sessions_v2_paused_duration_bounds_check
    check (
      started_at is null or ended_at is null
      or paused_duration_seconds <= extract(epoch from (ended_at - started_at))
    );
