// ============================================================
// ADMIN ROUTES — UNDERCITY
// All routes: verifyFirebaseToken + requireAdmin/requireModerator
// All mutating routes: insert into admin_audit_log
//
// FIX: shadow-ban and hard-ban now use validate(adminBanSchema)
// instead of manually calling adminBanSchema.shape.body.parse().
// This ensures consistent ValidationError formatting and field
// path prefixes through the central error handler.
// ============================================================

import { Router }                from "express";
import { isIP }                  from "node:net";
import { pool }                  from "../config/database";
import { redis }                 from "../config/redis";
import { verifyFirebaseToken }   from "../middleware/firebaseAuth";
import { revokeUserSession }     from "../middleware/firebaseAuth";
import { getPoolStats }          from "../config/database";
import { asyncHandler }          from "../utils/asyncHandler";
import { validate }              from "../middleware/validate";
import {
  adminUidParamSchema,
  adminBanSchema,
  adminAdjustMoneySchema,
  adminSearchSchema,
}                                from "../utils/schemas";
import { adminLimiter }          from "../middleware/rateLimiter";
import {
  requireAdmin,
  requireModerator,
  invalidateRoleCache,
}                                from "../middleware/requireAdmin";
import { invalidateBanCache }    from "../middleware/banCheck";
import { logger }                from "../utils/logger";
import { runTrustRecovery }      from "../services/trustRecovery";
import { invalidateImmunityCache } from "../services/immunityCheck";
import { getQueueStats }         from "../queues/index";
import { getWorkerStatuses }     from "../queues/workers";
import { getTickInfo }           from "../services/gameTick";
import { getPagination, buildPaginatedResponse } from "../utils/pagination";
import {
  ValidationError,
  NotFoundError,
}                                from "../utils/errors";
import { Alerts }                from "../utils/alerts";

const router = Router();

router.use(verifyFirebaseToken);
router.use(adminLimiter);

// ── Audit log helper ───────────────────────────────────────

async function auditLog(
  adminUid: string,
  action:   string,
  details:  Record<string, unknown>,
  ip:       string
): Promise<void> {
  await pool.query(
    `INSERT INTO admin_audit_log
       (admin_firebase_uid, action_type, details, ip_address)
     VALUES ($1, $2, $3, $4)`,
    [adminUid, action, JSON.stringify(details), ip]
  ).catch((err: Error) => {
    logger.error("Failed to write audit log", { action, error: err.message });
  });
}

// ── IP validator ───────────────────────────────────────────

function validateIp(ip: unknown): string {
  const value = typeof ip === "string" ? ip.trim() : "";
  if (!value || isIP(value) === 0) {
    throw new ValidationError("Invalid IP address format");
  }
  return value;
}

// ── GET /cheaters ──────────────────────────────────────────

router.get(
  "/cheaters",
  requireModerator,
  asyncHandler(async (req, res) => {
    const { limit, offset, page } = getPagination(req);

    const [countResult, rowsResult] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS total
         FROM users
         WHERE (trust_score < 100 OR total_flags > 0)
           AND deleted_at IS NULL`
      ),
      pool.query(
        `SELECT id, username, firebase_uid, trust_score, total_flags,
                is_shadow_banned, is_hard_banned,
                last_flag_reason, last_flag_at, created_at
         FROM users
         WHERE (trust_score < 100 OR total_flags > 0)
           AND deleted_at IS NULL
         ORDER BY trust_score ASC, total_flags DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
    ]);

    const total = (countResult.rows[0] as { total: number }).total;
    res.json(buildPaginatedResponse(rowsResult.rows, total, { page, limit, offset }));
  })
);

// ── GET /search ────────────────────────────────────────────

