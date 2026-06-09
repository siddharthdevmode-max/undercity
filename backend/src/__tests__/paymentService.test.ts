// ============================================================
// PAYMENT SERVICE TESTS
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────

vi.mock("../config/database", () => ({
  pool:            { query: vi.fn() },
  withTransaction: vi.fn(async (fn: (client: unknown) => Promise<unknown>) => {
    const mockClient = { query: vi.fn().mockResolvedValue({ rows: [
      {
        id:              1,
        username:        "TestPlayer",
        email:           "test@undercity.com",
        tier_expires_at: null,
      }
    ]}) };
    return fn(mockClient);
  }),
}));

vi.mock("../utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../utils/alerts", () => ({
  Alerts: { systemError: vi.fn() },
}));

vi.mock("../queues/index", () => ({
  queueEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../config/payments", () => ({
  getTierForVariant:      vi.fn(),
  HANDLED_WEBHOOK_EVENTS: new Set([
    "order_created",
    "subscription_created",
    "subscription_renewed",
    "subscription_cancelled",
    "subscription_expired",
    "subscription_resumed",
  ]),
}));

import { pool, withTransaction } from "../config/database";
import { getTierForVariant }     from "../config/payments";
import { processWebhookEvent }   from "../services/paymentService";
import type { LemonSqueezyWebhookPayload } from "../services/paymentService";

// ── Fixtures ──────────────────────────────────────────────

function makePayload(
  eventName:  string,
  variantId:  number  = 123,
  uid:        string  = "firebase-uid-test-123",
  overrides:  Partial<LemonSqueezyWebhookPayload["data"]["attributes"]> = {}
): LemonSqueezyWebhookPayload {
  return {
    meta: {
      event_name:   eventName,
      custom_data:  { firebase_uid: uid },
    },
    data: {
      id:   "ls-event-id-001",
      type: "orders",
      attributes: {
        variant_id:  variantId,
        total:       499,
        identifier:  "order-abc-123",
        status:      "paid",
        ...overrides,
      },
    },
  };
}

// ── Tests ─────────────────────────────────────────────────

