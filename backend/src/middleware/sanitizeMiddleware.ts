// ============================================================
// SANITIZE MIDDLEWARE — UNDERCITY
// Strips XSS/HTML from req.body, req.query, req.params.
// Delegates ALL sanitization to utils/sanitize.ts —
// single source of truth, no duplication.
// Skips binary/multipart content types.
// ============================================================

import { Request, Response, NextFunction } from "express";
import { sanitizeValue } from "../utils/sanitize";

// ─── Config ───────────────────────────────────────────────

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

// ─── Middleware ───────────────────────────────────────────

export function sanitizeBody(
  req:  Request,
  _res: Response,
  next: NextFunction
): void {
  if (shouldSkipSanitization(req)) {
    return next();
  }

  if (req.body !== undefined && req.body !== null) {
    req.body = sanitizeValue(req.body, 0);
  }

  next();
}

export function sanitizeQuery(
  req:  Request,
  _res: Response,
  next: NextFunction
): void {
  if (req.query && typeof req.query === "object") {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === "string") {
        sanitized[key] = sanitizeValue(value, 0);
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map((v) =>
          typeof v === "string" ? sanitizeValue(v, 0) : v
        );
      } else {
        // ParsedQs objects — leave complex query objects alone
        sanitized[key] = value;
      }
    }

    req.query = sanitized as typeof req.query;
  }

  next();
}

export function sanitizeParams(
  req:  Request,
  _res: Response,
  next: NextFunction
): void {
  if (req.params && typeof req.params === "object") {
    const sanitized: Record<string, string> = {};

    for (const [key, value] of Object.entries(req.params)) {
      sanitized[key] =
        typeof value === "string"
          ? (sanitizeValue(value, 0) as string)
          : value;
    }

    req.params = sanitized;
  }

  next();
}
