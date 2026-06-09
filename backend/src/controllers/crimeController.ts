// ============================================================
// CRIME CONTROLLER — UNDERCITY
// ============================================================

import { Request, Response } from "express";
import { PoolClient }        from "pg";
import { pool }              from "../config/database";
import {
  toNumber,
  isFutureDate,
  getUserByFirebaseUid,
  calcMaxNerve,
  calcMaxLife,
}                            from "../models/userModels";
import { getRequestLogger }  from "../utils/logger";
import { UnauthorizedError, NotFoundError } from "../utils/errors";
import { recordFingerprint, checkMultiAccount } from "../services/fingerprintEngine";
import { analyzeBehavior, analyzePostCrime }    from "../services/behaviorEngine";
import { flagUser }          from "../services/trustEngine";
import { SocketNotify }      from "../config/socket";
import {
  assertCanAttempt,
  assertCrimeRequirements,
  loadCrime,
  loadOrCreateProgress,
  pickAvailableSpecial,
  calculateOutcome,
  buildUpdatedStats,
  saveSpecialDiscovery,
  updateProgress,
  updateUserStats,
  getTotalCrimeXp,
}                            from "../services/crimeService";

// ============================================================
// GET /api/crimes
// ============================================================
export const getCrimes = async (req: Request, res: Response): Promise<void> => {
  const client: PoolClient = await pool.connect();
  try {
    const firebaseUid = req.firebaseUser?.uid;
    if (!firebaseUid) throw new UnauthorizedError();

    const user = await getUserByFirebaseUid(client, firebaseUid);
    if (!user) throw new NotFoundError("User");

    const playerLevel = toNumber(user.level);

    const crimesResult = await client.query(
      `SELECT
        c.*,
        COALESCE(ucp.crime_xp, 0)              AS crime_xp,
        COALESCE(ucp.crime_level, 0)            AS crime_level,
        COALESCE(ucp.attempts, 0)               AS attempts,
        COALESCE(ucp.successes, 0)              AS successes,
        COALESCE(ucp.failures, 0)               AS failures,
        COALESCE(ucp.crit_failures, 0)          AS crit_failures,
        COALESCE(ucp.specials_found_count, 0)   AS specials_found_count,
        CASE WHEN $2 >= c.unlock_level THEN TRUE ELSE FALSE END AS unlocked,
        (
          SELECT COUNT(*)
          FROM crime_specials cs
          WHERE cs.crime_id = c.id
            AND cs.is_active = TRUE
            AND cs.unlock_crime_level <= COALESCE(ucp.crime_level, 0)
            AND NOT EXISTS (
              SELECT 1 FROM user_crime_specials ucs
              WHERE ucs.user_id = $1 AND ucs.crime_special_id = cs.id
            )
        )::int AS available_specials_count
      FROM crimes c
      LEFT JOIN user_crime_progress ucp
        ON ucp.crime_id = c.id AND ucp.user_id = $1
      WHERE c.is_active = TRUE
      ORDER BY c.tier ASC, c.id ASC`,
      [user.id, playerLevel]
    );

    const crimes = crimesResult.rows.map((row: Record<string, unknown>) => ({
      id:          toNumber(row["id"]),
      key:         row["crime_key"],
      name:        row["name"],
      tier:        toNumber(row["tier"]),
      unlockLevel: toNumber(row["unlock_level"]),
      nerveCost:   toNumber(row["nerve_cost"]),
      minReward:   toNumber(row["min_reward"]),
      maxReward:   toNumber(row["max_reward"]),
      isFederal:   !!row["is_federal"],
      unlocked:    !!row["unlocked"],
      progress: {
        crimeXp:                toNumber(row["crime_xp"]),
        crimeLevel:             toNumber(row["crime_level"]),
        attempts:               toNumber(row["attempts"]),
        successes:              toNumber(row["successes"]),
        failures:               toNumber(row["failures"]),
        critFailures:           toNumber(row["crit_failures"]),
        specialsFoundCount:     toNumber(row["specials_found_count"]),
        availableSpecialsCount: toNumber(row["available_specials_count"]),
      },
      jailRange: {
        minSeconds: toNumber(row["jail_min_seconds"]),
        maxSeconds: toNumber(row["jail_max_seconds"]),
      },
    }));

    const totalCrimeXp = await getTotalCrimeXp(client, user.id);
    const maxNerve     = calcMaxNerve(totalCrimeXp);

    // FIX: Removed unused calcMaxLife call from getCrimes.
    // maxLife is not in the GET /crimes response — it's in the
    // POST /crimes/attempt response via buildUpdatedStats.
    // Keeping dead code with void suppression trains bad habits.

    res.json({
      user: {
        id:               toNumber(user.id),
        username:         user.username,
        level:            playerLevel,
        money:            toNumber(user.money),
        points:           toNumber(user.points),
        nerve:            toNumber(user.nerve),
        maxNerve,
        life:             toNumber(user.life),
        maxLife:          calcMaxLife(playerLevel),
        jailUntil:        user.jail_until,
        federalJailUntil: user.federal_jail_until,
        inJail:           isFutureDate(user.jail_until),
        inFederalJail:    isFutureDate(user.federal_jail_until),
      },
      crimes,
    });
  } finally {
    client.release();
  }
};

