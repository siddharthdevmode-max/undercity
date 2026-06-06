import { describe, it, expect } from "vitest";

// ============================================================
// Logger tests — verify structure without real Winston output
// ============================================================

describe("logger module", () => {
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

  it("getRequestLogger returns all log methods", async () => {
    const { getRequestLogger } = await import("../utils/logger");
    const log = getRequestLogger({ requestId: "test-req-id" });
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

  it("log methods accept meta object", async () => {
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
    // config.isTest = true → level forced to "silent"
    // This is correct — suppresses all log output during tests
    expect(logger.level).toBe("silent");
  });
});
