import { z } from "zod";
import { safeUsername, safeCrimeKey, safeUid } from "./sanitize";

// ============================================================
// REQUEST VALIDATION SCHEMAS
// All string inputs are sanitized via .transform()
// Single source of truth for all route validation
// ============================================================

export const attemptCrimeSchema = z.object({
  body: z.object({
    crimeKey: safeCrimeKey,
  }),
});

export const syncUserSchema = z.object({
  body: z.object({
    username: safeUsername.optional(),
  }),
});

export const checkUsernameSchema = z.object({
  params: z.object({
    username: safeUsername,
  }),
});

export const adminUidParamSchema = z.object({
  params: z.object({
    uid: safeUid,
  }),
});

// ============================================================
// FUTURE SCHEMAS — ready to use when features are built
// ============================================================

export const paginationSchema = z.object({
  query: z.object({
    page:  z.coerce.number().int().min(1).max(1000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

export const searchSchema = z.object({
  query: z.object({
    q: z.string().min(1).max(100).transform((val) => val.trim()),
  }),
});
