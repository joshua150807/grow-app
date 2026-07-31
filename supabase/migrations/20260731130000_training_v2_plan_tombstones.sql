-- Fixes a hard-delete gap: deleting an own training plan (trainingPlanRepository.ts's
-- delete()) used to physically remove the training_plans_v2 row, cascading away its entire
-- immutable revision tree (see the on-delete-cascade FK chain in
-- 20260726180000_training_v2_plan_core.sql). A training session that was only ever begun
-- locally and never yet reached the server (trainingSessionRepository.ts's genuinely-new-
-- idempotency-key path) could then never be saved at all: its very first plan lookup found
-- nothing and failed with plan_not_found, permanently losing the workout.
--
-- Tombstoning instead of physically deleting keeps the plan row, its revisions, units,
-- exercises and target sets fully intact and readable. Training V2 sessions already read that
-- data unconditionally -- trainingSessionRepository.ts's queries carry no deleted_at filter,
-- deliberately, and none is added here; that is the actual fix. Every user-facing plan read/
-- mutation in trainingPlanRepository.ts, by contrast, now excludes `deleted_at is not null`
-- and therefore still treats a tombstoned plan as gone. Only a true account/owner cascade (an
-- auth.users row deletion) still physically removes everything, via the unchanged FK chain.

alter table public.training_plans_v2
  add column deleted_at timestamptz;

-- A tombstoned plan is always moved into the existing 'archived' status -- never a new status
-- value -- so it can never occupy the one-active/one-scheduled-per-user partial unique
-- indexes; deleting an active or scheduled plan therefore always frees that slot as a side
-- effect of the same status transition archive() already uses. This mirrors
-- training_plans_v2_archive_state_check (20260726180000) for the same reason: any row that
-- claims deleted_at must also be in the one status that check already requires archived_at
-- for.
alter table public.training_plans_v2
  add constraint training_plans_v2_deleted_requires_archived_check
  check (deleted_at is null or (status = 'archived' and archived_at is not null));
