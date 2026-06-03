import { Router, Request, Response } from "express";
import { verifyFirebaseToken } from "../middleware/firebaseAuth";
import { flagUser } from "../services/trustEngine";
import { logger } from "../utils/logger";

const router = Router();

// ============================================================
// HONEYPOT ENDPOINTS
// These look like admin/exploit endpoints in JS bundles
// NO legitimate user/code ever hits these
// Anyone who does = INSTANT HARD BAN
// ============================================================

const honeypotHandler = async (req: Request, res: Response) => {
  try {
    const firebaseUser = req.firebaseUser;
    const uid = firebaseUser?.uid;

    if (uid) {
      logger.warn("🍯 HONEYPOT TRIGGERED", {
        uid: uid.substring(0, 8),
        path: req.path,
        ip: req.ip,
      });

      await flagUser({
        firebaseUid: uid,
        violationType: "HONEYPOT_TRIGGERED",
        details: {
          path: req.path,
          method: req.method,
          body: req.body,
        },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });
    } else {
      logger.warn("🍯 ANONYMOUS HONEYPOT HIT", {
        path: req.path,
        ip: req.ip,
      });
    }

    return res.status(404).json({ message: "Not found" });
  } catch {
    return res.status(404).json({ message: "Not found" });
  }
};

router.post("/admin/add-money", verifyFirebaseToken, honeypotHandler);
router.post("/admin/set-level", verifyFirebaseToken, honeypotHandler);
router.post("/debug/skip-jail", verifyFirebaseToken, honeypotHandler);
router.get("/internal/users-list", verifyFirebaseToken, honeypotHandler);
router.post("/api-v2/crimes/instant-success", verifyFirebaseToken, honeypotHandler);
router.get("/dev/give-points", verifyFirebaseToken, honeypotHandler);
router.post("/cheats/unlock-all", verifyFirebaseToken, honeypotHandler);

export default router;
