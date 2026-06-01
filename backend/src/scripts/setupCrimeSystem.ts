import { pool } from "../config/database";

type CrimeSeed = {
  key: string;
  name: string;
  tier: number;
  unlockLevel: number;
  nerveCost: number;
  minReward: number;
  maxReward: number;
  jailMinSeconds: number;
  jailMaxSeconds: number;
  isFederal: boolean;
};

const minutes = (n: number) => n * 60;
const hours = (n: number) => n * 60 * 60;
const days = (n: number) => n * 24 * 60 * 60;

const crimes: CrimeSeed[] = [
  // Tier 1 — Level 1+
  {
    key: "beg_for_change",
    name: "Beg for Change",
    tier: 1,
    unlockLevel: 1,
    nerveCost: 1,
    minReward: 20,
    maxReward: 80,
    jailMinSeconds: 0,
    jailMaxSeconds: 0,
    isFederal: false,
  },
  {
    key: "pickpocket",
    name: "Pickpocket",
    tier: 1,
    unlockLevel: 1,
    nerveCost: 2,
    minReward: 50,
    maxReward: 200,
    jailMinSeconds: minutes(25),
    jailMaxSeconds: minutes(45),
    isFederal: false,
  },
  {
    key: "shoplift",
    name: "Shoplift",
    tier: 1,
    unlockLevel: 1,
    nerveCost: 3,
    minReward: 100,
    maxReward: 300,
    jailMinSeconds: minutes(40),
    jailMaxSeconds: minutes(90),
    isFederal: false,
  },
  {
    key: "vandalize_property",
    name: "Vandalize Property",
    tier: 1,
    unlockLevel: 1,
    nerveCost: 4,
    minReward: 50,
    maxReward: 250,
    jailMinSeconds: minutes(60),
    jailMaxSeconds: minutes(150),
    isFederal: false,
  },
  {
    key: "snatching",
    name: "Snatching",
    tier: 1,
    unlockLevel: 1,
    nerveCost: 4,
    minReward: 150,
    maxReward: 400,
    jailMinSeconds: minutes(90),
    jailMaxSeconds: minutes(180),
    isFederal: false,
  },

  // Tier 2 — Level 5+
  {
    key: "burglary",
    name: "Burglary",
    tier: 2,
    unlockLevel: 5,
    nerveCost: 5,
    minReward: 300,
    maxReward: 900,
    jailMinSeconds: hours(2),
    jailMaxSeconds: hours(5),
    isFederal: false,
  },
  {
    key: "street_drug_deal",
    name: "Street Drug Deal",
    tier: 2,
    unlockLevel: 5,
    nerveCost: 6,
    minReward: 400,
    maxReward: 1200,
    jailMinSeconds: hours(3),
    jailMaxSeconds: hours(7),
    isFederal: false,
  },
  {
    key: "run_numbers",
    name: "Run Numbers",
    tier: 2,
    unlockLevel: 5,
    nerveCost: 7,
    minReward: 500,
    maxReward: 1500,
    jailMinSeconds: hours(4),
    jailMaxSeconds: hours(8),
    isFederal: false,
  },
  {
    key: "card_skimming",
    name: "Card Skimming",
    tier: 2,
    unlockLevel: 5,
    nerveCost: 8,
    minReward: 700,
    maxReward: 2000,
    jailMinSeconds: hours(5),
    jailMaxSeconds: hours(10),
    isFederal: false,
  },
  {
    key: "carjacking",
    name: "Carjacking",
    tier: 2,
    unlockLevel: 5,
    nerveCost: 10,
    minReward: 1000,
    maxReward: 3000,
    jailMinSeconds: hours(6),
    jailMaxSeconds: hours(12),
    isFederal: false,
  },

  // Tier 3 — Level 10+
  {
    key: "hacking",
    name: "Hacking",
    tier: 3,
    unlockLevel: 10,
    nerveCost: 8,
    minReward: 1500,
    maxReward: 5000,
    jailMinSeconds: hours(8),
    jailMaxSeconds: hours(16),
    isFederal: false,
  },
  {
    key: "counterfeiting",
    name: "Counterfeiting",
    tier: 3,
    unlockLevel: 10,
    nerveCost: 10,
    minReward: 2000,
    maxReward: 6000,
    jailMinSeconds: hours(10),
    jailMaxSeconds: hours(20),
    isFederal: false,
  },
  {
    key: "extortion_racket",
    name: "Extortion Racket",
    tier: 3,
    unlockLevel: 10,
    nerveCost: 11,
    minReward: 2500,
    maxReward: 7000,
    jailMinSeconds: hours(12),
    jailMaxSeconds: hours(24),
    isFederal: false,
  },
  {
    key: "crypto_scam",
    name: "Crypto Scam",
    tier: 3,
    unlockLevel: 10,
    nerveCost: 12,
    minReward: 3000,
    maxReward: 8000,
    jailMinSeconds: hours(14),
    jailMaxSeconds: hours(28),
    isFederal: false,
  },
  {
    key: "illegal_casino",
    name: "Illegal Casino",
    tier: 3,
    unlockLevel: 10,
    nerveCost: 13,
    minReward: 4000,
    maxReward: 10000,
    jailMinSeconds: hours(16),
    jailMaxSeconds: hours(32),
    isFederal: false,
  },

  // Tier 4 — Level 15+
  {
    key: "armed_robbery",
    name: "Armed Robbery",
    tier: 4,
    unlockLevel: 15,
    nerveCost: 12,
    minReward: 5000,
    maxReward: 15000,
    jailMinSeconds: hours(12),
    jailMaxSeconds: days(2),
    isFederal: true,
  },
  {
    key: "arson_for_hire",
    name: "Arson for Hire",
    tier: 4,
    unlockLevel: 15,
    nerveCost: 13,
    minReward: 7000,
    maxReward: 18000,
    jailMinSeconds: days(1),
    jailMaxSeconds: days(3),
    isFederal: true,
  },
  {
    key: "gang_war",
    name: "Gang War",
    tier: 4,
    unlockLevel: 15,
    nerveCost: 14,
    minReward: 10000,
    maxReward: 25000,
    jailMinSeconds: days(2),
    jailMaxSeconds: days(4),
    isFederal: true,
  },
  {
    key: "train_robbery",
    name: "Train Robbery",
    tier: 4,
    unlockLevel: 15,
    nerveCost: 15,
    minReward: 12000,
    maxReward: 28000,
    jailMinSeconds: days(3),
    jailMaxSeconds: days(5),
    isFederal: true,
  },
  {
    key: "hit_on_rival",
    name: "Hit on Rival",
    tier: 4,
    unlockLevel: 15,
    nerveCost: 15,
    minReward: 15000,
    maxReward: 30000,
    jailMinSeconds: days(4),
    jailMaxSeconds: days(7),
    isFederal: true,
  },

  // Tier 5 — Level 20+
  {
    key: "plane_hijacking",
    name: "Plane Hijacking",
    tier: 5,
    unlockLevel: 20,
    nerveCost: 15,
    minReward: 25000,
    maxReward: 60000,
    jailMinSeconds: days(5),
    jailMaxSeconds: days(7),
    isFederal: true,
  },
  {
    key: "bank_heist",
    name: "Bank Heist",
    tier: 5,
    unlockLevel: 20,
    nerveCost: 15,
    minReward: 35000,
    maxReward: 90000,
    jailMinSeconds: days(5),
    jailMaxSeconds: days(7),
    isFederal: true,
  },
  {
    key: "arms_smuggling",
    name: "Arms Smuggling",
    tier: 5,
    unlockLevel: 20,
    nerveCost: 15,
    minReward: 50000,
    maxReward: 120000,
    jailMinSeconds: days(5),
    jailMaxSeconds: days(7),
    isFederal: true,
  },
  {
    key: "crypto_exchange_hack",
    name: "Crypto Exchange Hack",
    tier: 5,
    unlockLevel: 20,
    nerveCost: 15,
    minReward: 75000,
    maxReward: 180000,
    jailMinSeconds: days(5),
    jailMaxSeconds: days(7),
    isFederal: true,
  },
  {
    key: "assassination",
    name: "Assassination",
    tier: 5,
    unlockLevel: 20,
    nerveCost: 15,
    minReward: 100000,
    maxReward: 300000,
    jailMinSeconds: days(6),
    jailMaxSeconds: days(7),
    isFederal: true,
  },
];

