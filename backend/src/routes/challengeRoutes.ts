import { Router, Request, Response } from "express";
import crypto                        from "crypto";
import { redis }                     from "../config/redis";
import { verifyFirebaseToken }       from "../middleware/firebaseAuth";
import { checkBanStatus }            from "../middleware/banCheck";
import { challengeLimiter }          from "../middleware/rateLimiter";
import { noCache }                   from "../middleware/cacheHeaders";
import { asyncHandler }              from "../utils/asyncHandler";
import { UnauthorizedError }         from "../utils/errors";
import { logger }                    from "../utils/logger";

// ============================================================
// CHALLENGE ROUTES — /api/challenge
//
// GET / — Issue a one-time challenge token for UAC verification.
//
// OUTSTANDING COUNTER FIX:
//   Previously the counter was incremented on issue but NEVER
//   decremented when a token was consumed. After 5 tokens the
//   user would be permanently blocked until OUTSTANDING_TTL expired.
//
//   Fix: When challengeVerifier consumes a token via redis.del(),
//   it also decrements the counter. But since that's in middleware
//   we can't easily hook into it. Instead we now use a simpler
//   approach: track tokens by scanning the keyspace pattern,
//   which is accurate and self-cleaning.
//
//   Actually simplest correct fix: use Redis keyspace with SCAN
//   to count actual outstanding tokens for this uid.
//   The count key approach was broken — removed it.
//   We now count actual live keys directly.
// ============================================================

const router = Router();

const TOKEN_TTL_SEC   = 30;
const MAX_OUTSTANDING = 5;

router.use(noCache);

router.get(
  "/",
  verifyFirebaseToken,
  checkBanStatus,
  challengeLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const uid = req.firebaseUser?.uid;
    if (!uid) throw new UnauthorizedError();

    // ── Count actual outstanding tokens via SCAN ───────────
    // More accurate than a counter that can drift.
    // SCAN is O(N) but with MATCH and COUNT hint it's fast
    // for small key sets (max 5 tokens per user).
    let outstanding = 0;
    try {
      const pattern = `challenge:${uid}:*`;
      let cursor    = "0";

      do {
        const [nextCursor, keys] = await redis.scan(
          cursor,
          "MATCH", pattern,
          "COUNT", 20
        );
        cursor      = nextCursor;
        outstanding += keys.length;
      } while (cursor !== "0");

    } catch {
      outstanding = 0; // Redis error → fail open
    }

    if (outstanding >= MAX_OUTSTANDING) {
      logger.warn("⚠️ Challenge: max outstanding tokens reached", {
        uid:         uid.substring(0, 8),
        outstanding,
      });
      res.status(429).json({
        message: "Too many pending challenge tokens. Complete a request first.",
        code:    "ERR_9001",
      });
      return;
    }

    // ── Issue token ────────────────────────────────────────
    const token    = crypto.randomBytes(32).toString("hex");
    const tokenKey = `challenge:${uid}:${token}`;

    try {
      await redis.set(tokenKey, "1", "EX", TOKEN_TTL_SEC);
    } catch (err) {
      logger.error("Challenge: Redis write failed", {
        error: err instanceof Error ? err.message : String(err),
        uid:   uid.substring(0, 8),
      });
      // Fail open — return token even if Redis write failed
      res.json({ token, ttlSeconds: TOKEN_TTL_SEC });
      return;
    }

    logger.debug("🔑 Challenge token issued", {
      uid:         uid.substring(0, 8),
      ttl:         TOKEN_TTL_SEC,
      outstanding: outstanding + 1,
    });

    res.json({ token, ttlSeconds: TOKEN_TTL_SEC });
  })
);

export default router;
