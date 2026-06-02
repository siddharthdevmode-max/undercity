import admin from "firebase-admin";
import path from "path";
import fs from "fs";
import { logger } from "../utils/logger";

// ============================================================
// FIREBASE ADMIN CONFIG
// Loads service account from one of (in order):
//   1. FIREBASE_SERVICE_ACCOUNT_JSON env var (production/Render)
//      Full JSON string pasted into the env var
//   2. firebase-service-account.json file (local dev)
//   3. Skipped entirely if NODE_ENV === 'test' (CI mock)
// ============================================================

function loadServiceAccount(): admin.ServiceAccount | null {
  // ── Production: read JSON from env var ──
  const envJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (envJson) {
    try {
      return JSON.parse(envJson) as admin.ServiceAccount;
    } catch (err) {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_JSON env var is not valid JSON"
      );
    }
  }

  // ── Local dev: read from disk ──
  const filePath = path.resolve(__dirname, "../../firebase-service-account.json");
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as admin.ServiceAccount;
  }

  return null;
}

// ── Initialize ──
if (!admin.apps.length) {
  if (process.env.NODE_ENV === "test") {
    // CI / unit tests: skip real Firebase init
    // Tests should mock the auth module if they need it
    logger.warn("⚠️  Firebase Admin skipped in test environment");
  } else {
    const serviceAccount = loadServiceAccount();
    if (!serviceAccount) {
      throw new Error(
        "Firebase service account not found. " +
        "Set FIREBASE_SERVICE_ACCOUNT_JSON env var or place " +
        "firebase-service-account.json in the backend folder."
      );
    }
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
}

// In test mode, export a stub that throws if actually called
// Tests must mock this if they hit auth-protected routes
export const authAdmin: admin.auth.Auth =
  process.env.NODE_ENV === "test" && !admin.apps.length
    ? ({} as admin.auth.Auth)
    : admin.auth();
