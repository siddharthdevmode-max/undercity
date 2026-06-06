// ============================================================
// SEED CRIMES — UNDERCITY
// All 25 base crimes across 5 tiers.
// Safe to run multiple times — ON CONFLICT updates existing rows.
//
// FUTURE: subdivided outcomes, item requirements, varied loot
// tables will be added post-launch. For now: money rewards only.
// ============================================================

import { pool } from "../config/database";

const minutes = (n: number) => n * 60;
const hours   = (n: number) => n * 3600;
const days    = (n: number) => n * 86400;

interface CrimeSeed {
  crime_key:        string;
  name:             string;
  tier:             number;
  unlock_level:     number;
  nerve_cost:       number;
  min_reward:       number;
  max_reward:       number;
  jail_min_seconds: number;
  jail_max_seconds: number;
  is_federal:       boolean;
}

// ============================================================
// REWARD LADDER
//
// Overlap formula: next crime min = prev crime max × 0.9
// Hard limits per tier:
//   Tier 1: $0        → $5,000
//   Tier 2: $5,000    → $50,000
//   Tier 3: $50,000   → $500,000
//   Tier 4: $500,000  → $2,500,000
//   Tier 5: $2,500,000 → $10,000,000
//
// CRIT FAIL (handled in crimeEngine.ts):
//   Tier 1-2: percentage of cash, capped, never negative
//   Tier 3-5: flat loss, CAN go negative (debt mechanic)
//
// NERVE COSTS:
//   Tier 1: 2,3,4,5,6
//   Tier 2: 7,8,9,10,11
//   Tier 3: 12,13,14,15,16
//   Tier 4: 17,18,19,20,21
//   Tier 5: 22,23,24,25,26
// ============================================================

