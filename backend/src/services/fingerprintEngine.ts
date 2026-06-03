import crypto from "crypto";
import { pool } from "../config/database";
import { logger } from "../utils/logger";

// ============================================================
// UAC 2.0 — UPGRADED FINGERPRINT ENGINE
// Now uses: IP + UserAgent + FingerprintJS visitorId
// ============================================================

export async function recordFingerprint(
  firebaseUid: string,
  ipAddress: string | undefined,
  userAgent: string | undefined,
  visitorId?: string | undefined
): Promise<void> {
  try {
    if (!ipAddress || !userAgent) return;

    const cleanIp = ipAddress.replace(/^::ffff:/, "");

    const legacyHash = crypto
      .createHash("sha256")
      .update(`${cleanIp}|${userAgent}`)
      .digest("hex")
      .substring(0, 32);

    const enhancedHash = visitorId
      ? crypto
          .createHash("sha256")
          .update(`${cleanIp}|${userAgent}|${visitorId}`)
          .digest("hex")
          .substring(0, 32)
      : null;

    const hashes = [legacyHash];
    if (enhancedHash && enhancedHash !== legacyHash) {
      hashes.push(enhancedHash);
    }

    for (const hash of hashes) {
      await pool.query(
        `INSERT INTO device_fingerprints
         (firebase_uid, fingerprint_hash, ip_address, user_agent, last_seen)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
         ON CONFLICT (firebase_uid, fingerprint_hash)
         DO UPDATE SET
           last_seen = CURRENT_TIMESTAMP,
           hit_count = device_fingerprints.hit_count + 1`,
        [firebaseUid, hash, cleanIp, userAgent]
      );
    }
  } catch (error: unknown) {
    logger.error("Fingerprint record error", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function checkMultiAccount(
  firebaseUid: string,
  ipAddress: string | undefined,
  userAgent: string | undefined,
  visitorId?: string | undefined
): Promise<{ otherAccountsCount: number; otherUids: string[] }> {
  try {
    if (!ipAddress || !userAgent) {
      return { otherAccountsCount: 0, otherUids: [] };
    }

    const cleanIp = ipAddress.replace(/^::ffff:/, "");

    const hashes: string[] = [];

    hashes.push(
      crypto
        .createHash("sha256")
        .update(`${cleanIp}|${userAgent}`)
        .digest("hex")
        .substring(0, 32)
    );

    if (visitorId) {
      hashes.push(
        crypto
          .createHash("sha256")
          .update(`${cleanIp}|${userAgent}|${visitorId}`)
          .digest("hex")
          .substring(0, 32)
      );
    }

    const result = await pool.query(
      `SELECT DISTINCT firebase_uid
       FROM device_fingerprints
       WHERE fingerprint_hash = ANY($1::text[])
         AND firebase_uid != $2`,
      [hashes, firebaseUid]
    );

    return {
      otherAccountsCount: result.rows.length,
      otherUids: result.rows.map((r: { firebase_uid: string }) => r.firebase_uid),
    };
  } catch (error: unknown) {
    logger.error("Multi-account check error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { otherAccountsCount: 0, otherUids: [] };
  }
}
