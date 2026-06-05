import { Request, Response, NextFunction } from "express";

// ============================================================
// HTTP CACHE HEADERS MIDDLEWARE
// Proper cache control for each route type
// ============================================================

// No cache — auth, mutations, user-specific data
export function noCache(
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma",        "no-cache");
  res.setHeader("Expires",       "0");
  next();
}

// Short cache — public stats, leaderboards (30s)
export function shortCache(
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
  next();
}

// Medium cache — crime list, game config (5 min)
export function mediumCache(
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  res.setHeader("Cache-Control", "private, max-age=300, stale-while-revalidate=600");
  next();
}

// Static cache — never changes (1 year)
export function staticCache(
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  next();
}
