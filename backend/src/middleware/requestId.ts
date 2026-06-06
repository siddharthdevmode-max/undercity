// ============================================================
// REQUEST ID MIDDLEWARE — UNDERCITY
// Attaches a unique trace ID to every request.
// Client-supplied IDs are validated (UUID v4 format, max 36 chars).
// Falls back to crypto.randomUUID() if invalid or missing.
// ============================================================

import { randomUUID } from "crypto";
import { Request, Response, NextFunction } from "express";

// ─── Config ───────────────────────────────────────────────

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const HEADER_NAME = "X-Request-ID"; // consistent casing everywhere

// ─── Middleware ───────────────────────────────────────────

export function requestId(
  req:  Request,
  res:  Response,
  next: NextFunction
): void {
  const clientId = req.headers["x-request-id"];

  let id: string;

  if (
    typeof clientId === "string" &&
    clientId.length <= 36 &&
    UUID_V4_REGEX.test(clientId)
  ) {
    // Accept valid UUID v4 from client (useful for frontend tracing)
    id = clientId;
  } else {
    // Generate server-side — ignore invalid/missing client IDs
    id = randomUUID();
  }

  req.requestId = id;

  // Expose in response so frontend can correlate logs
  res.setHeader(HEADER_NAME, id);

  next();
}
