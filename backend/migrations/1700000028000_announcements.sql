-- ============================================================
-- MIGRATION 028: Announcements
-- In-game announcements displayed on the Home dashboard.
-- Admins create/edit via the admin panel.
-- ============================================================

CREATE TABLE IF NOT EXISTS announcements (
  id         SERIAL PRIMARY KEY,
  title      varchar(255) NOT NULL,
  body       text NOT NULL,
  priority   varchar(20) NOT NULL DEFAULT 'normal'
               CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  active     boolean NOT NULL DEFAULT true,
  created_by integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(active, priority DESC, created_at DESC);

-- ── Down ──
-- DROP TABLE IF EXISTS announcements;