const crimes: CrimeSeed[] = [

  // ═══════════════════════════════════════════════════════════
  // TIER 1 — Street (unlock level 1)
  // Reward: $0 → $5,000 | Crit fail: 5-25% cash, cap $2,000
  // ═══════════════════════════════════════════════════════════

  {
    crime_key:        "beg_for_change",
    name:             "Beg for Change",
    tier:             1,
    unlock_level:     1,
    nerve_cost:       2,
    min_reward:       0,
    max_reward:       500,
    jail_min_seconds: 0,
    jail_max_seconds: 0,
    is_federal:       false,
  },
  {
    crime_key:        "pickpocket",
    name:             "Pickpocket",
    tier:             1,
    unlock_level:     1,
    nerve_cost:       3,
    min_reward:       450,
    max_reward:       1_200,
    jail_min_seconds: minutes(25),
    jail_max_seconds: minutes(45),
    is_federal:       false,
  },
  {
    crime_key:        "shoplift",
    name:             "Shoplift",
    tier:             1,
    unlock_level:     1,
    nerve_cost:       4,
    min_reward:       1_080,
    max_reward:       2_000,
    jail_min_seconds: minutes(40),
    jail_max_seconds: minutes(90),
    is_federal:       false,
  },
  {
    crime_key:        "vandalize_property",
    name:             "Vandalize Property",
    tier:             1,
    unlock_level:     1,
    nerve_cost:       5,
    min_reward:       1_800,
    max_reward:       3_200,
    jail_min_seconds: minutes(60),
    jail_max_seconds: minutes(150),
    is_federal:       false,
  },
  {
    crime_key:        "snatching",
    name:             "Snatching",
    tier:             1,
    unlock_level:     1,
    nerve_cost:       6,
    min_reward:       2_880,
    max_reward:       5_000,
    jail_min_seconds: minutes(90),
    jail_max_seconds: minutes(180),
    is_federal:       false,
  },

  // ═══════════════════════════════════════════════════════════
  // TIER 2 — Hustle (unlock level 5)
  // Reward: $5,000 → $50,000 | Crit fail: 10-35% cash, cap $30,000
  // ═══════════════════════════════════════════════════════════

  {
    crime_key:        "burglary",
    name:             "Burglary",
    tier:             2,
    unlock_level:     5,
    nerve_cost:       7,
    min_reward:       5_000,
    max_reward:       10_000,
    jail_min_seconds: hours(2),
    jail_max_seconds: hours(5),
    is_federal:       false,
  },
  {
    crime_key:        "street_drug_deal",
    name:             "Street Drug Deal",
    tier:             2,
    unlock_level:     5,
    nerve_cost:       8,
    min_reward:       9_000,
    max_reward:       18_000,
    jail_min_seconds: hours(3),
    jail_max_seconds: hours(7),
    is_federal:       false,
  },
  {
    crime_key:        "run_numbers",
    name:             "Run Numbers",
    tier:             2,
    unlock_level:     5,
    nerve_cost:       9,
    min_reward:       16_200,
    max_reward:       28_000,
    jail_min_seconds: hours(4),
    jail_max_seconds: hours(8),
    is_federal:       false,
  },
  {
    crime_key:        "card_skimming",
    name:             "Card Skimming",
    tier:             2,
    unlock_level:     5,
    nerve_cost:       10,
    min_reward:       25_200,
    max_reward:       40_000,
    jail_min_seconds: hours(5),
    jail_max_seconds: hours(10),
    is_federal:       false,
  },
  {
    crime_key:        "carjacking",
    name:             "Carjacking",
    tier:             2,
    unlock_level:     5,
    nerve_cost:       11,
    min_reward:       36_000,
    max_reward:       50_000,
    jail_min_seconds: hours(6),
    jail_max_seconds: hours(12),
    is_federal:       false,
  },

  // ═══════════════════════════════════════════════════════════
  // TIER 3 — Organized Crime (unlock level 10)
  // Reward: $50,000 → $500,000 | Crit fail: flat $50k-$200k, CAN go negative
  // ═══════════════════════════════════════════════════════════

  {
    crime_key:        "hacking",
    name:             "Hacking",
    tier:             3,
    unlock_level:     10,
    nerve_cost:       12,
    min_reward:       50_000,
    max_reward:       100_000,
    jail_min_seconds: hours(8),
    jail_max_seconds: hours(16),
    is_federal:       false,
  },
  {
    crime_key:        "counterfeiting",
    name:             "Counterfeiting",
    tier:             3,
    unlock_level:     10,
    nerve_cost:       13,
    min_reward:       90_000,
    max_reward:       180_000,
    jail_min_seconds: hours(10),
    jail_max_seconds: hours(20),
    is_federal:       false,
  },
  {
    crime_key:        "extortion_racket",
    name:             "Extortion Racket",
    tier:             3,
    unlock_level:     10,
    nerve_cost:       14,
    min_reward:       162_000,
    max_reward:       300_000,
    jail_min_seconds: hours(12),
    jail_max_seconds: hours(24),
    is_federal:       false,
  },
  {
    crime_key:        "crypto_scam",
    name:             "Crypto Scam",
    tier:             3,
    unlock_level:     10,
    nerve_cost:       15,
    min_reward:       270_000,
    max_reward:       420_000,
    jail_min_seconds: hours(14),
    jail_max_seconds: hours(28),
    is_federal:       false,
  },
  {
    crime_key:        "illegal_casino",
    name:             "Illegal Casino",
    tier:             3,
    unlock_level:     10,
    nerve_cost:       16,
    min_reward:       378_000,
    max_reward:       500_000,
    jail_min_seconds: hours(16),
    jail_max_seconds: hours(32),
    is_federal:       false,
  },

  // ═══════════════════════════════════════════════════════════
  // TIER 4 — Serious (unlock level 15)
  // Reward: $500,000 → $2,500,000 | Crit fail: flat $500k-$1.25M, CAN go negative
  // All federal crimes
  // ═══════════════════════════════════════════════════════════

  {
    crime_key:        "armed_robbery",
    name:             "Armed Robbery",
    tier:             4,
    unlock_level:     15,
    nerve_cost:       17,
    min_reward:       500_000,
    max_reward:       900_000,
    jail_min_seconds: hours(12),
    jail_max_seconds: days(2),
    is_federal:       true,
  },
  {
    crime_key:        "arson_for_hire",
    name:             "Arson for Hire",
    tier:             4,
    unlock_level:     15,
    nerve_cost:       18,
    min_reward:       810_000,
    max_reward:       1_400_000,
    jail_min_seconds: days(1),
    jail_max_seconds: days(3),
    is_federal:       true,
  },
  {
    crime_key:        "gang_war",
    name:             "Gang War",
    tier:             4,
    unlock_level:     15,
    nerve_cost:       19,
    min_reward:       1_260_000,
    max_reward:       1_800_000,
    jail_min_seconds: days(2),
    jail_max_seconds: days(4),
    is_federal:       true,
  },
  {
    crime_key:        "train_robbery",
    name:             "Train Robbery",
    tier:             4,
    unlock_level:     15,
    nerve_cost:       20,
    min_reward:       1_620_000,
    max_reward:       2_200_000,
    jail_min_seconds: days(3),
    jail_max_seconds: days(5),
    is_federal:       true,
  },
  {
    crime_key:        "hit_on_rival",
    name:             "Hit on Rival",
    tier:             4,
    unlock_level:     15,
    nerve_cost:       21,
    min_reward:       1_980_000,
    max_reward:       2_500_000,
    jail_min_seconds: days(4),
    jail_max_seconds: days(7),
    is_federal:       true,
  },

  // ═══════════════════════════════════════════════════════════
  // TIER 5 — Elite (unlock level 20)
  // Reward: $2,500,000 → $10,000,000 | Crit fail: flat $2.5M-$5M, CAN go negative
  // All federal crimes
  // ═══════════════════════════════════════════════════════════

  {
    crime_key:        "plane_hijacking",
    name:             "Plane Hijacking",
    tier:             5,
    unlock_level:     20,
    nerve_cost:       22,
    min_reward:       2_500_000,
    max_reward:       4_000_000,
    jail_min_seconds: days(5),
    jail_max_seconds: days(7),
    is_federal:       true,
  },
  {
    crime_key:        "bank_heist",
    name:             "Bank Heist",
    tier:             5,
    unlock_level:     20,
    nerve_cost:       23,
    min_reward:       3_600_000,
    max_reward:       5_500_000,
    jail_min_seconds: days(5),
    jail_max_seconds: days(7),
    is_federal:       true,
  },
  {
    crime_key:        "arms_smuggling",
    name:             "Arms Smuggling",
    tier:             5,
    unlock_level:     20,
    nerve_cost:       24,
    min_reward:       4_950_000,
    max_reward:       7_000_000,
    jail_min_seconds: days(5),
    jail_max_seconds: days(7),
    is_federal:       true,
  },
  {
    crime_key:        "crypto_exchange_hack",
    name:             "Crypto Exchange Hack",
    tier:             5,
    unlock_level:     20,
    nerve_cost:       25,
    min_reward:       6_300_000,
    max_reward:       8_500_000,
    jail_min_seconds: days(5),
    jail_max_seconds: days(7),
    is_federal:       true,
  },
  {
    crime_key:        "assassination",
    name:             "Assassination",
    tier:             5,
    unlock_level:     20,
    nerve_cost:       26,
    min_reward:       7_650_000,
    max_reward:       10_000_000,
    jail_min_seconds: days(6),
    jail_max_seconds: days(7),
    is_federal:       true,
  },
];

