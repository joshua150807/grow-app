-- KI Mentor V1 foundation (ticket M1).
--
-- Additive only: creates new mentor_* tables and does not touch existing tables.
--
-- Security boundary:
-- The mobile app never reads or writes these tables directly. All access goes
-- through the Grow backend (service_role), which verifies the Supabase JWT and
-- binds every query to the authenticated user id. RLS is enabled without any
-- anon/authenticated grants or policies, so direct client access is denied.
--
-- Account deletion: every table cascades from auth.users.

CREATE TABLE public.mentor_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  summary text,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mentor_conversations_id_user_id_key UNIQUE (id, user_id),
  CONSTRAINT mentor_conversations_title_check CHECK (
    title IS NULL OR char_length(btrim(title)) BETWEEN 1 AND 80
  ),
  CONSTRAINT mentor_conversations_summary_check CHECK (
    summary IS NULL OR char_length(summary) <= 8000
  )
);

CREATE TABLE public.mentor_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  prompt_version text,
  provider text,
  model text,
  input_tokens integer,
  output_tokens integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mentor_messages_conversation_owner_fkey
    FOREIGN KEY (conversation_id, user_id)
    REFERENCES public.mentor_conversations(id, user_id)
    ON DELETE CASCADE,
  CONSTRAINT mentor_messages_role_check CHECK (role IN ('user', 'assistant')),
  CONSTRAINT mentor_messages_content_check CHECK (
    char_length(btrim(content)) BETWEEN 1 AND 20000
  ),
  CONSTRAINT mentor_messages_prompt_version_check CHECK (
    prompt_version IS NULL OR char_length(prompt_version) BETWEEN 1 AND 64
  ),
  CONSTRAINT mentor_messages_provider_check CHECK (
    provider IS NULL OR char_length(provider) BETWEEN 1 AND 64
  ),
  CONSTRAINT mentor_messages_model_check CHECK (
    model IS NULL OR char_length(model) BETWEEN 1 AND 128
  ),
  CONSTRAINT mentor_messages_tokens_check CHECK (
    (input_tokens IS NULL OR input_tokens >= 0)
    AND (output_tokens IS NULL OR output_tokens >= 0)
  )
);

CREATE TABLE public.mentor_usage_daily (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date date NOT NULL,
  message_count integer NOT NULL DEFAULT 0,
  input_tokens bigint NOT NULL DEFAULT 0,
  output_tokens bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mentor_usage_daily_pkey PRIMARY KEY (user_id, usage_date),
  CONSTRAINT mentor_usage_daily_counts_check CHECK (
    message_count >= 0 AND input_tokens >= 0 AND output_tokens >= 0
  )
);

CREATE TABLE public.mentor_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_version text,
  consented_at timestamptz,
  memory_enabled boolean NOT NULL DEFAULT true,
  journal_access_enabled boolean NOT NULL DEFAULT false,
  notes_access_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mentor_settings_consent_check CHECK (
    (consent_version IS NULL AND consented_at IS NULL)
    OR (
      consent_version IS NOT NULL
      AND char_length(consent_version) BETWEEN 1 AND 32
      AND consented_at IS NOT NULL
    )
  )
);

CREATE INDEX mentor_conversations_user_recent_idx
  ON public.mentor_conversations (user_id, last_message_at DESC NULLS LAST, created_at DESC);

CREATE INDEX mentor_messages_conversation_created_idx
  ON public.mentor_messages (conversation_id, created_at, id);

CREATE INDEX mentor_messages_user_created_idx
  ON public.mentor_messages (user_id, created_at);

ALTER TABLE public.mentor_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentor_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentor_usage_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentor_settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.mentor_conversations FROM anon, authenticated;
REVOKE ALL ON TABLE public.mentor_messages FROM anon, authenticated;
REVOKE ALL ON TABLE public.mentor_usage_daily FROM anon, authenticated;
REVOKE ALL ON TABLE public.mentor_settings FROM anon, authenticated;

GRANT ALL ON TABLE public.mentor_conversations TO service_role;
GRANT ALL ON TABLE public.mentor_messages TO service_role;
GRANT ALL ON TABLE public.mentor_usage_daily TO service_role;
GRANT ALL ON TABLE public.mentor_settings TO service_role;

CREATE FUNCTION public.set_mentor_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER mentor_conversations_set_updated_at
BEFORE UPDATE ON public.mentor_conversations
FOR EACH ROW EXECUTE FUNCTION public.set_mentor_updated_at();

CREATE TRIGGER mentor_usage_daily_set_updated_at
BEFORE UPDATE ON public.mentor_usage_daily
FOR EACH ROW EXECUTE FUNCTION public.set_mentor_updated_at();

CREATE TRIGGER mentor_settings_set_updated_at
BEFORE UPDATE ON public.mentor_settings
FOR EACH ROW EXECUTE FUNCTION public.set_mentor_updated_at();

REVOKE ALL ON FUNCTION public.set_mentor_updated_at()
  FROM PUBLIC, anon, authenticated;

-- Keeps conversation ordering consistent with stored messages.
CREATE FUNCTION public.touch_mentor_conversation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  UPDATE public.mentor_conversations
  SET last_message_at = GREATEST(COALESCE(last_message_at, NEW.created_at), NEW.created_at)
  WHERE id = NEW.conversation_id
    AND user_id = NEW.user_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER mentor_messages_touch_conversation
AFTER INSERT ON public.mentor_messages
FOR EACH ROW EXECUTE FUNCTION public.touch_mentor_conversation();

REVOKE ALL ON FUNCTION public.touch_mentor_conversation()
  FROM PUBLIC, anon, authenticated;
