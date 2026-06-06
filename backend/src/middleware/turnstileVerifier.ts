import { Request, Response, NextFunction } from "express";
import { redis } from "../config/redis";
import { config } from "../config";
import { logger } from "../utils/logger";
import { getTrustInfo } from "../services/trustEngine";
import { ForbiddenError } from "../utils/errors";
import type { TrustTier } from "../services/trustEngine";

const TRUST_SKIP_THRESHOLD = 70;
const CACHE_TTL_SEC = 5 * 60;
const API_TIMEOUT_MS = 5000;
const TURNSTILE_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const WATCHED_CHALLENGE_RATE = 0.1;

const TIER_REQUIRES_TURNSTILE: Partial<Record<TrustTier, boolean>> = {
  SUSPICIOUS: true,
  SHADOW_BANNED: true,
  WATCHED: true,
  HARD_BANNED: true
};

function shouldChallenge(tier: TrustTier): boolean {
  if (!TIER_REQUIRES_TURNSTILE[tier]) return false;
  if (tier === "WATCHED") return Math.random() < WATCHED_CHALLENGE_RATE;
  return true;
}

interface TurnstileResponse {
  success: boolean;
  "error-codes"?: string[];
  hostname?: string;
}

async function callTurnstileApi(token: string, ip: string | undefined): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    const body = new URLSearchParams({
      secret: config.turnstileSecretKey,
      response: token
    });

    if (ip) body.append("remoteip", ip);

    const response = await fetch(TURNSTILE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: controller.signal
    });

    clearTimeout(timer);

    if (!response.ok) {
      logger.warn("Turnstile API returned non-200", { status: response.status });
      return false;
    }

    const data = (await response.json()) as TurnstileResponse;

    if (!data.success && data["error-codes"]?.length) {
      logger.warn("Turnstile verification failed", {
        errorCodes: data["error-codes"]
      });
    }

    return data.success === true;
  } catch (err) {
    logger.warn("Turnstile API call failed, failing open", {
      error: err instanceof Error ? err.message : String(err)
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
  } catch {
    // non-fatal
  }
}

export const verifyTurnstile = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const uid = req.firebaseUser?.uid;

  if (!uid) {
    next();
    return;
  }

  if (!config.isProduction) {
    next();
    return;
  }

  if (!config.turnstileSecretKey) {
    next();
    return;
  }

  try {
    const trustInfo = await getTrustInfo(uid);

    if (trustInfo.trustScore >= TRUST_SKIP_THRESHOLD) {
      next();
      return;
    }

    const tier = trustInfo.tier;

    if (!shouldChallenge(tier)) {
      next();
      return;
    }

    if (await isCachedVerification(uid)) {
      next();
      return;
    }

    const rawToken = req.headers["x-turnstile-token"];
    const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;

    if (!token) {
      logger.warn("Turnstile token required", {
        uid: uid.substring(0, 8),
        tier,
        path: req.path
      });

      next(new ForbiddenError("Security verification required. Please complete the challenge."));
      return;
    }

    const ip = req.ip ?? undefined;
    const valid = await callTurnstileApi(token, ip);

    if (!valid) {
      logger.warn("Turnstile verification failed", {
        uid: uid.substring(0, 8),
        tier,
        path: req.path
      });

      next(new ForbiddenError("Security verification failed. Please try again."));
      return;
    }

    await cacheVerification(uid);

    logger.debug("Turnstile verified", {
      uid: uid.substring(0, 8),
      tier
    });

    next();
  } catch (err) {
    logger.error("Turnstile unexpected error, failing open", {
      error: err instanceof Error ? err.message : String(err),
      uid: uid?.substring(0, 8)
    });
    next();
  }
};
