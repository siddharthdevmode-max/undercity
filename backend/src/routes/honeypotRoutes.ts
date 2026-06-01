import { Router, Request, Response } from "express";
import { verifyFirebaseToken } from "../middleware/firebaseAuth";
import { flagUser } from "../services/trustEngine";

const router = Router();

// ============================================================
// HONEYPOT ENDPOINTS
// These look like admin/exploit endpoints in JS bundles
// NO legitimate user/code ever hits these
// Anyone who does = INSTANT HARD BAN
// ============================================================

const honeypotHandler = async (req: Request, res: Response) => {
  try {
    const firebaseUser = (req as any).firebaseUser;
    const uid = firebaseUser?.uid;

    if (uid) {
      console.log(
        `🍯 HONEYPOT TRIGGERED by ${uid.substring(0, 8)}... ` +
        `| Path: ${req.path} ` +
        `| IP: ${req.ip}`
      );
      
      // Massive trust score hit = instant hard ban
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
      // No auth = still log the IP for fingerprinting later
      console.log(`🍯 ANONYMOUS HONEYPOT HIT | Path: ${req.path} | IP: ${req.ip}`);
    }

    // Always return generic 404 - never reveal it was a honeypot
    return res.status(404).json({ message: "Not found" });
  } catch (error) {
    return res.status(404).json({ message: "Not found" });
  }
};

// Tempting endpoints that look real but are traps
router.post("/admin/add-money", verifyFirebaseToken, honeypotHandler);
router.post("/admin/set-level", verifyFirebaseToken, honeypotHandler);
router.post("/debug/skip-jail", verifyFirebaseToken, honeypotHandler);
router.get("/internal/users-list", verifyFirebaseToken, honeypotHandler);
router.post("/api-v2/crimes/instant-success", verifyFirebaseToken, honeypotHandler);
router.get("/dev/give-points", verifyFirebaseToken, honeypotHandler);
router.post("/cheats/unlock-all", verifyFirebaseToken, honeypotHandler);

export default router;
