import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(function () {
    return { emails: { send: mockSend } };
  }),
}));

vi.mock("../utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../config", () => ({
  config: {
    email: {
      apiKey: "test-resend-key",
      from:   "test@undercity.online",
    },
  },
}));

import { sendEmail } from "../services/emailService";
import type { EmailJob } from "../queues/index";

function makeJob(overrides: Partial<EmailJob> = {}): EmailJob {
  return {
    type:     "welcome",
    to:       "player@test.com",
    username: "TestPlayer",
    ...overrides,
  } as EmailJob;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSend.mockResolvedValue({ data: {}, error: null });
});

describe("sendEmail", () => {
  it("sends welcome email", async () => {
    expect(await sendEmail(makeJob({ type: "welcome" }))).toBe(true);
  });

  it("sends security_alert email", async () => {
    expect(await sendEmail(makeJob({
      type: "security_alert",
      event: "New IP login",
      ip: "1.2.3.4",
    } as EmailJob))).toBe(true);
  });

  it("sends purchase_confirm email", async () => {
    expect(await sendEmail(makeJob({
      type: "purchase_confirm",
      points: 500,
      packName: "Black Card",
      amountCents: 499,
    } as EmailJob))).toBe(true);
  });

  it("sends ban_notice email", async () => {
    expect(await sendEmail(makeJob({
      type: "ban_notice",
      reason: "Cheating",
    } as EmailJob))).toBe(true);
  });

  it("sends email_verify email", async () => {
    expect(await sendEmail(makeJob({
      type: "email_verify",
      link: "https://undercity.online/verify?token=abc",
    } as EmailJob))).toBe(true);
  });

  it("sends password_reset email", async () => {
    expect(await sendEmail(makeJob({
      type: "password_reset",
      link: "https://undercity.online/reset?token=xyz",
    } as EmailJob))).toBe(true);
  });

  it("sends support_reply email", async () => {
    expect(await sendEmail(makeJob({
      type: "support_reply",
      ticketId: "TKT-001",
      message: "Resolved",
    } as EmailJob))).toBe(true);
  });

  it("returns false for unknown email type", async () => {
    expect(await sendEmail({ type: "unknown" } as unknown as EmailJob)).toBe(false);
  });

  it("returns false when Resend returns error", async () => {
    mockSend.mockResolvedValueOnce({ data: null, error: { message: "Bad key" } });
    expect(await sendEmail(makeJob())).toBe(false);
  });

  it("returns false when Resend throws", async () => {
    mockSend.mockRejectedValueOnce(new Error("Network error"));
    expect(await sendEmail(makeJob())).toBe(false);
  });
});
