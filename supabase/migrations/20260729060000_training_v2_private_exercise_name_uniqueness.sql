-- The lookup index added for private exercises in 20260726190000
-- (training_exercises_v2_active_user_name_idx) is not a unique index, so two concurrent
-- creates of the same owner-scoped exercise name could both succeed. This adds the real,
-- additive partial unique index the create path relies on for a race-safe
-- insert ... on conflict ... do nothing.
--
-- Normalization matches what the picker now uses to decide "is this an existing exercise":
-- trim, collapse internal whitespace runs to one space, then lowercase.
do $$
begin
  if exists (
    select 1
    from public.training_exercises_v2
    where scope = 'user' and status = 'active'
    group by owner_user_id, lower(regexp_replace(btrim(name), '\s+', ' ', 'g'))
    having count(*) > 1
  ) then
    raise exception
      'training V2 private exercise name uniqueness requires no existing duplicate active names per owner'
      using errcode = '55000';
  end if;
end;
$$;

create unique index training_exercises_v2_active_user_name_unique_idx
  on public.training_exercises_v2 (owner_user_id, (lower(regexp_replace(btrim(name), '\s+', ' ', 'g'))))
  where scope = 'user' and status = 'active';
