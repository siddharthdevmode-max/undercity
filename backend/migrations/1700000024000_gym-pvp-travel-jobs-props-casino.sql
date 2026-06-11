-- ============================================================
-- MIGRATION 024: Gym, PvP, Travel, Jobs, Properties, Casino
-- ============================================================
-- Run: psql $DATABASE_URL -f migrations/1700000024000_gym-pvp-travel-jobs-props-casino.sql

-- ── Gym stats columns ──
ALTER TABLE users ADD COLUMN IF NOT EXISTS strength  integer NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS speed     integer NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS defense   integer NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS dexterity integer NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS energy    integer NOT NULL DEFAULT 100;
ALTER TABLE users ADD COLUMN IF NOT EXISTS max_energy integer NOT NULL DEFAULT 100;

-- ── PvP attacks ──
CREATE TABLE IF NOT EXISTS pvp_attacks (
  id            SERIAL PRIMARY KEY,
  attacker_id   integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id     integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  result        varchar(20) NOT NULL CHECK (result IN ('attacker_win','target_win','mugged','hospitalized','stalemate')),
  attacker_hp   integer NOT NULL DEFAULT 0,
  target_hp     integer NOT NULL DEFAULT 0,
  money_stolen  bigint NOT NULL DEFAULT 0,
  attacker_nerve integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pvp_attacks_attacker_id ON pvp_attacks(attacker_id);
CREATE INDEX IF NOT EXISTS idx_pvp_attacks_target_id   ON pvp_attacks(target_id);

-- ── Cities ──
CREATE TABLE IF NOT EXISTS cities (
  id           SERIAL PRIMARY KEY,
  name         varchar(100) NOT NULL,
  description  text NOT NULL DEFAULT '',
  country      varchar(100) NOT NULL DEFAULT '',
  flight_cost  integer NOT NULL DEFAULT 0,
  flight_time  integer NOT NULL DEFAULT 300,
  min_level    integer NOT NULL DEFAULT 0
);

TRUNCATE cities RESTART IDENTITY CASCADE;
INSERT INTO cities (name, description, country, flight_cost, flight_time, min_level) VALUES
  ('London',    'The capital of the United Kingdom. A hub for finance and trade.', 'United Kingdom', 15000, 600,  10),
  ('Tokyo',     'A bustling metropolis blending tradition with cutting-edge tech.', 'Japan',          25000, 900,  15),
  ('Dubai',     'A city of luxury, skyscrapers, and black-market deals.',          'UAE',            20000, 720,  12),
  ('Sao Paulo', 'Brazilian economic powerhouse with a thriving underworld.',       'Brazil',         18000, 1080, 10),
  ('Moscow',    'Eastern European center of power, crime, and influence.',         'Russia',         22000, 840,  14),
  ('Bangkok',   'Southeast Asian hub for smuggling and underground trade.',        'Thailand',       16000, 780,  8);

-- ── Travel history ──
CREATE TABLE IF NOT EXISTS travel_history (
  id          SERIAL PRIMARY KEY,
  user_id     integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  city_id     integer NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  departed_at timestamptz NOT NULL DEFAULT NOW(),
  arrived_at  timestamptz NOT NULL,
  cost        integer NOT NULL DEFAULT 0
);

-- ── Jobs ──
CREATE TABLE IF NOT EXISTS jobs (
  id           SERIAL PRIMARY KEY,
  name         varchar(100) NOT NULL,
  description  text NOT NULL DEFAULT '',
  pay          integer NOT NULL DEFAULT 0,
  energy_cost  integer NOT NULL DEFAULT 10,
  min_level    integer NOT NULL DEFAULT 1,
  min_stats    integer NOT NULL DEFAULT 0
);

TRUNCATE jobs RESTART IDENTITY CASCADE;
INSERT INTO jobs (name, description, pay, energy_cost, min_level, min_stats) VALUES
  ('Street Sweeper', 'Clean the streets of the city. Low pay, no requirements.',  500,   10, 1,  0),
  ('Cashier',        'Work the register at a local store. Steady income.',         1000,  10, 2,  0),
  ('Bouncer',        'Keep troublemakers out of the local bar. Requires strength.', 1500, 10, 5,  50),
  ('Taxi Driver',    'Drive passengers around the city. Decent pay.',              2000,  10, 8,  0),
  ('Mechanic',       'Fix cars in the garage. Good pay for skilled workers.',      3000,  10, 10, 100),
  ('Smuggler',       'Transport illegal goods across borders. High risk, high pay.',4500, 10, 15, 250),
  ('Hacker',         'Digital crimes for the highest bidder. Elite status.',        7000,  10, 20, 500);

-- ── User jobs ──
CREATE TABLE IF NOT EXISTS user_jobs (
  id         SERIAL PRIMARY KEY,
  user_id    integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id     integer NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ── Properties ──
CREATE TABLE IF NOT EXISTS properties (
  id            SERIAL PRIMARY KEY,
  name          varchar(100) NOT NULL,
  description   text NOT NULL DEFAULT '',
  price         bigint NOT NULL DEFAULT 0,
  daily_income  integer NOT NULL DEFAULT 0,
  min_level     integer NOT NULL DEFAULT 1
);

TRUNCATE properties RESTART IDENTITY CASCADE;
INSERT INTO properties (name, description, price, daily_income, min_level) VALUES
  ('Shack',        'A rundown shack in the worst part of town. Barely standing.',       50000,    500,   1),
  ('Studio',       'A small studio apartment. Modest but cozy.',                        200000,   2000,  5),
  ('Safe House',   'A secure location with reinforced doors. Stay hidden.',             500000,   5000,  10),
  ('Brownstone',   'A classic brownstone in a respectable neighborhood. Classy.',       1500000,  15000, 15),
  ('Warehouse',    'A large industrial warehouse. Room for operations.',                3000000,  30000, 20),
  ('Penthouse',    'A luxurious penthouse with skyline views. The high life.',          8000000,  80000, 25),
  ('Private Island','A private island paradise. Ultimate status symbol.',               25000000, 250000, 30);

-- ── User properties ──
CREATE TABLE IF NOT EXISTS user_properties (
  id          SERIAL PRIMARY KEY,
  user_id     integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_id integer NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  bought_at   timestamptz NOT NULL DEFAULT NOW(),
  last_collected_at timestamptz DEFAULT NULL,
  UNIQUE(user_id, property_id)
);

-- ── Casino log ──
CREATE TABLE IF NOT EXISTS casino_log (
  id         SERIAL PRIMARY KEY,
  user_id    integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game       varchar(50) NOT NULL,
  bet        bigint NOT NULL DEFAULT 0,
  payout     bigint NOT NULL DEFAULT 0,
  result     varchar(10) NOT NULL DEFAULT 'lose',
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_casino_log_user_id ON casino_log(user_id);
