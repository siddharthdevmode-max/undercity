import rateLimit from "express-rate-limit";
import type { Request } from "express";

// ============================================================
// SHARED KEY GENERATORS
// ============================================================

const keyByUidOrIp = (req: Request): string => {
  if (req.firebaseUser?.uid) return `uid:${req.firebaseUser.uid}`;
  return `ip:${req.ip || "unknown"}`;
};

const keyByIp = (req: Request): string => `ip:${req.ip || "unknown"}`;

// ============================================================
// CRIME RATE LIMITER
// 30 attempts/min — humans can't crime faster
// ============================================================
export const crimeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, keyGeneratorIpFallback: false },
  message: { message: "Too many requests. Slow down." },
  keyGenerator: keyByUidOrIp,
  skipSuccessfulRequests: false,
});

// ============================================================
// CHALLENGE RATE LIMITER
// 60 tokens/min — one per crime attempt + buffer
// ============================================================
export const challengeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, keyGeneratorIpFallback: false },
  message: { message: "Too many requests." },
  keyGenerator: keyByUidOrIp,
});

// ============================================================
// AUTH SYNC LIMITER (STRICT)
// 5 syncs per 15 min per IP
// ============================================================
export const authSyncLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, keyGeneratorIpFallback: false },
  message: { message: "Too many registration attempts. Try again later." },
  keyGenerator: keyByIp,
});

// ============================================================
// AUTH ME LIMITER
// 60/min per user — React StrictMode double-fires once
// Reduced from 120 since UID caching in AuthContext
// prevents most duplicate calls
// ============================================================
export const authMeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, keyGeneratorIpFallback: false },
  message: { message: "Too many requests." },
  keyGenerator: keyByUidOrIp,
});

// ============================================================
// USERNAME CHECK LIMITER
// 20/min per IP
// ============================================================
export const usernameCheckLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, keyGeneratorIpFallback: false },
  message: { message: "Too many username checks. Slow down." },
  keyGenerator: keyByIp,
});

// ============================================================
// STATS LIMITER (public)
// 30/min per IP
// ============================================================
export const statsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, keyGeneratorIpFallback: false },
  message: { message: "Too many requests." },
  keyGenerator: keyByIp,
});

// ============================================================
// ADMIN LIMITER
// 30/min per UID
// ============================================================
export const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, keyGeneratorIpFallback: false },
  message: { message: "Too many admin requests." },
  keyGenerator: keyByUidOrIp,
});
