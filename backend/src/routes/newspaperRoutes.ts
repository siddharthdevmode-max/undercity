import { Router } from "express";
import { verifyFirebaseToken } from "../middleware/firebaseAuth";
import { noCache } from "../middleware/cacheHeaders";
import { asyncHandler } from "../utils/asyncHandler";
import { getArticles } from "../services/newspaperService";

const router = Router();
router.use(noCache);

router.get("/articles", verifyFirebaseToken, asyncHandler(async (req, res) => {
  const category = req.query.category as string | undefined;
  const page = parseInt(req.query.page as string, 10) || 1;
  res.json(await getArticles(category, page));
}));

export default router;
