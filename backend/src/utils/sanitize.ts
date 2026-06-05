import { z } from "zod";
import DOMPurify from "isomorphic-dompurify";

// ============================================================
// INPUT SANITIZATION UTILITY
// Uses DOMPurify (industry standard) — NOT regex
// Regex sanitizers can be bypassed with exotic encodings
// DOMPurify is battle-tested against all known XSS vectors
// ============================================================

// Strip ALL HTML — game inputs should never have any HTML
const STRIP_CONFIG = {
  ALLOWED_TAGS: [] as string[],
  ALLOWED_ATTR: [] as string[],
  KEEP_CONTENT: true,
} as const;

/**
 * Strips ALL HTML tags and XSS vectors from a string
 * Uses DOMPurify — safe against all known bypass techniques
 */
export function sanitizeString(input: string): string {
  if (!input || typeof input !== "string") return "";
  const clean = DOMPurify.sanitize(input.trim(), STRIP_CONFIG);
  return clean.trim();
}

/**
 * Sanitizes all string values in an object recursively
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      result[key] = sanitizeString(value);
    } else if (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value)
    ) {
      result[key] = sanitizeObject(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === "string"
          ? sanitizeString(item)
          : typeof item === "object" && item !== null
          ? sanitizeObject(item as Record<string, unknown>)
          : item
      );
    } else {
      result[key] = value;
    }
  }

  return result as T;
}

// ============================================================
// ZOD HELPERS — reusable sanitized string types
// ============================================================

/** Safe username: letters, numbers, underscores only */
export const safeUsername = z
  .string()
  .min(3,  "Username must be at least 3 characters")
  .max(20, "Username max 20 characters")
  .regex(
    /^[a-zA-Z0-9_]+$/,
    "Username can only contain letters, numbers, underscores"
  )
  .transform((val) => sanitizeString(val));

/** Safe crime key: lowercase letters, numbers, underscores only */
export const safeCrimeKey = z
  .string()
  .min(1,   "crimeKey is required")
  .max(100, "crimeKey too long")
  .regex(/^[a-z0-9_]+$/, "Invalid crimeKey format")
  .transform((val) => sanitizeString(val));

/** Safe text: strips HTML but allows spaces and punctuation */
export const safeText = (maxLength = 500) =>
  z
    .string()
    .max(maxLength)
    .transform((val) => sanitizeString(val));

/** Safe UID: alphanumeric only */
export const safeUid = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/, "Invalid UID format")
  .transform((val) => sanitizeString(val));
