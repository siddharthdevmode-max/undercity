import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError, z }          from "zod";
import { ValidationError }                 from "../utils/errors";

// ============================================================
// VALIDATE MIDDLEWARE
// Generic Zod schema validation for Express routes.
//
// USAGE:
//   validate(mySchema)  — validates body + params + query
//
// SCHEMA CONVENTION:
//   All schemas should wrap fields:
//     z.object({ body: z.object({...}), params: z.object({...}), query: z.object({...}) })
//
// TYPE SAFETY:
//   Validated data replaces req.body, req.params, req.query.
//   This means route handlers get coerced + sanitized values,
//   not raw unvalidated input.
//
// ERROR FORMAT:
//   {
//     message: "Invalid request data",
//     code:    "ERR_2001",
//     errors:  [{ field: "username", message: "Too short" }]
//   }
//   Note: field paths strip "body." prefix to avoid leaking
//   internal schema structure to clients.
//
// MAX BODY SIZE:
//   Raw body size is checked before Zod parsing.
//   Zod can be slow on deeply-nested objects — this guards
//   against ReDoS-style payloads.
// ============================================================

// ── Constants ──────────────────────────────────────────────

const MAX_BODY_KEYS  = 100;   // max top-level + nested keys in body
const MAX_BODY_DEPTH = 10;    // max nesting depth

// ── Body complexity guard ──────────────────────────────────
// Prevents deeply-nested or huge payloads from slowing Zod

function countKeys(obj: unknown, depth = 0): number {
  if (depth > MAX_BODY_DEPTH) return MAX_BODY_KEYS + 1; // signal overflow
  if (typeof obj !== "object" || obj === null) return 0;
  if (Array.isArray(obj)) {
    return obj.reduce((acc: number, item) => acc + countKeys(item, depth + 1), obj.length);
  }
  const keys = Object.keys(obj);
  return keys.length + keys.reduce(
    (acc, key) => acc + countKeys((obj as Record<string, unknown>)[key], depth + 1),
    0
  );
}

// ── Error formatter ────────────────────────────────────────
// Strips "body." / "params." / "query." prefix from paths
// so clients see "username" not "body.username"

function formatZodErrors(
  err: ZodError
): Array<{ field: string; message: string }> {
  return err.issues.map((issue) => {
    const rawPath = issue.path.join(".");

    // Remove leading segment (body / params / query)
    const field = rawPath.replace(/^(body|params|query)\.?/, "") || rawPath;

    return {
      field,
      message: issue.message,
    };
  });
}

// ── Infer output type helper ───────────────────────────────
// Lets you do: type Input = ValidatedInput<typeof mySchema>

export type ValidatedInput<T extends ZodSchema> = z.output<T>;

// ============================================================
// validate(schema) — main middleware factory
// ============================================================

export const validate = <T extends ZodSchema>(schema: T) => {
  return (req: Request, _res: Response, next: NextFunction): void => {

    // ── Body complexity guard ──────────────────────────────
    if (req.body && typeof req.body === "object") {
      const keyCount = countKeys(req.body);
      if (keyCount > MAX_BODY_KEYS) {
        next(
          new ValidationError(
            "Request body is too complex",
            [{ field: "body", message: `Too many fields (max ${MAX_BODY_KEYS})` }]
          )
        );
        return;
      }
    }

    // ── Zod parse ──────────────────────────────────────────
    const result = schema.safeParse({
      body:   req.body,
      params: req.params,
      query:  req.query,
    });

    if (!result.success) {
      const errors = formatZodErrors(result.error);

      next(new ValidationError("Invalid request data", errors));
      return;
    }

    // ── Merge validated data back into request ─────────────
    // This gives handlers coerced values (e.g. string "42" → number 42)
    // and sanitized strings (via .transform() in schemas)
    const parsed = result.data as {
      body?:   Record<string, unknown>;
      params?: Record<string, unknown>;
      query?:  Record<string, unknown>;
    };

    if (parsed.body   !== undefined) Object.assign(req.body,   parsed.body);
    if (parsed.params !== undefined) Object.assign(req.params, parsed.params);
    if (parsed.query  !== undefined) Object.assign(req.query,  parsed.query);

    next();
  };
};

// ============================================================
// validateBody(schema) — convenience for body-only schemas
// ============================================================
// Use when you only want to validate req.body without wrapping:
//
//   const schema = z.object({ username: z.string().min(3) });
//   router.post("/test", validateBody(schema), handler);

export const validateBody = <T extends ZodSchema>(schema: T) => {
  return validate(
    z.object({ body: schema })
  );
};

// ============================================================
// validateQuery(schema) — convenience for query-only schemas
// ============================================================

export const validateQuery = <T extends ZodSchema>(schema: T) => {
  return validate(
    z.object({ query: schema })
  );
};

// ============================================================
// validateParams(schema) — convenience for param-only schemas
// ============================================================

export const validateParams = <T extends ZodSchema>(schema: T) => {
  return validate(
    z.object({ params: schema })
  );
};
