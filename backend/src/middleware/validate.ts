// ============================================================
// VALIDATE MIDDLEWARE — UNDERCITY
// Generic Zod schema validation for Express routes.
//
// USAGE (preferred — wraps body/params/query):
//   validate(z.object({ body: z.object({...}), params: z.object({...}) }))
//
// USAGE (convenience helpers):
//   validateBody(z.object({ crimeKey: z.string() }))
//   validateQuery(z.object({ page: z.coerce.number() }))
//   validateParams(z.object({ id: z.string().uuid() }))
//
// TYPE SAFETY:
//   Coerced + sanitized values replace req.body/params/query.
//   Route handlers get clean typed data.
// ============================================================

import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError, z }          from "zod";
import { ValidationError }                 from "../utils/errors";

// ── Constants ──────────────────────────────────────────────

// BUG FIX: increased from 100 to 200 — 100 was too low for admin routes
// Arrays are no longer counted as keys (only object keys count)
const MAX_BODY_KEYS  = 200;
const MAX_BODY_DEPTH = 10;

// ── Body complexity guard ──────────────────────────────────

function countKeys(obj: unknown, depth = 0): number {
  if (depth > MAX_BODY_DEPTH) return MAX_BODY_KEYS + 1;
  if (typeof obj !== "object" || obj === null) return 0;
  // BUG FIX: arrays don't count as keys — only object keys count
  // Prevents false positives when body contains arrays (e.g. bulk operations)
  if (Array.isArray(obj)) {
    return obj.reduce((acc: number, item) => acc + countKeys(item, depth + 1), 0);
  }
  const keys = Object.keys(obj);
  return keys.length + keys.reduce(
    (acc, key) => acc + countKeys((obj as Record<string, unknown>)[key], depth + 1),
    0
  );
}

// ── Error formatter ────────────────────────────────────────

function formatZodErrors(err: ZodError): Array<{ field: string; message: string }> {
  return err.issues.map((issue) => {
    const rawPath = issue.path.join(".");
    const field   = rawPath.replace(/^(body|params|query)\.?/, "") || "request";
    return { field, message: issue.message };
  });
}

// ── Type helper ────────────────────────────────────────────

export type ValidatedInput<T extends ZodSchema> = z.output<T>;

// ============================================================
// validate(schema) — main middleware factory
// ============================================================

export const validate = <T extends ZodSchema>(schema: T) => {
  return (req: Request, _res: Response, next: NextFunction): void => {

    // Body complexity guard
    if (req.body && typeof req.body === "object") {
      const keyCount = countKeys(req.body);
      if (keyCount > MAX_BODY_KEYS) {
        next(new ValidationError(
          "Request body is too complex",
          [{ field: "body", message: `Too many fields (max ${MAX_BODY_KEYS})` }]
        ));
        return;
      }
    }

    const result = schema.safeParse({
      body:   req.body,
      params: req.params,
      query:  req.query,
    });

    if (!result.success) {
      next(new ValidationError("Invalid request data", formatZodErrors(result.error)));
      return;
    }

    const parsed = result.data as {
      body?:   Record<string, unknown>;
      params?: Record<string, unknown>;
      query?:  Record<string, unknown>;
    };

    if (parsed.body   !== undefined) req.body   = parsed.body;

    // BUG FIX: req.params can be read-only — use explicit property assignment
    // Object.assign can fail on frozen objects in strict Express configs
    if (parsed.params !== undefined) {
      for (const [k, v] of Object.entries(parsed.params)) {
        (req.params as Record<string, unknown>)[k] = v;
      }
    }

    if (parsed.query  !== undefined) Object.assign(req.query, parsed.query);

    next();
  };
};

// ── Convenience wrappers ───────────────────────────────────

export const validateBody = <T extends ZodSchema>(schema: T) =>
  validate(z.object({ body: schema }));

export const validateQuery = <T extends ZodSchema>(schema: T) =>
  validate(z.object({ query: schema }));

export const validateParams = <T extends ZodSchema>(schema: T) =>
  validate(z.object({ params: schema }));
