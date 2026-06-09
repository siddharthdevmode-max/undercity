// ============================================================
// TIER CONFIG TESTS
// ============================================================

import { describe, it, expect } from "vitest";
import {
  TIER_CONFIG,
  getTierConfig,
  isValidTier,
  getNerveRegenMs,
  getEnergyRegenMs,
  getEnergyRegenAmount,
  isTierExpired,
  calcTierExpiry,
} from "../config/tiers";

describe("TIER_CONFIG", () => {
  it("has all three tiers", () => {
    expect(TIER_CONFIG).toHaveProperty("player");
    expect(TIER_CONFIG).toHaveProperty("citizen");
    expect(TIER_CONFIG).toHaveProperty("contributor");
  });

  it("player nerve regen is 300s (1 nerve / 5 min)", () => {
    expect(TIER_CONFIG.player.nerveRegenSec).toBe(300);
  });

  it("citizen nerve regen is 300s (same as player)", () => {
    expect(TIER_CONFIG.citizen.nerveRegenSec).toBe(300);
  });

  it("contributor nerve regen is 180s (1 nerve / 3 min)", () => {
    expect(TIER_CONFIG.contributor.nerveRegenSec).toBe(180);
  });

  it("contributor nerve regen is faster than player", () => {
    expect(TIER_CONFIG.contributor.nerveRegenSec).toBeLessThan(
      TIER_CONFIG.player.nerveRegenSec
    );
  });

  it("player energy regen is 900s (5 energy / 15 min)", () => {
    expect(TIER_CONFIG.player.energyRegenSec).toBe(900);
  });

  it("citizen energy regen is 720s (5 energy / 12 min)", () => {
    expect(TIER_CONFIG.citizen.energyRegenSec).toBe(720);
  });

  it("contributor energy regen is 600s (5 energy / 10 min)", () => {
    expect(TIER_CONFIG.contributor.energyRegenSec).toBe(600);
  });

  it("energy regen is faster for higher tiers", () => {
    expect(TIER_CONFIG.contributor.energyRegenSec).toBeLessThan(
      TIER_CONFIG.citizen.energyRegenSec
    );
    expect(TIER_CONFIG.citizen.energyRegenSec).toBeLessThan(
      TIER_CONFIG.player.energyRegenSec
    );
  });

  it("all tiers start at nerve 30", () => {
    expect(TIER_CONFIG.player.nerveStart).toBe(30);
    expect(TIER_CONFIG.citizen.nerveStart).toBe(30);
    expect(TIER_CONFIG.contributor.nerveStart).toBe(30);
  });

  it("all tiers have same nerveMaxCap (130)", () => {
    expect(TIER_CONFIG.player.nerveMaxCap).toBe(130);
    expect(TIER_CONFIG.citizen.nerveMaxCap).toBe(130);
    expect(TIER_CONFIG.contributor.nerveMaxCap).toBe(130);
  });

  it("all tiers regen 5 energy per tick", () => {
    expect(TIER_CONFIG.player.energyRegenAmount).toBe(5);
    expect(TIER_CONFIG.citizen.energyRegenAmount).toBe(5);
    expect(TIER_CONFIG.contributor.energyRegenAmount).toBe(5);
  });

  it("citizen is not a subscription, contributor is", () => {
    expect(TIER_CONFIG.citizen.isSubscription).toBe(false);
    expect(TIER_CONFIG.contributor.isSubscription).toBe(true);
  });

  it("player is free (priceUsd = 0)", () => {
    expect(TIER_CONFIG.player.priceUsd).toBe(0);
  });

  it("citizen is $4.99", () => {
    expect(TIER_CONFIG.citizen.priceUsd).toBe(4.99);
  });

  it("contributor is $7.99", () => {
    expect(TIER_CONFIG.contributor.priceUsd).toBe(7.99);
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
  it("returns milliseconds for player (300s = 300_000ms)", () => {
    expect(getNerveRegenMs("player")).toBe(300_000);
  });

  it("returns milliseconds for contributor (180s = 180_000ms)", () => {
    expect(getNerveRegenMs("contributor")).toBe(180_000);
  });
});

describe("getEnergyRegenMs", () => {
  it("returns 900_000ms for player (15 min)", () => {
    expect(getEnergyRegenMs("player")).toBe(900_000);
  });

  it("returns 720_000ms for citizen (12 min)", () => {
    expect(getEnergyRegenMs("citizen")).toBe(720_000);
  });

  it("returns 600_000ms for contributor (10 min)", () => {
    expect(getEnergyRegenMs("contributor")).toBe(600_000);
  });
});

describe("getEnergyRegenAmount", () => {
  it("returns 5 for all tiers", () => {
    expect(getEnergyRegenAmount("player")).toBe(5);
    expect(getEnergyRegenAmount("citizen")).toBe(5);
    expect(getEnergyRegenAmount("contributor")).toBe(5);
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

describe("calcTierExpiry", () => {
  it("citizen: returns 31 days in the future (no existing expiry)", () => {
    const expiry   = calcTierExpiry("citizen", null);
    const expected = Date.now() + 31 * 24 * 60 * 60 * 1_000;
    expect(expiry.getTime()).toBeGreaterThan(expected - 5_000);
    expect(expiry.getTime()).toBeLessThan(expected + 5_000);
  });

  it("contributor: returns 31 days in the future (no existing expiry)", () => {
    const expiry   = calcTierExpiry("contributor", null);
    const expected = Date.now() + 31 * 24 * 60 * 60 * 1_000;
    expect(expiry.getTime()).toBeGreaterThan(expected - 5_000);
    expect(expiry.getTime()).toBeLessThan(expected + 5_000);
  });

  it("extends from current expiry when still active", () => {
    const currentExpiry  = new Date(Date.now() + 15 * 24 * 60 * 60 * 1_000);
    const newExpiry      = calcTierExpiry("citizen", currentExpiry);
    const diffDays       = Math.round(
      (newExpiry.getTime() - currentExpiry.getTime()) / (1000 * 60 * 60 * 24)
    );
    expect(diffDays).toBe(31);
  });

  it("starts fresh from now when existing expiry is in the past", () => {
    const pastExpiry = new Date(Date.now() - 24 * 60 * 60 * 1_000);
    const newExpiry  = calcTierExpiry("citizen", pastExpiry);
    const expected   = Date.now() + 31 * 24 * 60 * 60 * 1_000;
    expect(newExpiry.getTime()).toBeGreaterThan(expected - 5_000);
    expect(newExpiry.getTime()).toBeLessThan(expected + 5_000);
  });

  it("throws for player tier", () => {
    expect(() => calcTierExpiry("player", null)).toThrow();
  });
});
