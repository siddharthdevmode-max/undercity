// ============================================================
// TURNSTILE VERIFIER MIDDLEWARE — UNDERCITY
// Cloudflare Turnstile verification for low-trust users.
// ============================================================

import { randomInt }      from "crypto";
import { Request, Response, NextFunction } from "express";
import { redis }          from "../config/redis";
import { config }         from "../config";
import { logger }         from "../utils/logger";
import { getTrustInfo }   from "../services/trustEngine";
import { ForbiddenError } from "../utils/errors";
import { Alerts }         from "../utils/alerts";
import type { TrustTier } from "../services/trustEngine";

const TRUST_SKIP_THRESHOLD       = 70;
const CACHE_TTL_SEC              = 5 * 60;
const API_TIMEOUT_MS             = 5_000;
const TURNSTILE_URL              = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const MAX_TURNSTILE_TOKEN_LEN    = 2_048;
const WATCHED_CHALLENGE_RATE_PCT = 10;

// BUG FIX: HARD_BANNED removed — hard-banned users are blocked by banCheck
// before reaching this middleware. Showing them a Turnstile challenge is
// misleading (they can't get back in by solving it).
const TIER_REQUIRES_TURNSTILE: Partial<Record<TrustTier, boolean>> = {
  SUSPICIOUS:    true,
  SHADOW_BANNED: true,
  WATCHED:       true,
};

function shouldChallenge(tier: TrustTier): boolean {
  if (!TIER_REQUIRES_TURNSTILE[tier]) return false;
  if (tier === "WATCHED") {
    return randomInt(0, 100) < WATCHED_CHALLENGE_RATE_PCT;
  }
  return true;
}

interface TurnstileResponse {
  success:        boolean;
  "error-codes"?: string[];
  hostname?:      string;
}

let turnstileFailOpenAlertedAt = 0;
const FAIL_OPEN_ALERT_COOLDOWN_MS = 10 * 60 * 1_000;

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
      logger.warn("Turnstile verification failed", { errorCodes: data["error-codes"] });
    }

    return data.success === true;
  } catch (err) {
    // BUG FIX: alert when failing open (not just log)
    // If Turnstile is down, all low-trust users bypass — needs visibility
    const now = Date.now();
    if (now - turnstileFailOpenAlertedAt > FAIL_OPEN_ALERT_COOLDOWN_MS) {
      turnstileFailOpenAlertedAt = now;
      void Alerts.systemError(
        "Turnstile API Failing Open",
        "Turnstile verification is unavailable — low-trust users bypassing challenge",
        "high"
      );
    }

    logger.warn("Turnstile API call failed — failing open", {
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
  } catch { /* non-critical */ }
}

export const verifyTurnstile = async (
  req:  Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const uid = req.firebaseUser?.uid;

  if (!uid)                       { next(); return; }
  if (!config.isProduction)       { next(); return; }
  if (!config.turnstileSecretKey) { next(); return; }

  try {
    // BUG FIX: use req.trustInfo if already populated by banCheck middleware
    // Avoids redundant DB call on every request for low-trust users
    const trustInfo = req.trustInfo ?? (await getTrustInfo(uid));

    if (trustInfo.trustScore >= TRUST_SKIP_THRESHOLD) {
      next();
      return;
    }

    if (!shouldChallenge(trustInfo.tier)) {
      next();
      return;
    }

    if (await isCachedVerification(uid)) {
      next();
      return;
    }

    const rawToken = req.headers["x-turnstile-token"];
    const rawValue = Array.isArray(rawToken) ? rawToken[0] : rawToken;
    // BUG FIX: trim whitespace before length check
    const token    = rawValue?.trim();

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
      next(new ForbiddenError(
        "Security verification required. Please complete the challenge."
      ));
      return;
    }

    const valid = await callTurnstileApi(token, req.ip ?? undefined);

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

    logger.debug("Turnstile verified", {
      uid:  uid.substring(0, 8),
      tier: trustInfo.tier,
    });

    next();
  } catch (err) {
    // Fail open — unexpected error should not block all users
    logger.error("Turnstile unexpected error — failing open", {
      error: err instanceof Error ? err.message : String(err),
      uid:   uid?.substring(0, 8),
    });
    next();
  }
};
