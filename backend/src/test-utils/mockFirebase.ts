import { vi } from "vitest";

// ============================================================
// MOCK FIREBASE TOKEN VERIFICATION
// Lets integration tests bypass real Firebase auth
// ============================================================

export function mockFirebaseAuth(uid: string) {
  vi.mock("../config/firebase", () => ({
    authAdmin: {
      verifyIdToken: vi.fn().mockResolvedValue({
        uid,
        email: `${uid}@test.com`,
        name:  "Test User",
      }),
    },
  }));
}

export function mockFirebaseAuthFailure() {
  vi.mock("../config/firebase", () => ({
    authAdmin: {
      verifyIdToken: vi.fn().mockRejectedValue(
        new Error("Firebase token invalid")
      ),
    },
  }));
}
