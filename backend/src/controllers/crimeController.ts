import { Request, Response } from "express";
import { pool } from "../config/database";
import {
  calcCrimeLevel,
  calcMaxNerve,
  CrimeDefinition,
  CrimeProgress,
  CrimeSpecial,
  resolveCrimeOutcome,
} from "../services/crimeEngine";

function toNumber(value: any): number {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

function parseCrime(row: any): CrimeDefinition {
  return {
    id: toNumber(row.id),
    crime_key: row.crime_key,
    name: row.name,
    tier: toNumber(row.tier),
    unlock_level: toNumber(row.unlock_level),
    nerve_cost: toNumber(row.nerve_cost),
    min_reward: toNumber(row.min_reward),
    max_reward: toNumber(row.max_reward),
    jail_min_seconds: toNumber(row.jail_min_seconds),
    jail_max_seconds: toNumber(row.jail_max_seconds),
    is_federal: !!row.is_federal,
  };
}

function parseProgress(row: any): CrimeProgress {
  return {
    id: row?.id ? toNumber(row.id) : null,
    user_id: toNumber(row.user_id),
    crime_id: toNumber(row.crime_id),
    crime_xp: toNumber(row.crime_xp),
    crime_level: toNumber(row.crime_level),
    hidden_cpl: Number(row.hidden_cpl ?? 0),
    attempts: toNumber(row.attempts),
    successes: toNumber(row.successes),
    failures: toNumber(row.failures),
    crit_failures: toNumber(row.crit_failures),
    specials_found_count: toNumber(row.specials_found_count),
  };
}

function parseSpecial(row: any): CrimeSpecial {
  return {
    id: toNumber(row.id),
    crime_id: toNumber(row.crime_id),
    title: row.title,
    description: row.description,
    reward_money: toNumber(row.reward_money),
    reward_points: toNumber(row.reward_points),
    unlock_crime_level: toNumber(row.unlock_crime_level),
  };
}

function isFutureDate(value: any): boolean {
  if (!value) return false;
  const date = new Date(value);
  return date.getTime() > Date.now();
}

async function getCurrentUserByFirebaseUid(client: any, firebaseUid: string) {
  const result = await client.query(
    `SELECT * FROM users WHERE firebase_uid = $1 LIMIT 1`,
    [firebaseUid]
  );

  return result.rows[0] || null;
}

export const getCrimes = async (req: Request, res: Response) => {
  const client = await pool.connect();

  try {
    const firebaseUser = (req as any).firebaseUser;
    const firebaseUid = firebaseUser?.uid;

    if (!firebaseUid) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const user = await getCurrentUserByFirebaseUid(client, firebaseUid);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const crimesResult = await client.query(
      `
      SELECT
        c.*,
        COALESCE(ucp.crime_xp, 0) AS crime_xp,
        COALESCE(ucp.crime_level, 0) AS crime_level,
        COALESCE(ucp.attempts, 0) AS attempts,
        COALESCE(ucp.successes, 0) AS successes,
        COALESCE(ucp.failures, 0) AS failures,
        COALESCE(ucp.crit_failures, 0) AS crit_failures,
        COALESCE(ucp.specials_found_count, 0) AS specials_found_count,
        CASE WHEN $2 >= c.unlock_level THEN TRUE ELSE FALSE END AS unlocked,
        (
          SELECT COUNT(*)
          FROM crime_specials cs
          WHERE cs.crime_id = c.id
            AND cs.is_active = TRUE
            AND cs.unlock_crime_level <= COALESCE(ucp.crime_level, 0)
            AND NOT EXISTS (
              SELECT 1
              FROM user_crime_specials ucs
              WHERE ucs.user_id = $1
                AND ucs.crime_special_id = cs.id
            )
        )::int AS available_specials_count
      FROM crimes c
      LEFT JOIN user_crime_progress ucp
        ON ucp.crime_id = c.id
       AND ucp.user_id = $1
      WHERE c.is_active = TRUE
      ORDER BY c.tier ASC, c.id ASC
      `,
      [user.id, user.level]
    );

    const data = crimesResult.rows.map((row: any) => ({
      id: toNumber(row.id),
      key: row.crime_key,
      name: row.name,
      tier: toNumber(row.tier),
      unlockLevel: toNumber(row.unlock_level),
      nerveCost: toNumber(row.nerve_cost),
      minReward: toNumber(row.min_reward),
      maxReward: toNumber(row.max_reward),
      isFederal: !!row.is_federal,
      unlocked: !!row.unlocked,
      progress: {
        crimeXp: toNumber(row.crime_xp),
        crimeLevel: toNumber(row.crime_level),
        attempts: toNumber(row.attempts),
        successes: toNumber(row.successes),
        failures: toNumber(row.failures),
        critFailures: toNumber(row.crit_failures),
        specialsFoundCount: toNumber(row.specials_found_count),
        availableSpecialsCount: toNumber(row.available_specials_count),
      },
      jailRange: {
        minSeconds: toNumber(row.jail_min_seconds),
        maxSeconds: toNumber(row.jail_max_seconds),
      },
    }));

    return res.json({
      user: {
        id: toNumber(user.id),
        username: user.username,
        level: toNumber(user.level),
        money: toNumber(user.money),
        points: toNumber(user.points),
        nerve: toNumber(user.nerve),
        maxNerve: toNumber(user.max_nerve),
        life: toNumber(user.life),
        maxLife: toNumber(user.max_life),
        jailUntil: user.jail_until,
        federalJailUntil: user.federal_jail_until,
        inJail: isFutureDate(user.jail_until),
        inFederalJail: isFutureDate(user.federal_jail_until),
      },
      crimes: data,
    });
  } catch (error: any) {
    console.error("getCrimes error:", error);
    return res.status(500).json({
      message: "Failed to fetch crimes",
      error: error.message,
    });
  } finally {
    client.release();
  }
};

export const attemptCrime = async (req: Request, res: Response) => {
  const client = await pool.connect();

  try {
    const firebaseUser = (req as any).firebaseUser;
    const firebaseUid = firebaseUser?.uid;
    const { crimeKey } = req.body;

    if (!firebaseUid) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!crimeKey || typeof crimeKey !== "string") {
      return res.status(400).json({ message: "crimeKey is required" });
    }

    await client.query("BEGIN");

    const user = await getCurrentUserByFirebaseUid(client, firebaseUid);

    if (!user) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "User not found" });
    }

    const activeNormalJail = isFutureDate(user.jail_until);
    const activeFederalJail = isFutureDate(user.federal_jail_until);

    if (activeFederalJail) {
      await client.query("ROLLBACK");
      return res.status(423).json({
        message: "You are currently in federal jail.",
        federalJailUntil: user.federal_jail_until,
      });
    }

    if (activeNormalJail) {
      await client.query("ROLLBACK");
      return res.status(423).json({
        message: "You are currently in jail.",
        jailUntil: user.jail_until,
      });
    }

    const crimeResult = await client.query(
      `
      SELECT *
      FROM crimes
      WHERE crime_key = $1
        AND is_active = TRUE
      LIMIT 1
      `,
      [crimeKey]
    );

    if (crimeResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Crime not found" });
    }

    const crime = parseCrime(crimeResult.rows[0]);

    if (toNumber(user.level) < crime.unlock_level) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        message: `You need to be level ${crime.unlock_level} to attempt this crime.`,
      });
    }

    if (toNumber(user.nerve) < crime.nerve_cost) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Not enough nerve.",
        currentNerve: toNumber(user.nerve),
        requiredNerve: crime.nerve_cost,
      });
    }

    await client.query(
      `
      INSERT INTO user_crime_progress (user_id, crime_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, crime_id) DO NOTHING
      `,
      [user.id, crime.id]
    );

    const progressResult = await client.query(
      `
      SELECT *
      FROM user_crime_progress
      WHERE user_id = $1
        AND crime_id = $2
      LIMIT 1
      `,
      [user.id, crime.id]
    );

    const progress = parseProgress(progressResult.rows[0]);

    const specialResult = await client.query(
      `
      SELECT cs.*
      FROM crime_specials cs
      WHERE cs.crime_id = $1
        AND cs.is_active = TRUE
        AND cs.unlock_crime_level <= $2
        AND NOT EXISTS (
          SELECT 1
          FROM user_crime_specials ucs
          WHERE ucs.user_id = $3
            AND ucs.crime_special_id = cs.id
        )
      ORDER BY RANDOM()
      LIMIT 1
      `,
      [crime.id, progress.crime_level, user.id]
    );

    const availableSpecial =
      specialResult.rows.length > 0 ? parseSpecial(specialResult.rows[0]) : null;

    const outcomeResult = resolveCrimeOutcome(
      crime,
      progress,
      availableSpecial,
      toNumber(user.money),
      toNumber(user.max_life)
    );

    const updatedNerve = Math.max(0, toNumber(user.nerve) - crime.nerve_cost);
    const updatedMoney = Math.max(
      0,
      toNumber(user.money) - outcomeResult.money_loss + outcomeResult.reward_money
    );
    const updatedPoints = Math.max(
      0,
      toNumber(user.points) + outcomeResult.reward_points
    );

    // Temporary phase-1 life handling:
    // keep player alive at minimum 1 until hospital/death systems exist
    const updatedLife = Math.max(
      1,
      toNumber(user.life) - outcomeResult.life_loss
    );

    const updatedCrimeXp = progress.crime_xp + outcomeResult.xp_gained;
    const updatedCrimeLevel = calcCrimeLevel(updatedCrimeXp);
    const updatedHiddenCpl = Math.max(
      0,
      progress.hidden_cpl + outcomeResult.cpl_change
    );

    const attempts = progress.attempts + 1;
    const successes =
      progress.successes +
      (outcomeResult.outcome === "success" || outcomeResult.outcome === "special"
        ? 1
        : 0);
    const failures =
      progress.failures + (outcomeResult.outcome === "fail" ? 1 : 0);
    const critFailures =
      progress.crit_failures +
      (outcomeResult.outcome === "crit_fail" ? 1 : 0);

    let specialDiscovered = false;

    if (outcomeResult.outcome === "special" && outcomeResult.special) {
      const discoveredResult = await client.query(
        `
        INSERT INTO user_crime_specials (user_id, crime_special_id)
        VALUES ($1, $2)
        ON CONFLICT (user_id, crime_special_id) DO NOTHING
        RETURNING id
        `,
        [user.id, outcomeResult.special.id]
      );

      specialDiscovered = discoveredResult.rows.length > 0;
    }

    const updatedSpecialsFoundCount =
      progress.specials_found_count + (specialDiscovered ? 1 : 0);

    await client.query(
      `
      UPDATE user_crime_progress
      SET
        crime_xp = $1,
        crime_level = $2,
        hidden_cpl = $3,
        attempts = $4,
        successes = $5,
        failures = $6,
        crit_failures = $7,
        specials_found_count = $8,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $9
        AND crime_id = $10
      `,
      [
        updatedCrimeXp,
        updatedCrimeLevel,
        updatedHiddenCpl,
        attempts,
        successes,
        failures,
        critFailures,
        updatedSpecialsFoundCount,
        user.id,
        crime.id,
      ]
    );

    let jailUntil: Date | null = user.jail_until ? new Date(user.jail_until) : null;
    let federalJailUntil: Date | null = user.federal_jail_until
      ? new Date(user.federal_jail_until)
      : null;

    if (outcomeResult.outcome === "crit_fail" && outcomeResult.jail_seconds > 0) {
      const until = new Date(Date.now() + outcomeResult.jail_seconds * 1000);

      if (crime.is_federal) {
        federalJailUntil = until;
      } else {
        jailUntil = until;
      }
    }

    const totalXpResult = await client.query(
      `
      SELECT COALESCE(SUM(crime_xp), 0) AS total_xp
      FROM user_crime_progress
      WHERE user_id = $1
      `,
      [user.id]
    );

    const totalCrimeXp = toNumber(totalXpResult.rows[0]?.total_xp ?? 0);
    const updatedMaxNerve = calcMaxNerve(totalCrimeXp);
    const finalNerve = Math.min(updatedNerve, updatedMaxNerve);

    await client.query(
      `
      UPDATE users
      SET
        money = $1,
        points = $2,
        nerve = $3,
        max_nerve = $4,
        life = $5,
        jail_until = $6,
        federal_jail_until = $7
      WHERE id = $8
      `,
      [
        updatedMoney,
        updatedPoints,
        finalNerve,
        updatedMaxNerve,
        updatedLife,
        jailUntil,
        federalJailUntil,
        user.id,
      ]
    );

    await client.query("COMMIT");

    return res.json({
      outcome: outcomeResult.outcome,
      message: outcomeResult.message,
      crime: {
        id: crime.id,
        key: crime.crime_key,
        name: crime.name,
        tier: crime.tier,
        nerveCost: crime.nerve_cost,
        isFederal: crime.is_federal,
      },
      rewards: {
        money: outcomeResult.reward_money,
        points: outcomeResult.reward_points,
        xpGained: outcomeResult.xp_gained,
      },
      penalties: {
        moneyLost: outcomeResult.money_loss,
        lifeLost: outcomeResult.life_loss,
        jailSeconds: outcomeResult.jail_seconds,
        jailType:
          outcomeResult.jail_seconds > 0
            ? crime.is_federal
              ? "federal"
              : "normal"
            : null,
      },
      special: outcomeResult.special
        ? {
            id: outcomeResult.special.id,
            title: outcomeResult.special.title,
            description: outcomeResult.special.description,
            rewardMoney: outcomeResult.special.reward_money,
            rewardPoints: outcomeResult.special.reward_points,
            wasNewlyDiscovered: specialDiscovered,
          }
        : null,
      progress: {
        crimeXp: updatedCrimeXp,
        crimeLevel: updatedCrimeLevel,
        attempts,
        successes,
        failures,
        critFailures,
        specialsFoundCount: updatedSpecialsFoundCount,
      },
      user: {
        money: updatedMoney,
        points: updatedPoints,
        nerve: finalNerve,
        maxNerve: updatedMaxNerve,
        life: updatedLife,
        maxLife: toNumber(user.max_life),
        jailUntil: jailUntil ? jailUntil.toISOString() : null,
        federalJailUntil: federalJailUntil
          ? federalJailUntil.toISOString()
          : null,
      },
    });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("attemptCrime error:", error);
    return res.status(500).json({
      message: "Crime attempt failed",
      error: error.message,
    });
  } finally {
    client.release();
  }
};