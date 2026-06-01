import { z } from "zod";

// ============================================================
// REQUEST VALIDATION SCHEMAS
// Used by validate() middleware
// ============================================================

export const attemptCrimeSchema = z.object({
  body: z.object({
    crimeKey: z
      .string()
      .min(1, "crimeKey is required")
      .max(100, "crimeKey too long")
      .regex(/^[a-z0-9_]+$/, "Invalid crimeKey format"),
  }),
});

export const syncUserSchema = z.object({
  body: z.object({
    username: z
      .string()
      .min(3, "Username must be at least 3 characters")
      .max(20, "Username max 20 characters")
      .regex(/^[a-zA-Z0-9_]+$/, "Username can only have letters, numbers, underscores")
      .optional(),
  }),
});

export const checkUsernameSchema = z.object({
  params: z.object({
    username: z
      .string()
      .min(1)
      .max(30),
  }),
});

export const adminUidParamSchema = z.object({
  params: z.object({
    uid: z.string().min(1).max(128),
  }),
});
