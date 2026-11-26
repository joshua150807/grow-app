-- Additive groundwork for the future Grow template catalog and "saved Grow plan"
-- provenance. Schema only: no repository, service, route or mobile wiring in this change.
--
-- Hardens training_plans_v2.source_template_id from its original `on delete set null`
-- (see 20260726180000_training_v2_plan_core.sql) to `on delete restrict`: a template that
-- any user has ever saved can now never be hard-deleted at all, so provenance can never be
-- silently lost -- not even for a plan whose saved_at is null (e.g. one created from a
-- template but never explicitly "saved" under the future save flow). Templates already have
-- their own soft-delete via `status` (active/archived/unpublished), so a hard DELETE of a
-- template should never be the real deletion path in the first place.

alter table public.training_plans_v2
  drop constraint training_plans_v2_source_template_id_fkey;

alter table public.training_plans_v2
  add constraint training_plans_v2_source_template_id_fkey
  foreign key (source_template_id) references public.training_templates_v2(id)
  on delete restrict;

alter table public.training_templates_v2
  add column image_reference text;

alter table public.training_template_revisions_v2
  add column default_weekly_goal integer
    check (default_weekly_goal is null or default_weekly_goal > 0);

alter table public.training_plans_v2
  add column saved_at timestamptz;

alter table public.training_plans_v2
  add constraint training_plans_v2_saved_at_requires_template_check
  check (saved_at is null or source_template_id is not null);

create unique index training_plans_v2_user_source_template_unique_idx
  on public.training_plans_v2(user_id, source_template_id)
  where source_template_id is not null;

alter table public.training_plan_revisions_v2
  add column source_template_revision_id uuid
    references public.training_template_revisions_v2(id);
