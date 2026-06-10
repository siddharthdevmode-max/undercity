// ============================================================
// REQUEST ID MIDDLEWARE — UNDERCITY
// Attaches a unique trace ID to every request.
// Client-supplied IDs are validated (UUID v4 format, max 36 chars).
// Falls back to crypto.randomUUID() if invalid or missing.
// Normalized to lowercase — consistent across all log entries.
// ============================================================

import { randomUUID } from "crypto";
import { Request, Response, NextFunction } from "express";

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const HEADER_NAME = "X-Request-ID";

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
    // BUG FIX: normalize to lowercase for consistent log correlation
    id = clientId.toLowerCase();
  } else {
    id = randomUUID();
  }

  req.requestId = id;
  res.setHeader(HEADER_NAME, id);

  next();
}
