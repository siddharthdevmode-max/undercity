// ============================================================
// HTTP CACHE HEADERS MIDDLEWARE — UNDERCITY
//
// USAGE GUIDE:
//   noCache       — auth, mutations, GDPR, payment, user-specific data
//   privateCache  — authenticated game API (profile, crimes, inventory)
//   shortCache    — PUBLIC stats only (landing page, public leaderboard)
//                   ⚠️ Only use when response is identical for ALL users
//   mediumCache   — crime list, item catalog, game config (5 min private)
//   staticCache   — content-hashed assets (1 year + immutable)
//                   NEVER use on non-hashed URLs
//   apiCache      — generic authenticated endpoints (1 min private)
//   etagCache     — conditional GET support
//                   ⚠️ Do NOT combine with idempotencyCheck on same route
//
// CONFLICT GUARD:
//   etagCache marks response with __etagCacheApplied = true.
//   idempotencyCheck detects this in dev mode and throws.
// ============================================================

import crypto                              from "crypto";
import { Request, Response, NextFunction } from "express";
import { logger }                          from "../utils/logger";

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
    // BUG FIX: stale-while-revalidate reduced from 120s to 30s
    // Game data (nerve, money, jail) should not be 3min stale
    "private, max-age=60, stale-while-revalidate=30, stale-if-error=60"
  );
  res.setHeader("Vary", "Authorization");
  next();
}

// ── Short public cache ─────────────────────────────────────
// ⚠️ Only use for responses identical for ALL users

export function shortCache(
  req:  Request,
  res:  Response,
  next: NextFunction
): void {
  // BUG FIX: refuse to set public cache if user is authenticated
  // Prevents developer mistake of caching user-specific data publicly
  if (req.headers["authorization"]) {
    logger.warn(
      "shortCache applied to authenticated request — " +
      "use privateCache for authenticated routes. Falling back to privateCache.",
      { path: req.path }
    );
    return privateCache(req, res, next);
  }

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
    "private, max-age=300, stale-while-revalidate=60, stale-if-error=60"
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
// NOTE: This middleware SETS ETags but does NOT handle conditional GETs.
// For conditional GET support (304 responses), implement If-None-Match
// handling in the route handler.
//
// ⚠️ Do NOT combine with idempotencyCheck on the same route.

type ResponseWithMarker = Response & { __etagCacheApplied?: boolean };

export function etagCache(
  _req: Request,
  res:  Response,
  next: NextFunction
): void {
  (res as ResponseWithMarker).__etagCacheApplied = true;

  const originalJson = res.json.bind(res);

  res.json = function (body: unknown): Response {
    // BUG FIX: sha256 instead of md5 — consistent with security posture
    const hash = crypto
      .createHash("sha256")
      .update(JSON.stringify(body))
      .digest("hex")
      .slice(0, 32); // 32 hex chars is sufficient for ETag

    res.setHeader("ETag",          `"${hash}"`);
    res.setHeader("Cache-Control", "private, max-age=300, must-revalidate");
    res.setHeader("Vary",          "Authorization");

    return originalJson(body);
  };

  next();
}
