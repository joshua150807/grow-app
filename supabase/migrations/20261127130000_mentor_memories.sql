-- KI Mentor long-term memory (ticket M6).
--
-- Additive only. Short facts the mentor remembers about a user, e.g. goals or
-- an injury. Facts are never hard-coded by the client: the backend writes them
-- (service_role) and binds every query to the authenticated user. Users can
-- view, edit and delete them through the backend API.
--
-- status: 'active' = currently true, 'resolved' = in the past (e.g. healed
-- injury, reached goal). Resolved facts stay so the mentor can connect them.

CREATE TABLE public.mentor_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  content text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  source_message_id uuid REFERENCES public.mentor_messages(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mentor_memories_category_check CHECK (
    category IN (
      'goals', 'health', 'training', 'habits', 'business',
      'learning', 'preferences', 'personal', 'challenges', 'other'
    )
  ),
  CONSTRAINT mentor_memories_content_check CHECK (
    char_length(btrim(content)) BETWEEN 1 AND 300
  ),
  CONSTRAINT mentor_memories_status_check CHECK (status IN ('active', 'resolved'))
);

CREATE INDEX mentor_memories_user_recent_idx
  ON public.mentor_memories (user_id, updated_at DESC);

ALTER TABLE public.mentor_memories ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.mentor_memories FROM anon, authenticated;
GRANT ALL ON TABLE public.mentor_memories TO service_role;

-- Reuses the hardened trigger function from the mentor foundation migration.
CREATE TRIGGER mentor_memories_set_updated_at
BEFORE UPDATE ON public.mentor_memories
FOR EACH ROW EXECUTE FUNCTION public.set_mentor_updated_at();
