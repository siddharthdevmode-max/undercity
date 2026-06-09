// ============================================================
// TIER CONFIG TESTS
// ============================================================

import { describe, it, expect } from "vitest";
import {
  TIER_CONFIG,
  getTierConfig,
  isValidTier,
  getNerveRegenMs,
  isTierExpired,
  calcCitizenPackExpiry,
} from "../config/tiers";

describe("TIER_CONFIG", () => {
  it("has all three tiers", () => {
    expect(TIER_CONFIG).toHaveProperty("player");
    expect(TIER_CONFIG).toHaveProperty("citizen");
    expect(TIER_CONFIG).toHaveProperty("contributor");
  });

  it("player nerve regen is 300s", () => {
    expect(TIER_CONFIG.player.nerveRegenSec).toBe(300);
  });

  it("contributor nerve regen is faster than player", () => {
    expect(TIER_CONFIG.contributor.nerveRegenSec).toBeLessThan(
      TIER_CONFIG.player.nerveRegenSec
    );
  });

  it("all tiers start at nerve 30", () => {
    expect(TIER_CONFIG.player.nerveStart).toBe(30);
    expect(TIER_CONFIG.citizen.nerveStart).toBe(30);
    expect(TIER_CONFIG.contributor.nerveStart).toBe(30);
  });

  it("all tiers have same nerveMaxCap", () => {
    expect(TIER_CONFIG.player.nerveMaxCap).toBe(130);
    expect(TIER_CONFIG.citizen.nerveMaxCap).toBe(130);
    expect(TIER_CONFIG.contributor.nerveMaxCap).toBe(130);
  });
});

describe("getTierConfig", () => {
  it("returns correct config for player", () => {
    expect(getTierConfig("player")).toEqual(TIER_CONFIG.player);
  });

  it("returns correct config for contributor", () => {
    expect(getTierConfig("contributor")).toEqual(TIER_CONFIG.contributor);
  });

  it("falls back to player for unknown tier", () => {
    expect(getTierConfig("unknown" as never)).toEqual(TIER_CONFIG.player);
  });
});

describe("isValidTier", () => {
  it("accepts valid tiers", () => {
    expect(isValidTier("player")).toBe(true);
    expect(isValidTier("citizen")).toBe(true);
    expect(isValidTier("contributor")).toBe(true);
  });

  it("rejects invalid tiers", () => {
    expect(isValidTier("admin")).toBe(false);
    expect(isValidTier("")).toBe(false);
    expect(isValidTier("PLAYER")).toBe(false);
  });
});

describe("getNerveRegenMs", () => {
  it("returns milliseconds (nerveRegenSec * 1000)", () => {
    expect(getNerveRegenMs("player")).toBe(300_000);
    expect(getNerveRegenMs("contributor")).toBe(180_000);
  });
});

describe("isTierExpired", () => {
  it("player tier never expires", () => {
    expect(isTierExpired("player", null)).toBe(false);
    expect(isTierExpired("player", new Date(Date.now() - 1000))).toBe(false);
  });

  it("citizen tier with null expiry is not expired", () => {
    expect(isTierExpired("citizen", null)).toBe(false);
  });

  it("citizen tier with past expiry is expired", () => {
    const past = new Date(Date.now() - 1000);
    expect(isTierExpired("citizen", past)).toBe(true);
  });

  it("citizen tier with future expiry is not expired", () => {
    const future = new Date(Date.now() + 100_000);
    expect(isTierExpired("citizen", future)).toBe(false);
  });

  it("accepts string dates", () => {
    const past = new Date(Date.now() - 1000).toISOString();
    expect(isTierExpired("contributor", past)).toBe(true);
  });
});

describe("calcCitizenPackExpiry", () => {
  it("returns a date 31 days in the future", () => {
    const expiry    = calcCitizenPackExpiry();
    const expected  = Date.now() + 31 * 24 * 60 * 60 * 1_000;
    // Allow 5 second window for test execution time
    expect(expiry.getTime()).toBeGreaterThan(expected - 5_000);
    expect(expiry.getTime()).toBeLessThan(expected + 5_000);
  });
});
