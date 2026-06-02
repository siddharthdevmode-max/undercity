import rateLimit from "express-rate-limit";
import type { Request } from "express";

// ============================================================
// SHARED KEY GENERATORS
// ============================================================

const keyByUidOrIp = (req: Request): string => {
  const firebaseUser = (req as any).firebaseUser;
  if (firebaseUser?.uid) return `uid:${firebaseUser.uid}`;
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
  validate: {
    xForwardedForHeader: false,
    keyGeneratorIpFallback: false,
  },
  message: { message: "Too many requests. Slow down." },
  keyGenerator: keyByUidOrIp,
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
  validate: {
    xForwardedForHeader: false,
    keyGeneratorIpFallback: false,
  },
  message: { message: "Too many requests." },
  keyGenerator: keyByUidOrIp,
});

// ============================================================
// AUTH SYNC LIMITER (STRICT — registration only)
// 5 syncs per 15 min per IP — accounts are rare to create
// ============================================================
export const authSyncLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    keyGeneratorIpFallback: false,
  },
  message: { message: "Too many registration attempts. Try again later." },
  keyGenerator: keyByIp,
});

// ============================================================
// AUTH ME LIMITER (LENIENT — called every page load)
// 120/min per user — covers normal navigation + StrictMode
// ============================================================
export const authMeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
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
// USERNAME CHECK LIMITER
// 20/min per IP — typing username on registration
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
// STATS LIMITER (public endpoint)
// 30/min per IP
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

// ============================================================
// ADMIN LIMITER (strict — admin actions are rare)
// 30/min per UID — protects admin endpoints
// ============================================================
export const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    keyGeneratorIpFallback: false,
  },
  message: { message: "Too many admin requests." },
  keyGenerator: keyByUidOrIp,
});
