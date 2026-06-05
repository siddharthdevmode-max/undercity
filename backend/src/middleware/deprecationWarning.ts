import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

// ============================================================
// DEPRECATION WARNING MIDDLEWARE
// Adds Deprecation header to legacy /api/* routes (non v1)
// Logs usage for migration tracking
// ============================================================

export const deprecationWarning = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const isLegacy = !req.path.includes("/v1/") && !req.path.includes("/health");

  if (isLegacy) {
    res.setHeader("Deprecation", "true");
    res.setHeader("Sunset", "2027-01-01");
    res.setHeader(
      "Link",
      `<${req.path.replace("/api/", "/api/v1/")}>;rel="successor-version"`
    );

    logger.debug("⚠️ Legacy route used", {
      path:   req.path,
      method: req.method,
      ip:     req.ip,
    });
  }

  next();
};
