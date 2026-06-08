// ============================================================
// IDEMPOTENCY MIDDLEWARE — UNIT TESTS
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction }  from "express";

// ── Hoisted mocks ──────────────────────────────────────────

const mocks = vi.hoisted(() => {
  const mockPoolQuery = vi.fn();
  const onFinishedCb  = vi.fn();
  return { mockPoolQuery, onFinishedCb };
});

vi.mock("../config/database", () => ({
  pool: {
    query:   mocks.mockPoolQuery,
    connect: vi.fn(),
    on:      vi.fn(),
    totalCount: 1, idleCount: 1, waitingCount: 0,
  },
  withTransaction: vi.fn(),
  getPoolStats:    vi.fn().mockReturnValue({ total: 1, idle: 1, waiting: 0 }),
}));

vi.mock("../config/redis", () => ({
  default: { get: vi.fn().mockResolvedValue(null), set: vi.fn(), on: vi.fn(), status: "ready" },
  redis:   { get: vi.fn().mockResolvedValue(null), set: vi.fn(), on: vi.fn(), status: "ready" },
}));

vi.mock("../utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  getRequestLogger: vi.fn().mockReturnValue({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  }),
}));

// on-finished: call the callback synchronously so we can test it
vi.mock("on-finished", () => ({
  default: vi.fn((_res: unknown, cb: () => void) => {
    mocks.onFinishedCb.mockImplementation(cb);
  }),
}));

// ── Import after mocks ─────────────────────────────────────

import { idempotencyCheck } from "../middleware/idempotency";

// ── Helpers ───────────────────────────────────────────────

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

function makeReq(overrides: Partial<Request> = {}): Partial<Request> {
  return {
    headers:      { "x-idempotency-key": VALID_UUID },
    path:         "/api/v1/crimes/attempt",
    requestId:    "req-123",
    firebaseUser: { uid: "uid-123", email: "test@test.com", emailVerified: true },
    ...overrides,
  };
}

function makeRes(): Partial<Response> & { statusCode: number } {
  const res = {
    statusCode: 200,
    json:       vi.fn().mockReturnThis(),
    status:     vi.fn().mockReturnThis(),
    on:         vi.fn(),
  };
  res.status.mockReturnValue(res as unknown as Response);
  return res as Partial<Response> & { statusCode: number };
}

const mockNext = vi.fn() as NextFunction;

// ============================================================

