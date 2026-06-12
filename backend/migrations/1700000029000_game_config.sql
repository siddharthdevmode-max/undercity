-- ============================================================
-- MIGRATION 029: Game Configuration
-- Key-value store for dynamic game settings.
-- Admins edit via the admin panel — no deploy needed.
-- ============================================================

CREATE TABLE IF NOT EXISTS game_config (
  key        varchar(100) PRIMARY KEY,
  value      text NOT NULL,
  type       varchar(20) NOT NULL DEFAULT 'string'
               CHECK (type IN ('string', 'number', 'boolean', 'json')),
  label      varchar(255) NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

INSERT INTO game_config (key, value, type, label, description) VALUES
  ('maintenance_mode', 'false', 'boolean', 'Maintenance Mode', 'When enabled, blocks all non-admin requests'),
  ('signups_open', 'true', 'boolean', 'Signups Open', 'Allow new user registration'),
  ('nerve_regen_multiplier', '1.0', 'number', 'Nerve Regen Multiplier', 'Global nerve regeneration speed multiplier'),
  ('money_multiplier', '1.0', 'number', 'Money Multiplier', 'Global money reward multiplier'),
  ('xp_multiplier', '1.0', 'number', 'XP Multiplier', 'Global XP gain multiplier'),
  ('max_daily_attacks', '100', 'number', 'Max Daily Attacks', 'Maximum PvP attacks per day per user'),
  ('newbie_protection_level', '5', 'number', 'Newbie Protection Level', 'Players below this level cannot be attacked'),
  ('min_transfer_tax', '0.05', 'number', 'Min Transfer Tax', 'Minimum bank transfer tax rate (0.05 = 5%)')
ON CONFLICT (key) DO NOTHING;

-- ── Down ──
-- DROP TABLE IF EXISTS game_config;

