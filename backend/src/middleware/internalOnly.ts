// ============================================================
// INTERNAL ONLY MIDDLEWARE
//
// Restricts access to internal-only endpoints.
// Used on: GET /health/metrics (Prometheus scrape endpoint)
//
// Allowed sources:
//   - 127.0.0.1      (localhost IPv4)
//   - ::1            (localhost IPv6)
//   - 10.0.0.0/8     (Docker internal network)
//   - 172.16.0.0/12  (Docker bridge default range)
//   - 192.168.0.0/16 (private network)
//
// Everything else → 403 Forbidden
// No error body — treat it like the route does not exist
// ============================================================

import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

// ── IP range checkers ──────────────────────────────────────

function isLoopback(ip: string): boolean {
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
}

function ipToInt(ip: string): number {
  // Strip IPv4-mapped IPv6 prefix
  const clean = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  return clean
    .split(".")
    .reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

function inRange(ip: string, cidr: string): boolean {
  try {
    const [base, bits] = cidr.split("/") as [string, string];
    const mask    = ~((1 << (32 - parseInt(bits, 10))) - 1) >>> 0;
    const baseInt = ipToInt(base);
    const ipInt   = ipToInt(ip);
    return (ipInt & mask) === (baseInt & mask);
  } catch {
    return false;
  }
}

function isPrivateIp(ip: string): boolean {
  if (isLoopback(ip)) return true;

  // IPv6 that is not loopback and not IPv4-mapped → block
  if (ip.includes(":") && !ip.startsWith("::ffff:")) return false;

  return (
    inRange(ip, "10.0.0.0/8")     ||  // Docker internal
    inRange(ip, "172.16.0.0/12")  ||  // Docker bridge
    inRange(ip, "192.168.0.0/16")     // Private LAN
  );
}

// ── Middleware ─────────────────────────────────────────────

export function internalOnly(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // req.ip is set by Express (trust proxy must be configured)
  const raw = req.ip ?? req.socket.remoteAddress ?? "";

  // Strip IPv4-mapped IPv6 prefix for range checks
  const ip = raw.startsWith("::ffff:") ? raw.slice(7) : raw;

  if (isPrivateIp(raw)) {
    next();
    return;
  }

  logger.warn("internalOnly: blocked external access attempt", {
    ip,
    path:   req.path,
    method: req.method,
  });

  // Return 403 with no body — do not reveal what lives here
  res.status(403).end();
}
