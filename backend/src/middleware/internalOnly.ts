// ============================================================
// INTERNAL ONLY MIDDLEWARE — UNDERCITY
//
// Restricts access to internal-only endpoints.
// Used on: GET /health/metrics (Prometheus scrape endpoint)
//
// Allowed:
//   - 127.0.0.1 / ::1           (loopback)
//   - 10.0.0.0/8                (Docker internal)
//   - 172.16.0.0/12             (Docker bridge)
//   - 192.168.0.0/16            (private LAN)
//
// Everything else → 403 with no body (route appears to not exist)
// ============================================================

import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

function isLoopback(ip: string): boolean {
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
}

function ipToInt(ip: string): number {
  const clean = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  return clean
    .split(".")
    .reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

function inRange(ip: string, cidr: string): boolean {
  try {
    const [base, bits] = cidr.split("/") as [string, string];
    const mask    = ~((1 << (32 - parseInt(bits!, 10))) - 1) >>> 0;
    const baseInt = ipToInt(base!);
    const ipInt   = ipToInt(ip);
    return (ipInt & mask) === (baseInt & mask);
  } catch {
    return false;
  }
}

function isPrivateIp(ip: string): boolean {
  // Strip IPv4-mapped IPv6 for range checks
  const clean = ip.startsWith("::ffff:") ? ip.slice(7) : ip;

  if (isLoopback(ip) || isLoopback(clean)) return true;

  // Pure IPv6 (not mapped) — block unless loopback
  if (clean.includes(":")) return false;

  return (
    inRange(clean, "10.0.0.0/8")    ||
    inRange(clean, "172.16.0.0/12") ||
    inRange(clean, "192.168.0.0/16")
  );
}

export function internalOnly(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const raw = req.ip ?? req.socket.remoteAddress ?? "";

  if (isPrivateIp(raw)) {
    next();
    return;
  }

  const displayIp = raw.startsWith("::ffff:") ? raw.slice(7) : raw;

  logger.warn("internalOnly: blocked external access", {
    ip:     displayIp,
    path:   req.path,
    method: req.method,
  });

  res.status(403).end();
}
