import { describe, it, expect } from "vitest";
import {
  attemptCrimeSchema,
  registerSchema,
  syncUserSchema,
  checkUsernameSchema,
  adminBanSchema,
  adminAdjustMoneySchema,
  gdprDeleteSchema,
  createSupportTicketSchema,
  paginationQuery,
  searchQuery,
} from "../utils/schemas";

describe("attemptCrimeSchema", () => {
  it("accepts valid crimeKey", () => {
    const r = attemptCrimeSchema.safeParse({
      body: { crimeKey: "pickpocket" },
    });
    expect(r.success).toBe(true);
  });

  it("rejects empty crimeKey", () => {
    const r = attemptCrimeSchema.safeParse({
      body: { crimeKey: "" },
    });
    expect(r.success).toBe(false);
  });

  it("rejects missing body", () => {
    const r = attemptCrimeSchema.safeParse({});
    expect(r.success).toBe(false);
  });
});

describe("registerSchema", () => {
  it("accepts valid username", () => {
    const r = registerSchema.safeParse({
      body: { username: "testplayer" },
    });
    expect(r.success).toBe(true);
  });

  it("rejects username too short", () => {
    const r = registerSchema.safeParse({
      body: { username: "ab" },
    });
    expect(r.success).toBe(false);
  });

  it("rejects username with special chars", () => {
    const r = registerSchema.safeParse({
      body: { username: "player@123" },
    });
    expect(r.success).toBe(false);
  });

  it("accepts username with optional email", () => {
    const r = registerSchema.safeParse({
      body: { username: "testplayer", email: "test@test.com" },
    });
    expect(r.success).toBe(true);
  });
});

describe("syncUserSchema", () => {
  it("accepts empty body", () => {
    const r = syncUserSchema.safeParse({ body: {} });
    expect(r.success).toBe(true);
  });

  it("accepts body with username", () => {
    const r = syncUserSchema.safeParse({
      body: { username: "testuser" },
    });
    expect(r.success).toBe(true);
  });
});

describe("checkUsernameSchema", () => {
  it("accepts valid username param", () => {
    const r = checkUsernameSchema.safeParse({
      params: { username: "testuser" },
    });
    expect(r.success).toBe(true);
  });

  it("rejects missing param", () => {
    const r = checkUsernameSchema.safeParse({ params: {} });
    expect(r.success).toBe(false);
  });
});

describe("adminBanSchema", () => {
  it("accepts valid ban request", () => {
    const r = adminBanSchema.safeParse({
      params: { uid: "firebase_uid_123456" },
      body: {
        banType: "hard",
        reason: "Cheating detected",
      },
    });
    expect(r.success).toBe(true);
  });

  it("rejects empty reason", () => {
    const r = adminBanSchema.safeParse({
      params: { uid: "firebase_uid_123456" },
      body: { banType: "hard", reason: "" },
    });
    expect(r.success).toBe(false);
  });

  it("rejects invalid banType", () => {
    const r = adminBanSchema.safeParse({
      params: { uid: "firebase_uid_123456" },
      body: { banType: "invalid", reason: "test" },
    });
    expect(r.success).toBe(false);
  });

  it("accepts optional durationDays", () => {
    const r = adminBanSchema.safeParse({
      params: { uid: "firebase_uid_123456" },
      body: {
        banType: "soft",
        reason: "Warning",
        durationDays: 7,
      },
    });
    expect(r.success).toBe(true);
  });
});

describe("adminAdjustMoneySchema", () => {
  it("accepts positive amount", () => {
    const r = adminAdjustMoneySchema.safeParse({
      params: { uid: "uid_123" },
      body: { amount: 1000, reason: "Compensation" },
    });
    expect(r.success).toBe(true);
  });

  it("accepts negative amount", () => {
    const r = adminAdjustMoneySchema.safeParse({
      params: { uid: "uid_123" },
      body: { amount: -500, reason: "Penalty" },
    });
    expect(r.success).toBe(true);
  });

  it("rejects amount exceeding 1 billion", () => {
    const r = adminAdjustMoneySchema.safeParse({
      params: { uid: "uid_123" },
      body: { amount: 1_000_000_001, reason: "test" },
    });
    expect(r.success).toBe(false);
  });
});

describe("gdprDeleteSchema", () => {
  it("accepts correct confirm phrase", () => {
    const r = gdprDeleteSchema.safeParse({
      body: { confirmPhrase: "DELETE MY ACCOUNT" },
    });
    expect(r.success).toBe(true);
  });

  it("rejects wrong confirm phrase", () => {
    const r = gdprDeleteSchema.safeParse({
      body: { confirmPhrase: "delete my account" },
    });
    expect(r.success).toBe(false);
  });

  it("rejects missing confirm phrase", () => {
    const r = gdprDeleteSchema.safeParse({ body: {} });
    expect(r.success).toBe(false);
  });
});

describe("createSupportTicketSchema", () => {
  it("accepts valid ticket", () => {
    const r = createSupportTicketSchema.safeParse({
      body: {
        subject:  "Bug report",
        category: "bug",
        message:  "Something is broken in the crime page",
      },
    });
    expect(r.success).toBe(true);
  });

  it("rejects invalid category", () => {
    const r = createSupportTicketSchema.safeParse({
      body: {
        subject:  "Test",
        category: "invalid_category",
        message:  "test message here",
      },
    });
    expect(r.success).toBe(false);
  });

  it("rejects empty subject", () => {
    const r = createSupportTicketSchema.safeParse({
      body: {
        subject:  "",
        category: "bug",
        message:  "test message",
      },
    });
    expect(r.success).toBe(false);
  });
});

describe("paginationQuery", () => {
  it("defaults to page 1 limit 20", () => {
    const r = paginationQuery.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.page).toBe(1);
      expect(r.data.limit).toBe(20);
    }
  });

  it("accepts custom values", () => {
    const r = paginationQuery.safeParse({ page: 3, limit: 50 });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.page).toBe(3);
      expect(r.data.limit).toBe(50);
    }
  });
});

describe("searchQuery", () => {
  it("accepts valid search query", () => {
    const r = searchQuery.safeParse({ q: "testuser" });
    expect(r.success).toBe(true);
  });
});
