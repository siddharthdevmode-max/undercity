// ============================================================
// PAYMENT ROUTES — UNDERCITY
// ============================================================
// Stub for Phase 0-2.
// Real Lemon Squeezy integration coming in Phase 3 (Sept 2026).
// ============================================================

import { Router, Request, Response } from "express";
import { POINT_PACKS }               from "../config/stripe";

const router = Router();

// GET /packs — returns available point packs
router.get("/packs", (_req: Request, res: Response) => {
  res.json({
    success: true,
    packs:   POINT_PACKS,
    notice:  "Payments launch with the game on December 15, 2026.",
  });
});

// POST /checkout — not yet enabled
router.post("/checkout", (_req: Request, res: Response) => {
  res.status(503).json({
    success: false,
    error:   "PAYMENTS_NOT_ENABLED",
    message: "Payments will be available at launch (December 2026).",
  });
});

// POST /webhook — placeholder for Lemon Squeezy webhooks
router.post("/webhook", (_req: Request, res: Response) => {
  res.status(503).json({
    success: false,
    error:   "WEBHOOK_NOT_ENABLED",
    message: "Webhook handler not yet implemented.",
  });
});

export default router;
