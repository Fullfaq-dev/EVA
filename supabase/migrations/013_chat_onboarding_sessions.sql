-- Migration 013: Chat Onboarding Sessions
-- Stores per-user state for the in-chat onboarding flow.
-- Vercel serverless functions are stateless, so all session data lives here.

CREATE TABLE IF NOT EXISTS chat_onboarding_sessions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id  text        NOT NULL UNIQUE,
  step         integer     NOT NULL DEFAULT 0,
  data         jsonb       NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookup by telegram_id
CREATE INDEX IF NOT EXISTS idx_chat_onboarding_sessions_telegram_id
  ON chat_onboarding_sessions (telegram_id);

-- Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION update_chat_onboarding_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_chat_onboarding_updated_at ON chat_onboarding_sessions;
CREATE TRIGGER trg_chat_onboarding_updated_at
  BEFORE UPDATE ON chat_onboarding_sessions
  FOR EACH ROW EXECUTE FUNCTION update_chat_onboarding_updated_at();

-- RLS: only service role can read/write (webhook uses service role key)
ALTER TABLE chat_onboarding_sessions ENABLE ROW LEVEL SECURITY;

-- No public policies — access only via service role key
