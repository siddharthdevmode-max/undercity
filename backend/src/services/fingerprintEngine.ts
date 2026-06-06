import crypto              from "crypto";
import { pool }            from "../config/database";
import { redis }           from "../config/redis";
import { logger }          from "../utils/logger";
import { isImmuneFromUAC } from "./immunityCheck";
import { checkVpnProxy }   from "./vpnDetection";
import { config }          from "../config";

// ============================================================
// UAC 2.0 — FINGERPRINT ENGINE
// Pillar 1: Device + Network Intelligence
//
// - Full SHA256 hash (64 hex chars, no truncation)
// - Dual hash: legacy (IP+UA) + enhanced (IP+UA+visitorId)
// - Multi-account detection via shared fingerprint hash
// - VPN check debounced per-user (6h Redis cooldown)
// - visitorId validated: max 128 chars, hex/base64 only
// - DB writes via Promise.allSettled (not sequential loop)
// ============================================================

// ── Constants ──────────────────────────────────────────────

const VISITOR_ID_MAX_LEN  = 128;
const VISITOR_ID_SAFE_RE  = /^[a-zA-Z0-9+/=_-]+$/;
const VPN_CHECK_COOLDOWN  = 6 * 60 * 60; // 6h in seconds — match vpnDetection cache TTL
const MULTI_ACCOUNT_LIMIT = 1;           // flag if ANY other account shares fingerprint

// ── Hash builder ───────────────────────────────────────────

function makeHash(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

// ── visitorId sanitizer ─────────────────────────────────────
// Reject oversized or non-safe visitorIds before hashing

function sanitizeVisitorId(visitorId: unknown): string | null {
  if (typeof visitorId !== "string") return null;
  if (visitorId.length === 0 || visitorId.length > VISITOR_ID_MAX_LEN) return null;
  if (!VISITOR_ID_SAFE_RE.test(visitorId)) return null;
  return visitorId;
}

// ── IP cleaner ─────────────────────────────────────────────

function cleanIp(ip: string | undefined): string | undefined {
  return ip?.replace(/^::ffff:/, "").trim() || undefined;
}

// ============================================================
// recordFingerprint
// Called on every authenticated request via firebaseAuth.ts
// Upserts device_fingerprints row, fires VPN check (debounced)
// ============================================================

export async function recordFingerprint(
  firebaseUid: string,
  ipAddress:   string | undefined,
  userAgent:   string | undefined,
  visitorId?:  string | undefined
): Promise<void> {
  if (config.isTest) return;

  try {
    if (await isImmuneFromUAC(firebaseUid)) return;

    const ip = cleanIp(ipAddress);
    if (!ip || !userAgent) return;

    // Sanitize visitorId before including in hash
    const safeVisitorId = sanitizeVisitorId(visitorId);

    const legacyHash   = makeHash(`${ip}|${userAgent}`);
    const enhancedHash = safeVisitorId
      ? makeHash(`${ip}|${userAgent}|${safeVisitorId}`)
      : null;

    // Deduplicate: if both hashes are identical, only upsert once
    const hashes = Array.from(
      new Set([legacyHash, ...(enhancedHash ? [enhancedHash] : [])])
    );

    // Upsert all hashes in parallel — not a sequential loop
    await Promise.allSettled(
      hashes.map((hash) =>
        pool.query(
          `INSERT INTO device_fingerprints
             (firebase_uid, fingerprint_hash, ip_address, user_agent, last_seen)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (firebase_uid, fingerprint_hash)
           DO UPDATE SET
             last_seen = NOW(),
             hit_count = device_fingerprints.hit_count + 1`,
          [firebaseUid, hash, ip, userAgent]
        )
      )
    );

    // VPN check — debounced per-user via Redis
    // Prevents firing on every request for the same IP
    const vpnCooldownKey = `vpn:checked:${firebaseUid}:${ip}`;
    const alreadyChecked = await redis.exists(vpnCooldownKey);

    if (!alreadyChecked) {
      await redis.set(vpnCooldownKey, "1", "EX", VPN_CHECK_COOLDOWN);

      // Fire-and-forget — never blocks the request
      checkVpnProxy(firebaseUid, ip, userAgent).catch((err) => {
        logger.debug("FingerprintEngine: VPN check error", {
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }

  } catch (err) {
    logger.error("FingerprintEngine: recordFingerprint error", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ============================================================
// checkMultiAccount
// Returns other UIDs sharing the same fingerprint hash.
// Called from crimeController or auth middleware.
// ============================================================

export async function checkMultiAccount(
  firebaseUid: string,
  ipAddress:   string | undefined,
  userAgent:   string | undefined,
  visitorId?:  string | undefined
): Promise<{
  otherAccountsCount: number;
  otherUids:          string[];
  isSuspicious:       boolean;
}> {
  const EMPTY = { otherAccountsCount: 0, otherUids: [], isSuspicious: false };

  try {
    if (await isImmuneFromUAC(firebaseUid)) return EMPTY;

    const ip = cleanIp(ipAddress);
    if (!ip || !userAgent) return EMPTY;

    const safeVisitorId = sanitizeVisitorId(visitorId);

    const hashes = Array.from(
      new Set([
        makeHash(`${ip}|${userAgent}`),
        ...(safeVisitorId ? [makeHash(`${ip}|${userAgent}|${safeVisitorId}`)] : []),
      ])
    );

    const result = await pool.query(
      `SELECT DISTINCT firebase_uid
       FROM device_fingerprints
       WHERE fingerprint_hash = ANY($1::text[])
         AND firebase_uid    != $2
       LIMIT 20`,
      [hashes, firebaseUid]
    );

    const otherUids          = result.rows.map((r: { firebase_uid: string }) => r.firebase_uid);
    const otherAccountsCount = otherUids.length;
    const isSuspicious       = otherAccountsCount >= MULTI_ACCOUNT_LIMIT;

    if (isSuspicious) {
      logger.warn("👥 Multi-account fingerprint match", {
        uid:        firebaseUid.substring(0, 8),
        otherCount: otherAccountsCount,
        hashes:     hashes.map((h) => h.substring(0, 12)),
      });
    }

    return { otherAccountsCount, otherUids, isSuspicious };

  } catch (err) {
    logger.error("FingerprintEngine: checkMultiAccount error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return EMPTY;
  }
}

// ============================================================
// getDeviceHistory
// Returns the device fingerprint history for a user.
// Used by admin /user/:uid/full endpoint.
// ============================================================

export async function getDeviceHistory(
  firebaseUid: string,
  limit = 50
): Promise<Array<{
  fingerprint_hash: string;
  ip_address:       string;
  user_agent:       string;
  hit_count:        number;
  last_seen:        Date;
}>> {
  try {
    const result = await pool.query(
      `SELECT fingerprint_hash, ip_address, user_agent, hit_count, last_seen
       FROM device_fingerprints
       WHERE firebase_uid = $1
       ORDER BY last_seen DESC
       LIMIT $2`,
      [firebaseUid, Math.min(limit, 200)]
    );
    return result.rows;
  } catch (err) {
    logger.error("FingerprintEngine: getDeviceHistory error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}