// ============================================================
// SEED FUNCTION
// Uses ON CONFLICT to safely update existing crimes
// ============================================================

async function seedCrimes(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    let inserted = 0;
    let updated  = 0;

    for (const crime of crimes) {
      const result = await client.query(
        `INSERT INTO crimes (
          crime_key, name, tier, unlock_level, nerve_cost,
          min_reward, max_reward,
          jail_min_seconds, jail_max_seconds, is_federal
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        ON CONFLICT (crime_key)
        DO UPDATE SET
          name             = EXCLUDED.name,
          tier             = EXCLUDED.tier,
          unlock_level     = EXCLUDED.unlock_level,
          nerve_cost       = EXCLUDED.nerve_cost,
          min_reward       = EXCLUDED.min_reward,
          max_reward       = EXCLUDED.max_reward,
          jail_min_seconds = EXCLUDED.jail_min_seconds,
          jail_max_seconds = EXCLUDED.jail_max_seconds,
          is_federal       = EXCLUDED.is_federal
        RETURNING (xmax = 0) AS is_insert`,
        [
          crime.crime_key,
          crime.name,
          crime.tier,
          crime.unlock_level,
          crime.nerve_cost,
          crime.min_reward,
          crime.max_reward,
          crime.jail_min_seconds,
          crime.jail_max_seconds,
          crime.is_federal,
        ]
      );

      const isInsert = result.rows[0]?.is_insert;
      if (isInsert) {
        inserted++;
        console.log(`✅ Inserted: ${crime.crime_key}`);
      } else {
        updated++;
        console.log(`🔄 Updated: ${crime.crime_key}`);
      }
    }

    // Delete old crimes that are no longer in the seed list
    const validKeys = crimes.map((c) => c.crime_key);
    const deleteResult = await client.query(
      `DELETE FROM crimes WHERE crime_key != ALL($1::text[]) RETURNING crime_key`,
      [validKeys]
    );

    if ((deleteResult.rowCount ?? 0) > 0) {
      for (const row of deleteResult.rows as { crime_key: string }[]) {
        console.log(`🗑️  Removed old crime: ${row.crime_key}`);
      }
    }

    await client.query("COMMIT");

    console.log("\n✅ Crime seeding completed");
    console.log(`   ✅ Inserted: ${inserted}`);
    console.log(`   🔄 Updated:  ${updated}`);
    console.log(`   🗑️  Removed:  ${deleteResult.rowCount ?? 0}`);

    // Summary by tier
    const summary = await client.query(
      `SELECT tier, COUNT(*)::int AS count,
              MIN(min_reward)::text AS min_r,
              MAX(max_reward)::text AS max_r
       FROM crimes GROUP BY tier ORDER BY tier`
    );

    console.log("\n📊 Crimes by tier:");
    const tierNames: Record<number, string> = {
      1: "Street",  2: "Hustle",  3: "Organized",
      4: "Serious",  5: "Elite",
    };
    for (const row of summary.rows as { tier: number; count: number; min_r: string; max_r: string }[]) {
      console.log(`   Tier ${row.tier} (${tierNames[row.tier]}): ${row.count} crimes | $${Number(row.min_r).toLocaleString()} → $${Number(row.max_r).toLocaleString()}`);
    }

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Crime seeding failed:", error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedCrimes();