router.get(
  "/search",
  requireModerator,
  validate(adminSearchSchema),
  asyncHandler(async (req, res) => {
    const q               = String(req.query["q"] ?? "").trim();
    const { limit, offset, page } = getPagination(req);

    if (q.length < 2) {
      throw new ValidationError("Search query must be at least 2 characters");
    }

    const pattern = `%${q.toLowerCase()}%`;

    const [countResult, rowsResult] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS total
         FROM users
         WHERE (LOWER(username) LIKE $1 OR LOWER(email) LIKE $1)
           AND deleted_at IS NULL`,
        [pattern]
      ),
      pool.query(
        `SELECT id, username, email, firebase_uid,
                level, trust_score, total_flags,
                is_shadow_banned, is_hard_banned,
                created_at, last_seen_at
         FROM users
         WHERE (LOWER(username) LIKE $1 OR LOWER(email) LIKE $1)
           AND deleted_at IS NULL
         ORDER BY username ASC
         LIMIT $2 OFFSET $3`,
        [pattern, limit, offset]
      ),
    ]);

    const total = (countResult.rows[0] as { total: number }).total;
    res.json(buildPaginatedResponse(rowsResult.rows, total, { page, limit, offset }));
  })
);

// ── GET /violations/:uid ───────────────────────────────────

router.get(
  "/violations/:uid",
  requireModerator,
  validate(adminUidParamSchema),
  asyncHandler(async (req, res) => {
    const uid             = String(req.params["uid"]);
    const { limit, offset, page } = getPagination(req);

    const [countResult, rowsResult] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS total FROM uac_violations WHERE firebase_uid = $1`,
        [uid]
      ),
      pool.query(
        `SELECT violation_type, severity, details,
                ip_address, user_agent, created_at
         FROM uac_violations
         WHERE firebase_uid = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [uid, limit, offset]
      ),
    ]);

    const total = (countResult.rows[0] as { total: number }).total;
    res.json(buildPaginatedResponse(rowsResult.rows, total, { page, limit, offset }));
  })
);

// ── POST /unban/:uid ───────────────────────────────────────

router.post(
  "/unban/:uid",
  requireAdmin,
  validate(adminUidParamSchema),
  asyncHandler(async (req, res) => {
    const uid      = String(req.params["uid"]);
    const adminUid = req.firebaseUser!.uid;

    const result = await pool.query(
      `UPDATE users
       SET    trust_score      = 100,
              is_shadow_banned = FALSE,
              is_hard_banned   = FALSE,
              ban_type         = NULL,
              ban_reason       = NULL,
              ban_expires_at   = NULL,
              total_flags      = GREATEST(total_flags - 1, 0),
              last_flag_reason = NULL,
              last_flag_at     = NULL,
              updated_at       = NOW()
       WHERE  firebase_uid = $1
         AND  deleted_at   IS NULL
       RETURNING id, username, firebase_uid,
                 trust_score, is_shadow_banned, is_hard_banned`,
      [uid]
    );

    if (result.rows.length === 0) throw new NotFoundError("User");

    const user = result.rows[0] as { id: number; username: string };

    await Promise.allSettled([
      invalidateBanCache(uid),
      invalidateImmunityCache(uid),
      invalidateRoleCache(uid),
      auditLog(adminUid, "UNBAN", { uid, username: user.username }, req.ip ?? ""),
    ]);

    res.json({ message: "User unbanned and trust restored", user: result.rows[0] });
  })
);

// ── POST /shadow-ban/:uid ─────────────────────────────────
// FIX: Use validate(adminBanSchema) to cover both params + body.
// Previously used manual adminBanSchema.shape.body.parse(req.body)
// which threw raw ZodError with wrong field path prefixes.

router.post(
  "/shadow-ban/:uid",
  requireAdmin,
  validate(adminBanSchema),
  asyncHandler(async (req, res) => {
    const uid      = String(req.params["uid"]);
    const adminUid = req.firebaseUser!.uid;
    const body     = req.body as {
      banType:       string;
      reason:        string;
      durationDays?: number;
    };

    if (uid === adminUid) {
      throw new ValidationError("You cannot ban yourself");
    }

    const result = await pool.query(
      `UPDATE users
       SET    trust_score      = LEAST(COALESCE(trust_score, 100), 19),
              is_shadow_banned = TRUE,
              is_hard_banned   = FALSE,
              ban_type         = 'shadow',
              ban_reason       = $2,
              ban_expires_at   = CASE
                                   WHEN $3::int IS NOT NULL
                                   THEN NOW() + ($3 || ' days')::INTERVAL
                                   ELSE NULL
                                 END,
              last_flag_reason = $2,
              last_flag_at     = NOW(),
              updated_at       = NOW()
       WHERE  firebase_uid = $1
         AND  deleted_at   IS NULL
       RETURNING id, username, firebase_uid,
                 trust_score, is_shadow_banned, is_hard_banned,
                 ban_reason, ban_expires_at`,
      [uid, body.reason, body.durationDays ?? null]
    );

    if (result.rows.length === 0) throw new NotFoundError("User");

    const user = result.rows[0] as { id: number; username: string };

    await Promise.allSettled([
      invalidateBanCache(uid),
      auditLog(adminUid, "SHADOW_BAN", {
        uid,
        username: user.username,
        reason:   body.reason,
        days:     body.durationDays,
      }, req.ip ?? ""),
    ]);

    res.json({ message: "User shadow-banned", user: result.rows[0] });
  })
);

// ── POST /hard-ban/:uid ────────────────────────────────────
// FIX: Same — use validate(adminBanSchema) for consistent error handling.

router.post(
  "/hard-ban/:uid",
  requireAdmin,
  validate(adminBanSchema),
  asyncHandler(async (req, res) => {
    const uid      = String(req.params["uid"]);
    const adminUid = req.firebaseUser!.uid;
    const body     = req.body as {
      banType: string;
      reason:  string;
    };

    if (uid === adminUid) {
      throw new ValidationError("You cannot ban yourself");
    }

    const result = await pool.query(
      `UPDATE users
       SET    trust_score      = 0,
              is_shadow_banned = FALSE,
              is_hard_banned   = TRUE,
              ban_type         = 'hard',
              ban_reason       = $2,
              ban_expires_at   = NULL,
              last_flag_reason = $2,
              last_flag_at     = NOW(),
              updated_at       = NOW()
       WHERE  firebase_uid = $1
         AND  deleted_at   IS NULL
       RETURNING id, username, firebase_uid,
                 trust_score, is_shadow_banned, is_hard_banned, ban_reason`,
      [uid, body.reason]
    );

    if (result.rows.length === 0) throw new NotFoundError("User");

    const user = result.rows[0] as { id: number; username: string };

    await revokeUserSession(uid);

    const fpResult = await pool.query(
      `SELECT DISTINCT ip_address
       FROM device_fingerprints
       WHERE firebase_uid = $1
         AND ip_address   IS NOT NULL
         AND last_seen    > NOW() - INTERVAL '30 days'`,
      [uid]
    );

    const ips = fpResult.rows
      .map((r: { ip_address: string }) => r.ip_address)
      .filter(Boolean) as string[];

    if (ips.length > 0) {
      const pipeline = redis.pipeline();
      for (const ip of ips) {
        pipeline.set(
          `blacklist:ip:${ip}`,
          body.reason,
          "EX",
          60 * 60 * 24 * 30
        );
      }
      await pipeline.exec();
    }

    await Promise.allSettled([
      invalidateBanCache(uid),
      invalidateImmunityCache(uid),
      auditLog(adminUid, "HARD_BAN", {
        uid,
        username:       user.username,
        reason:         body.reason,
        ipsBlacklisted: ips.length,
      }, req.ip ?? ""),
      Alerts.systemError(
        "Hard Ban Issued",
        `User ${user.username} (${uid.substring(0, 8)}) hard-banned by admin. Reason: ${body.reason}`,
        "medium"
      ),
    ]);

    res.json({
      message:         "User hard-banned, session revoked, IPs blacklisted",
      user:            result.rows[0],
      ips_blacklisted: ips.length,
    });
  })
);

// ── POST /ip-blacklist ─────────────────────────────────────

router.post(
  "/ip-blacklist",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const adminUid = req.firebaseUser!.uid;
    const { ip, reason = "Manual admin blacklist", days = 30 } = req.body as {
      ip:      unknown;
      reason?: string;
      days?:   unknown;
    };

    const validatedIp   = validateIp(ip);
    const validatedDays = Math.min(Math.max(Number(days) || 30, 1), 365);
    const ttl           = validatedDays * 60 * 60 * 24;

    await redis.set(`blacklist:ip:${validatedIp}`, reason, "EX", ttl);
    await auditLog(adminUid, "IP_BLACKLIST_ADD", {
      ip: validatedIp, reason, days: validatedDays,
    }, req.ip ?? "");

    res.json({ message: `IP ${validatedIp} blacklisted for ${validatedDays} days` });
  })
);

// ── DELETE /ip-blacklist ───────────────────────────────────

router.delete(
  "/ip-blacklist",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const adminUid = req.firebaseUser!.uid;
    const { ip }   = req.body as { ip: unknown };

    const validatedIp = validateIp(ip);
    await redis.del(`blacklist:ip:${validatedIp}`);
    await auditLog(adminUid, "IP_BLACKLIST_REMOVE", { ip: validatedIp }, req.ip ?? "");

    res.json({ message: `IP ${validatedIp} removed from blacklist` });
  })
);

// ── POST /adjust-money/:uid ────────────────────────────────

router.post(
  "/adjust-money/:uid",
  requireAdmin,
  validate(adminAdjustMoneySchema),
  asyncHandler(async (req, res) => {
    const uid      = String(req.params["uid"]);
    const adminUid = req.firebaseUser!.uid;
    const body     = req.body as { amount: number; reason: string };

    const result = await pool.query(
      `UPDATE users
       SET    money      = money + $2,
              updated_at = NOW()
       WHERE  firebase_uid = $1
         AND  deleted_at   IS NULL
       RETURNING id, username, money`,
      [uid, body.amount]
    );

    if (result.rows.length === 0) throw new NotFoundError("User");

    const user = result.rows[0] as { id: number; username: string; money: bigint };

    await auditLog(adminUid, "ADJUST_MONEY", {
      uid,
      username:   user.username,
      amount:     body.amount,
      reason:     body.reason,
      newBalance: user.money.toString(),
    }, req.ip ?? "");

    res.json({ message: `Money adjusted by ${body.amount}`, user: result.rows[0] });
  })
);

// ── GET /user/:uid/full ────────────────────────────────────

router.get(
  "/user/:uid/full",
  requireModerator,
  validate(adminUidParamSchema),
  asyncHandler(async (req, res) => {
    const uid = String(req.params["uid"]);

    const userResult = await pool.query(
      `SELECT id, username, email, firebase_uid, level, money, points,
              nerve, max_nerve, life, max_life, energy, max_energy,
              trust_score, total_flags,
              is_shadow_banned, is_hard_banned,
              ban_type, ban_reason, ban_expires_at,
              last_flag_reason, last_flag_at,
              last_seen_at, created_at
       FROM users
       WHERE firebase_uid = $1
         AND deleted_at   IS NULL
       LIMIT 1`,
      [uid]
    );

    if (userResult.rows.length === 0) throw new NotFoundError("User");

    const [
      violationsR, trustLogR, fingerprintsR,
      linkedR, crimeR, authLogR,
    ] = await Promise.all([
      pool.query(
        `SELECT violation_type, severity, details, ip_address, user_agent, created_at
         FROM uac_violations WHERE firebase_uid = $1
         ORDER BY created_at DESC LIMIT 100`,
        [uid]
      ),
      pool.query(
        `SELECT old_score, new_score, reason, created_at
         FROM trust_recovery_log WHERE firebase_uid = $1
         ORDER BY created_at DESC LIMIT 50`,
        [uid]
      ),
      pool.query(
        `SELECT fingerprint_hash, ip_address, user_agent, hit_count, last_seen
         FROM device_fingerprints WHERE firebase_uid = $1
         ORDER BY last_seen DESC LIMIT 50`,
        [uid]
      ),
      pool.query(
        `SELECT DISTINCT df2.firebase_uid
         FROM device_fingerprints df1
         JOIN device_fingerprints df2
           ON  df1.fingerprint_hash = df2.fingerprint_hash
           AND df2.firebase_uid    != $1
         WHERE df1.firebase_uid = $1 LIMIT 20`,
        [uid]
      ),
      pool.query(
        `SELECT c.crime_key, c.name, c.tier,
                ucp.crime_level, ucp.crime_xp, ucp.hidden_cpl,
                ucp.attempts, ucp.successes, ucp.failures, ucp.crit_failures,
                ucp.specials_found_count, ucp.updated_at
         FROM user_crime_progress ucp
         JOIN users  u ON u.id  = ucp.user_id
         JOIN crimes c ON c.id  = ucp.crime_id
         WHERE u.firebase_uid = $1
         ORDER BY ucp.updated_at DESC LIMIT 50`,
        [uid]
      ),
      pool.query(
        `SELECT ip_address, user_agent, is_new_ip, accessed_at
         FROM auth_access_log WHERE firebase_uid = $1
         ORDER BY accessed_at DESC LIMIT 50`,
        [uid]
      ).catch(() => ({ rows: [] })),
    ]);

    res.json({
      user:             userResult.rows[0],
      violations:       violationsR.rows,
      trustRecoveryLog: trustLogR.rows,
      fingerprints:     fingerprintsR.rows,
      linkedAccounts:   linkedR.rows.map((r: { firebase_uid: string }) => r.firebase_uid),
      crimeProgress:    crimeR.rows,
      authLog:          authLogR.rows,
    });
  })
);

// ── GET /stats ─────────────────────────────────────────────

router.get(
  "/stats",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const [
      usersR, bannedR, shadowR, suspiciousR,
      violationsR, violations24hR, newIpsR,
    ] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS n FROM users WHERE deleted_at IS NULL`),
      pool.query(`SELECT COUNT(*)::int AS n FROM users WHERE is_hard_banned = TRUE AND deleted_at IS NULL`),
      pool.query(`SELECT COUNT(*)::int AS n FROM users WHERE is_shadow_banned = TRUE AND deleted_at IS NULL`),
      pool.query(`SELECT COUNT(*)::int AS n FROM users WHERE trust_score < 70 AND deleted_at IS NULL`),
      pool.query(`SELECT COUNT(*)::int AS n FROM uac_violations`),
      pool.query(`SELECT COUNT(*)::int AS n FROM uac_violations WHERE created_at > NOW() - INTERVAL '24 hours'`),
      pool.query(`SELECT COUNT(*)::int AS n FROM auth_access_log WHERE is_new_ip = TRUE AND accessed_at > NOW() - INTERVAL '24 hours'`).catch(() => ({ rows: [{ n: 0 }] })),
    ]);

    const n = (r: { rows: Array<{ n: number }> }) => r.rows[0]?.n ?? 0;

    res.json({
      totalUsers:      n(usersR),
      hardBanned:      n(bannedR),
      shadowBanned:    n(shadowR),
      suspicious:      n(suspiciousR),
      totalViolations: n(violationsR),
      violations24h:   n(violations24hR),
      newIps24h:       n(newIpsR),
      generatedAt:     new Date().toISOString(),
    });
  })
);

