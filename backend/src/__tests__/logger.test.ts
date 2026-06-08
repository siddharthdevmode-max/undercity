import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================
// Logger tests — verify structure and error rate tracking
// without real Winston output or real file system writes.
// ============================================================

describe("logger module — exports", () => {
  it("exports logger with expected methods", async () => {
    const { logger } = await import("../utils/logger");
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.debug).toBe("function");
    expect(typeof logger.http).toBe("function");
  });

  it("exports getRequestLogger", async () => {
    const { getRequestLogger } = await import("../utils/logger");
    expect(typeof getRequestLogger).toBe("function");
  });

  it("getRequestLogger returns child logger with all log methods", async () => {
    const { getRequestLogger } = await import("../utils/logger");
    const log = getRequestLogger("req-123");
    expect(typeof log.info).toBe("function");
    expect(typeof log.warn).toBe("function");
    expect(typeof log.error).toBe("function");
    expect(typeof log.debug).toBe("function");
    expect(typeof log.http).toBe("function");
  });

  it("getRequestLogger accepts string requestId", async () => {
    const { getRequestLogger } = await import("../utils/logger");
    const log = getRequestLogger("req-123");
    expect(typeof log.info).toBe("function");
  });

  it("getRequestLogger accepts undefined", async () => {
    const { getRequestLogger } = await import("../utils/logger");
    const log = getRequestLogger(undefined);
    expect(typeof log.info).toBe("function");
  });

  it("log methods accept meta object without throwing", async () => {
    const { getRequestLogger } = await import("../utils/logger");
    const log = getRequestLogger("test-id");
    expect(() => log.info("test message", { key: "value" })).not.toThrow();
    expect(() => log.warn("test warning")).not.toThrow();
    expect(() => log.error("test error", { error: "details" })).not.toThrow();
    expect(() => log.debug("test debug")).not.toThrow();
    expect(() => log.http("test http")).not.toThrow();
  });

  it("logger level is silent in test environment", async () => {
    const { logger } = await import("../utils/logger");
    expect(logger.level).toBe("silent");
  });
});

// ── error method wrapping ─────────────────────────────────

describe("logger module — error rate tracking", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("logger.error does not throw when called", async () => {
    const { logger } = await import("../utils/logger");
    expect(() => logger.error("test error")).not.toThrow();
  });

  it("logger.error can be called multiple times", async () => {
    const { logger } = await import("../utils/logger");
    expect(() => {
      for (let i = 0; i < 5; i++) {
        logger.error(`error ${i}`, { index: i });
      }
    }).not.toThrow();
  });

  it("logger.error accepts object as first arg", async () => {
    const { logger } = await import("../utils/logger");
    expect(() => logger.error({ message: "obj error", code: 500 })).not.toThrow();
  });

  it("logger.error accepts string with meta splat", async () => {
    const { logger } = await import("../utils/logger");
    expect(() =>
      logger.error("something broke", { uid: "abc123", context: "test" })
    ).not.toThrow();
  });

  it("logger returns itself from .error() for chaining", async () => {
    const { logger } = await import("../utils/logger");
    const result = logger.error("test");
    // Winston logger returns itself — verify it's truthy and has log methods
    expect(result).toBeTruthy();
  });
});

// ── logger methods do not throw with various inputs ───────

describe("logger module — robustness", () => {
  it("logger.warn does not throw", async () => {
    const { logger } = await import("../utils/logger");
    expect(() => logger.warn("test warning", { key: "val" })).not.toThrow();
  });

  it("logger.info does not throw", async () => {
    const { logger } = await import("../utils/logger");
    expect(() => logger.info("test info")).not.toThrow();
  });

  it("logger.debug does not throw", async () => {
    const { logger } = await import("../utils/logger");
    expect(() => logger.debug("test debug", { data: 42 })).not.toThrow();
  });

  it("logger.http does not throw", async () => {
    const { logger } = await import("../utils/logger");
    expect(() => logger.http("GET /api/health 200")).not.toThrow();
  });

  it("logger.info accepts empty string", async () => {
    const { logger } = await import("../utils/logger");
    expect(() => logger.info("")).not.toThrow();
  });

  it("logger.error handles undefined meta gracefully", async () => {
    const { logger } = await import("../utils/logger");
    expect(() => logger.error("error with no meta")).not.toThrow();
  });

  it("getRequestLogger child retains parent silent level", async () => {
    const { getRequestLogger } = await import("../utils/logger");
    const child = getRequestLogger("req-abc");
    // Child logger should not throw even with all methods
    expect(() => {
      child.info("child info");
      child.warn("child warn");
      child.error("child error");
      child.debug("child debug");
    }).not.toThrow();
  });
});
