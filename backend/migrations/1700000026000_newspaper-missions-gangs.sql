-- ============================================================
-- MIGRATION 026: Newspaper, Missions, Gangs
-- ============================================================

-- ── Newspaper ──
CREATE TABLE IF NOT EXISTS newspaper_articles (
  id         SERIAL PRIMARY KEY,
  title      varchar(255) NOT NULL,
  content    text NOT NULL DEFAULT '',
  category   varchar(50) NOT NULL DEFAULT 'general',
  important  boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

-- ── Missions ──
CREATE TABLE IF NOT EXISTS missions (
  id          SERIAL PRIMARY KEY,
  name        varchar(100) NOT NULL,
  description text NOT NULL DEFAULT '',
  objectives  jsonb NOT NULL DEFAULT '[]',
  rewards     jsonb NOT NULL DEFAULT '{}',
  min_level   integer NOT NULL DEFAULT 1,
  repeatable  boolean NOT NULL DEFAULT false,
  cooldown_h  integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_missions (
  id         SERIAL PRIMARY KEY,
  user_id    integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mission_id integer NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  progress   jsonb NOT NULL DEFAULT '{}',
  status     varchar(20) NOT NULL DEFAULT 'active',
  started_at timestamptz NOT NULL DEFAULT NOW(),
  completed_at timestamptz DEFAULT NULL,
  UNIQUE(user_id, mission_id)
);

INSERT INTO missions (name, description, objectives, rewards, min_level, repeatable, cooldown_h) VALUES
  ('First Blood', 'Successfully attack another player.', '[{"type":"pvp_wins","target":1}]', '{"money":10000,"xp":500}', 1, false, 0),
  ('Street Rep', 'Complete 10 crimes.', '[{"type":"crimes_complete","target":10}]', '{"money":25000,"xp":1000}', 1, true, 24),
  ('Money Maker', 'Earn $100,000 total from crimes.', '[{"type":"crime_earnings","target":100000}]', '{"money":50000,"xp":2000}', 5, false, 0),
  ('Gym Rat', 'Train 20 times at the gym.', '[{"type":"gym_sessions","target":20}]', '{"money":15000,"xp":1500,"points":5}', 3, true, 12),
  ('Property Baron', 'Own at least 3 properties.', '[{"type":"properties_own","target":3}]', '{"money":100000,"xp":5000}', 10, false, 0)
ON CONFLICT DO NOTHING;

-- ── Gangs ──
CREATE TABLE IF NOT EXISTS gangs (
  id          SERIAL PRIMARY KEY,
  name        varchar(50) NOT NULL UNIQUE,
  tag         varchar(5) NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  leader_id   integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bank        bigint NOT NULL DEFAULT 0,
  respect     integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gang_members (
  id       SERIAL PRIMARY KEY,
  gang_id  integer NOT NULL REFERENCES gangs(id) ON DELETE CASCADE,
  user_id  integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role     varchar(20) NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE(gang_id, user_id)
);

CREATE TABLE IF NOT EXISTS gang_alliances (
  id          SERIAL PRIMARY KEY,
  gang_a_id   integer NOT NULL REFERENCES gangs(id) ON DELETE CASCADE,
  gang_b_id   integer NOT NULL REFERENCES gangs(id) ON DELETE CASCADE,
  status      varchar(20) NOT NULL DEFAULT 'pending',
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE(gang_a_id, gang_b_id)
);

CREATE TABLE IF NOT EXISTS gang_wars (
  id          SERIAL PRIMARY KEY,
  attacker_id integer NOT NULL REFERENCES gangs(id) ON DELETE CASCADE,
  defender_id integer NOT NULL REFERENCES gangs(id) ON DELETE CASCADE,
  status      varchar(20) NOT NULL DEFAULT 'active',
  attacker_score integer NOT NULL DEFAULT 0,
  defender_score integer NOT NULL DEFAULT 0,
  started_at  timestamptz NOT NULL DEFAULT NOW(),
  ended_at    timestamptz DEFAULT NULL
);