// ── GET /multi-accounts ────────────────────────────────────

router.get(
  "/multi-accounts",
  requireModerator,
  asyncHandler(async (req, res) => {
    const { limit, offset, page } = getPagination(req);

    const [countR, rowsR] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS total FROM (
           SELECT fingerprint_hash FROM device_fingerprints
           GROUP BY fingerprint_hash
           HAVING COUNT(DISTINCT firebase_uid) > 1
         ) sub`
      ),
      pool.query(
        `SELECT fingerprint_hash,
                COUNT(DISTINCT firebase_uid)::int AS account_count,
                array_agg(DISTINCT firebase_uid)  AS uids,
                MAX(last_seen)                    AS last_active
         FROM device_fingerprints
         GROUP BY fingerprint_hash
         HAVING COUNT(DISTINCT firebase_uid) > 1
         ORDER BY account_count DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
    ]);

    const total = (countR.rows[0] as { total: number }).total;
    res.json(buildPaginatedResponse(rowsR.rows, total, { page, limit, offset }));
  })
);

// ── GET /earnings-anomalies ────────────────────────────────

router.get(
  "/earnings-anomalies",
  requireModerator,
  asyncHandler(async (req, res) => {
    const { limit, offset, page } = getPagination(req);

    const [countR, rowsR] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS total FROM uac_violations WHERE violation_type = 'EARNINGS_VELOCITY'`
      ),
      pool.query(
        `SELECT uv.firebase_uid, u.username, uv.severity,
                uv.details, uv.ip_address, uv.user_agent, uv.created_at
         FROM uac_violations uv
         LEFT JOIN users u ON u.firebase_uid = uv.firebase_uid
         WHERE uv.violation_type = 'EARNINGS_VELOCITY'
         ORDER BY uv.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
    ]);

    const total = (countR.rows[0] as { total: number }).total;
    res.json(buildPaginatedResponse(rowsR.rows, total, { page, limit, offset }));
  })
);

