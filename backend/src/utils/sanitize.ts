// ============================================================
// SANITIZE UTILITY — UNDERCITY
// Server-side XSS/injection prevention for game inputs.
// All inputs are expected to be plain text — no HTML allowed.
// ============================================================

import { z } from "zod";

// ─── Core Sanitizer ───────────────────────────────────────

const HTML_TAG_REGEX    = /<[^>]*>/g;
// BUG FIX: match ALL &entity; patterns not just specific ones
// e.g. &#x3C; = < — a bypass for the HTML tag regex above
const HTML_ENTITY_REGEX = /&(?:#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g;
const NULL_BYTE_REGEX   = /\0/g;
// Unicode direction overrides — used in text spoofing
const BIDI_REGEX        = /[\u200F\u200E\u202A-\u202E\u2066-\u2069]/g;

export function sanitizeString(input: unknown): string {
  if (typeof input !== "string") return "";
  if (input.length === 0) return "";

  return input
    .replace(NULL_BYTE_REGEX,   "")
    .replace(BIDI_REGEX,        "")
    .replace(HTML_TAG_REGEX,    "")
    .replace(HTML_ENTITY_REGEX, "")
    .trim();
}

export function sanitizeObject<T extends Record<string, unknown>>(
  obj:   T,
  depth: number = 0
): T {
  const MAX_DEPTH = 10;
  if (depth > MAX_DEPTH) return obj;

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = sanitizeValue(value, depth + 1);
  }
  return result as T;
}

export function sanitizeValue(value: unknown, depth = 0): unknown {
  const MAX_DEPTH = 10;
  if (depth > MAX_DEPTH) return value;

  if (typeof value === "string") return sanitizeString(value);

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, depth + 1));
  }

  if (value !== null && typeof value === "object") {
    return sanitizeObject(value as Record<string, unknown>, depth + 1);
  }

  return value; // number, boolean, null, undefined — safe
}

// ─── Zod Schema Helpers ───────────────────────────────────

export const safeUsername = z
  .string()
  .min(3,  "Username must be at least 3 characters")
  .max(20, "Username cannot exceed 20 characters")
  .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores")
  .transform(sanitizeString);

export const safeCrimeKey = z
  .string()
  .min(1,   "crimeKey is required")
  .max(100, "crimeKey is too long")
  .regex(/^[a-z0-9_]+$/, "Invalid crimeKey format")
  .transform(sanitizeString);

export const safeUid = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/, "Invalid UID format")
  .transform(sanitizeString);

export const safeText = (maxLength = 500) =>
  z.string()
    .max(maxLength, `Cannot exceed ${maxLength} characters`)
    .transform(sanitizeString);

export const safeEmail = z
  .string()
  .email("Must be a valid email address")
  .max(254, "Email address too long")
  .transform((val) => sanitizeString(val).toLowerCase());

export const safePositiveInt = (max = 2_147_483_647) =>
  z.number()
    .int("Must be a whole number")
    .min(1, "Must be at least 1")
    .max(max, `Cannot exceed ${max}`);

export const safeNonNegativeInt = (max = 2_147_483_647) =>
  z.number()
    .int("Must be a whole number")
    .min(0, "Cannot be negative")
    .max(max, `Cannot exceed ${max}`);

export const safeCoercedInt = (min = 1, max = 2_147_483_647) =>
  z.coerce.number()
    .int("Must be a whole number")
    .min(min)
    .max(max);

export const safeEnum = <T extends string>(values: readonly [T, ...T[]]) =>
  z.enum(values);

export const safeUuid = z.string().uuid("Must be a valid UUID v4");

export const safeUrl = z
  .string()
  .url("Must be a valid URL")
  .max(2048, "URL too long");

export const safeName = (min = 1, max = 50) =>
  z.string()
    .min(min, `Must be at least ${min} characters`)
    .max(max, `Cannot exceed ${max} characters`)
    .transform(sanitizeString);

export const safeMessage = safeText(2_000);

export const safeSearchQuery = z
  .string()
  .min(1,   "Search query cannot be empty")
  .max(100, "Search query too long")
  .transform((val) => sanitizeString(val).trim());
