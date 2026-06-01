import { pool } from "../config/database";

interface SpecialSeed {
  crimeKey: string;
  title: string;
  description: string;
  rewardMoney: number;
  rewardPoints: number;
  unlockCrimeLevel: number;
}

const specials: SpecialSeed[] = [
  // ═══════════════════════════════════════════
  // TIER 1 — Beg for Change (3 sample specials)
  // ═══════════════════════════════════════════
  {
    crimeKey: "beg_for_change",
    title: "Generous Businessman",
    description: "A wealthy businessman took pity on you and handed you a $100 bill. 'Get yourself cleaned up, kid.'",
    rewardMoney: 100,
    rewardPoints: 5,
    unlockCrimeLevel: 0,
  },
  {
    crimeKey: "beg_for_change",
    title: "Lost Wallet",
    description: "You found a wallet on the ground while begging. No ID inside, but $250 in cash. Finders keepers.",
    rewardMoney: 250,
    rewardPoints: 10,
    unlockCrimeLevel: 5,
  },
  {
    crimeKey: "beg_for_change",
    title: "Street Performer's Tip",
    description: "A street performer shared their earnings with you. 'We're all hustling out here.' You got $500.",
    rewardMoney: 500,
    rewardPoints: 25,
    unlockCrimeLevel: 15,
  },

  // ═══════════════════════════════════════════
  // TIER 1 — Pickpocket (3 sample specials)
  // ═══════════════════════════════════════════
  {
    crimeKey: "pickpocket",
    title: "Diamond Ring",
    description: "You lifted a wallet and found a diamond ring tucked inside. Pawned it for $800.",
    rewardMoney: 800,
    rewardPoints: 15,
    unlockCrimeLevel: 0,
  },
  {
    crimeKey: "pickpocket",
    title: "Crypto Whale's Phone",
    description: "The phone you snatched was unlocked with a crypto wallet. Transferred $1,500 before they noticed.",
    rewardMoney: 1500,
    rewardPoints: 30,
    unlockCrimeLevel: 10,
  },
  {
    crimeKey: "pickpocket",
    title: "Undercover Cop's Badge",
    description: "You pickpocketed an undercover cop and got their badge. Sold it to a crime boss for $3,000.",
    rewardMoney: 3000,
    rewardPoints: 50,
    unlockCrimeLevel: 25,
  },

  // ═══════════════════════════════════════════
  // TIER 1 — Shoplift (3 sample specials)
  // ═══════════════════════════════════════════
  {
    crimeKey: "shoplift",
    title: "Rare Collectible",
    description: "You accidentally grabbed a rare collectible worth $600. Some collector paid cash, no questions.",
    rewardMoney: 600,
    rewardPoints: 12,
    unlockCrimeLevel: 0,
  },
  {
    crimeKey: "shoplift",
    title: "Designer Watch",
    description: "Hidden behind cheap watches was a Rolex. Fenced it for $2,000.",
    rewardMoney: 2000,
    rewardPoints: 35,
    unlockCrimeLevel: 12,
  },
  {
    crimeKey: "shoplift",
    title: "Store Safe Code",
    description: "You overheard the manager's safe code while hiding. Came back at night and grabbed $5,000.",
    rewardMoney: 5000,
    rewardPoints: 75,
    unlockCrimeLevel: 30,
  },

  // ═══════════════════════════════════════════
  // TIER 1 — Vandalize Property (3 sample specials)
  // ═══════════════════════════════════════════
  {
    crimeKey: "vandalize_property",
    title: "Street Cred",
    description: "Your graffiti tag went viral on social media. A local gang paid you $300 to tag their territory.",
    rewardMoney: 300,
    rewardPoints: 20,
    unlockCrimeLevel: 0,
  },
  {
    crimeKey: "vandalize_property",
    title: "Art Collector",
    description: "A quirky art collector saw your work and bought the whole wall section for $1,200.",
    rewardMoney: 1200,
    rewardPoints: 40,
    unlockCrimeLevel: 10,
  },
  {
    crimeKey: "vandalize_property",
    title: "Insurance Scam Partner",
    description: "The building owner caught you but offered a deal — trash the place for insurance money. Cut: $4,000.",
    rewardMoney: 4000,
    rewardPoints: 60,
    unlockCrimeLevel: 25,
  },

  // ═══════════════════════════════════════════
  // TIER 1 — Snatching (3 sample specials)
  // ═══════════════════════════════════════════
  {
    crimeKey: "snatching",
    title: "Gold Chain",
    description: "That chain you snatched? Solid gold. Pawned it for $700.",
    rewardMoney: 700,
    rewardPoints: 15,
    unlockCrimeLevel: 0,
  },
  {
    crimeKey: "snatching",
    title: "Celebrity's Bag",
    description: "You snatched a bag from a minor celebrity. Sold the story and contents for $2,500.",
    rewardMoney: 2500,
    rewardPoints: 45,
    unlockCrimeLevel: 12,
  },
  {
    crimeKey: "snatching",
    title: "Briefcase Full of Cash",
    description: "Wrong place, right time. That briefcase had $8,000 cash and some documents you burned.",
    rewardMoney: 8000,
    rewardPoints: 100,
    unlockCrimeLevel: 35,
  },

  // ═══════════════════════════════════════════
  // TIER 2 — Burglary (2 sample specials)
  // ═══════════════════════════════════════════
  {
    crimeKey: "burglary",
    title: "Hidden Safe",
    description: "Behind a painting, you found a wall safe. Cracked it open — $3,000 in cash and gold coins.",
    rewardMoney: 3000,
    rewardPoints: 50,
    unlockCrimeLevel: 0,
  },
  {
    crimeKey: "burglary",
    title: "Drug Dealer's Stash",
    description: "Turns out you robbed a dealer's place. Found $10,000 and product you flipped fast.",
    rewardMoney: 10000,
    rewardPoints: 100,
    unlockCrimeLevel: 20,
  },

  // ═══════════════════════════════════════════
  // TIER 2 — Street Drug Deal (2 sample specials)
  // ═══════════════════════════════════════════
  {
    crimeKey: "street_drug_deal",
    title: "Repeat Customer",
    description: "Your buyer loved the product and bought double. Made $2,500 in one deal.",
    rewardMoney: 2500,
    rewardPoints: 40,
    unlockCrimeLevel: 0,
  },
  {
    crimeKey: "street_drug_deal",
    title: "Cartel Connection",
    description: "A cartel scout noticed your hustle. Offered you a one-time deal worth $8,000.",
    rewardMoney: 8000,
    rewardPoints: 80,
    unlockCrimeLevel: 25,
  },

  // ═══════════════════════════════════════════
  // TIER 3 — Hacking (2 sample specials)
  // ═══════════════════════════════════════════
  {
    crimeKey: "hacking",
    title: "Corporate Secrets",
    description: "You stumbled onto trade secrets. A rival company paid $15,000 for the data.",
    rewardMoney: 15000,
    rewardPoints: 150,
    unlockCrimeLevel: 0,
  },
  {
    crimeKey: "hacking",
    title: "Crypto Wallet Drain",
    description: "Found an unsecured hot wallet. Drained $50,000 in crypto before they noticed.",
    rewardMoney: 50000,
    rewardPoints: 300,
    unlockCrimeLevel: 30,
  },

  // ═══════════════════════════════════════════
  // TIER 4 — Armed Robbery (1 sample special)
  // ═══════════════════════════════════════════
  {
    crimeKey: "armed_robbery",
    title: "Manager's Secret Stash",
    description: "The manager begged you not to check under the counter. You did. $40,000 in a duffel bag.",
    rewardMoney: 40000,
    rewardPoints: 200,
    unlockCrimeLevel: 10,
  },

  // ═══════════════════════════════════════════
  // TIER 5 — Bank Heist (1 sample special)
  // ═══════════════════════════════════════════
  {
    crimeKey: "bank_heist",
    title: "Safety Deposit Jackpot",
    description: "One of the safety deposit boxes had bearer bonds worth $250,000. Untraceable.",
    rewardMoney: 250000,
    rewardPoints: 500,
    unlockCrimeLevel: 25,
  },
];