// ── GET /db-health ─────────────────────────────────────────

router.get(
  "/db-health",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const [poolStats, dbSizeR, tableStatsR, slowQueriesR] = await Promise.all([
      Promise.resolve(getPoolStats()),
      pool.query(
        `SELECT pg_size_pretty(pg_database_size(current_database())) AS db_size`
      ),
      pool.query(
        `SELECT schemaname,
                relname AS table_name,
                n_live_tup AS row_count,
                pg_size_pretty(
                  pg_total_relation_size(schemaname || '.' || relname)
                ) AS total_size
         FROM pg_stat_user_tables
         ORDER BY n_live_tup DESC`
      ),
      pool.query(
        `SELECT query_text, duration_ms, rows_returned, created_at
         FROM slow_queries ORDER BY created_at DESC LIMIT 20`
      ).catch(() => ({ rows: [] })),
    ]);

    res.json({
      pool:              poolStats,
      databaseSize:      dbSizeR.rows[0]?.db_size,
      tables:            tableStatsR.rows,
      recentSlowQueries: slowQueriesR.rows,
      checkedAt:         new Date().toISOString(),
    });
  })
);

// ── GET /queue-stats ───────────────────────────────────────

router.get(
  "/queue-stats",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const [queues, workers, tick] = await Promise.all([
      getQueueStats(),
      Promise.resolve(getWorkerStatuses()),
      getTickInfo(),
    ]);
    res.json({ queues, workers, gameTick: tick, checkedAt: new Date().toISOString() });
  })
);

