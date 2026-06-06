// ============================================================
// SANITIZE UTILITY — UNDERCITY
// Server-side HTML/XSS stripping without JSDOM overhead.
// Uses a simple tag-stripping approach — game inputs should
// never contain HTML. DOMPurify is for browser rendering,
// not server-side input validation.
//
// Also exports reusable Zod schemas for common game inputs.
// ============================================================

import { z } from "zod";

// ─── Core Sanitizer ───────────────────────────────────────

// Matches any HTML tag including malformed variants
const HTML_TAG_REGEX    = /<[^>]*>/g;

// Matches common HTML entities
const HTML_ENTITY_REGEX = /&(?:amp|lt|gt|quot|#x27|#x2F|#39|#47);/gi;

// Null byte — can bypass some filters
const NULL_BYTE_REGEX   = /\0/g;

// Unicode direction override characters — used in spoofing attacks
const BIDI_REGEX        = /[\u200F\u200E\u202A-\u202E\u2066-\u2069]/g;

/**
 * Strips ALL HTML tags, entities, null bytes, and BiDi overrides from a string.
 * Fast, zero-dependency server-side sanitization.
 * Game inputs should never contain HTML — we strip it all.
 */
export function sanitizeString(input: unknown): string {
  if (typeof input !== "string") return "";
  if (input.length === 0)        return "";

  return input
    .replace(NULL_BYTE_REGEX,   "")   // null bytes first
    .replace(BIDI_REGEX,        "")   // direction overrides
    .replace(HTML_TAG_REGEX,    "")   // strip <tags>
    .replace(HTML_ENTITY_REGEX, "")   // strip &entities;
    .trim();
}

/**
 * Recursively sanitizes all string values in an object.
 * Depth-limited to prevent stack overflow on deeply nested payloads.
 * Accepts optional depth parameter for recursive calls.
 */
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

/**
 * Sanitizes any value — dispatches based on type.
 * Exported so sanitizeMiddleware can call it directly.
 */
export function sanitizeValue(value: unknown, depth = 0): unknown {
  const MAX_DEPTH = 10;

  if (depth > MAX_DEPTH) return value;

  if (typeof value === "string") {
    return sanitizeString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, depth + 1));
  }

  if (value !== null && typeof value === "object") {
    return sanitizeObject(value as Record<string, unknown>, depth + 1);
  }

  // number, boolean, null, undefined — safe as-is
  return value;
}

// ─── Zod Schema Helpers ───────────────────────────────────

/** Username: 3–20 chars, letters/numbers/underscores only */
export const safeUsername = z
  .string()
  .min(3,  "Username must be at least 3 characters")
  .max(20, "Username cannot exceed 20 characters")
  .regex(
    /^[a-zA-Z0-9_]+$/,
    "Username can only contain letters, numbers, and underscores"
  )
  .transform(sanitizeString);

/** Crime key: lowercase slug format */
export const safeCrimeKey = z
  .string()
  .min(1,   "crimeKey is required")
  .max(100, "crimeKey is too long")
  .regex(/^[a-z0-9_]+$/, "Invalid crimeKey format — use lowercase letters, numbers, underscores")
  .transform(sanitizeString);

/** Firebase UID / internal ID */
export const safeUid = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/, "Invalid UID format")
  .transform(sanitizeString);

/** Generic text — strips HTML, respects max length */
export const safeText = (maxLength = 500) =>
  z
    .string()
    .max(maxLength, `Cannot exceed ${maxLength} characters`)
    .transform(sanitizeString);

/** Email address */
export const safeEmail = z
  .string()
  .email("Must be a valid email address")
  .max(254, "Email address too long") // RFC 5321 limit
  .transform((val) => sanitizeString(val).toLowerCase());

/** Positive integer — for game quantities, amounts, counts */
export const safePositiveInt = (max = 2_147_483_647) =>
  z
    .number()
    .int("Must be a whole number")
    .min(1, "Must be at least 1")
    .max(max, `Cannot exceed ${max}`);

/** Non-negative integer — for zero-inclusive counts */
export const safeNonNegativeInt = (max = 2_147_483_647) =>
  z
    .number()
    .int("Must be a whole number")
    .min(0, "Cannot be negative")
    .max(max, `Cannot exceed ${max}`);

/** Coerced positive int — for query params (strings that should be numbers) */
export const safeCoercedInt = (min = 1, max = 2_147_483_647) =>
  z.coerce
    .number()
    .int("Must be a whole number")
    .min(min)
    .max(max);

/** Bounded enum — validates string is one of allowed values */
export const safeEnum = <T extends string>(values: readonly [T, ...T[]]) =>
  z.enum(values);

/** UUID v4 */
export const safeUuid = z
  .string()
  .uuid("Must be a valid UUID v4");

/** URL */
export const safeUrl = z
  .string()
  .url("Must be a valid URL")
  .max(2048, "URL too long");

/** Short name — for item names, gang names, etc */
export const safeName = (min = 1, max = 50) =>
  z
    .string()
    .min(min, `Must be at least ${min} characters`)
    .max(max, `Cannot exceed ${max} characters`)
    .transform(sanitizeString);

/** Message/description — longer free text */
export const safeMessage = safeText(2_000);

/** Search query */
export const safeSearchQuery = z
  .string()
  .min(1,  "Search query cannot be empty")
  .max(100, "Search query too long")
  .transform((val) => sanitizeString(val).trim());
