// ============================================================
// PROFANITY FILTER — UNDERCITY
// Smarter than raw bad-words library — uses word boundaries
// to avoid false positives on common substrings.
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-require-imports
const BadWords = require("bad-words") as {
  new(): { isProfane(s: string): boolean }
};

const filter = new BadWords();

// ─── Reserved Names ──────────────────────────────────────
// Exact match only — case-insensitive
const RESERVED_NAMES = new Set([
  "admin", "administrator", "moderator", "mod", "staff",
  "undercity", "support", "system", "root", "superuser",
  "developer", "dev", "owner", "god", "null", "undefined",
  "select", "insert", "delete", "drop", "update", "where",
  "anonymous", "user", "test", "guest", "official",
]);

// ─── Profanity Check ─────────────────────────────────────
// Only flag if username contains a profane WORD (with separators)
// — NOT just any substring match.
// This prevents false positives like "IDONTKNOWYOU" being flagged
// because "know" or similar appears as a substring.
//
// Strategy: split username on common separators and check each part.

export function isProfane(username: string): boolean {
  const lower = username.toLowerCase();

  // Exact reserved name match
  if (RESERVED_NAMES.has(lower)) return true;

  // Split on common separators (_, -, digits) and check each part
  // A part is only flagged if the WHOLE part is profane.
  const parts = lower.split(/[_\-0-9]+/).filter(Boolean);

  for (const part of parts) {
    // Only check parts that are 3+ chars (avoid false positives on tiny fragments)
    if (part.length >= 3 && filter.isProfane(part)) {
      return true;
    }
  }

  return false;
}

// ─── Username Validator ──────────────────────────────────
export function isValidUsername(username: string): {
  valid:   boolean;
  reason?: string;
} {
  if (username.length < 3) {
    return { valid: false, reason: "Username must be at least 3 characters" };
  }
  if (username.length > 20) {
    return { valid: false, reason: "Username must be 20 characters or less" };
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return {
      valid:  false,
      reason: "Username can only contain letters, numbers, underscores, and hyphens",
    };
  }
  if (isProfane(username)) {
    return { valid: false, reason: "Username is not allowed" };
  }
  return { valid: true };
}
