// ============================================================
// IDEMPOTENCY MIDDLEWARE TESTS
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

vi.mock("../config/database", () => ({
  pool: { query: vi.fn() },
}));

vi.mock("../config/redis", () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
}));

vi.mock("on-finished", () => ({
  default: vi.fn((_res: unknown, cb: () => void) => cb()),
}));

vi.mock("../config", () => ({
  config: {
    isTest:        false,
    isDevelopment: false,
    isProduction:  false,
    game: { idempotencyTtlMs: 300_000 },
  },
}));

vi.mock("../utils/logger", () => ({
  logger: {
    info:  vi.fn(),
    warn:  vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { pool }             from "../config/database";
import { redis }            from "../config/redis";
import { idempotencyCheck } from "../middleware/idempotency";

// ── Helpers ───────────────────────────────────────────────

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
const TEST_UID   = "firebase-uid-test-123";

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    headers:      { "x-idempotency-key": VALID_UUID },
    firebaseUser: { uid: TEST_UID, email: "test@test.com", emailVerified: true },
    path:         "/api/v1/crimes/attempt",
    ...overrides,
  } as unknown as Request;
}

function makeRes(): Response & { _status: number; _body: unknown } {
  const res = {
    _status:    200,
    _body:      null,
    statusCode: 200,
    status(code: number) {
      this._status    = code;
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this._body = body;
      return this;
    },
    on: vi.fn(),
  };
  return res as unknown as Response & { _status: number; _body: unknown };
}

function makeNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

function nextArg(next: NextFunction): unknown {
  return (next as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
}

// ── Tests ─────────────────────────────────────────────────

describe("idempotencyCheck", () => {
  beforeEach(() => {
    // clearAllMocks resets call counts but NOT mockResolvedValue implementations.
    // resetAllMocks resets both — use this to prevent mock bleed between tests.
    vi.resetAllMocks();

    // Set safe defaults for every test — each test overrides as needed.
    // redis.set returning "OK" = lock acquired (not null = not held).
    vi.mocked(redis.set).mockResolvedValue("OK" as never);
    vi.mocked(redis.del).mockResolvedValue(1);
    vi.mocked(redis.get).mockResolvedValue(null);
  });

  // ── Skip conditions ──────────────────────────────────────

  it("skips if no idempotency key in header", async () => {
    const req  = makeReq({ headers: {} } as Partial<Request>);
    const res  = makeRes();
    const next = makeNext();

    await idempotencyCheck(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(pool.query).not.toHaveBeenCalled();
  });

  it("skips if no authenticated user", async () => {
    const req  = makeReq({ firebaseUser: undefined } as Partial<Request>);
    const res  = makeRes();
    const next = makeNext();

    await idempotencyCheck(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  // ── Validation ────────────────────────────────────────────

  it("rejects array idempotency key with VALIDATION_ERROR", async () => {
    const req  = makeReq({
      headers: { "x-idempotency-key": ["key1", "key2"] },
    } as Partial<Request>);
    const res  = makeRes();
    const next = makeNext();

    await idempotencyCheck(req, res, next);

    expect(nextArg(next)).toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("rejects key over 128 chars with VALIDATION_ERROR", async () => {
    const req  = makeReq({
      headers: { "x-idempotency-key": "a".repeat(129) },
    } as Partial<Request>);
    const res  = makeRes();
    const next = makeNext();

    await idempotencyCheck(req, res, next);

    expect(nextArg(next)).toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("rejects non-UUID-v4 key with VALIDATION_ERROR", async () => {
    const req  = makeReq({
      headers: { "x-idempotency-key": "not-a-uuid" },
    } as Partial<Request>);
    const res  = makeRes();
    const next = makeNext();

    await idempotencyCheck(req, res, next);

    expect(nextArg(next)).toMatchObject({ code: "VALIDATION_ERROR" });
  });

  // ── Cache hit ─────────────────────────────────────────────

  it("returns cached response when found in DB", async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [{ response_body: { ok: true }, response_status: 200 }],
    } as never);

    const req  = makeReq();
    const res  = makeRes();
    const next = makeNext();

    await idempotencyCheck(req, res, next);

    expect(res._status).toBe(200);
    expect(res._body).toEqual({ ok: true });
    expect(next).not.toHaveBeenCalled();
  });

  // ── Lock contention ───────────────────────────────────────

  it("returns CONFLICT when Redis lock already held", async () => {
    // DB miss
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never);
    // Lock held — NX returns null
    vi.mocked(redis.set).mockResolvedValueOnce(null);

    const req  = makeReq();
    const res  = makeRes();
    const next = makeNext();

    await idempotencyCheck(req, res, next);

    expect(nextArg(next)).toMatchObject({ code: "CONFLICT" });
  });

  // ── Happy path ────────────────────────────────────────────

  it("proceeds when lock acquired — calls next() with no args", async () => {
    // DB miss — no cached response
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never);
    // Lock acquired — "OK" (already set as default in beforeEach)
    // DB save triggered by on-finished mock
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never);

    const req  = makeReq();
    const res  = makeRes();
    const next = makeNext();

    await idempotencyCheck(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(nextArg(next)).toBeUndefined();
  });

  // ── Fail open ─────────────────────────────────────────────

  it("fails open on DB error — next() called with no error", async () => {
    // DB throws on the cache-lookup query.
    // The outer catch in idempotencyCheck calls next() with no args.
    // redis.set default is "OK" (from beforeEach) — but because pool.query
    // throws BEFORE we reach the redis.set call, the catch fires first.
    vi.mocked(pool.query).mockRejectedValueOnce(new Error("DB down"));

    const req  = makeReq();
    const res  = makeRes();
    const next = makeNext();

    await idempotencyCheck(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(nextArg(next)).toBeUndefined();
  });
});