// ── POST /trust-recovery/run ───────────────────────────────

router.post(
  "/trust-recovery/run",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const adminUid = req.firebaseUser!.uid;
    const result   = await runTrustRecovery();
    await auditLog(adminUid, "TRUST_RECOVERY_MANUAL", result as unknown as Record<string, unknown>, req.ip ?? "");
    res.json({ message: "Trust recovery complete", ...result });
  })
);

// ── GET /trust-recovery/log/:uid ──────────────────────────

router.get(
  "/trust-recovery/log/:uid",
  requireModerator,
  validate(adminUidParamSchema),
  asyncHandler(async (req, res) => {
    const uid             = String(req.params["uid"]);
    const { limit, offset, page } = getPagination(req);

    const [countR, rowsR] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS total FROM trust_recovery_log WHERE firebase_uid = $1`,
        [uid]
      ),
      pool.query(
        `SELECT old_score, new_score, reason, created_at
         FROM trust_recovery_log WHERE firebase_uid = $1
         ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [uid, limit, offset]
      ),
    ]);

    const total = (countR.rows[0] as { total: number }).total;
    res.json(buildPaginatedResponse(rowsR.rows, total, { page, limit, offset }));
  })
);

// ── GET /audit-log ─────────────────────────────────────────

router.get(
  "/audit-log",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { limit, offset, page } = getPagination(req);
    const actionFilter            = req.query["action"] ? String(req.query["action"]) : null;

    const [countR, rowsR] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS total FROM admin_audit_log
         WHERE ($1::text IS NULL OR action_type = $1)`,
        [actionFilter]
      ),
      pool.query(
        `SELECT id, admin_firebase_uid, action_type, details, ip_address, created_at
         FROM admin_audit_log
         WHERE ($1::text IS NULL OR action_type = $1)
         ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [actionFilter, limit, offset]
      ),
    ]);

    const total = (countR.rows[0] as { total: number }).total;
    res.json(buildPaginatedResponse(rowsR.rows, total, { page, limit, offset }));
  })
);

export default router;
