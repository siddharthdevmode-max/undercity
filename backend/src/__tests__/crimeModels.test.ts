// ============================================================
// CRIME MODELS — UNIT TESTS
// Tests for parseCrime, parseProgress, parseSpecial
// ============================================================

import { describe, it, expect } from "vitest";
import {
  parseCrime,
  parseProgress,
  parseSpecial,
} from "../models/crimeModels";

// ============================================================
// parseCrime
// ============================================================

describe("parseCrime", () => {
  const validRow = {
    id:               1,
    crime_key:        "shoplift",
    name:             "Shoplift",
    tier:             1,
    unlock_level:     1,
    nerve_cost:       2,
    min_reward:       100,
    max_reward:       500,
    jail_min_seconds: 60,
    jail_max_seconds: 300,
    is_federal:       false,
  };

  it("parses a valid crime row correctly", () => {
    const crime = parseCrime(validRow);
    expect(crime.id).toBe(1);
    expect(crime.crime_key).toBe("shoplift");
    expect(crime.name).toBe("Shoplift");
    expect(crime.tier).toBe(1);
    expect(crime.unlock_level).toBe(1);
    expect(crime.nerve_cost).toBe(2);
    expect(crime.min_reward).toBe(100);
    expect(crime.max_reward).toBe(500);
    expect(crime.jail_min_seconds).toBe(60);
    expect(crime.jail_max_seconds).toBe(300);
    expect(crime.is_federal).toBe(false);
  });

  it("converts numeric strings to numbers", () => {
    const row = { ...validRow, id: "5", tier: "3", nerve_cost: "12" };
    const crime = parseCrime(row);
    expect(crime.id).toBe(5);
    expect(crime.tier).toBe(3);
    expect(crime.nerve_cost).toBe(12);
  });

  it("converts truthy is_federal to true", () => {
    const crime = parseCrime({ ...validRow, is_federal: 1 });
    expect(crime.is_federal).toBe(true);
  });

  it("converts falsy is_federal to false", () => {
    const crime = parseCrime({ ...validRow, is_federal: 0 });
    expect(crime.is_federal).toBe(false);
  });

  it("converts null/undefined numeric fields to 0", () => {
    const row = {
      ...validRow,
      min_reward: null,
      max_reward: undefined,
      nerve_cost: null,
    };
    const crime = parseCrime(row);
    expect(crime.min_reward).toBe(0);
    expect(crime.max_reward).toBe(0);
    expect(crime.nerve_cost).toBe(0);
  });

  it("converts crime_key to string", () => {
    const crime = parseCrime({ ...validRow, crime_key: 42 });
    expect(typeof crime.crime_key).toBe("string");
    expect(crime.crime_key).toBe("42");
  });

  it("converts name to string", () => {
    const crime = parseCrime({ ...validRow, name: 123 });
    expect(typeof crime.name).toBe("string");
  });

  it("returns correct shape (all fields present)", () => {
    const crime = parseCrime(validRow);
    expect(crime).toMatchObject({
      id:               expect.any(Number),
      crime_key:        expect.any(String),
      name:             expect.any(String),
      tier:             expect.any(Number),
      unlock_level:     expect.any(Number),
      nerve_cost:       expect.any(Number),
      min_reward:       expect.any(Number),
      max_reward:       expect.any(Number),
      jail_min_seconds: expect.any(Number),
      jail_max_seconds: expect.any(Number),
      is_federal:       expect.any(Boolean),
    });
  });

  it("parses tier 5 federal crime correctly", () => {
    const crime = parseCrime({
      id: 25, crime_key: "assassination", name: "Assassination",
      tier: 5, unlock_level: 20, nerve_cost: 26,
      min_reward: 2_500_000, max_reward: 10_000_000,
      jail_min_seconds: 259200, jail_max_seconds: 604800,
      is_federal: true,
    });
    expect(crime.tier).toBe(5);
    expect(crime.is_federal).toBe(true);
    expect(crime.max_reward).toBe(10_000_000);
  });
});

// ============================================================
// parseProgress
// ============================================================

