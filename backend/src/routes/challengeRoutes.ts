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
// SECURITY:
//   - Token: 32 random bytes → 64-char hex (256 bits of entropy)
//   - TTL: 30 seconds — short window, forces recent activity
//   - noCache: browser must not cache tokens
//   - Max outstanding tokens per user: MAX_OUTSTANDING
//     Prevents bots pre-generating 1000 tokens
//   - Token format: hex only — validated by challengeVerifier
// ============================================================

const router = Router();

// ── Config ─────────────────────────────────────────────────

const TOKEN_TTL_SEC     = 30;  // how long the token is valid
const MAX_OUTSTANDING   = 5;   // max unspent tokens per user at once
const OUTSTANDING_TTL   = 60;  // tracking window for outstanding count

// ── Never cache challenge tokens ───────────────────────────
router.use(noCache);

// ============================================================
// GET /api/challenge
// ============================================================
router.get(
  "/",
  verifyFirebaseToken,
  checkBanStatus,
  challengeLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const uid = req.firebaseUser?.uid;
    if (!uid) throw new UnauthorizedError();

    // ── Outstanding token limit ────────────────────────────
    // Prevent bots pre-generating a stockpile of challenge tokens.
    // Track count separately from the tokens themselves.
    const countKey = `challenge:count:${uid}`;
    let outstanding: number;

    try {
      const raw  = await redis.get(countKey);
      outstanding = raw ? parseInt(raw, 10) : 0;
    } catch {
      outstanding = 0; // Redis error → allow (fail open)
    }

    if (outstanding >= MAX_OUTSTANDING) {
      logger.warn("⚠️ Challenge: max outstanding tokens reached", {
        uid:         uid.substring(0, 8),
        outstanding,
      });
      // Return 429 — not a ban-worthy offence, just a limit
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
      // Pipeline: set token + increment + set TTL on counter atomically
      await redis
        .pipeline()
        .set(tokenKey, "1", "EX", TOKEN_TTL_SEC)
        .incr(countKey)
        .expire(countKey, OUTSTANDING_TTL)
        .exec();
    } catch (err) {
      logger.error("Challenge: Redis write failed", {
        error: err instanceof Error ? err.message : String(err),
        uid:   uid.substring(0, 8),
      });
      // Fail open — return token even if Redis write failed.
      // verifyChallenge will fail open too on Redis error.
      res.json({ token, ttlSeconds: TOKEN_TTL_SEC });
      return;
    }

    logger.debug("🔑 Challenge token issued", {
      uid:     uid.substring(0, 8),
      ttl:     TOKEN_TTL_SEC,
      outstanding: outstanding + 1,
    });

    res.json({
      token,
      ttlSeconds: TOKEN_TTL_SEC,
    });
  })
);

export default router;
