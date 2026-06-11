import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("dotenv", () => ({
  config: vi.fn(),
}));

vi.mock("fs", () => ({
  existsSync: vi.fn().mockReturnValue(true),
}));

const originalEnv = { ...process.env };

const exitSpy = vi.spyOn(process, "exit").mockImplementation(
  (code) => { throw new Error("process.exit(" + code + ")"); }
);

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  process.env = {
    NODE_ENV:     "development",
    PORT:         "5000",
    DATABASE_URL: "postgresql://user:pass@localhost:5432/testdb",
    REDIS_HOST:   "127.0.0.1",
    REDIS_PORT:   "6379",
  };
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("validateEnv", () => {
  it("passes with valid development env", async () => {
    const { validateEnv } = await import("../utils/envValidator");
    expect(() => validateEnv()).not.toThrow();
  });

  it("fails when DATABASE_URL is missing", async () => {
    delete process.env["DATABASE_URL"];
    const { validateEnv } = await import("../utils/envValidator");
    expect(() => validateEnv()).toThrow("process.exit(1)");
  });

  it("fails when NODE_ENV is invalid", async () => {
    process.env["NODE_ENV"] = "invalid";
    const { validateEnv } = await import("../utils/envValidator");
    expect(() => validateEnv()).toThrow("process.exit(1)");
  });

  it("passes in test mode", async () => {
    process.env["NODE_ENV"] = "test";
    const { validateEnv } = await import("../utils/envValidator");
    expect(() => validateEnv()).not.toThrow();
  });

  it("logs success on valid env", async () => {
    const { logger } = await import("../utils/logger");
    const { validateEnv } = await import("../utils/envValidator");
    validateEnv();
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      expect.stringContaining("Environment variables validated"),
      expect.any(Object)
    );
  });

  it("warns in production without SENTRY_DSN", async () => {
    process.env["NODE_ENV"]           = "production";
    process.env["ALLOWED_ORIGINS"]    = "https://undercity.online";
    process.env["TURNSTILE_SECRET_KEY"] = "real-key";
    process.env["FINGERPRINT_SALT"]   = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    process.env["FIREBASE_SERVICE_ACCOUNT_JSON"] = "{}";
    delete process.env["SENTRY_DSN"];

    const { logger } = await import("../utils/logger");
    const { validateEnv } = await import("../utils/envValidator");

    try { validateEnv(); } catch (_e) { /* exit mock throws */ }

    expect(vi.mocked(logger.warn)).toHaveBeenCalled();
  });
});

describe("exitSpy", () => {
  it("is installed correctly", () => {
    expect(exitSpy).toBeDefined();
  });
});
