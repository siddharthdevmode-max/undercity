// ============================================================
// FIREBASE ADMIN CONFIG — UNDERCITY
// Service account loaded from (in priority order):
//   1. FIREBASE_SERVICE_ACCOUNT_JSON env var (production — ALWAYS use this)
//   2. firebase-service-account.json file   (local dev — NEVER commit this file)
//   3. Proxy stub                           (test environment)
//
// Uses named app ("undercity") to prevent hot-reload conflicts.
// Validates service account shape before initializing.
// ============================================================

import admin from "firebase-admin";
import path  from "path";
import fs    from "fs";
import { logger } from "../utils/logger";
import { config } from "./index";

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

  const requiredFields: Array<keyof ServiceAccountShape> = [
    "type",
    "project_id",
    "private_key",
    "client_email",
  ];

  const missing = requiredFields.filter((key) => !sa[key]);
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

  // BUG FIX: validate private key format
  const key = sa.private_key ?? "";
  const validKeyHeaders = [
    "-----BEGIN RSA PRIVATE KEY-----",
    "-----BEGIN PRIVATE KEY-----",
  ];
  if (!validKeyHeaders.some((h) => key.includes(h))) {
    throw new Error(
      "private_key does not appear to be a valid PEM key. " +
      "Check for truncation or encoding issues."
    );
  }

  logger.info("Firebase service account validated", {
    projectId:   sa.project_id,
    clientEmail: sa.client_email?.replace(/^[^@]+/, "***"),
  });

  return raw as admin.ServiceAccount;
}

// ─── Load Service Account ─────────────────────────────────

function loadServiceAccount(): admin.ServiceAccount {
  // 1. Config (from env var — preferred in all environments)
  const envJson = config.firebaseServiceAccountJson;
  if (envJson) {
    try {
      const parsed = JSON.parse(envJson) as unknown;
      return validateServiceAccount(parsed);
    } catch (err) {
      throw new Error(
        `FIREBASE_SERVICE_ACCOUNT_JSON is invalid: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  // 2. File on disk (local dev ONLY — this file must NEVER be committed)
  // If you're reading this and about to commit firebase-service-account.json:
  // DON'T. Use FIREBASE_SERVICE_ACCOUNT_JSON env var instead.
  const candidates = [
    path.resolve(process.cwd(), "firebase-service-account.json"),
    path.resolve(process.cwd(), "../firebase-service-account.json"),
  ];

  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) {
      // Warn in any non-test environment — file should not be used in prod
      if (config.isProduction) {
        throw new Error(
          "firebase-service-account.json found on disk in production. " +
          "Use FIREBASE_SERVICE_ACCOUNT_JSON env var instead. " +
          `File path: ${filePath}`
        );
      }

      try {
        const raw = JSON.parse(
          fs.readFileSync(filePath, "utf-8")
        ) as unknown;
        logger.debug("Loading Firebase service account from file (dev only)", {
          filePath,
        });
        return validateServiceAccount(raw);
      } catch (err) {
        throw new Error(
          `Failed to parse ${filePath}: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    }
  }

  throw new Error(
    "Firebase service account not found.\n" +
    "Set FIREBASE_SERVICE_ACCOUNT_JSON env var (recommended)\n" +
    "or place firebase-service-account.json in the backend/ directory (dev only).\n" +
    "NEVER commit firebase-service-account.json to git."
  );
}

// ─── Token Verification with Timeout ─────────────────────
// BUG FIX: verifyIdToken makes a network call (JWKS fetch) on
// first call. Without a timeout, slow Google = hung request.

const VERIFY_TIMEOUT_MS = 10_000;

export async function verifyFirebaseToken(
  token: string
): Promise<admin.auth.DecodedIdToken> {
  return Promise.race([
    authAdmin.verifyIdToken(token),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("Firebase token verification timed out")),
        VERIFY_TIMEOUT_MS
      )
    ),
  ]);
}

// ─── Initialize Firebase App ──────────────────────────────

function initFirebase(): admin.app.App | null {
  if (config.isTest) {
    logger.warn("Firebase Admin skipped in test environment");
    return null;
  }

  // BUG FIX: filter null entries before searching
  const existing = admin.apps
    .filter((a): a is admin.app.App => a !== null)
    .find((a) => a.name === APP_NAME);

  if (existing) {
    logger.debug("Reusing existing Firebase app", { name: APP_NAME });
    return existing;
  }

  const serviceAccount = loadServiceAccount();

  const app = admin.initializeApp(
    { credential: admin.credential.cert(serviceAccount) },
    APP_NAME
  );

  logger.info("Firebase Admin initialized", { app: APP_NAME });
  return app;
}

// ─── Exports ──────────────────────────────────────────────

const firebaseApp = initFirebase();

/**
 * Firebase Auth admin instance.
 *
 * In production: real Firebase Auth client.
 * In test mode: Proxy that throws clear errors if accidentally called.
 * Always use verifyFirebaseToken() instead of authAdmin.verifyIdToken()
 * directly — it adds a timeout wrapper.
 */
export const authAdmin: admin.auth.Auth =
  firebaseApp
    ? firebaseApp.auth()
    : (new Proxy({} as admin.auth.Auth, {
        get(_target, prop) {
          throw new Error(
            `Firebase authAdmin.${String(prop)}() called in test environment. ` +
            `Mock firebase in your test: vi.mock("../config/firebase")`
          );
        },
      }) as admin.auth.Auth);

export { firebaseApp };
