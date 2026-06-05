import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  runIntegrityCheck,
  encodeIntegrityReport,
  markPageLoad,
} from "../integrityCheck";

describe("integrityCheck", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Set navigator.webdriver to false for clean tests
    Object.defineProperty(navigator, "webdriver", {
      value:    false,
      writable: true,
    });
  });

  it("returns a report with passed, flags, score", () => {
    const report = runIntegrityCheck();
    expect(report).toHaveProperty("passed");
    expect(report).toHaveProperty("flags");
    expect(report).toHaveProperty("score");
    expect(Array.isArray(report.flags)).toBe(true);
    expect(typeof report.score).toBe("number");
  });

  it("score is between 0 and 100", () => {
    const report = runIntegrityCheck();
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
  });

  it("encodeIntegrityReport returns base64 string", () => {
    const report  = runIntegrityCheck();
    const encoded = encodeIntegrityReport(report);
    expect(typeof encoded).toBe("string");
    expect(encoded.length).toBeGreaterThan(0);
    // Should be decodeable
    const decoded = JSON.parse(atob(encoded));
    expect(decoded).toHaveProperty("p");
    expect(decoded).toHaveProperty("f");
    expect(decoded).toHaveProperty("s");
  });

  it("markPageLoad sets page load time", () => {
    expect(() => markPageLoad()).not.toThrow();
  });

  it("clean environment passes integrity check", () => {
    const report = runIntegrityCheck();
    // In test environment (jsdom) score should be low
    expect(report.score).toBeLessThan(80);
  });
});
