import { Router } from "express";
import { leaderboardLimiter } from "../middleware/rateLimiter";
import { shortCache } from "../middleware/cacheHeaders";
import { asyncHandler } from "../utils/asyncHandler";
import { getPagination, buildPaginatedResponse } from "../utils/pagination";
import { getLeaderboard } from "../services/leaderboardService";

const router = Router();

router.get("/:type", leaderboardLimiter, shortCache, asyncHandler(async (req, res) => {
  const type = (req.params["type"] ?? "level") as "level" | "money" | "crimes" | "points";
  if (!["level", "money", "crimes", "points"].includes(type)) {
    res.status(400).json({ error: "Invalid leaderboard type", code: "INVALID_TYPE" });
    return;
  }
  const { limit, offset, page } = getPagination(req);
  const result = await getLeaderboard(type, limit, offset);
  res.json(buildPaginatedResponse(result.entries, result.total, { page, limit, offset }));
}));

export default router;
