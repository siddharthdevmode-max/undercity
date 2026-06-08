import { redis }           from "../config/redis";
import { logger }          from "../utils/logger";
import { flagUser }        from "./trustEngine";
import { isImmuneFromUAC } from "./immunityCheck";
import { config }          from "../config";

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

export interface VpnCheckResult {
  isVpn:     boolean;
  isTor:     boolean;
  isHosting: boolean;
  country:   string;
}

const DEFAULT_RESULT: VpnCheckResult = {
  isVpn:     false,
  isTor:     false,
  isHosting: false,
  country:   "UNKNOWN",
};

const CACHE_TTL_SEC     = 6 * 60 * 60;
const API_TIMEOUT_MS    = 4_000;
const CACHE_PREFIX      = "vpnip:";
const FLAG_COOLDOWN_SEC = CACHE_TTL_SEC;
const API_FIELDS        = "status,proxy,vpn,tor,hosting,isp,org,country,countryCode,query";

const PRIVATE_IP_PATTERNS: RegExp[] = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
  /^0\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
];

const LOOPBACK_SET = new Set(["127.0.0.1", "::1", "localhost"]);

function isPrivateIp(ip: string): boolean {
  if (LOOPBACK_SET.has(ip)) return true;
  return PRIVATE_IP_PATTERNS.some((re) => re.test(ip));
}

// ── Fixed: blockedCountries is already string[] from config ─
const BLOCKED_COUNTRIES: ReadonlySet<string> = new Set(
  config.blockedCountries
    .map((c: string) => c.trim().toUpperCase())
    .filter(Boolean)
);

async function lookupIp(ip: string): Promise<IpApiResponse | null> {
  if (isPrivateIp(ip)) {
    logger.debug("VpnDetection: skipping private IP", { ip });
    return null;
  }

  const cacheKey = `${CACHE_PREFIX}${ip}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as IpApiResponse;
  } catch { /* Redis down */ }

  try {
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
    const scheme = "http"; // ip-api.com free tier is HTTP only
    const url        = `${scheme}://ip-api.com/json/${encodeURIComponent(ip)}?fields=${API_FIELDS}`;

    const response = await fetch(url, {
      signal:  controller.signal,
      headers: { "Accept": "application/json" },
    });

    clearTimeout(timer);

    if (!response.ok) {
      logger.debug("VpnDetection: API non-200", { ip, status: response.status });
      return null;
    }

    const data = await response.json() as unknown;

    if (
      !data ||
      typeof data !== "object" ||
      !("status" in data) ||
      typeof (data as IpApiResponse).status !== "string"
    ) {
      return null;
    }

    const typed = data as IpApiResponse;

    if (typed.status === "success") {
      await redis.set(cacheKey, JSON.stringify(typed), "EX", CACHE_TTL_SEC).catch(() => {});
    }

    return typed;
  } catch (err) {
    logger.debug("VpnDetection: API lookup failed (fail open)", {
      ip,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

async function isFlagOnCooldown(uid: string, type: string, ip: string): Promise<boolean> {
  try {
    const key    = `vpn:flag:${type}:${uid}:${ip}`;
    const result = await redis.set(key, "1", "EX", FLAG_COOLDOWN_SEC, "NX");
    return result === null;
  } catch {
    return false;
  }
}

export async function checkVpnProxy(
  firebaseUid: string,
  ipAddress:   string | undefined,
  userAgent?:  string
): Promise<VpnCheckResult> {
  if (!ipAddress) return DEFAULT_RESULT;

  const cleanIp = ipAddress.replace(/^::ffff:/, "").trim();
  if (!cleanIp || isPrivateIp(cleanIp)) return DEFAULT_RESULT;

  const immune = await isImmuneFromUAC(firebaseUid);
  const data   = await lookupIp(cleanIp);

  if (!data || data.status !== "success") return DEFAULT_RESULT;

  const result: VpnCheckResult = {
    isVpn:     data.vpn || data.proxy,
    isTor:     data.tor,
    isHosting: data.hosting,
    country:   data.countryCode || "UNKNOWN",
  };

  if (immune) return result;

  const flagPromises: Promise<unknown>[] = [];

  if (data.vpn || data.proxy) {
    const onCooldown = await isFlagOnCooldown(firebaseUid, "VPN", cleanIp);
    if (!onCooldown) {
      logger.warn("🔒 VPN/Proxy detected", { uid: firebaseUid.substring(0, 8), isp: data.isp });
      flagPromises.push(flagUser({
        firebaseUid,
        violationType: "VPN_PROXY_DETECTED",
        details:       { isp: data.isp, org: data.org, vpn: data.vpn, proxy: data.proxy },
        ipAddress:     cleanIp,
        userAgent,
      }));
    }
  }

  if (data.hosting && !data.vpn && !data.proxy) {
    const onCooldown = await isFlagOnCooldown(firebaseUid, "DATACENTER", cleanIp);
    if (!onCooldown) {
      logger.warn("🖥️ Datacenter IP detected", { uid: firebaseUid.substring(0, 8), isp: data.isp });
      flagPromises.push(flagUser({
        firebaseUid,
        violationType: "DATACENTER_IP",
        details:       { isp: data.isp, org: data.org, hosting: true },
        ipAddress:     cleanIp,
        userAgent,
      }));
    }
  }

  if (data.tor) {
    const onCooldown = await isFlagOnCooldown(firebaseUid, "TOR", cleanIp);
    if (!onCooldown) {
      logger.warn("🧅 Tor exit node detected", { uid: firebaseUid.substring(0, 8) });
      flagPromises.push(flagUser({
        firebaseUid,
        violationType: "TOR_DETECTED",
        details:       { isp: data.isp },
        ipAddress:     cleanIp,
        userAgent,
      }));
    }
  }

  if (BLOCKED_COUNTRIES.size > 0 && BLOCKED_COUNTRIES.has(data.countryCode)) {
    const onCooldown = await isFlagOnCooldown(firebaseUid, "GEO", cleanIp);
    if (!onCooldown) {
      logger.warn("🌍 Geo-blocked country", { uid: firebaseUid.substring(0, 8), country: data.countryCode });
      flagPromises.push(flagUser({
        firebaseUid,
        violationType: "GEO_BLOCKED",
        details:       { country: data.country, countryCode: data.countryCode },
        ipAddress:     cleanIp,
        userAgent,
      }));
    }
  }

  if (flagPromises.length > 0) {
    await Promise.allSettled(flagPromises);
  }

  return result;
}
