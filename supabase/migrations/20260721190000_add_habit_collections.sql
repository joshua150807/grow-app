-- Additive Habit Collection V1 foundation.
-- Existing habits and completions remain the source of completion and streak truth.

CREATE TABLE public.habit_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  days integer[] NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT habit_collections_id_user_id_key UNIQUE (id, user_id),
  CONSTRAINT habit_collections_name_check CHECK (
    char_length(btrim(name)) BETWEEN 1 AND 60
  ),
  CONSTRAINT habit_collections_days_check CHECK (
    public.habit_days_are_valid(days)
  ),
  CONSTRAINT habit_collections_version_check CHECK (version >= 1)
);

CREATE TABLE public.habit_collection_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  collection_id uuid NOT NULL,
  habit_id uuid NOT NULL,
  fallback_days integer[] NOT NULL,
  position integer NOT NULL,
  active_from timestamptz NOT NULL DEFAULT now(),
  active_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT habit_collection_memberships_collection_owner_fkey
    FOREIGN KEY (collection_id, user_id)
    REFERENCES public.habit_collections(id, user_id),
  CONSTRAINT habit_collection_memberships_habit_owner_fkey
    FOREIGN KEY (habit_id, user_id)
    REFERENCES public.habits(id, user_id)
    ON DELETE CASCADE,
  CONSTRAINT habit_collection_memberships_fallback_days_check CHECK (
    public.habit_days_are_valid(fallback_days)
  ),
  CONSTRAINT habit_collection_memberships_position_check CHECK (position >= 0),
  CONSTRAINT habit_collection_memberships_active_window_check CHECK (
    active_until IS NULL OR active_until >= active_from
  )
);

CREATE INDEX habit_collections_user_active_idx
  ON public.habit_collections (user_id, deleted_at, created_at);

CREATE UNIQUE INDEX habit_collection_memberships_one_active_habit_idx
  ON public.habit_collection_memberships (user_id, habit_id)
  WHERE active_until IS NULL;

CREATE INDEX habit_collection_memberships_collection_position_idx
  ON public.habit_collection_memberships (collection_id, position)
  WHERE active_until IS NULL;

CREATE INDEX habit_collection_memberships_habit_active_idx
  ON public.habit_collection_memberships (habit_id, user_id)
  WHERE active_until IS NULL;

CREATE INDEX habit_collection_memberships_user_active_idx
  ON public.habit_collection_memberships (user_id, collection_id)
  WHERE active_until IS NULL;

ALTER TABLE public.habit_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_collection_memberships ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.habit_collections FROM anon, authenticated;
REVOKE ALL ON TABLE public.habit_collection_memberships FROM anon, authenticated;
GRANT SELECT ON TABLE public.habit_collections TO authenticated;
GRANT SELECT ON TABLE public.habit_collection_memberships TO authenticated;
GRANT ALL ON TABLE public.habit_collections TO service_role;
GRANT ALL ON TABLE public.habit_collection_memberships TO service_role;

CREATE POLICY "Grow habit collections select own"
  ON public.habit_collections
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Grow habit collection memberships select own"
  ON public.habit_collection_memberships
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE FUNCTION public.set_habit_collection_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER habit_collections_set_updated_at
BEFORE UPDATE ON public.habit_collections
FOR EACH ROW EXECUTE FUNCTION public.set_habit_collection_updated_at();

CREATE TRIGGER habit_collection_memberships_set_updated_at
BEFORE UPDATE ON public.habit_collection_memberships
FOR EACH ROW EXECUTE FUNCTION public.set_habit_collection_updated_at();

REVOKE ALL ON FUNCTION public.set_habit_collection_updated_at()
  FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.enforce_habit_collection_days()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  collection_days integer[];
BEGIN
  SELECT collection.days
  INTO collection_days
  FROM public.habit_collection_memberships AS membership
  JOIN public.habit_collections AS collection
    ON collection.id = membership.collection_id
   AND collection.user_id = membership.user_id
  WHERE membership.habit_id = NEW.id
    AND membership.user_id = NEW.user_id
    AND membership.active_until IS NULL
    AND collection.deleted_at IS NULL
  LIMIT 1;

  IF collection_days IS NOT NULL THEN
    NEW.days := collection_days;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER habits_enforce_collection_days
BEFORE UPDATE OF days ON public.habits
FOR EACH ROW EXECUTE FUNCTION public.enforce_habit_collection_days();