async function setupCrimeSystem() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1) Extend users table
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS nerve INTEGER NOT NULL DEFAULT 30,
      ADD COLUMN IF NOT EXISTS max_nerve INTEGER NOT NULL DEFAULT 30,
      ADD COLUMN IF NOT EXISTS life INTEGER NOT NULL DEFAULT 100,
      ADD COLUMN IF NOT EXISTS max_life INTEGER NOT NULL DEFAULT 100,
      ADD COLUMN IF NOT EXISTS jail_until TIMESTAMP NULL,
      ADD COLUMN IF NOT EXISTS federal_jail_until TIMESTAMP NULL
    `);

    // 2) Crimes table
    await client.query(`
      CREATE TABLE IF NOT EXISTS crimes (
        id SERIAL PRIMARY KEY,
        crime_key VARCHAR(100) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        tier INTEGER NOT NULL CHECK (tier BETWEEN 1 AND 5),
        unlock_level INTEGER NOT NULL,
        nerve_cost INTEGER NOT NULL CHECK (nerve_cost > 0),
        min_reward BIGINT NOT NULL DEFAULT 0,
        max_reward BIGINT NOT NULL DEFAULT 0,
        jail_min_seconds INTEGER NOT NULL DEFAULT 0,
        jail_max_seconds INTEGER NOT NULL DEFAULT 0,
        is_federal BOOLEAN NOT NULL DEFAULT FALSE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 3) Per-user per-crime progression
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_crime_progress (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        crime_id INTEGER NOT NULL REFERENCES crimes(id) ON DELETE CASCADE,
        crime_xp BIGINT NOT NULL DEFAULT 0,
        crime_level INTEGER NOT NULL DEFAULT 0 CHECK (crime_level >= 0 AND crime_level <= 100),
        hidden_cpl NUMERIC(12, 4) NOT NULL DEFAULT 0,
        attempts INTEGER NOT NULL DEFAULT 0,
        successes INTEGER NOT NULL DEFAULT 0,
        failures INTEGER NOT NULL DEFAULT 0,
        crit_failures INTEGER NOT NULL DEFAULT 0,
        specials_found_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, crime_id)
      )
    `);

    // 4) Specials catalog
    await client.query(`
      CREATE TABLE IF NOT EXISTS crime_specials (
        id SERIAL PRIMARY KEY,
        crime_id INTEGER NOT NULL REFERENCES crimes(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        reward_money BIGINT NOT NULL DEFAULT 0,
        reward_points INTEGER NOT NULL DEFAULT 0,
        unlock_crime_level INTEGER NOT NULL DEFAULT 0 CHECK (unlock_crime_level >= 0 AND unlock_crime_level <= 100),
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 5) Player-discovered specials
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_crime_specials (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        crime_special_id INTEGER NOT NULL REFERENCES crime_specials(id) ON DELETE CASCADE,
        discovered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, crime_special_id)
      )
    `);

    // Helpful indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_crimes_tier ON crimes(tier);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_crimes_unlock_level ON crimes(unlock_level);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_crime_progress_user_id ON user_crime_progress(user_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_crime_progress_crime_id ON user_crime_progress(crime_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_crime_specials_crime_id ON crime_specials(crime_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_crime_specials_user_id ON user_crime_specials(user_id);
    `);

    // 6) Seed crimes
    for (const crime of crimes) {
      await client.query(
        `
        INSERT INTO crimes (
          crime_key,
          name,
          tier,
          unlock_level,
          nerve_cost,
          min_reward,
          max_reward,
          jail_min_seconds,
          jail_max_seconds,
          is_federal,
          is_active
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,TRUE)
        ON CONFLICT (crime_key)
        DO UPDATE SET
          name = EXCLUDED.name,
          tier = EXCLUDED.tier,
          unlock_level = EXCLUDED.unlock_level,
          nerve_cost = EXCLUDED.nerve_cost,
          min_reward = EXCLUDED.min_reward,
          max_reward = EXCLUDED.max_reward,
          jail_min_seconds = EXCLUDED.jail_min_seconds,
          jail_max_seconds = EXCLUDED.jail_max_seconds,
          is_federal = EXCLUDED.is_federal,
          updated_at = CURRENT_TIMESTAMP
        `,
        [
          crime.key,
          crime.name,
          crime.tier,
          crime.unlockLevel,
          crime.nerveCost,
          crime.minReward,
          crime.maxReward,
          crime.jailMinSeconds,
          crime.jailMaxSeconds,
          crime.isFederal,
        ]
      );
    }

    await client.query("COMMIT");

    const crimeCount = await client.query(`SELECT COUNT(*)::int AS count FROM crimes`);
    const userColumns = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name IN ('nerve', 'max_nerve', 'life', 'max_life', 'jail_until', 'federal_jail_until')
      ORDER BY column_name
    `);

    console.log("✅ Crime system setup completed successfully");
    console.log(`✅ Crimes seeded: ${crimeCount.rows[0].count}`);
    console.log(
      "✅ Added user columns:",
      userColumns.rows.map((r) => r.column_name).join(", ")
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Crime system setup failed:", error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

setupCrimeSystem();