-- Additive integrity hardening for the existing habit tables.
-- This migration intentionally performs no cleanup or backfill.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.habit_completions AS completion
    LEFT JOIN public.habits AS habit ON habit.id = completion.habit_id
    WHERE habit.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Habit integrity check failed: orphan habit completions exist';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.habit_completions AS completion
    JOIN public.habits AS habit ON habit.id = completion.habit_id
    WHERE completion.user_id <> habit.user_id
  ) THEN
    RAISE EXCEPTION 'Habit integrity check failed: completion owner mismatches exist';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.habits AS habit
    WHERE cardinality(habit.days) = 0
       OR array_position(habit.days, NULL) IS NOT NULL
       OR EXISTS (
         SELECT 1
         FROM unnest(habit.days) AS scheduled_day
         WHERE scheduled_day NOT BETWEEN 0 AND 6
       )
       OR cardinality(habit.days) <> (
         SELECT count(DISTINCT scheduled_day)
         FROM unnest(habit.days) AS scheduled_day
       )
  ) THEN
    RAISE EXCEPTION 'Habit integrity check failed: invalid habit days exist';
  END IF;
END;
$$;

CREATE FUNCTION public.habit_days_are_valid(days integer[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT
    days IS NOT NULL
    AND cardinality(days) BETWEEN 1 AND 7
    AND array_position(days, NULL) IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM unnest(days) AS scheduled_day
      WHERE scheduled_day NOT BETWEEN 0 AND 6
    )
    AND cardinality(days) = (
      SELECT count(DISTINCT scheduled_day)
      FROM unnest(days) AS scheduled_day
    );
$$;

ALTER TABLE public.habits
  ADD CONSTRAINT habits_id_user_id_key UNIQUE (id, user_id);

ALTER TABLE public.habits
  ADD CONSTRAINT habits_days_valid_check
  CHECK (public.habit_days_are_valid(days))
  NOT VALID;

ALTER TABLE public.habits
  VALIDATE CONSTRAINT habits_days_valid_check;

ALTER TABLE public.habit_completions
  ADD CONSTRAINT habit_completions_habit_owner_fkey
  FOREIGN KEY (habit_id, user_id)
  REFERENCES public.habits (id, user_id)
  ON DELETE CASCADE
  NOT VALID;

ALTER TABLE public.habit_completions
  VALIDATE CONSTRAINT habit_completions_habit_owner_fkey;

CREATE INDEX IF NOT EXISTS habits_user_id_idx
  ON public.habits (user_id);

CREATE INDEX IF NOT EXISTS habit_completions_user_id_completed_date_idx
  ON public.habit_completions (user_id, completed_date);

CREATE INDEX IF NOT EXISTS habit_completions_habit_id_user_id_idx
  ON public.habit_completions (habit_id, user_id);