REVOKE ALL ON FUNCTION public.enforce_habit_collection_days()
  FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.create_habit_collection(
  input_user_id uuid,
  input_name text,
  input_days integer[],
  input_members jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_collection_id uuid;
  new_habit_id uuid;
  member jsonb;
  member_position integer;
  existing_habit_days integer[];
BEGIN
  IF input_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Habit collection owner is required';
  END IF;
  IF char_length(btrim(coalesce(input_name, ''))) NOT BETWEEN 1 AND 60 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid habit collection name';
  END IF;
  IF public.habit_days_are_valid(input_days) IS NOT TRUE THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid habit collection days';
  END IF;
  IF input_members IS NULL OR jsonb_typeof(input_members) <> 'array' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Habit collection members must be an array';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(input_members) AS item
    WHERE item->>'type' = 'existing'
    GROUP BY item->>'habit_id'
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Duplicate habit collection member';
  END IF;

  INSERT INTO public.habit_collections (user_id, name, days)
  VALUES (input_user_id, btrim(input_name), input_days)
  RETURNING id INTO new_collection_id;

  FOR member, member_position IN
    SELECT item, (ordinality - 1)::integer
    FROM jsonb_array_elements(input_members) WITH ORDINALITY AS requested(item, ordinality)
  LOOP
    IF member->>'type' = 'existing' THEN
      SELECT habit.days
      INTO existing_habit_days
      FROM public.habits AS habit
      WHERE habit.id = (member->>'habit_id')::uuid
        AND habit.user_id = input_user_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Habit not found';
      END IF;
      IF EXISTS (
        SELECT 1 FROM public.habit_collection_memberships AS membership
        WHERE membership.user_id = input_user_id
          AND membership.habit_id = (member->>'habit_id')::uuid
          AND membership.active_until IS NULL
      ) THEN
        RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'Habit already belongs to an active collection';
      END IF;

      INSERT INTO public.habit_collection_memberships (
        user_id, collection_id, habit_id, fallback_days, position
      ) VALUES (
        input_user_id, new_collection_id, (member->>'habit_id')::uuid,
        existing_habit_days, member_position
      );

      UPDATE public.habits
      SET days = input_days
      WHERE id = (member->>'habit_id')::uuid AND user_id = input_user_id;
    ELSIF member->>'type' = 'new' THEN
      IF char_length(btrim(coalesce(member->>'name', ''))) < 1 THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid habit name';
      END IF;

      INSERT INTO public.habits (
        user_id, name, days, linked_tool_id, linked_tool_title, linked_tool_route
      ) VALUES (
        input_user_id,
        btrim(member->>'name'),
        input_days,
        nullif(member->>'linked_tool_id', ''),
        nullif(member->>'linked_tool_title', ''),
        nullif(member->>'linked_tool_route', '')
      ) RETURNING id INTO new_habit_id;

      INSERT INTO public.habit_collection_memberships (
        user_id, collection_id, habit_id, fallback_days, position
      ) VALUES (
        input_user_id, new_collection_id, new_habit_id, input_days, member_position
      );
    ELSE
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid habit collection member type';
    END IF;
  END LOOP;

  RETURN new_collection_id;
END;
$$;

CREATE FUNCTION public.update_habit_collection(
  input_user_id uuid,
  input_collection_id uuid,
  input_expected_version integer,
  input_name text,
  input_days integer[],
  input_members jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_version integer;
  current_membership record;
  existing_membership record;
  member jsonb;
  member_position integer;
  existing_habit_days integer[];
  new_habit_id uuid;
BEGIN
  IF char_length(btrim(coalesce(input_name, ''))) NOT BETWEEN 1 AND 60 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid habit collection name';
  END IF;
  IF public.habit_days_are_valid(input_days) IS NOT TRUE THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid habit collection days';
  END IF;
  IF input_expected_version IS NULL OR input_expected_version < 1 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid expected version';
  END IF;
  IF input_members IS NULL OR jsonb_typeof(input_members) <> 'array' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Habit collection members must be an array';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(input_members) AS item
    WHERE item->>'type' = 'existing'
    GROUP BY item->>'habit_id'
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Duplicate habit collection member';
  END IF;

  SELECT collection.version
  INTO current_version
  FROM public.habit_collections AS collection
  WHERE collection.id = input_collection_id
    AND collection.user_id = input_user_id
    AND collection.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Habit collection not found';
  END IF;
  IF current_version <> input_expected_version THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'Habit collection version conflict';
  END IF;

  PERFORM 1
  FROM public.habit_collection_memberships AS membership
  JOIN public.habits AS habit
    ON habit.id = membership.habit_id AND habit.user_id = membership.user_id
  WHERE membership.collection_id = input_collection_id
    AND membership.user_id = input_user_id
    AND membership.active_until IS NULL
  FOR UPDATE OF membership, habit;

  UPDATE public.habit_collections
  SET name = btrim(input_name), days = input_days, version = version + 1
  WHERE id = input_collection_id AND user_id = input_user_id;

  FOR current_membership IN
    SELECT membership.id, membership.habit_id, membership.fallback_days
    FROM public.habit_collection_memberships AS membership
    WHERE membership.collection_id = input_collection_id
      AND membership.user_id = input_user_id
      AND membership.active_until IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(input_members) AS desired
        WHERE desired->>'type' = 'existing'
          AND (desired->>'habit_id')::uuid = membership.habit_id
      )
  LOOP
    UPDATE public.habit_collection_memberships
    SET active_until = now()
    WHERE id = current_membership.id;

    UPDATE public.habits
    SET days = current_membership.fallback_days
    WHERE id = current_membership.habit_id AND user_id = input_user_id;
  END LOOP;

  FOR member, member_position IN
    SELECT item, (ordinality - 1)::integer
    FROM jsonb_array_elements(input_members) WITH ORDINALITY AS requested(item, ordinality)
  LOOP
    IF member->>'type' = 'existing' THEN
      SELECT membership.id, membership.fallback_days
      INTO existing_membership
      FROM public.habit_collection_memberships AS membership
      WHERE membership.collection_id = input_collection_id
        AND membership.user_id = input_user_id
        AND membership.habit_id = (member->>'habit_id')::uuid
        AND membership.active_until IS NULL;

      IF FOUND THEN
        UPDATE public.habit_collection_memberships
        SET position = member_position
        WHERE id = existing_membership.id;

        UPDATE public.habits
        SET days = input_days
        WHERE id = (member->>'habit_id')::uuid AND user_id = input_user_id;
      ELSE
        SELECT habit.days
        INTO existing_habit_days
        FROM public.habits AS habit
        WHERE habit.id = (member->>'habit_id')::uuid
          AND habit.user_id = input_user_id
        FOR UPDATE;

        IF NOT FOUND THEN
          RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Habit not found';
        END IF;
        IF EXISTS (
          SELECT 1 FROM public.habit_collection_memberships AS membership
          WHERE membership.user_id = input_user_id
            AND membership.habit_id = (member->>'habit_id')::uuid
            AND membership.active_until IS NULL
        ) THEN
          RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'Habit already belongs to an active collection';
        END IF;

        INSERT INTO public.habit_collection_memberships (
          user_id, collection_id, habit_id, fallback_days, position
        ) VALUES (
          input_user_id, input_collection_id, (member->>'habit_id')::uuid,
          existing_habit_days, member_position
        );

        UPDATE public.habits
        SET days = input_days
        WHERE id = (member->>'habit_id')::uuid AND user_id = input_user_id;
      END IF;
    ELSIF member->>'type' = 'new' THEN
      IF char_length(btrim(coalesce(member->>'name', ''))) < 1 THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid habit name';
      END IF;

      INSERT INTO public.habits (
        user_id, name, days, linked_tool_id, linked_tool_title, linked_tool_route
      ) VALUES (
        input_user_id,
        btrim(member->>'name'),
        input_days,
        nullif(member->>'linked_tool_id', ''),
        nullif(member->>'linked_tool_title', ''),
        nullif(member->>'linked_tool_route', '')
      ) RETURNING id INTO new_habit_id;

      INSERT INTO public.habit_collection_memberships (
        user_id, collection_id, habit_id, fallback_days, position
      ) VALUES (
        input_user_id, input_collection_id, new_habit_id, input_days, member_position
      );
    ELSE
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid habit collection member type';
    END IF;
  END LOOP;

  RETURN current_version + 1;
END;
$$;

CREATE FUNCTION public.delete_habit_collection(
  input_user_id uuid,
  input_collection_id uuid,
  input_expected_version integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_version integer;
  current_membership record;
BEGIN
  SELECT collection.version
  INTO current_version
  FROM public.habit_collections AS collection
  WHERE collection.id = input_collection_id
    AND collection.user_id = input_user_id
    AND collection.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'Habit collection not found';
  END IF;
  IF current_version <> input_expected_version THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'Habit collection version conflict';
  END IF;

  PERFORM 1
  FROM public.habit_collection_memberships AS membership
  JOIN public.habits AS habit
    ON habit.id = membership.habit_id AND habit.user_id = membership.user_id
  WHERE membership.collection_id = input_collection_id
    AND membership.user_id = input_user_id
    AND membership.active_until IS NULL
  FOR UPDATE OF membership, habit;

  UPDATE public.habit_collections
  SET deleted_at = now(), version = version + 1
  WHERE id = input_collection_id AND user_id = input_user_id;

  FOR current_membership IN
    SELECT membership.id, membership.habit_id, membership.fallback_days
    FROM public.habit_collection_memberships AS membership
    WHERE membership.collection_id = input_collection_id
      AND membership.user_id = input_user_id
      AND membership.active_until IS NULL
  LOOP
    UPDATE public.habit_collection_memberships
    SET active_until = now()
    WHERE id = current_membership.id;

    UPDATE public.habits
    SET days = current_membership.fallback_days
    WHERE id = current_membership.habit_id AND user_id = input_user_id;
  END LOOP;

  RETURN current_version + 1;
END;
$$;

REVOKE ALL ON FUNCTION public.create_habit_collection(uuid, text, integer[], jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_habit_collection(uuid, uuid, integer, text, integer[], jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_habit_collection(uuid, uuid, integer)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_habit_collection(uuid, text, integer[], jsonb)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.update_habit_collection(uuid, uuid, integer, text, integer[], jsonb)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_habit_collection(uuid, uuid, integer)
  TO service_role;