// ============================================================
// POST /api/crimes/attempt
// ============================================================
export const attemptCrime = async (req: Request, res: Response): Promise<void> => {
  const log = getRequestLogger(req.requestId);

  // Auth check BEFORE acquiring DB connection — prevents connection
  // leak when unauthorized requests hit this endpoint.
  // verifyFirebaseToken middleware should have already blocked these,
  // but this is defense-in-depth.
  const firebaseUid = req.firebaseUser?.uid;
  if (!firebaseUid) throw new UnauthorizedError();

  const visitorId = req.headers["x-fp-visitor"] as string | undefined;
  const ipAddress = req.ip;
  const userAgent = req.headers["user-agent"] as string | undefined;
  const { crimeKey } = req.body as { crimeKey: string };

  // Anti-cheat: fire BEFORE transaction — writes to separate tracking
  // tables that must NOT be rolled back if crime tx fails.
  // All fire-and-forget via .catch().
  recordFingerprint(firebaseUid, ipAddress, userAgent, visitorId).catch(
    (e: Error) => log.warn("Fingerprint record failed", { error: e.message })
  );

  analyzeBehavior(firebaseUid, ipAddress, userAgent).catch(
    (e: Error) => log.warn("Behavior analysis failed", { error: e.message })
  );

  checkMultiAccount(firebaseUid, ipAddress, userAgent, visitorId)
    .then(({ otherAccountsCount, otherUids }) => {
      if (otherAccountsCount > 0) {
        log.warn("🚨 Multi-account detected", {
          uid:           firebaseUid.substring(0, 8),
          otherAccounts: otherAccountsCount,
          otherUids:     otherUids.map((u) => u.substring(0, 8)),
        });
        flagUser({
          firebaseUid,
          violationType: "IMPOSSIBLE_ACTION",
          details:       { reason: "Multi-account detected", otherAccountsCount },
          ipAddress,
          userAgent,
        }).catch(() => {});
      }
    })
    .catch((e: Error) => log.warn("Multi-account check failed", { error: e.message }));

  // Acquire connection AFTER anti-cheat fires and AFTER auth check
  const client: PoolClient = await pool.connect();

  try {
    await client.query("BEGIN");

    const user = await getUserByFirebaseUid(client, firebaseUid);
    if (!user) {
      await client.query("ROLLBACK");
      throw new NotFoundError("User");
    }

    const trustInfo = req.trustInfo ?? {
      isShadowBanned: false,
      trustScore:     100,
      tier:           "CLEAN" as const,
      isHardBanned:   false,
    };

    assertCanAttempt(user);

    const crime            = await loadCrime(client, crimeKey);
    assertCrimeRequirements(user, crime);

    const progress         = await loadOrCreateProgress(client, user.id, crime.id);
    const availableSpecial = await pickAvailableSpecial(client, user.id, crime.id, progress.crime_level);
    const outcome          = calculateOutcome(crime, progress, availableSpecial, user, trustInfo);

    const totalCrimeXp     = await getTotalCrimeXp(client, user.id);
    const stats            = buildUpdatedStats(user, crime, progress, outcome, totalCrimeXp);

    let specialDiscovered = false;
    if (outcome.outcome === "special" && outcome.special) {
      specialDiscovered = await saveSpecialDiscovery(client, user.id, outcome.special.id);
    }

    const updatedSpecialsFoundCount = progress.specials_found_count + (specialDiscovered ? 1 : 0);

    await updateProgress(client, user.id, crime.id, {
      crimeXp:            stats.crimeXp,
      crimeLevel:         stats.crimeLevel,
      hiddenCpl:          stats.hiddenCpl,
      attempts:           stats.attempts,
      successes:          stats.successes,
      failures:           stats.failures,
      critFailures:       stats.critFailures,
      specialsFoundCount: updatedSpecialsFoundCount,
    });

    await updateUserStats(client, user.id, {
      money:            stats.money,
      points:           stats.points,
      nerve:            stats.nerve,
      maxNerve:         stats.maxNerve,
      life:             stats.life,
      maxLife:          stats.maxLife,
      jailUntil:        stats.jailUntil,
      federalJailUntil: stats.federalJailUntil,
    });

    await client.query("COMMIT");

    const wasSuccess  = outcome.outcome === "success" || outcome.outcome === "special";
    const moneyEarned = outcome.reward_money;

    analyzePostCrime(firebaseUid, moneyEarned, wasSuccess, ipAddress, userAgent).catch(
      (e: Error) => log.warn("Post-crime analysis failed", { error: e.message })
    );

    log.info("Crime attempted", {
      uid:     firebaseUid.substring(0, 8),
      crime:   crime.crime_key,
      outcome: outcome.outcome,
    });

    const responseBody = {
      outcome: outcome.outcome,
      message: outcome.message,
      crime: {
        id:        crime.id,
        key:       crime.crime_key,
        name:      crime.name,
        tier:      crime.tier,
        nerveCost: crime.nerve_cost,
        isFederal: crime.is_federal,
      },
      rewards: {
        money:    outcome.reward_money,
        points:   outcome.reward_points,
        xpGained: outcome.xp_gained,
      },
      penalties: {
        moneyLost:   outcome.money_loss,
        lifeLost:    outcome.life_loss,
        xpLost:      outcome.xp_lost,
        jailSeconds: outcome.jail_seconds,
        jailType:
          outcome.jail_seconds > 0
            ? crime.is_federal ? "federal" : "normal"
            : null,
      },
      special: outcome.special ? {
        id:                 outcome.special.id,
        title:              outcome.special.title,
        description:        outcome.special.description,
        rewardMoney:        outcome.special.reward_money,
        rewardPoints:       outcome.special.reward_points,
        wasNewlyDiscovered: specialDiscovered,
      } : null,
      progress: {
        crimeXp:            stats.crimeXp,
        crimeLevel:         stats.crimeLevel,
        attempts:           stats.attempts,
        successes:          stats.successes,
        failures:           stats.failures,
        critFailures:       stats.critFailures,
        specialsFoundCount: updatedSpecialsFoundCount,
      },
      user: {
        money:            stats.money,
        points:           stats.points,
        nerve:            stats.nerve,
        maxNerve:         stats.maxNerve,
        life:             stats.life,
        maxLife:          stats.maxLife,
        jailUntil:        stats.jailUntil ? stats.jailUntil.toISOString() : null,
        federalJailUntil: stats.federalJailUntil ? stats.federalJailUntil.toISOString() : null,
      },
    };

    // HTTP response first — WebSocket after
    res.json(responseBody);

    SocketNotify.statUpdate(firebaseUid, {
      money:    stats.money,
      nerve:    stats.nerve,
      maxNerve: stats.maxNerve,
      life:     stats.life,
      maxLife:  stats.maxLife,
      points:   stats.points,
    });

    SocketNotify.crimeResult(firebaseUid, {
      success:  outcome.outcome === "success" || outcome.outcome === "special",
      reward:   outcome.reward_money,
      message:  outcome.message,
      crime:    crime.name,
      xpGained: outcome.xp_gained,
    });

  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
};
