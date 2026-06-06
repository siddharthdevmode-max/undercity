// bad-words uses ESM default export — use require for CommonJS compat
// eslint-disable-next-line @typescript-eslint/no-require-imports
const BadWords = require("bad-words") as { new(): { isProfane(s: string): boolean } };

const filter = new BadWords();

const RESERVED_NAMES = new Set([
  "admin", "administrator", "moderator", "mod", "staff",
  "undercity", "support", "system", "root", "superuser",
  "developer", "dev", "owner", "god", "null", "undefined",
  "select", "insert", "delete", "drop", "update", "where",
]);

export function isProfane(username: string): boolean {
  const lower = username.toLowerCase();
  if (RESERVED_NAMES.has(lower)) return true;
  try {
    return filter.isProfane(lower);
  } catch {
    return false;
  }
}

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
