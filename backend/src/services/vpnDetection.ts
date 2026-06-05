import redis from "../config/redis";
import { logger } from "../utils/logger";
import { flagUser } from "./trustEngine";
import { isImmuneFromUAC } from "./immunityCheck";

// ============================================================
// UAC 2.0 — VPN/PROXY DETECTION ENGINE
// Uses IP-API (free tier: 45 req/min, no key needed)
// Cache: Redis (6h TTL) — survives restarts
// Flags: VPN, Proxy, Tor, Hosting IPs, Geo-blocked countries
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
const SKIP_IPS          = new Set(["127.0.0.1", "::1", "localhost"]);

const BLOCKED_COUNTRIES: string[] = (
  process.env.BLOCKED_COUNTRIES || ""
).split(",").map((c) => c.trim()).filter(Boolean);

// ============================================================
// IP LOOKUP — Redis cached
// ============================================================
async function lookupIp(ip: string): Promise<IpApiResponse | null> {
  const cacheKey = `${CACHE_PREFIX}${ip}`;

  // ── Try Redis cache first ──
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as IpApiResponse;
  } catch {
    // Redis down — fall through to API
  }

  // ── Call IP-API ──
  try {
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,proxy,vpn,tor,hosting,isp,org,country,countryCode,query`,
      { signal: controller.signal }
    );

    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = await res.json() as IpApiResponse;

    // ── Cache in Redis ──
    try {
      await redis.set(cacheKey, JSON.stringify(data), "EX", CACHE_TTL_SECONDS);
    } catch {
      // ignore cache write failures
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

// ============================================================
// MAIN EXPORT
// ============================================================
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
  if (SKIP_IPS.has(cleanIp)) return defaultResult;

  const immune = await isImmuneFromUAC(firebaseUid);
  const data   = await lookupIp(cleanIp);

  if (!data || data.status !== "success") return defaultResult;

  const result = {
    isVpn:     data.vpn || data.proxy,
    isTor:     data.tor,
    isHosting: data.hosting,
    country:   data.countryCode || "UNKNOWN",
  };

  // Immune users — return data but skip flagging
  if (immune) return result;

  // ── VPN / Proxy ──
  if (data.vpn || data.proxy) {
    logger.warn("🔒 VPN/Proxy detected", {
      uid: firebaseUid.substring(0, 8),
      ip:  cleanIp,
      isp: data.isp,
      org: data.org,
    });
    await flagUser({
      firebaseUid,
      violationType: "VPN_PROXY_DETECTED",
      details: {
        ip:    cleanIp,
        isp:   data.isp,
        org:   data.org,
        vpn:   data.vpn,
        proxy: data.proxy,
      },
      ipAddress: cleanIp,
      userAgent,
    });
  }

  // ── Hosting / Datacenter IP ──
  if (data.hosting && !data.vpn && !data.proxy) {
    logger.warn("🖥️ Datacenter/hosting IP detected", {
      uid: firebaseUid.substring(0, 8),
      ip:  cleanIp,
      isp: data.isp,
      org: data.org,
    });
    await flagUser({
      firebaseUid,
      violationType: "VPN_PROXY_DETECTED",
      details: {
        ip:      cleanIp,
        isp:     data.isp,
        org:     data.org,
        hosting: true,
        reason:  "Datacenter/hosting IP — likely automated traffic",
      },
      ipAddress: cleanIp,
      userAgent,
    });
  }

  // ── Tor ──
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

  // ── Geo-blocking ──
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
      details: {
        country:     data.country,
        countryCode: data.countryCode,
      },
      ipAddress: cleanIp,
      userAgent,
    });
  }

  return result;
}
