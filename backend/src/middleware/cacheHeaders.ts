import { Request, Response, NextFunction } from "express";

// ============================================================
// HTTP CACHE HEADERS MIDDLEWARE
//
// USAGE GUIDE:
//
//   noCache     — auth endpoints, mutations, any user-specific data
//                 (anything with a session cookie or Authorization header)
//
//   privateCache — authenticated API responses that differ per user
//                  (game state, inventory, profile)
//                  Cache-Control: private — CDN won't cache, browser will
//
//   shortCache  — PUBLIC statistics, leaderboards, landing page stats
//                 Cache-Control: public — CDN CAN cache (30s)
//                 ⚠️  Only use public if response is identical for ALL users
//
//   mediumCache — game config, crime list, item catalog (5 min)
//                 Cache-Control: private — differs per user permissions
//
//   staticCache — fingerprint.js, hashed assets (1 year + immutable)
//                 Only use with content-hashed URLs
//
//   apiCache    — generic authenticated API cache (1 min private)
//                 Balances freshness vs DB load for game endpoints
//
// VARY HEADER:
//   Set Vary: Authorization on private responses so that browser
//   caches key on the auth header and don't serve cached responses
//   to different users on shared machines.
//
// STALE-IF-ERROR:
//   Serve stale content for up to 1 minute on origin errors.
//   Prevents CDN from propagating 5xx to all users during blips.
// ============================================================

// ── No cache ───────────────────────────────────────────────
// Use for: auth, mutations, GDPR, payment, anything user-specific

export function noCache(
  _req: Request,
  res:  Response,
  next: NextFunction
): void {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma",        "no-cache");  // HTTP/1.0 compat
  res.setHeader("Expires",       "0");
  next();
}

// ── Private cache ──────────────────────────────────────────
// Use for: authenticated game API (profile, inventory, crimes)
// Browser caches 60s, CDN must NOT cache

export function privateCache(
  _req: Request,
  res:  Response,
  next: NextFunction
): void {
  res.setHeader("Cache-Control", "private, max-age=60, stale-while-revalidate=120, stale-if-error=60");
  res.setHeader("Vary",          "Authorization");
  next();
}

// ── Short public cache ─────────────────────────────────────
// Use for: /api/stats/live, /api/health, public landing page data
// ⚠️  Only use when response is identical for ALL users (no auth data)

export function shortCache(
  _req: Request,
  res:  Response,
  next: NextFunction
): void {
  res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=60, stale-if-error=300");
  next();
}

// ── Medium private cache ───────────────────────────────────
// Use for: crime list, item catalog, game config
// Differs per user permissions → private

export function mediumCache(
  _req: Request,
  res:  Response,
  next: NextFunction
): void {
  res.setHeader("Cache-Control", "private, max-age=300, stale-while-revalidate=600, stale-if-error=60");
  res.setHeader("Vary",          "Authorization");
  next();
}

// ── Static cache ───────────────────────────────────────────
// Use for: content-hashed assets (/dist/app.abc123.js)
// NEVER use on non-hashed URLs — browser won't re-fetch on update

export function staticCache(
  _req: Request,
  res:  Response,
  next: NextFunction
): void {
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  next();
}

// ── API cache ──────────────────────────────────────────────
// Use for: generic authenticated game endpoints (gang, market, etc.)
// 1 minute private cache — reduces DB load without staleness risk

export function apiCache(
  _req: Request,
  res:  Response,
  next: NextFunction
): void {
  res.setHeader("Cache-Control", "private, max-age=60, stale-while-revalidate=30, stale-if-error=60");
  res.setHeader("Vary",          "Authorization");
  next();
}

// ── Conditional cache helper ───────────────────────────────
// Use for routes that are public when unauthenticated,
// private when authenticated (e.g. stats with user context)

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

// ── ETag helper ────────────────────────────────────────────
// Wraps res.json to add ETag based on response body hash.
// Use sparingly — only when conditional GET is valuable.
//
// Usage: router.get("/config", etagCache, asyncHandler(...))

import crypto from "crypto";

export function etagCache(
  _req: Request,
  res:  Response,
  next: NextFunction
): void {
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
