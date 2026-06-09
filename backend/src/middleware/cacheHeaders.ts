// ============================================================
// HTTP CACHE HEADERS MIDDLEWARE — UNDERCITY
//
// USAGE GUIDE:
//
//   noCache      — auth, mutations, GDPR, payment, user-specific data
//   privateCache — authenticated game API (profile, crimes, inventory)
//                  Browser caches 60s, CDN must NOT cache
//   shortCache   — PUBLIC stats, health, landing page
//                  ⚠️  Only use when response is identical for ALL users
//   mediumCache  — crime list, item catalog, game config (5 min private)
//   staticCache  — content-hashed assets (1 year + immutable)
//                  NEVER use on non-hashed URLs
//   apiCache     — generic authenticated endpoints (1 min private)
//   etagCache    — conditional GET support (use sparingly)
//                  ⚠️  Do NOT combine with idempotencyCheck on same route
//
// CONFLICT GUARD:
//   etagCache marks the response with __etagCacheApplied = true
//   idempotencyCheck reads this marker in dev mode and throws
//   if both are applied to the same route
// ============================================================

import crypto                            from "crypto";
import { Request, Response, NextFunction } from "express";

// ── No cache ───────────────────────────────────────────────

export function noCache(
  _req: Request,
  res:  Response,
  next: NextFunction
): void {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma",        "no-cache");
  res.setHeader("Expires",       "0");
  next();
}

// ── Private cache ──────────────────────────────────────────

export function privateCache(
  _req: Request,
  res:  Response,
  next: NextFunction
): void {
  res.setHeader(
    "Cache-Control",
    "private, max-age=60, stale-while-revalidate=120, stale-if-error=60"
  );
  res.setHeader("Vary", "Authorization");
  next();
}

// ── Short public cache ─────────────────────────────────────

export function shortCache(
  _req: Request,
  res:  Response,
  next: NextFunction
): void {
  res.setHeader(
    "Cache-Control",
    "public, max-age=30, stale-while-revalidate=60, stale-if-error=300"
  );
  next();
}

// ── Medium private cache ───────────────────────────────────

export function mediumCache(
  _req: Request,
  res:  Response,
  next: NextFunction
): void {
  res.setHeader(
    "Cache-Control",
    "private, max-age=300, stale-while-revalidate=600, stale-if-error=60"
  );
  res.setHeader("Vary", "Authorization");
  next();
}

// ── Static cache ───────────────────────────────────────────

export function staticCache(
  _req: Request,
  res:  Response,
  next: NextFunction
): void {
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  next();
}

// ── API cache ──────────────────────────────────────────────

export function apiCache(
  _req: Request,
  res:  Response,
  next: NextFunction
): void {
  res.setHeader(
    "Cache-Control",
    "private, max-age=60, stale-while-revalidate=30, stale-if-error=60"
  );
  res.setHeader("Vary", "Authorization");
  next();
}

// ── Conditional cache ──────────────────────────────────────

export function conditionalCache(
  req:  Request,
  res:  Response,
  next: NextFunction
): void {
  const isAuthed = !!req.headers["authorization"];
  if (isAuthed) {
    privateCache(req, res, next);
  } else {
    shortCache(req, res, next);
  }
}

// ── ETag cache ─────────────────────────────────────────────
// Marks response with __etagCacheApplied so idempotencyCheck
// can detect the conflict in dev mode and throw immediately.
//
// ⚠️  Do NOT combine with idempotencyCheck on the same route.

type ResponseWithMarker = Response & { __etagCacheApplied?: boolean };

export function etagCache(
  _req: Request,
  res:  Response,
  next: NextFunction
): void {
  // Mark the response so idempotencyCheck can detect the conflict
  (res as ResponseWithMarker).__etagCacheApplied = true;

  const originalJson = res.json.bind(res);

  res.json = function (body: unknown): Response {
    const hash = crypto
      .createHash("md5")
      .update(JSON.stringify(body))
      .digest("hex");

    res.setHeader("ETag",          `"${hash}"`);
    res.setHeader("Cache-Control", "private, max-age=300, must-revalidate");
    res.setHeader("Vary",          "Authorization");

    return originalJson(body);
  };

  next();
}
