import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";
import { ValidationError } from "../utils/errors";

// ============================================================
// validate(schema)
// Generic middleware that validates request against Zod schema
// Uses next(error) — proper Express error pipeline
// ============================================================

export const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query,
    });

    if (!result.success) {
      const formatted = result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }));
      return next(new ValidationError("Invalid request data", formatted));
    }

    next();
  };
};
