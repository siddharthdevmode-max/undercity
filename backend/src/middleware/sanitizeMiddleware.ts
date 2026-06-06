// ============================================================
// SANITIZE MIDDLEWARE — UNDERCITY
// Strips XSS/HTML from req.body, req.query, req.params.
// Depth-limited to prevent stack overflow attacks.
// Skips binary/multipart content types.
// ============================================================

import { Request, Response, NextFunction } from "express";
import { sanitizeObject } from "../utils/sanitize";

// ─── Config ───────────────────────────────────────────────

const MAX_DEPTH = 10;

// Content types that should NOT be sanitized (binary/streaming)
const SKIP_CONTENT_TYPES = [
  "multipart/form-data",
  "application/octet-stream",
  "image/",
  "video/",
  "audio/",
];

// ─── Helpers ──────────────────────────────────────────────

function shouldSkipSanitization(req: Request): boolean {
  const contentType = req.headers["content-type"] ?? "";
  return SKIP_CONTENT_TYPES.some((t) => contentType.includes(t));
}

/**
 * Recursively sanitize any value with depth limiting.
 * Handles strings, arrays, objects, and primitives.
 */
function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return value; // too deep — leave as-is

  if (typeof value === "string") {
    return sanitizeString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, depth + 1));
  }

  if (value !== null && typeof value === "object") {
    return sanitizeObject(value as Record<string, unknown>, depth);
  }

  return value; // number, boolean, null, undefined — safe
}

function sanitizeString(str: string): string {
  // Delegate to your existing sanitize utility
  // This wrapper exists so we can add extra rules here if needed
  const obj = sanitizeObject({ v: str } as Record<string, unknown>, 0);
  return (obj as Record<string, unknown>).v as string;
}

// ─── Overload sanitizeObject to accept depth ──────────────
// We wrap the imported function to pass depth tracking through

function deepSanitize(
  obj: Record<string, unknown>,
  depth: number
): Record<string, unknown> {
  if (depth > MAX_DEPTH) return obj;

  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    result[key] = sanitizeValue(obj[key], depth + 1);
  }
  return result;
}

// ─── Middleware ───────────────────────────────────────────

export function sanitizeBody(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (shouldSkipSanitization(req)) {
    return next();
  }

  if (req.body !== undefined && req.body !== null) {
    if (Array.isArray(req.body)) {
      req.body = req.body.map((item: unknown) => sanitizeValue(item, 0));
    } else if (typeof req.body === "object") {
      req.body = deepSanitize(req.body as Record<string, unknown>, 0);
    }
  }

  next();
}

export function sanitizeQuery(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (req.query && typeof req.query === "object") {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(req.query)) {
      // query values can be string | string[] | ParsedQs | ParsedQs[]
      if (typeof value === "string") {
        sanitized[key] = sanitizeValue(value, 0);
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map((v) =>
          typeof v === "string" ? sanitizeValue(v, 0) : v
        );
      } else {
        sanitized[key] = value; // ParsedQs — leave complex objects alone
      }
    }

    req.query = sanitized as typeof req.query;
  }

  next();
}

export function sanitizeParams(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (req.params && typeof req.params === "object") {
    const sanitized: Record<string, string> = {};

    for (const [key, value] of Object.entries(req.params)) {
      sanitized[key] = typeof value === "string"
        ? (sanitizeValue(value, 0) as string)
        : value;
    }

    req.params = sanitized;
  }

  next();
}
