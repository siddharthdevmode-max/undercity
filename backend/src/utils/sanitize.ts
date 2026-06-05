import { z } from "zod";

// ============================================================
// INPUT SANITIZATION UTILITY
// Strips dangerous characters from string inputs
// Works server-side (no DOM needed)
// ============================================================

// Characters that should never appear in game inputs
const DANGEROUS_PATTERNS = [
  /<script[\s\S]*?>[\s\S]*?<\/script>/gi,  // script tags
  /<[^>]+>/g,                               // all HTML tags
  /javascript:/gi,                          // javascript: protocol
  /on\w+\s*=/gi,                            // event handlers (onclick=, etc)
  /data:/gi,                                // data: URIs
  /vbscript:/gi,                            // vbscript: protocol
];

/**
 * Strips HTML and dangerous patterns from a string
 */
export function sanitizeString(input: string): string {
  let clean = input;
  for (const pattern of DANGEROUS_PATTERNS) {
    clean = clean.replace(pattern, "");
  }
  // Trim whitespace
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
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
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
  .min(3, "Username must be at least 3 characters")
  .max(20, "Username max 20 characters")
  .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, underscores")
  .transform((val) => sanitizeString(val));

/** Safe crime key: lowercase letters, numbers, underscores only */
export const safeCrimeKey = z
  .string()
  .min(1, "crimeKey is required")
  .max(100, "crimeKey too long")
  .regex(/^[a-z0-9_]+$/, "Invalid crimeKey format")
  .transform((val) => sanitizeString(val));

/** Safe text: strips HTML but allows spaces and punctuation */
export const safeText = (maxLength: number = 500) =>
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
