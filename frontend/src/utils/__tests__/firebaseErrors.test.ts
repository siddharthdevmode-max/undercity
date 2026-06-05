import { describe, it, expect } from "vitest";
import { getFriendlyError } from "../firebaseErrors";

describe("getFriendlyError", () => {
  it("returns friendly message for email-already-in-use", () => {
    const err = { code: "auth/email-already-in-use" };
    expect(getFriendlyError(err)).toBe("This email is already registered.");
  });

  it("returns friendly message for wrong-password", () => {
    const err = { code: "auth/wrong-password" };
    expect(getFriendlyError(err)).toBe("Incorrect password. Please try again.");
  });

  it("returns friendly message for invalid-credential", () => {
    const err = { code: "auth/invalid-credential" };
    expect(getFriendlyError(err)).toBe("Invalid email or password.");
  });

  it("returns friendly message for too-many-requests", () => {
    const err = { code: "auth/too-many-requests" };
    expect(getFriendlyError(err)).toBe("Too many attempts. Try again in a few minutes.");
  });

  it("returns fallback for unknown code", () => {
    const err = { code: "auth/unknown-code", message: "Firebase: Unknown error" };
    expect(getFriendlyError(err)).toBe("Unknown error");
  });

  it("returns fallback for non-object", () => {
    expect(getFriendlyError("string error")).toBe("Something went wrong.");
    expect(getFriendlyError(null)).toBe("Something went wrong.");
    expect(getFriendlyError(undefined)).toBe("Something went wrong.");
  });

  it("handles missing code gracefully", () => {
    const err = { message: "Firebase: Some error (auth/blah)" };
    const result = getFriendlyError(err);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});
