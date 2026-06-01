import rateLimit from "express-rate-limit";

// ============================================================
// CRIME RATE LIMITER
// Max 120 attempts per minute per user
// ============================================================

export const crimeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    keyGeneratorIpFallback: false,
  },
  message: {
    message: "Too many requests. Slow down.",
  },
  keyGenerator: (req) => {
    const firebaseUser = (req as any).firebaseUser;
    if (firebaseUser?.uid) return firebaseUser.uid;
    return "anonymous";
  },
});

// ============================================================
// CHALLENGE RATE LIMITER
// Max 200 challenge tokens per minute per user
// ============================================================

export const challengeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    xForwardedForHeader: false,
    keyGeneratorIpFallback: false,
  },
  message: {
    message: "Too many requests.",
  },
  keyGenerator: (req) => {
    const firebaseUser = (req as any).firebaseUser;
    if (firebaseUser?.uid) return firebaseUser.uid;
    return "anonymous";
  },
});
