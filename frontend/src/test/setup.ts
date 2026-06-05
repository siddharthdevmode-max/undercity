import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock Firebase
vi.mock("../firebase", () => ({
  auth: {
    currentUser: null,
    onAuthStateChanged: vi.fn(),
  },
}));

// Mock environment variables
Object.defineProperty(import.meta, "env", {
  value: {
    VITE_API_URL:            "http://localhost:5000",
    VITE_FIREBASE_API_KEY:   "test-key",
    VITE_FIREBASE_AUTH_DOMAIN: "test.firebaseapp.com",
    VITE_FIREBASE_PROJECT_ID:  "test-project",
    VITE_FIREBASE_APP_ID:      "test-app-id",
    DEV:  true,
    PROD: false,
    MODE: "test",
  },
});
