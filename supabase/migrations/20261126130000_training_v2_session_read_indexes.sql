-- Fixplan B6 (2026-11-26, audit F01/F02): read indexes chosen from EXPLAIN (ANALYZE) of the exact
-- queries the stats / records / progress / exercise endpoints send (isolated DB, 11k sessions,
-- 224k sets). Without them PostgreSQL filtered training_session_sets_v2 by user_id with a
-- (parallel) seq scan over ALL users' rows: a 100-session user's stats took 21 ms instead of 4 ms
-- as soon as another user had 10k sessions. A third candidate (sessions by user/status/date) was
-- not needed after the period filter fix and is deliberately not added.
--
-- Plain CREATE INDEX (not CONCURRENTLY): it takes a SHARE lock that blocks writes to the table
-- for the build time. Measured build time in the isolated DB: ~70 ms (56k rows) and ~220 ms
-- (224k rows). For large production tables run these statements separately with CONCURRENTLY
-- outside a transaction instead -- see the Fixplan report.
create index if not exists training_session_exercises_v2_user_exercise_idx
  on public.training_session_exercises_v2(user_id, exercise_id);

create index if not exists training_session_sets_v2_user_session_idx
  on public.training_session_sets_v2(user_id, session_id);
