import { describe, it, expect } from "vitest";
import { isProfane, isValidUsername } from "../utils/profanityFilter";

describe("isProfane", () => {
  it("flags reserved names", () => {
    expect(isProfane("admin")).toBe(true);
    expect(isProfane("moderator")).toBe(true);
    expect(isProfane("system")).toBe(true);
    expect(isProfane("root")).toBe(true);
    expect(isProfane("undercity")).toBe(true);
  });

  it("flags reserved names case-insensitive", () => {
    expect(isProfane("Admin")).toBe(true);
    expect(isProfane("ADMIN")).toBe(true);
    expect(isProfane("SyStEm")).toBe(true);
  });

  it("flags profane split parts", () => {
    expect(isProfane("dark_shit_lord")).toBe(true);
    expect(isProfane("x-fuck-y")).toBe(true);
    expect(isProfane("abc_bitch_xyz")).toBe(true);
  });

  it("does not false-positive on normal usernames", () => {
    expect(isProfane("player123")).toBe(false);
    expect(isProfane("darknight")).toBe(false);
    expect(isProfane("xhunter99")).toBe(false);
    expect(isProfane("scunthorpe")).toBe(false);
    expect(isProfane("assassin")).toBe(false);
  });

  it("flags SQL keywords", () => {
    expect(isProfane("select")).toBe(true);
    expect(isProfane("delete")).toBe(true);
    expect(isProfane("drop")).toBe(true);
  });
});

describe("isValidUsername", () => {
  it("accepts valid usernames", () => {
    expect(isValidUsername("player1").valid).toBe(true);
    expect(isValidUsername("Dark_Knight").valid).toBe(true);
    expect(isValidUsername("x-hunter-99").valid).toBe(true);
  });

  it("rejects too short", () => {
    const r = isValidUsername("ab");
    expect(r.valid).toBe(false);
    expect(r.reason).toContain("3");
  });

  it("rejects too long", () => {
    const r = isValidUsername("a".repeat(21));
    expect(r.valid).toBe(false);
    expect(r.reason).toContain("20");
  });

  it("rejects special characters", () => {
    const r = isValidUsername("player@123");
    expect(r.valid).toBe(false);
  });

  it("rejects spaces", () => {
    const r = isValidUsername("player 123");
    expect(r.valid).toBe(false);
  });

  it("rejects reserved names", () => {
    const r = isValidUsername("admin");
    expect(r.valid).toBe(false);
    expect(r.reason).toContain("not allowed");
  });

  it("accepts boundary length 3", () => {
    expect(isValidUsername("abc").valid).toBe(true);
  });

  it("accepts boundary length 20", () => {
    expect(isValidUsername("a".repeat(20)).valid).toBe(true);
  });
});