describe("parseProgress", () => {
  const validRow = {
    id:                   42,
    user_id:              1,
    crime_id:             5,
    crime_xp:             1500,
    crime_level:          10,
    hidden_cpl:           75.5,
    attempts:             100,
    successes:            60,
    failures:             30,
    crit_failures:        10,
    specials_found_count: 3,
  };

  it("parses a valid progress row correctly", () => {
    const progress = parseProgress(validRow);
    expect(progress.id).toBe(42);
    expect(progress.user_id).toBe(1);
    expect(progress.crime_id).toBe(5);
    expect(progress.crime_xp).toBe(1500);
    expect(progress.crime_level).toBe(10);
    expect(progress.hidden_cpl).toBe(75.5);
    expect(progress.attempts).toBe(100);
    expect(progress.successes).toBe(60);
    expect(progress.failures).toBe(30);
    expect(progress.crit_failures).toBe(10);
    expect(progress.specials_found_count).toBe(3);
  });

  it("returns null id when row id is missing/falsy", () => {
    const row = { ...validRow, id: null };
    const progress = parseProgress(row);
    expect(progress.id).toBeNull();
  });

  it("returns null id when row id is undefined", () => {
    const row = { ...validRow, id: undefined };
    const progress = parseProgress(row);
    expect(progress.id).toBeNull();
  });

  it("returns numeric id when present", () => {
    const progress = parseProgress(validRow);
    expect(progress.id).toBe(42);
  });

  it("converts string numbers to numbers", () => {
    const row = { ...validRow, crime_xp: "500", crime_level: "5", attempts: "10" };
    const progress = parseProgress(row);
    expect(progress.crime_xp).toBe(500);
    expect(progress.crime_level).toBe(5);
    expect(progress.attempts).toBe(10);
  });

  it("defaults null hidden_cpl to 0", () => {
    const row = { ...validRow, hidden_cpl: null };
    const progress = parseProgress(row);
    expect(progress.hidden_cpl).toBe(0);
  });

  it("defaults undefined hidden_cpl to 0", () => {
    const row = { ...validRow, hidden_cpl: undefined };
    const progress = parseProgress(row);
    expect(progress.hidden_cpl).toBe(0);
  });

  it("converts null numeric fields to 0", () => {
    const row = {
      ...validRow,
      crime_xp: null, attempts: null,
      successes: null, failures: null,
      crit_failures: null, specials_found_count: null,
    };
    const progress = parseProgress(row);
    expect(progress.crime_xp).toBe(0);
    expect(progress.attempts).toBe(0);
    expect(progress.successes).toBe(0);
    expect(progress.failures).toBe(0);
    expect(progress.crit_failures).toBe(0);
    expect(progress.specials_found_count).toBe(0);
  });

  it("returns correct shape (all fields present)", () => {
    const progress = parseProgress(validRow);
    expect(progress).toMatchObject({
      id:                   expect.any(Number),
      user_id:              expect.any(Number),
      crime_id:             expect.any(Number),
      crime_xp:             expect.any(Number),
      crime_level:          expect.any(Number),
      hidden_cpl:           expect.any(Number),
      attempts:             expect.any(Number),
      successes:            expect.any(Number),
      failures:             expect.any(Number),
      crit_failures:        expect.any(Number),
      specials_found_count: expect.any(Number),
    });
  });

  it("handles fresh progress row (all zeros)", () => {
    const row = {
      id: null, user_id: 1, crime_id: 1,
      crime_xp: 0, crime_level: 0, hidden_cpl: 0,
      attempts: 0, successes: 0, failures: 0,
      crit_failures: 0, specials_found_count: 0,
    };
    const progress = parseProgress(row);
    expect(progress.id).toBeNull();
    expect(progress.crime_xp).toBe(0);
    expect(progress.attempts).toBe(0);
  });

  it("preserves float hidden_cpl", () => {
    const row = { ...validRow, hidden_cpl: 123.456 };
    const progress = parseProgress(row);
    expect(progress.hidden_cpl).toBeCloseTo(123.456);
  });
});

// ============================================================
// parseSpecial
// ============================================================

describe("parseSpecial", () => {
  const validRow = {
    id:                  10,
    crime_id:            5,
    title:               "Lucky Strike",
    description:         "You found a hidden stash of cash!",
    reward_money:        50_000,
    reward_points:       100,
    unlock_crime_level:  5,
  };

  it("parses a valid special row correctly", () => {
    const special = parseSpecial(validRow);
    expect(special.id).toBe(10);
    expect(special.crime_id).toBe(5);
    expect(special.title).toBe("Lucky Strike");
    expect(special.description).toBe("You found a hidden stash of cash!");
    expect(special.reward_money).toBe(50_000);
    expect(special.reward_points).toBe(100);
    expect(special.unlock_crime_level).toBe(5);
  });

  it("converts numeric string fields to numbers", () => {
    const row = { ...validRow, id: "15", reward_money: "75000", reward_points: "50" };
    const special = parseSpecial(row);
    expect(special.id).toBe(15);
    expect(special.reward_money).toBe(75_000);
    expect(special.reward_points).toBe(50);
  });

  it("converts title to string", () => {
    const special = parseSpecial({ ...validRow, title: 999 });
    expect(typeof special.title).toBe("string");
    expect(special.title).toBe("999");
  });

  it("converts description to string", () => {
    const special = parseSpecial({ ...validRow, description: null });
    expect(typeof special.description).toBe("string");
  });

  it("converts null numeric fields to 0", () => {
    const row = {
      ...validRow,
      reward_money: null,
      reward_points: null,
      unlock_crime_level: null,
    };
    const special = parseSpecial(row);
    expect(special.reward_money).toBe(0);
    expect(special.reward_points).toBe(0);
    expect(special.unlock_crime_level).toBe(0);
  });

  it("returns correct shape (all fields present)", () => {
    const special = parseSpecial(validRow);
    expect(special).toMatchObject({
      id:                 expect.any(Number),
      crime_id:           expect.any(Number),
      title:              expect.any(String),
      description:        expect.any(String),
      reward_money:       expect.any(Number),
      reward_points:      expect.any(Number),
      unlock_crime_level: expect.any(Number),
    });
  });

  it("handles high-value specials (tier 5)", () => {
    const special = parseSpecial({
      id: 99, crime_id: 25,
      title: "The Perfect Score",
      description: "Everything went exactly to plan.",
      reward_money: 15_000_000,
      reward_points: 5000,
      unlock_crime_level: 90,
    });
    expect(special.reward_money).toBe(15_000_000);
    expect(special.unlock_crime_level).toBe(90);
  });

  it("handles unlock_crime_level of 0 (available from start)", () => {
    const special = parseSpecial({ ...validRow, unlock_crime_level: 0 });
    expect(special.unlock_crime_level).toBe(0);
  });
});
