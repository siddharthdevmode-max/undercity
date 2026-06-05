import crypto from "crypto";
import { pool } from "../config/database";
import { logger } from "../utils/logger";
import { isImmuneFromUAC } from "./immunityCheck";
import { checkVpnProxy } from "./vpnDetection";

// ============================================================
// UAC 2.0 — FINGERPRINT ENGINE
// Pillar 1: Device + Network Intelligence
// - Full SHA256 hashes (no truncation)
// - Dual hash: legacy (IP+UA) + enhanced (IP+UA+visitorId)
// - Multi-account detection
// - VPN/Proxy/Tor detection (fire-and-forget)
// ============================================================

function makeHash(input: string): string {
  return crypto
    .createHash("sha256")
    .update(input)
    .digest("hex"); // full 64-char hash — no truncation
}

export async function recordFingerprint(
  firebaseUid: string,
  ipAddress:   string | undefined,
  userAgent:   string | undefined,
  visitorId?:  string | undefined
): Promise<void> {
  try {
    if (await isImmuneFromUAC(firebaseUid)) return;
    if (!ipAddress || !userAgent) return;

    const cleanIp = ipAddress.replace(/^::ffff:/, "");

    const legacyHash   = makeHash(`${cleanIp}|${userAgent}`);
    const enhancedHash = visitorId
      ? makeHash(`${cleanIp}|${userAgent}|${visitorId}`)
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

    // 🔒 VPN/Proxy/Tor check — fire and forget
    checkVpnProxy(firebaseUid, cleanIp, userAgent).catch((err) => {
      logger.debug("VPN check fire-and-forget error", {
        error: err instanceof Error ? err.message : String(err),
      });
    });

  } catch (error: unknown) {
    logger.error("Fingerprint record error", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function checkMultiAccount(
  firebaseUid: string,
  ipAddress:   string | undefined,
  userAgent:   string | undefined,
  visitorId?:  string | undefined
): Promise<{ otherAccountsCount: number; otherUids: string[] }> {
  try {
    if (await isImmuneFromUAC(firebaseUid)) {
      return { otherAccountsCount: 0, otherUids: [] };
    }

    if (!ipAddress || !userAgent) {
      return { otherAccountsCount: 0, otherUids: [] };
    }

    const cleanIp = ipAddress.replace(/^::ffff:/, "");
    const hashes: string[] = [makeHash(`${cleanIp}|${userAgent}`)];

    if (visitorId) {
      hashes.push(makeHash(`${cleanIp}|${userAgent}|${visitorId}`));
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
