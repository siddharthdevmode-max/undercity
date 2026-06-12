-- ============================================================
-- MIGRATION 027: User Messages (Private Messaging)
-- ============================================================

CREATE TABLE IF NOT EXISTS user_messages (
  id          SERIAL PRIMARY KEY,
  sender_id   integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject     varchar(255) NOT NULL DEFAULT '',
  body        text NOT NULL,
  read        boolean NOT NULL DEFAULT false,
  sender_deleted boolean NOT NULL DEFAULT false,
  recipient_deleted boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_recipient ON user_messages(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON user_messages(sender_id, created_at DESC);

-- ── Down ──
-- DROP TABLE IF EXISTS user_messages;
