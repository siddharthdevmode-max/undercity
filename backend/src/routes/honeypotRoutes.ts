import { Router, Request, Response } from "express";
import { redis }                     from "../config/redis";
import { flagUser }                  from "../services/trustEngine";
import { logger }                    from "../utils/logger";
import { Alerts }                    from "../utils/alerts";

// ============================================================
// HONEYPOT ROUTES
// These endpoints look like admin/cheat endpoints in JS bundles.
// NO legitimate user or code path ever hits these.
//
// WHO HITS THESE:
//   - Automated exploit scanners
//   - Players trying to cheat via DevTools / Postman
//   - Security researchers (we still ban, they can appeal)
//
// WHAT HAPPENS:
//   - Authenticated users: instant hard-ban flag + alert
//   - Anonymous traffic: IP blacklisted for 24h + alert
//
// AUTH NOTE:
//   verifyFirebaseToken is NOT required here — we want to
//   catch unauthenticated scanners too, not just authenticated
//   users. Routes handle both cases.
//
// BODY NOTE:
//   req.body is NOT logged — could contain credentials if
//   someone sends a POST to what looks like /api/auth/login.
//   Only path, method, and IP are logged.
//
// RESPONSE:
//   Always 404 — don't reveal that the endpoint exists or
//   that it's a honeypot.
// ============================================================

const router = Router();

// ── Config ─────────────────────────────────────────────────
const IP_BLACKLIST_TTL_SEC = 24 * 60 * 60; // 24 hours

// ── Honeypot paths (listed here for documentation) ────────
// These are registered below as routes.
// Add more that match common exploit patterns.
const HONEYPOT_PATHS = [
  { method: "POST", path: "/admin/add-money"             },
  { method: "POST", path: "/admin/set-level"             },
  { method: "POST", path: "/admin/give-items"            },
  { method: "GET",  path: "/admin/user-dump"             },
  { method: "POST", path: "/debug/skip-jail"             },
  { method: "POST", path: "/debug/set-trust-score"       },
  { method: "GET",  path: "/internal/users-list"         },
  { method: "GET",  path: "/internal/config-dump"        },
  { method: "POST", path: "/api-v2/crimes/instant-success" },
  { method: "GET",  path: "/dev/give-points"             },
  { method: "POST", path: "/cheats/unlock-all"           },
  { method: "GET",  path: "/cheats/god-mode"             },
  { method: "POST", path: "/exploit/rce"                 },
  { method: "GET",  path: "/exploit/sqli"                },
] as const;

// ── Honeypot handler ───────────────────────────────────────

const honeypotHandler = async (req: Request, res: Response): Promise<void> => {
  const uid = req.firebaseUser?.uid; // may be undefined for unauthenticated hits
  const ip  = req.ip ?? req.socket?.remoteAddress ?? "unknown";

  // Sanitize path for logging (strip query strings, cap length)
  const safePath   = req.path.substring(0, 200).replace(/[^\w/\-.]/g, "");
  const safeMethod = req.method.substring(0, 10).toUpperCase();

  // ── Authenticated user hit ─────────────────────────────
  if (uid) {
    logger.warn("🍯 HONEYPOT TRIGGERED (authenticated)", {
      uid:    uid.substring(0, 8),
      path:   safePath,
      method: safeMethod,
      ip,
    });

    // Fire alert and flag in parallel — don't await alert
    void Alerts.honeypotTriggered(uid, safePath, ip);

    await flagUser({
      firebaseUid:   uid,
      violationType: "HONEYPOT_TRIGGERED",
      details: {
        path:   safePath,
        method: safeMethod,
        // intentionally NOT logging req.body (may contain credentials)
      },
      ipAddress: ip,
      userAgent: req.headers["user-agent"],
    });

  // ── Anonymous / unauthenticated hit ───────────────────
  } else {
    logger.warn("🍯 HONEYPOT TRIGGERED (anonymous)", {
      path:   safePath,
      method: safeMethod,
      ip,
    });

    void Alerts.honeypotTriggered("anonymous", safePath, ip);

    // Blacklist the IP for 24h
    if (ip && ip !== "unknown") {
      await redis
        .set(
          `blacklist:ip:${ip}`,
          `Honeypot hit: ${safeMethod} ${safePath}`,
          "EX",
          IP_BLACKLIST_TTL_SEC
        )
        .catch((err) => {
          logger.error("Honeypot: IP blacklist write failed", {
            error: err instanceof Error ? err.message : String(err),
          });
        });
    }
  }

  // Always return 404 — never reveal this is a honeypot
  res.status(404).json({ message: "Not found" });
};

// ── Register routes ────────────────────────────────────────
// No verifyFirebaseToken — catch both auth and unauth traffic.
// firebaseAuth middleware still runs if token is present
// (because app.ts applies it globally or it's in req.firebaseUser).

for (const { method, path } of HONEYPOT_PATHS) {
  if (method === "POST") router.post(path, honeypotHandler);
  if (method === "GET")  router.get(path,  honeypotHandler);
}

export default router;
