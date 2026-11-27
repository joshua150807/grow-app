-- KI Mentor actions (ticket M7).
--
-- Additive only. Every change the mentor wants to make in a user's Grow
-- account is stored here as a proposal first. The backend executes it only
-- after the user confirmed it, and keeps the row as an audit trail.
--
-- status:
--   proposed  -> shown to the user as a confirmation card
--   executing -> claimed by a confirm request (prevents double execution)
--   executed  -> done, result_ref points to what was created/changed
--   rejected  -> declined by the user
--   failed    -> execution failed, error_code says why
--   expired   -> not decided in time
--
-- The client never accesses this table directly (no anon/authenticated grants).

CREATE TABLE public.mentor_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.mentor_conversations(id) ON DELETE SET NULL,
  message_id uuid REFERENCES public.mentor_messages(id) ON DELETE SET NULL,
  type text NOT NULL,
  payload jsonb NOT NULL,
  summary text NOT NULL,
  status text NOT NULL DEFAULT 'proposed',
  result_ref jsonb,
  error_code text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mentor_actions_type_check CHECK (type ~ '^[a-z_]+\.[a-z_]+$' AND char_length(type) <= 64),
  CONSTRAINT mentor_actions_payload_check CHECK (
    jsonb_typeof(payload) = 'object' AND pg_column_size(payload) <= 16384
  ),
  CONSTRAINT mentor_actions_summary_check CHECK (char_length(btrim(summary)) BETWEEN 1 AND 300),
  CONSTRAINT mentor_actions_status_check CHECK (
    status IN ('proposed', 'executing', 'executed', 'rejected', 'failed', 'expired')
  ),
  CONSTRAINT mentor_actions_error_code_check CHECK (error_code IS NULL OR char_length(error_code) <= 64)
);

CREATE INDEX mentor_actions_user_created_idx
  ON public.mentor_actions (user_id, created_at DESC);

CREATE INDEX mentor_actions_message_idx
  ON public.mentor_actions (message_id)
  WHERE message_id IS NOT NULL;

ALTER TABLE public.mentor_actions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.mentor_actions FROM anon, authenticated;
GRANT ALL ON TABLE public.mentor_actions TO service_role;

CREATE TRIGGER mentor_actions_set_updated_at
BEFORE UPDATE ON public.mentor_actions
FOR EACH ROW EXECUTE FUNCTION public.set_mentor_updated_at();
