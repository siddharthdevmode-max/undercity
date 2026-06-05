import { Request, Response, NextFunction } from "express";
import { sanitizeObject } from "../utils/sanitize";

// ============================================================
// AUTO-SANITIZE MIDDLEWARE
// Strips HTML/XSS from all incoming:
//   - req.body   (POST/PUT payloads)
//   - req.query  (GET query strings)
//   - req.params (URL parameters like :uid, :username)
// Runs BEFORE route handlers
// ============================================================

export function sanitizeBody(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeObject(req.body as Record<string, unknown>);
  }
  next();
}

export function sanitizeQuery(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (req.query && typeof req.query === "object") {
    req.query = sanitizeObject(
      req.query as Record<string, unknown>
    ) as typeof req.query;
  }
  next();
}

export function sanitizeParams(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (req.params && typeof req.params === "object") {
    req.params = sanitizeObject(
      req.params as Record<string, unknown>
    ) as typeof req.params;
  }
  next();
}
