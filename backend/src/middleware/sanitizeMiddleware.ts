// ============================================================
// SANITIZE MIDDLEWARE — UNDERCITY
// Strips XSS/HTML from req.body, req.query, req.params.
// Delegates ALL sanitization to utils/sanitize.ts.
// Skips binary/multipart content types.
// ============================================================

import { Request, Response, NextFunction } from "express";
import { sanitizeValue } from "../utils/sanitize";

const SKIP_CONTENT_TYPE_PREFIXES = [
  "multipart/form-data",
  "application/octet-stream",
  "image/",
  "video/",
  "audio/",
];

// BUG FIX: parse content-type properly before the parameters (e.g. "; boundary=...")
function shouldSkipSanitization(req: Request): boolean {
  const raw         = req.headers["content-type"] ?? "";
  const contentType = raw.split(";")[0]?.trim().toLowerCase() ?? "";
  return SKIP_CONTENT_TYPE_PREFIXES.some((prefix) =>
    contentType === prefix || contentType.startsWith(prefix)
  );
}

export function sanitizeBody(
  req:  Request,
  _res: Response,
  next: NextFunction
): void {
  if (shouldSkipSanitization(req)) return next();

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
      } else if (value && typeof value === "object") {
        // BUG FIX: recursively sanitize nested ParsedQs objects
        // e.g. ?filter[name]=<script> was previously unsanitized
        sanitized[key] = sanitizeValue(value, 0);
      } else {
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
      if (typeof value === "string") {
        const result = sanitizeValue(value, 0);
        // Ensure result is always a string for req.params
        sanitized[key] = typeof result === "string" ? result : String(result ?? "");
      } else {
        sanitized[key] = value;
      }
    }

    req.params = sanitized;
  }

  next();
}
