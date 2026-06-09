// ============================================================
// TURNSTILE VERIFIER MIDDLEWARE — UNDERCITY
// Cloudflare Turnstile verification for low-trust users.
// Uses crypto.randomInt for sampling — NOT Math.random().
// ============================================================

import { randomInt }        from "crypto";
import { Request, Response, NextFunction } from "express";
import { redis }            from "../config/redis";
import { config }           from "../config";
import { logger }           from "../utils/logger";
import { getTrustInfo }     from "../services/trustEngine";
import { ForbiddenError }   from "../utils/errors";
import type { TrustTier }   from "../services/trustEngine";

// ── Constants ──────────────────────────────────────────────

const TRUST_SKIP_THRESHOLD    = 70;
const CACHE_TTL_SEC           = 5 * 60;
const API_TIMEOUT_MS          = 5_000;
const TURNSTILE_URL           = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const MAX_TURNSTILE_TOKEN_LEN = 2_048;

// WATCHED users challenged 10% of the time
// Uses crypto.randomInt(0, 100) < 10 — not Math.random()
const WATCHED_CHALLENGE_RATE_PCT = 10;

const TIER_REQUIRES_TURNSTILE: Partial<Record<TrustTier, boolean>> = {
  SUSPICIOUS:   true,
  SHADOW_BANNED: true,
  WATCHED:      true,
  HARD_BANNED:  true,
};

// ── Helpers ───────────────────────────────────────────────

function shouldChallenge(tier: TrustTier): boolean {
  if (!TIER_REQUIRES_TURNSTILE[tier]) return false;

  if (tier === "WATCHED") {
    // crypto.randomInt is cryptographically safe — Math.random() is NOT
    // Math.random() is predictable in V8; an attacker knowing the rate
    // can retry until they get through without a challenge
    return randomInt(0, 100) < WATCHED_CHALLENGE_RATE_PCT;
  }

  return true;
}

interface TurnstileResponse {
  success:        boolean;
  "error-codes"?: string[];
  hostname?:      string;
}

async function callTurnstileApi(
  token: string,
  ip:    string | undefined
): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    const body = new URLSearchParams({
      secret:   config.turnstileSecretKey,
      response: token,
    });

    if (ip) body.append("remoteip", ip);

    const response = await fetch(TURNSTILE_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    body.toString(),
      signal:  controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      logger.warn("Turnstile API returned non-200", { status: response.status });
      return false;
    }

    const data = (await response.json()) as TurnstileResponse;

    if (!data.success && data["error-codes"]?.length) {
      logger.warn("Turnstile verification failed", {
        errorCodes: data["error-codes"],
      });
    }

    return data.success === true;
  } catch (err) {
    // API timeout or network error — fail open to avoid blocking all users
    logger.warn("Turnstile API call failed, failing open", {
      error: err instanceof Error ? err.message : String(err),
    });
    return true;
  }
}

async function isCachedVerification(uid: string): Promise<boolean> {
  try {
    const result = await redis.get(`turnstile:verified:${uid}`);
    return result === "1";
  } catch {
    return false;
  }
}

async function cacheVerification(uid: string): Promise<void> {
  try {
    await redis.set(`turnstile:verified:${uid}`, "1", "EX", CACHE_TTL_SEC);
  } catch { /* Non-critical */ }
}

// ── Middleware ────────────────────────────────────────────

export const verifyTurnstile = async (
  req:  Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const uid = req.firebaseUser?.uid;

  if (!uid)                    { next(); return; }
  if (!config.isProduction)    { next(); return; }
  if (!config.turnstileSecretKey) { next(); return; }

  try {
    const trustInfo = await getTrustInfo(uid);

    // High-trust users skip the challenge entirely
    if (trustInfo.trustScore >= TRUST_SKIP_THRESHOLD) {
      next();
      return;
    }

    if (!shouldChallenge(trustInfo.tier)) {
      next();
      return;
    }

    // Skip if already verified recently
    if (await isCachedVerification(uid)) {
      next();
      return;
    }

    const rawToken = req.headers["x-turnstile-token"];
    const token    = Array.isArray(rawToken) ? rawToken[0] : rawToken;

    if (token && token.length > MAX_TURNSTILE_TOKEN_LEN) {
      next(new ForbiddenError("Invalid security token."));
      return;
    }

    if (!token) {
      logger.warn("Turnstile token required", {
        uid:  uid.substring(0, 8),
        tier: trustInfo.tier,
        path: req.path,
      });
      next(
        new ForbiddenError(
          "Security verification required. Please complete the challenge."
        )
      );
      return;
    }

    const ip    = req.ip ?? undefined;
    const valid = await callTurnstileApi(token, ip);

    if (!valid) {
      logger.warn("Turnstile verification failed", {
        uid:  uid.substring(0, 8),
        tier: trustInfo.tier,
        path: req.path,
      });
      next(new ForbiddenError("Security verification failed. Please try again."));
      return;
    }

    await cacheVerification(uid);

    logger.debug("✅ Turnstile verified", {
      uid:  uid.substring(0, 8),
      tier: trustInfo.tier,
    });

    next();
  } catch (err) {
    // Unexpected error — fail open to avoid blocking all users
    logger.error("Turnstile unexpected error, failing open", {
      error: err instanceof Error ? err.message : String(err),
      uid:   uid?.substring(0, 8),
    });
    next();
  }
};
