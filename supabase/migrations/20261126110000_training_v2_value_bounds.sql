-- Fixplan B4 (2026-11-26, audit F03/F04/F05): technical safety bounds in the database.
-- The API enforces the product limits (weight <= 1500 kg, reps <= 1000, rest <= 24 h, planned
-- rest <= 60 min, weekly goal 1-7; see TRAINING_V2_LIMITS in packages/shared). These checks are
-- deliberately 10x looser, so they can never be stricter than the API (which would turn a valid
-- request into a 500) while still guaranteeing finite, int-safe aggregates.
-- NOT VALID: only new and changed rows are checked; historical rows (immutable sessions) are
-- neither scanned nor rejected. Run VALIDATE CONSTRAINT separately once a read-only diagnosis
-- shows zero violations in that environment.
alter table public.training_session_sets_v2
  add constraint training_session_sets_v2_weight_kg_bound_check
    check (weight_kg is null or weight_kg <= 15000) not valid,
  add constraint training_session_sets_v2_reps_bound_check
    check (reps is null or reps <= 10000) not valid,
  add constraint training_session_sets_v2_actual_rest_bound_check
    check (actual_rest_seconds is null or actual_rest_seconds <= 864000) not valid;

alter table public.training_plan_target_sets_v2
  add constraint training_plan_target_sets_v2_weight_bound_check
    check (target_weight_kg is null or target_weight_kg <= 15000) not valid,
  add constraint training_plan_target_sets_v2_reps_bound_check
    check ((target_reps_min is null or target_reps_min <= 10000)
      and (target_reps_max is null or target_reps_max <= 10000)) not valid,
  add constraint training_plan_target_sets_v2_planned_rest_bound_check
    check (planned_rest_seconds <= 36000) not valid;

alter table public.training_weekly_goal_versions_v2
  add constraint training_weekly_goal_versions_v2_target_bound_check
    check (target_sessions_per_week <= 70) not valid;
