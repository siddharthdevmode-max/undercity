-- ============================================================
-- MIGRATION 030: Unspent Stat Points
-- Players earn 3 stat points per level-up that they can
-- freely allocate to strength/speed/defense/dexterity.
-- ============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS unspent_stat_points integer NOT NULL DEFAULT 0;

-- ── Down ──
-- ALTER TABLE users DROP COLUMN IF EXISTS unspent_stat_points;

