// ============================================================
// PAYMENT ROUTES — UNDERCITY
// ============================================================
// Stub for Phase 0-2.
// Real Lemon Squeezy integration coming in Phase 3 (Sept 2026).
// ============================================================

import { Router, Request, Response } from "express";
import { POINT_PACKS } from "../config/stripe";

const router = Router();

// GET /packs — returns available point packs (frontend can display them)
router.get("/packs", (_req: Request, res: Response) => {
  res.json({
    success: true,
    packs:   POINT_PACKS,
  });
});

// POST /checkout — payment processing not yet enabled
router.post("/checkout", (_req: Request, res: Response) => {
  res.status(503).json({
    success: false,
    error:   "PAYMENTS_NOT_ENABLED",
    message: "Payments will be available at launch (January 2027).",
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
