import { Request, Response, NextFunction } from "express";
import { config } from "../config";
import { logger } from "../utils/logger";
import { getTrustInfo } from "../services/trustEngine";

const TRUST_THRESHOLD_SKIP = 70;

const CHALLENGE_FREQUENCY: Record<string, number> = {
  WATCHED:       50,
  SUSPICIOUS:    5,
  SHADOW_BANNED: 1,
};

export const verifyTurnstile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const uid = req.firebaseUser?.uid;
  if (!uid) return next();

  // Skip entirely in dev/test
  if (config.isDevelopment || config.isTest) return next();

  try {
    const trustInfo = await getTrustInfo(uid);

    if (trustInfo.trustScore >= TRUST_THRESHOLD_SKIP) return next();

    const tier = trustInfo.tier;
    const frequency = CHALLENGE_FREQUENCY[tier] ?? 1;
    void frequency;

    const turnstileToken = req.headers["x-turnstile-token"] as string | undefined;

    if (tier === "SUSPICIOUS" || tier === "SHADOW_BANNED") {
      if (!turnstileToken) {
        logger.warn("🤖 Turnstile token missing for low-trust user", {
          uid: uid.substring(0, 8),
          tier,
        });
        return res.status(403).json({
          message: "Security verification required.",
          code: "TURNSTILE_REQUIRED",
          requiresTurnstile: true,
        });
      }

      const valid = await verifyTurnstileToken(turnstileToken, req.ip);
      if (!valid) {
        return res.status(403).json({
          message: "Security verification failed.",
          code: "TURNSTILE_FAILED",
          requiresTurnstile: true,
        });
      }
    }

    next();
  } catch (error: unknown) {
    logger.error("Turnstile check error", {
      error: error instanceof Error ? error.message : String(error),
    });
    next();
  }
};

async function verifyTurnstileToken(
  token: string,
  ip: string | undefined
): Promise<boolean> {
  try {
    const formData = new FormData();
    formData.append("secret", config.turnstileSecretKey);
    formData.append("response", token);
    if (ip) formData.append("remoteip", ip);

    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body: formData }
    );

    const data = (await response.json()) as { success: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
