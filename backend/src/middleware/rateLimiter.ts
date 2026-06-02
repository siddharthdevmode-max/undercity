import rateLimit from "express-rate-limit";
import type { Request } from "express";

// ============================================================
// SHARED KEY GENERATOR
// Uses Firebase UID if available, falls back to IP
// (NOT a shared "anonymous" bucket anymore)
// ============================================================

const keyByUidOrIp = (req: Request): string => {
  const firebaseUser = (req as any).firebaseUser;
  if (firebaseUser?.uid) return `uid:${firebaseUser.uid}`;
  return `ip:${req.ip || "unknown"}`;
};

const keyByIp = (req: Request): string => `ip:${req.ip || "unknown"}`;

// ============================================================
// CRIME RATE LIMITER
// Max 30 attempts per minute per user
// (Lowered from 120 — humans don't crime faster than this)
// ============================================================

export const crimeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    keyGeneratorIpFallback: false,
  },
  message: { message: "Too many requests. Slow down." },
  keyGenerator: keyByUidOrIp,
});

// ============================================================
// CHALLENGE RATE LIMITER
// Max 60 challenge tokens per minute per user
// (Lowered from 200 — one per action is plenty)
// ============================================================

export const challengeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    keyGeneratorIpFallback: false,
  },
  message: { message: "Too many requests." },
  keyGenerator: keyByUidOrIp,
});

// ============================================================
// AUTH RATE LIMITER
// For /auth/sync and /auth/me
// Max 10 requests per 15 min per IP
// (Registration & profile fetch should be rare)
// ============================================================

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    keyGeneratorIpFallback: false,
  },
  message: { message: "Too many auth requests. Try again later." },
  keyGenerator: keyByIp,
});

// ============================================================
// USERNAME CHECK LIMITER
// For /auth/check-username — public endpoint
// Max 20 per minute per IP
// ============================================================

export const usernameCheckLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    keyGeneratorIpFallback: false,
  },
  message: { message: "Too many username checks. Slow down." },
  keyGenerator: keyByIp,
});

// ============================================================
// STATS LIMITER
// For /stats/live — public endpoint
// Max 30 per minute per IP
// ============================================================

export const statsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    keyGeneratorIpFallback: false,
  },
  message: { message: "Too many requests." },
  keyGenerator: keyByIp,
});
