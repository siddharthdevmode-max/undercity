// ============================================================
// FIREBASE ADMIN CONFIG — UNDERCITY
// Service account loaded from (in priority order):
//   1. FIREBASE_SERVICE_ACCOUNT_JSON env var (production)
//   2. firebase-service-account.json file   (local dev)
//   3. Stub object                          (test environment)
//
// Uses named app ("undercity") to prevent hot-reload conflicts.
// Validates service account shape before initializing.
// ============================================================

import admin from "firebase-admin";
import path  from "path";
import fs    from "fs";
import { logger } from "../utils/logger";

// ─── Named App Constant ───────────────────────────────────

const APP_NAME = "undercity";

// ─── Service Account Shape Validation ────────────────────

interface ServiceAccountShape {
  type:                        string;
  project_id:                  string;
  private_key_id:              string;
  private_key:                 string;
  client_email:                string;
  client_id:                   string;
  auth_uri:                    string;
  token_uri:                   string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url:        string;
}

function validateServiceAccount(raw: unknown): admin.ServiceAccount {
  if (!raw || typeof raw !== "object") {
    throw new Error("Service account must be a JSON object");
  }

  const sa = raw as Partial<ServiceAccountShape>;

  const required: Array<keyof ServiceAccountShape> = [
    "type",
    "project_id",
    "private_key",
    "client_email",
  ];

  const missing = required.filter((key) => !sa[key]);

  if (missing.length > 0) {
    throw new Error(
      `Service account JSON is missing required fields: ${missing.join(", ")}`
    );
  }

  if (sa.type !== "service_account") {
    throw new Error(
      `Invalid service account type: "${sa.type}". Expected "service_account"`
    );
  }

  if (!sa.client_email?.endsWith(".iam.gserviceaccount.com")) {
    throw new Error(
      `Invalid client_email format: "${sa.client_email}"`
    );
  }

  logger.info("✅ Firebase service account validated", {
    projectId:   sa.project_id,
    clientEmail: sa.client_email?.replace(/^.+@/, "***@"),
  });

  return raw as admin.ServiceAccount;
}

// ─── Load Service Account ─────────────────────────────────

function loadServiceAccount(): admin.ServiceAccount {
  // 1. Environment variable (production / Render / Railway)
  const envJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (envJson) {
    try {
      const parsed = JSON.parse(envJson) as unknown;
      return validateServiceAccount(parsed);
    } catch (err) {
      throw new Error(
        `FIREBASE_SERVICE_ACCOUNT_JSON is invalid: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  // 2. File on disk (local dev)
  // Use process.cwd() instead of __dirname for ESM compatibility
  const candidates = [
    path.resolve(process.cwd(), "firebase-service-account.json"),
    path.resolve(process.cwd(), "../firebase-service-account.json"),
  ];

  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(filePath, "utf-8")) as unknown;
        logger.debug("📄 Loading Firebase service account from file", { filePath });
        return validateServiceAccount(raw);
      } catch (err) {
        throw new Error(
          `Failed to parse ${filePath}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
  }

  throw new Error(
    "Firebase service account not found.\n" +
    "Set FIREBASE_SERVICE_ACCOUNT_JSON env var\n" +
    "or place firebase-service-account.json in the backend/ directory."
  );
}

// ─── Initialize Firebase App ──────────────────────────────

function initFirebase(): admin.app.App | null {
  if (process.env.NODE_ENV === "test") {
    logger.warn("⚠️  Firebase Admin skipped in test environment");
    return null;
  }

  // Check if named app already exists (hot-reload guard)
  const existing = admin.apps.find((a) => a?.name === APP_NAME);
  if (existing) {
    logger.debug("♻️  Reusing existing Firebase app");
    return existing;
  }

  const serviceAccount = loadServiceAccount();

  const app = admin.initializeApp(
    { credential: admin.credential.cert(serviceAccount) },
    APP_NAME
  );

  logger.info("✅ Firebase Admin initialized", { app: APP_NAME });
  return app;
}

// ─── Exports ──────────────────────────────────────────────

const firebaseApp = initFirebase();

/**
 * Firebase Auth admin instance.
 * In test mode: a proxy that throws clear errors if accidentally called.
 */
export const authAdmin: admin.auth.Auth =
  firebaseApp
    ? firebaseApp.auth()
    : new Proxy({} as admin.auth.Auth, {
        get(_target, prop) {
          throw new Error(
            `Firebase authAdmin.${String(prop)}() called in test environment. ` +
            `Mock firebase in your test: vi.mock("../config/firebase")`
          );
        },
      });

export { firebaseApp };
