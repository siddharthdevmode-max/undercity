-- ============================================================
-- MIGRATION 025: Forum + Calendar
-- ============================================================
-- Run: psql $DATABASE_URL -f migrations/1700000025000_forum-calendar.sql

-- ── Forum ──
CREATE TABLE IF NOT EXISTS forum_categories (
  id          SERIAL PRIMARY KEY,
  name        varchar(100) NOT NULL,
  description text NOT NULL DEFAULT '',
  sort_order  integer NOT NULL DEFAULT 0
);

INSERT INTO forum_categories (name, description, sort_order) VALUES
  ('General Discussion', 'Talk about anything Undercity related.', 1),
  ('Trading Post',       'Buy, sell, and trade items with other players.', 2),
  ('Bounty Board',       'Post bounties and contracts for other players.', 3),
  ('Help & Support',     'Get help with the game.', 4),
  ('Suggestions',        'Suggest features and improvements.', 5),
  ('Gang Recruiting',    'Find or recruit members for your gang.', 6)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS forum_threads (
  id          SERIAL PRIMARY KEY,
  category_id integer NOT NULL REFERENCES forum_categories(id) ON DELETE CASCADE,
  user_id     integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       varchar(255) NOT NULL,
  content     text NOT NULL DEFAULT '',
  is_pinned   boolean NOT NULL DEFAULT false,
  is_locked   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  updated_at  timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_forum_threads_category ON forum_threads(category_id);
CREATE INDEX IF NOT EXISTS idx_forum_threads_updated  ON forum_threads(updated_at DESC);

CREATE TABLE IF NOT EXISTS forum_posts (
  id         SERIAL PRIMARY KEY,
  thread_id  integer NOT NULL REFERENCES forum_threads(id) ON DELETE CASCADE,
  user_id    integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_forum_posts_thread ON forum_posts(thread_id);

-- ── Calendar ──
CREATE TABLE IF NOT EXISTS calendar_events (
  id          SERIAL PRIMARY KEY,
  user_id     integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       varchar(255) NOT NULL,
  description text NOT NULL DEFAULT '',
  event_date  date NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_user_date ON calendar_events(user_id, event_date);