async function seedSpecials() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    let inserted = 0;
    let skipped = 0;

    for (const special of specials) {
      // Get crime ID
      const crimeResult = await client.query(
        `SELECT id FROM crimes WHERE crime_key = $1 LIMIT 1`,
        [special.crimeKey]
      );

      if (crimeResult.rows.length === 0) {
        console.log(`⚠️ Crime not found: ${special.crimeKey}`);
        skipped++;
        continue;
      }

      const crimeId = crimeResult.rows[0].id;

      // Check if special already exists
      const existingResult = await client.query(
        `SELECT id FROM crime_specials WHERE crime_id = $1 AND title = $2 LIMIT 1`,
        [crimeId, special.title]
      );

      if (existingResult.rows.length > 0) {
        skipped++;
        continue;
      }

      // Insert special
      await client.query(
        `
        INSERT INTO crime_specials (
          crime_id,
          title,
          description,
          reward_money,
          reward_points,
          unlock_crime_level,
          is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, TRUE)
        `,
        [
          crimeId,
          special.title,
          special.description,
          special.rewardMoney,
          special.rewardPoints,
          special.unlockCrimeLevel,
        ]
      );

      inserted++;
    }

    await client.query("COMMIT");

    console.log("✅ Specials seeding completed");
    console.log(`✅ Inserted: ${inserted}`);
    console.log(`⏭️ Skipped (already exist): ${skipped}`);

    // Show count per crime
    const countResult = await client.query(`
      SELECT c.crime_key, c.name, COUNT(cs.id)::int AS special_count
      FROM crimes c
      LEFT JOIN crime_specials cs ON cs.crime_id = c.id
      GROUP BY c.id, c.crime_key, c.name
      ORDER BY c.tier, c.id
    `);

    console.log("\n📊 Specials per crime:");
    for (const row of countResult.rows) {
      console.log(`   ${row.name}: ${row.special_count}`);
    }

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedSpecials();