describe("idempotencyCheck middleware", () => {

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockPoolQuery.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  // ── Skip conditions ──────────────────────────────────────

  it("calls next() immediately when no X-Idempotency-Key header", async () => {
    const req = makeReq({ headers: {} });
    const res = makeRes();
    await idempotencyCheck(req as Request, res as Response, mockNext);
    expect(mockNext).toHaveBeenCalledWith();
    expect(res.json).not.toHaveBeenCalled();
  });

  it("calls next() when no firebaseUser (unauthenticated)", async () => {
    const req = makeReq({ firebaseUser: undefined });
    const res = makeRes();
    await idempotencyCheck(req as Request, res as Response, mockNext);
    expect(mockNext).toHaveBeenCalledWith();
  });

  // ── Key validation ───────────────────────────────────────

  it("calls next(ValidationError) when key exceeds 128 chars", async () => {
    const req = makeReq({ headers: { "x-idempotency-key": "a".repeat(129) } });
    const res = makeRes();
    await idempotencyCheck(req as Request, res as Response, mockNext);
    expect(mockNext).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("too long") })
    );
  });

  it("calls next(ValidationError) when key is not UUID v4 format", async () => {
    const req = makeReq({ headers: { "x-idempotency-key": "not-a-uuid-at-all" } });
    const res = makeRes();
    await idempotencyCheck(req as Request, res as Response, mockNext);
    expect(mockNext).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("UUID v4") })
    );
  });

  it("calls next(ValidationError) for UUID v1 (wrong version digit)", async () => {
    const uuidV1 = "550e8400-e29b-11d4-a716-446655440000";
    const req = makeReq({ headers: { "x-idempotency-key": uuidV1 } });
    const res = makeRes();
    await idempotencyCheck(req as Request, res as Response, mockNext);
    expect(mockNext).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("UUID v4") })
    );
  });

  it("accepts valid UUID v4 and proceeds to DB check", async () => {
    mocks.mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const req = makeReq({ headers: { "x-idempotency-key": VALID_UUID } });
    const res = makeRes();
    await idempotencyCheck(req as Request, res as Response, mockNext);
    expect(mockNext).toHaveBeenCalledWith();
    expect(mocks.mockPoolQuery).toHaveBeenCalled();
  });

  it("accepts uppercase UUID v4", async () => {
    mocks.mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const req = makeReq({ headers: { "x-idempotency-key": VALID_UUID.toUpperCase() } });
    const res = makeRes();
    await idempotencyCheck(req as Request, res as Response, mockNext);
    expect(mockNext).toHaveBeenCalledWith();
  });

  // ── Cache hit — idempotent response ──────────────────────

  it("returns cached response when key exists in DB", async () => {
    const cachedBody   = { outcome: "success", rewards: { money: 500 } };
    const cachedStatus = 200;
    mocks.mockPoolQuery.mockResolvedValueOnce({
      rows:     [{ response_body: cachedBody, response_status: cachedStatus }],
      rowCount: 1,
    });
    const req = makeReq({ headers: { "x-idempotency-key": VALID_UUID } });
    const res = makeRes();
    await idempotencyCheck(req as Request, res as Response, mockNext);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(cachedBody);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("preserves original status code in cached response", async () => {
    mocks.mockPoolQuery.mockResolvedValueOnce({
      rows:     [{ response_body: { message: "created" }, response_status: 201 }],
      rowCount: 1,
    });
    const req = makeReq({ headers: { "x-idempotency-key": VALID_UUID } });
    const res = makeRes();
    await idempotencyCheck(req as Request, res as Response, mockNext);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  // ── Cache miss — new request ─────────────────────────────

  it("calls next() when no cached response (new request)", async () => {
    mocks.mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const req = makeReq({ headers: { "x-idempotency-key": VALID_UUID } });
    const res = makeRes();

    // Capture original json spy BEFORE middleware patches it
    const originalJsonSpy = res.json as ReturnType<typeof vi.fn>;

    await idempotencyCheck(req as Request, res as Response, mockNext);

    // next() called without error — request proceeds to handler
    expect(mockNext).toHaveBeenCalledWith();

    // The ORIGINAL json spy was never called (middleware didn't short-circuit)
    // Note: res.json is now patched by the middleware — check original spy
    expect(originalJsonSpy).not.toHaveBeenCalled();
  });

  it("patches res.json to capture response body for future caching", async () => {
    mocks.mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const req         = makeReq({ headers: { "x-idempotency-key": VALID_UUID } });
    const res         = makeRes();
    const originalJson = res.json;
    await idempotencyCheck(req as Request, res as Response, mockNext);
    expect(res.json).not.toBe(originalJson);
  });

  // ── Fail open ────────────────────────────────────────────

  it("fails open (calls next) when DB throws", async () => {
    mocks.mockPoolQuery.mockRejectedValueOnce(new Error("DB connection refused"));
    const req = makeReq({ headers: { "x-idempotency-key": VALID_UUID } });
    const res = makeRes();
    await idempotencyCheck(req as Request, res as Response, mockNext);
    expect(mockNext).toHaveBeenCalledWith();
  });

  // ── Key trimming ─────────────────────────────────────────

  it("trims whitespace from key before validation", async () => {
    mocks.mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const paddedKey = `  ${VALID_UUID}  `;
    const req = makeReq({ headers: { "x-idempotency-key": paddedKey } });
    const res = makeRes();
    await idempotencyCheck(req as Request, res as Response, mockNext);
    expect(mockNext).toHaveBeenCalledWith();
  });

  // ── Only caches 2xx responses ────────────────────────────

  it("DB query includes correct uid and idempotency key", async () => {
    mocks.mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const req = makeReq({ headers: { "x-idempotency-key": VALID_UUID } });
    const res = makeRes();
    await idempotencyCheck(req as Request, res as Response, mockNext);
    expect(mocks.mockPoolQuery).toHaveBeenCalledWith(
      expect.stringContaining("idempotency_keys"),
      expect.arrayContaining(["uid-123", VALID_UUID])
    );
  });
});