describe("processWebhookEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Ignored events ────────────────────────────────────────

  it("skips unhandled event types", async () => {
    const result = await processWebhookEvent(
      makePayload("order_refunded"),
      "{}",
      "order_refunded"
    );
    expect(result.success).toBe(false);
    expect(result.message).toBe("skipped");
    expect(withTransaction).not.toHaveBeenCalled();
  });

  // ── Missing firebase_uid ───────────────────────────────────

  it("returns missing_firebase_uid when custom_data has no uid", async () => {
    const payload = makePayload("order_created");
    payload.meta.custom_data = {};

    const result = await processWebhookEvent(payload, "{}", "order_created");
    expect(result.success).toBe(false);
    expect(result.message).toBe("missing_firebase_uid");
  });

  // ── Black Card (citizen) ───────────────────────────────────

  it("activates Black Card on order_created with citizen variant", async () => {
    vi.mocked(getTierForVariant).mockReturnValue("citizen");

    const result = await processWebhookEvent(
      makePayload("order_created", 123),
      "{}",
      "order_created"
    );

    expect(result.success).toBe(true);
    expect(result.tier).toBe("citizen");
    expect(result.message).toBe("black_card_activated");
    expect(withTransaction).toHaveBeenCalled();
  });

  it("returns unknown_variant when variant not citizen for order_created", async () => {
    vi.mocked(getTierForVariant).mockReturnValue("contributor");

    const result = await processWebhookEvent(
      makePayload("order_created", 999),
      "{}",
      "order_created"
    );

    expect(result.success).toBe(false);
    expect(result.message).toBe("unknown_variant");
  });

  it("returns unknown_variant when variant is null for order_created", async () => {
    vi.mocked(getTierForVariant).mockReturnValue(null);

    const result = await processWebhookEvent(
      makePayload("order_created", 0),
      "{}",
      "order_created"
    );

    expect(result.success).toBe(false);
    expect(result.message).toBe("unknown_variant");
  });

  // ── Contributor subscription ───────────────────────────────

  it("activates Contributor on subscription_created", async () => {
    vi.mocked(getTierForVariant).mockReturnValue("contributor");

    const result = await processWebhookEvent(
      makePayload("subscription_created", 456),
      "{}",
      "subscription_created"
    );

    expect(result.success).toBe(true);
    expect(result.tier).toBe("contributor");
    expect(result.message).toBe("contributor_activated");
  });

  it("renews Contributor on subscription_renewed", async () => {
    vi.mocked(getTierForVariant).mockReturnValue("contributor");

    const result = await processWebhookEvent(
      makePayload("subscription_renewed", 456),
      "{}",
      "subscription_renewed"
    );

    expect(result.success).toBe(true);
    expect(result.tier).toBe("contributor");
    expect(result.message).toBe("contributor_activated");
  });

  it("resumes Contributor on subscription_resumed", async () => {
    vi.mocked(getTierForVariant).mockReturnValue("contributor");

    const result = await processWebhookEvent(
      makePayload("subscription_resumed", 456),
      "{}",
      "subscription_resumed"
    );

    expect(result.success).toBe(true);
    expect(result.tier).toBe("contributor");
    expect(result.message).toBe("contributor_activated");
  });

  // ── Cancellation ──────────────────────────────────────────

  it("logs cancellation without changing tier on subscription_cancelled", async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never);

    const result = await processWebhookEvent(
      makePayload("subscription_cancelled"),
      "{}",
      "subscription_cancelled"
    );

    expect(result.success).toBe(true);
    expect(result.tier).toBeNull();
    expect(result.message).toBe("cancellation_logged");
  });

  // ── Expiry ────────────────────────────────────────────────

  it("downgrades to player on subscription_expired", async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as never) // UPDATE users
      .mockResolvedValueOnce({ rows: [] } as never);             // INSERT audit_log

    const result = await processWebhookEvent(
      makePayload("subscription_expired"),
      "{}",
      "subscription_expired"
    );

    expect(result.success).toBe(true);
    expect(result.tier).toBe("player");
    expect(result.message).toBe("downgraded_to_player");
  });

  // ── DB failure resilience ─────────────────────────────────

  it("returns activation_failed when DB throws during Black Card activation", async () => {
    vi.mocked(getTierForVariant).mockReturnValue("citizen");
    vi.mocked(withTransaction).mockRejectedValueOnce(new Error("DB down"));

    const result = await processWebhookEvent(
      makePayload("order_created", 123),
      "{}",
      "order_created"
    );

    expect(result.success).toBe(false);
    expect(result.message).toBe("activation_failed");
  });

  it("returns activation_failed when DB throws during Contributor activation", async () => {
    vi.mocked(getTierForVariant).mockReturnValue("contributor");
    vi.mocked(withTransaction).mockRejectedValueOnce(new Error("DB down"));

    const result = await processWebhookEvent(
      makePayload("subscription_created", 456),
      "{}",
      "subscription_created"
    );

    expect(result.success).toBe(false);
    expect(result.message).toBe("activation_failed");
  });
});

// ── Tier expiry calculation ────────────────────────────────

describe("calcTierExpiry (via tiers.ts)", () => {
  it("Black Card expiry is 31 days from now when no existing expiry", async () => {
    const { calcTierExpiry } = await import("../config/tiers");
    const expiry = calcTierExpiry("citizen", null);
    const diffDays = Math.round(
      (expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    expect(diffDays).toBe(31);
  });

  it("Contributor expiry is 31 days from now when no existing expiry", async () => {
    const { calcTierExpiry } = await import("../config/tiers");
    const expiry = calcTierExpiry("contributor", null);
    const diffDays = Math.round(
      (expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    expect(diffDays).toBe(31);
  });

  it("extends from current expiry when tier is still active", async () => {
    const { calcTierExpiry } = await import("../config/tiers");
    const currentExpiry = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000); // 15 days from now
    const newExpiry     = calcTierExpiry("citizen", currentExpiry);
    const diffFromCurrent = Math.round(
      (newExpiry.getTime() - currentExpiry.getTime()) / (1000 * 60 * 60 * 24)
    );
    expect(diffFromCurrent).toBe(31);
  });

  it("throws for player tier (never expires)", async () => {
    const { calcTierExpiry } = await import("../config/tiers");
    expect(() => calcTierExpiry("player", null)).toThrow();
  });
});
