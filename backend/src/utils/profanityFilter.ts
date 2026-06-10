// ============================================================
// PROFANITY FILTER — UNDERCITY
// Dependency-free username filter.
// We intentionally avoid runtime dependencies here because:
// - username validation must never fail due to module format issues
// - this code is called in auth flows and must stay stable
// ============================================================

// ─── Reserved Names ──────────────────────────────────────
// Exact match only — case-insensitive
const RESERVED_NAMES = new Set([
  "admin", "administrator", "moderator", "mod", "staff",
  "undercity", "support", "system", "root", "superuser",
  "developer", "dev", "owner", "god", "null", "undefined",
  "select", "insert", "delete", "drop", "update", "where",
  "anonymous", "user", "test", "guest", "official",
]);

// ─── Profanity Lexicon ───────────────────────────────────
// We only match WHOLE PARTS after splitting on separators.
// This avoids false positives like "scunthorpe"-style issues.
const PROFANE_PARTS = new Set([
  "shit",
  "fuck",
  "bitch",
  "cunt",
  "nigger",
  "nigga",
  "fag",
  "faggot",
  "whore",
  "slut",
  "retard",
  "rape",
  "rapist",
  "hitler",
  "nazi",
]);

// ─── Profanity Check ─────────────────────────────────────
// Strategy:
// - exact reserved-name block
// - split username on separators (_, -, digits)
// - check each resulting part as a whole token

export function isProfane(username: string): boolean {
  const lower = username.toLowerCase();

  // Exact reserved name match
  if (RESERVED_NAMES.has(lower)) return true;

  // Split on common separators and digits
  const parts = lower.split(/[_\-0-9]+/).filter(Boolean);

  for (const part of parts) {
    if (part.length >= 3 && PROFANE_PARTS.has(part)) {
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
