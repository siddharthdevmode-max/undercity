import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// ============================================================
// FIREBASE CONFIG — all values come from environment variables
// Set these in frontend/.env (local) and Cloudflare dashboard (prod)
// ============================================================

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Fail loudly in dev if any var is missing
if (
  !firebaseConfig.apiKey ||
  !firebaseConfig.authDomain ||
  !firebaseConfig.projectId ||
  !firebaseConfig.appId
) {
  throw new Error(
    "Missing Firebase environment variables. Check your .env file."
  );
}

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
