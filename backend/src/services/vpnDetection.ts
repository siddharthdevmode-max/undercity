import redis from "../config/redis";
import { logger } from "../utils/logger";
import { flagUser } from "./trustEngine";
import { isImmuneFromUAC } from "./immunityCheck";

// ============================================================
// UAC 2.0 — VPN/PROXY DETECTION ENGINE
// SSRF protected: blocks all private/internal IPs
// ============================================================

interface IpApiResponse {
  status:      "success" | "fail";
  proxy:       boolean;
  vpn:         boolean;
  tor:         boolean;
  hosting:     boolean;
  isp:         string;
  org:         string;
  country:     string;
  countryCode: string;
  query:       string;
}

const CACHE_TTL_SECONDS = 60 * 60 * 6; // 6 hours
const CACHE_PREFIX      = "vpn:";
const API_TIMEOUT_MS    = 3000;

const SKIP_IPS = new Set(["127.0.0.1", "::1", "localhost"]);

// ── SSRF Protection: block private/internal IP ranges ────────
const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
  /^0\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,  // CGNAT
];

function isPrivateIp(ip: string): boolean {
  return PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(ip));
}

// Whitelist outbound domains for SSRF protection
const ALLOWED_LOOKUP_HOST = "ip-api.com";

async function lookupIp(ip: string): Promise<IpApiResponse | null> {
  // SSRF: never look up private/internal IPs
  if (isPrivateIp(ip)) {
    logger.debug("VPN lookup skipped — private IP", { ip });
    return null;
  }

  const cacheKey = `${CACHE_PREFIX}${ip}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as IpApiResponse;
  } catch {
    // Redis down — fall through
  }

  try {
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    // Explicitly construct URL with whitelisted host (SSRF prevention)
    const url = `http://${ALLOWED_LOOKUP_HOST}/json/${encodeURIComponent(ip)}?fields=status,proxy,vpn,tor,hosting,isp,org,country,countryCode,query`;

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = await res.json() as IpApiResponse;

    // Validate response structure before caching
    if (!data || typeof data.status !== "string") return null;

    try {
      await redis.set(cacheKey, JSON.stringify(data), "EX", CACHE_TTL_SECONDS);
    } catch {
      // ignore
    }

    return data;
  } catch (error: unknown) {
    logger.debug("VPN lookup failed (fail open)", {
      ip,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

const BLOCKED_COUNTRIES: string[] = (
  process.env.BLOCKED_COUNTRIES || ""
).split(",").map((c) => c.trim()).filter(Boolean);

export async function checkVpnProxy(
  firebaseUid: string,
  ipAddress:   string | undefined,
  userAgent?:  string
): Promise<{
  isVpn:      boolean;
  isTor:      boolean;
  isHosting:  boolean;
  country:    string;
}> {
  const defaultResult = {
    isVpn:     false,
    isTor:     false,
    isHosting: false,
    country:   "UNKNOWN",
  };

  if (!ipAddress) return defaultResult;

  const cleanIp = ipAddress.replace(/^::ffff:/, "");
  if (SKIP_IPS.has(cleanIp) || isPrivateIp(cleanIp)) return defaultResult;

  const immune = await isImmuneFromUAC(firebaseUid);
  const data   = await lookupIp(cleanIp);

  if (!data || data.status !== "success") return defaultResult;

  const result = {
    isVpn:     data.vpn || data.proxy,
    isTor:     data.tor,
    isHosting: data.hosting,
    country:   data.countryCode || "UNKNOWN",
  };

  if (immune) return result;

  if (data.vpn || data.proxy) {
    logger.warn("🔒 VPN/Proxy detected", {
      uid: firebaseUid.substring(0, 8),
      ip:  cleanIp,
      isp: data.isp,
    });
    await flagUser({
      firebaseUid,
      violationType: "VPN_PROXY_DETECTED",
      details: { ip: cleanIp, isp: data.isp, org: data.org, vpn: data.vpn, proxy: data.proxy },
      ipAddress: cleanIp,
      userAgent,
    });
  }

  if (data.hosting && !data.vpn && !data.proxy) {
    logger.warn("🖥️ Datacenter IP detected", {
      uid: firebaseUid.substring(0, 8),
      ip:  cleanIp,
    });
    await flagUser({
      firebaseUid,
      violationType: "VPN_PROXY_DETECTED",
      details: { ip: cleanIp, isp: data.isp, org: data.org, hosting: true },
      ipAddress: cleanIp,
      userAgent,
    });
  }

  if (data.tor) {
    logger.warn("🧅 Tor exit node detected", {
      uid: firebaseUid.substring(0, 8),
      ip:  cleanIp,
    });
    await flagUser({
      firebaseUid,
      violationType: "TOR_DETECTED",
      details: { ip: cleanIp },
      ipAddress: cleanIp,
      userAgent,
    });
  }

  if (
    BLOCKED_COUNTRIES.length > 0 &&
    BLOCKED_COUNTRIES.includes(data.countryCode)
  ) {
    logger.warn("🌍 Geo-blocked country", {
      uid:     firebaseUid.substring(0, 8),
      country: data.countryCode,
    });
    await flagUser({
      firebaseUid,
      violationType: "GEO_BLOCKED",
      details: { country: data.country, countryCode: data.countryCode },
      ipAddress: cleanIp,
      userAgent,
    });
  }

  return result;
}
