// ============================================================
// CONFIG TESTS — UNDERCITY
// Tests for all config helper functions and production guards.
//
// ISOLATION STRATEGY:
//   config/index.ts runs buildConfig() at module load time.
//   To test different env combinations we use vi.resetModules()
//   before each dynamic import, which clears Vitest's module
//   registry and forces a fresh evaluation of the config module.
//
//   vi.isolateModules() was removed in Vitest v2.
//   vi.resetModules() + dynamic import is the correct replacement.
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── env snapshot helpers ───────────────────────────────────

let envSnapshot: NodeJS.ProcessEnv;

function saveEnv() {
  envSnapshot = { ...process.env };
}

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in envSnapshot)) {
      delete process.env[key];
    }
  }
  for (const [key, val] of Object.entries(envSnapshot)) {
    process.env[key] = val;
  }
}

// ── Baseline env setters ───────────────────────────────────

function setDevBase() {
  process.env["NODE_ENV"]     = "development";
  process.env["DATABASE_URL"] = "postgres://localhost:5432/undercity_dev";
  delete process.env["ALLOWED_ORIGINS"];
  delete process.env["FINGERPRINT_SALT"];
  delete process.env["TURNSTILE_SECRET_KEY"];
}

function setProdBase() {
  process.env["NODE_ENV"]                      = "production";
  process.env["DATABASE_URL"]                  = "postgres://localhost:5432/undercity_prod";
  process.env["ALLOWED_ORIGINS"]               = "https://undercity.online";
  process.env["FINGERPRINT_SALT"]              = "a-real-32-char-salt-value-here!!";
  process.env["TURNSTILE_SECRET_KEY"]          = "real-turnstile-key";
  process.env["LEMONSQUEEZY_WEBHOOK_SECRET"]   = "whsec_test_secret";
  process.env["LEMONSQUEEZY_API_KEY"]          = "api_key_test";
  process.env["LEMONSQUEEZY_STORE_ID"]         = "store_12345";
}

// ── Helper: load config in a fresh module scope ───────────
// vi.resetModules() clears the module registry before each import.
// This is the Vitest v2+ replacement for vi.isolateModules().

async function loadConfig() {
  vi.resetModules();
  const mod = await import("../config");
  return mod.config;
}

async function expectConfigToThrow(pattern: RegExp) {
  vi.resetModules();
  await expect(import("../config")).rejects.toThrow(pattern);
}

// ── test environment values ───────────────────────────────

describe("config — test environment values", () => {
  // These tests use NODE_ENV=test set by vitest automatically.
  // No beforeEach/afterEach needed — we are not mutating env here.

  it("nodeEnv is test", async () => {
    const cfg = await loadConfig();
    expect(cfg.nodeEnv).toBe("test");
  });

  it("isTest is true", async () => {
    const cfg = await loadConfig();
    expect(cfg.isTest).toBe(true);
  });

  it("isProduction is false", async () => {
    const cfg = await loadConfig();
    expect(cfg.isProduction).toBe(false);
  });

  it("isDevelopment is false in test mode", async () => {
    const cfg = await loadConfig();
    expect(cfg.isDevelopment).toBe(false);
  });

  it("port defaults to 5000 when PORT not set", async () => {
    const cfg = await loadConfig();
    expect(cfg.port).toBe(5000);
  });

  it("redis.tls is false in non-production", async () => {
    const cfg = await loadConfig();
    expect(cfg.redis.tls).toBe(false);
  });

  it("features.vpnCheckEnabled is false in non-production", async () => {
    const cfg = await loadConfig();
    expect(cfg.features.vpnCheckEnabled).toBe(false);
  });

  it("features.paymentsEnabled is false in non-production", async () => {
    const cfg = await loadConfig();
    expect(cfg.features.paymentsEnabled).toBe(false);
  });

  it("features.enableApiDocs is true in non-production", async () => {
    const cfg = await loadConfig();
    expect(cfg.features.enableApiDocs).toBe(true);
  });

  it("game.tickIntervalMs defaults to 60000", async () => {
    const cfg = await loadConfig();
    expect(cfg.game.tickIntervalMs).toBe(60000);
  });

  it("game.maxNerveDefault defaults to 30", async () => {
    const cfg = await loadConfig();
    expect(cfg.game.maxNerveDefault).toBe(30);
  });

  it("game.maxEnergyDefault defaults to 100", async () => {
    const cfg = await loadConfig();
    expect(cfg.game.maxEnergyDefault).toBe(100);
  });

  it("game.energyRegenSec defaults to 300", async () => {
    const cfg = await loadConfig();
    expect(cfg.game.energyRegenSec).toBe(300);
  });

  it("game.nerveRegenSec defaults to 300", async () => {
    const cfg = await loadConfig();
    expect(cfg.game.nerveRegenSec).toBe(300);
  });

  it("allowedOrigins includes localhost in test/dev", async () => {
    const cfg = await loadConfig();
    expect(cfg.allowedOrigins).toContain("http://localhost:5173");
  });

  it("logLevel defaults to debug in non-production", async () => {
    const cfg = await loadConfig();
    expect(cfg.logLevel).toBe("debug");
  });

  it("turnstileSecretKey uses always-pass token in non-production", async () => {
    const cfg = await loadConfig();
    expect(cfg.turnstileSecretKey).toBe(
      "1x0000000000000000000000000000000AA"
    );
  });

  it("sentry.tracesSampleRate is 1.0 in non-production", async () => {
    const cfg = await loadConfig();
    expect(cfg.sentry.tracesSampleRate).toBe(1.0);
  });

  it("email.provider defaults to console in non-production", async () => {
    const cfg = await loadConfig();
    expect(cfg.email.provider).toBe("console");
  });

  it("lemonSqueezy keys are string or undefined — never throw", async () => {
    const cfg = await loadConfig();
    expect(
      cfg.lemonSqueezy.apiKey === undefined ||
      typeof cfg.lemonSqueezy.apiKey === "string"
    ).toBe(true);
  });

  it("blockedCountries is an array", async () => {
    const cfg = await loadConfig();
    expect(Array.isArray(cfg.blockedCountries)).toBe(true);
  });

  it("adminUids is an array", async () => {
    const cfg = await loadConfig();
    expect(Array.isArray(cfg.adminUids)).toBe(true);
  });

  it("moderatorUids is an array", async () => {
    const cfg = await loadConfig();
    expect(Array.isArray(cfg.moderatorUids)).toBe(true);
  });

  it("devUids is an array", async () => {
    const cfg = await loadConfig();
    expect(Array.isArray(cfg.devUids)).toBe(true);
  });

  it("rateLimit.windowMs defaults to 60000", async () => {
    const cfg = await loadConfig();
    expect(cfg.rateLimit.windowMs).toBe(60000);
  });

  it("rateLimit.maxRequests defaults to 100", async () => {
    const cfg = await loadConfig();
    expect(cfg.rateLimit.maxRequests).toBe(100);
  });
});

// ── required() — missing var throws ──────────────────────

describe("config — required() throws on missing var", () => {
  beforeEach(saveEnv);
  afterEach(restoreEnv);

  it("throws when DATABASE_URL is missing in production", async () => {
    setProdBase();
    delete process.env["DATABASE_URL"];
    await expectConfigToThrow(
      /Missing required environment variable: DATABASE_URL/
    );
  });

  it("throws when DATABASE_URL is whitespace-only in production", async () => {
    setProdBase();
    process.env["DATABASE_URL"] = "   ";
    await expectConfigToThrow(
      /Missing required environment variable: DATABASE_URL/
    );
  });
});

// ── optionalInt() — NaN branch ────────────────────────────

describe("config — optionalInt() NaN branch", () => {
  beforeEach(saveEnv);
  afterEach(restoreEnv);

  it("throws when PORT is not a valid integer", async () => {
    setDevBase();
    process.env["PORT"] = "not-a-number";
    await expectConfigToThrow(/PORT must be an integer/);
  });

  it("throws when REDIS_PORT is not a valid integer", async () => {
    setDevBase();
    process.env["REDIS_PORT"] = "abc";
    await expectConfigToThrow(/REDIS_PORT must be an integer/);
  });

  it("accepts valid integer PORT", async () => {
    setDevBase();
    process.env["PORT"] = "8080";
    const cfg = await loadConfig();
    expect(cfg.port).toBe(8080);
  });
});

// ── optionalBool() — all branches ─────────────────────────

describe("config — optionalBool() branches", () => {
  beforeEach(saveEnv);
  afterEach(restoreEnv);

  it("throws when FEATURE_MAINTENANCE has invalid bool value", async () => {
    setDevBase();
    process.env["FEATURE_MAINTENANCE"] = "yes";
    await expectConfigToThrow(/FEATURE_MAINTENANCE must be true\/false/);
  });

  it("throws when FEATURE_REGISTRATION has invalid bool value", async () => {
    setDevBase();
    process.env["FEATURE_REGISTRATION"] = "on";
    await expectConfigToThrow(/FEATURE_REGISTRATION must be true\/false/);
  });

  it("accepts 'true' string", async () => {
    setDevBase();
    process.env["FEATURE_MAINTENANCE"] = "true";
    const cfg = await loadConfig();
    expect(cfg.features.maintenanceMode).toBe(true);
  });

  it("accepts 'false' string", async () => {
    setDevBase();
    process.env["FEATURE_MAINTENANCE"] = "false";
    const cfg = await loadConfig();
    expect(cfg.features.maintenanceMode).toBe(false);
  });

  it("accepts '1' as true", async () => {
    setDevBase();
    process.env["FEATURE_MAINTENANCE"] = "1";
    const cfg = await loadConfig();
    expect(cfg.features.maintenanceMode).toBe(true);
  });

  it("accepts '0' as false", async () => {
    setDevBase();
    process.env["FEATURE_MAINTENANCE"] = "0";
    const cfg = await loadConfig();
    expect(cfg.features.maintenanceMode).toBe(false);
  });

  it("uses fallback when var is not set", async () => {
    setDevBase();
    delete process.env["FEATURE_MAINTENANCE"];
    const cfg = await loadConfig();
    expect(cfg.features.maintenanceMode).toBe(false);
  });
});

// ── production ALLOWED_ORIGINS guard ─────────────────────

describe("config — production ALLOWED_ORIGINS guard", () => {
  beforeEach(saveEnv);
  afterEach(restoreEnv);

  it("throws when ALLOWED_ORIGINS is not set", async () => {
    setProdBase();
    delete process.env["ALLOWED_ORIGINS"];
    await expectConfigToThrow(/ALLOWED_ORIGINS is required in production/);
  });

  it("throws when ALLOWED_ORIGINS is empty string", async () => {
    setProdBase();
    process.env["ALLOWED_ORIGINS"] = "";
    await expectConfigToThrow(/ALLOWED_ORIGINS is required in production/);
  });

  it("throws when ALLOWED_ORIGINS is only commas/spaces", async () => {
    setProdBase();
    process.env["ALLOWED_ORIGINS"] = ",,, ,";
    await expectConfigToThrow(/ALLOWED_ORIGINS is required in production/);
  });

  it("accepts single origin", async () => {
    setProdBase();
    process.env["ALLOWED_ORIGINS"] = "https://undercity.online";
    const cfg = await loadConfig();
    expect(cfg.allowedOrigins).toContain("https://undercity.online");
  });

  it("accepts multiple comma-separated origins", async () => {
    setProdBase();
    process.env["ALLOWED_ORIGINS"] =
      "https://undercity.online,https://www.undercity.online";
    const cfg = await loadConfig();
    expect(cfg.allowedOrigins).toContain("https://undercity.online");
    expect(cfg.allowedOrigins).toContain("https://www.undercity.online");
  });

  it("dev mode uses localhost defaults when ALLOWED_ORIGINS not set", async () => {
    setDevBase();
    delete process.env["ALLOWED_ORIGINS"];
    const cfg = await loadConfig();
    expect(cfg.allowedOrigins).toContain("http://localhost:5173");
    expect(cfg.allowedOrigins).toContain("http://localhost:3000");
  });
});

// ── production FINGERPRINT_SALT guard ────────────────────

describe("config — production FINGERPRINT_SALT guard", () => {
  beforeEach(saveEnv);
  afterEach(restoreEnv);

  it("throws when FINGERPRINT_SALT is not set in production", async () => {
    setProdBase();
    delete process.env["FINGERPRINT_SALT"];
    await expectConfigToThrow(
      /Missing required environment variable: FINGERPRINT_SALT/
    );
  });

  it("uses dev fallback when not set in development", async () => {
    setDevBase();
    delete process.env["FINGERPRINT_SALT"];
    const cfg = await loadConfig();
    expect(cfg.fingerprintSalt).toBe("dev-fingerprint-salt-change-in-prod");
  });

  it("uses provided value when set in development", async () => {
    setDevBase();
    process.env["FINGERPRINT_SALT"] = "my-custom-salt";
    const cfg = await loadConfig();
    expect(cfg.fingerprintSalt).toBe("my-custom-salt");
  });

  it("uses provided value when set in production", async () => {
    setProdBase();
    process.env["FINGERPRINT_SALT"] = "prod-salt-value";
    const cfg = await loadConfig();
    expect(cfg.fingerprintSalt).toBe("prod-salt-value");
  });
});

// ── production TURNSTILE_SECRET_KEY guard ─────────────────

describe("config — production TURNSTILE_SECRET_KEY guard", () => {
  beforeEach(saveEnv);
  afterEach(restoreEnv);

  it("throws when TURNSTILE_SECRET_KEY is not set in production", async () => {
    setProdBase();
    delete process.env["TURNSTILE_SECRET_KEY"];
    await expectConfigToThrow(
      /Missing required environment variable: TURNSTILE_SECRET_KEY/
    );
  });

  it("uses always-pass token in dev when not set", async () => {
    setDevBase();
    delete process.env["TURNSTILE_SECRET_KEY"];
    const cfg = await loadConfig();
    expect(cfg.turnstileSecretKey).toBe(
      "1x0000000000000000000000000000000AA"
    );
  });

  it("uses provided key in dev when set", async () => {
    setDevBase();
    process.env["TURNSTILE_SECRET_KEY"] = "my-dev-key";
    const cfg = await loadConfig();
    expect(cfg.turnstileSecretKey).toBe("my-dev-key");
  });
});

// ── optionalList() parsing ────────────────────────────────

describe("config — optionalList() parsing", () => {
  beforeEach(saveEnv);
  afterEach(restoreEnv);

  it("parses comma-separated ADMIN_UIDS with whitespace", async () => {
    setDevBase();
    process.env["ADMIN_UIDS"] = "uid1,uid2, uid3 , uid4";
    const cfg = await loadConfig();
    expect(cfg.adminUids).toEqual(["uid1", "uid2", "uid3", "uid4"]);
  });

  it("parses comma-separated BLOCKED_COUNTRIES", async () => {
    setDevBase();
    process.env["BLOCKED_COUNTRIES"] = "CN,RU, KP";
    const cfg = await loadConfig();
    expect(cfg.blockedCountries).toEqual(["CN", "RU", "KP"]);
  });

  it("returns empty array when list var is not set", async () => {
    setDevBase();
    delete process.env["ADMIN_UIDS"];
    const cfg = await loadConfig();
    expect(cfg.adminUids).toEqual([]);
  });

  it("filters out empty entries from list", async () => {
    setDevBase();
    process.env["ADMIN_UIDS"] = "uid1,,uid2,";
    const cfg = await loadConfig();
    expect(cfg.adminUids).toEqual(["uid1", "uid2"]);
  });
});

// ── optionalSecret() ──────────────────────────────────────

describe("config — optionalSecret() behaviour", () => {
  beforeEach(saveEnv);
  afterEach(restoreEnv);

  it("returns undefined when secret not set", async () => {
    setDevBase();
    delete process.env["DISCORD_ALERT_WEBHOOK"];
    const cfg = await loadConfig();
    expect(cfg.discordAlertWebhook).toBeUndefined();
  });

  it("returns value when secret is set", async () => {
    setDevBase();
    process.env["DISCORD_ALERT_WEBHOOK"] =
      "https://discord.com/api/webhooks/test";
    const cfg = await loadConfig();
    expect(cfg.discordAlertWebhook).toBe(
      "https://discord.com/api/webhooks/test"
    );
  });

  it("returns undefined for empty string secret", async () => {
    setDevBase();
    process.env["SENTRY_DSN"] = "";
    const cfg = await loadConfig();
    expect(cfg.sentry.dsn).toBeUndefined();
  });

  it("returns undefined for whitespace-only secret", async () => {
    setDevBase();
    process.env["DISCORD_ALERT_WEBHOOK"] = "   ";
    const cfg = await loadConfig();
    expect(cfg.discordAlertWebhook).toBeUndefined();
  });
});

// ── production full valid config ──────────────────────────

describe("config — production full valid config loads cleanly", () => {
  beforeEach(saveEnv);
  afterEach(restoreEnv);

  it("loads without throwing when all required prod vars are set", async () => {
    setProdBase();
    vi.resetModules();
    await expect(import("../config")).resolves.toBeDefined();
  });

  it("production config has isProduction=true", async () => {
    setProdBase();
    const cfg = await loadConfig();
    expect(cfg.isProduction).toBe(true);
  });

  it("production config has isDevelopment=false", async () => {
    setProdBase();
    const cfg = await loadConfig();
    expect(cfg.isDevelopment).toBe(false);
  });

  it("production config has redis.tls=false by default (explicit opt-in required)", async () => {
    // redis.tls now defaults to FALSE in all environments.
    // Hetzner private network does not need TLS.
    // To enable TLS: set REDIS_TLS=true in your .env
    setProdBase();
    delete process.env["REDIS_TLS"];
    const cfg = await loadConfig();
    expect(cfg.redis.tls).toBe(false);
  });

  it("production config redis.tls=true when REDIS_TLS=true", async () => {
    setProdBase();
    process.env["REDIS_TLS"] = "true";
    const cfg = await loadConfig();
    expect(cfg.redis.tls).toBe(true);
  });

  it("production config logLevel defaults to info", async () => {
    setProdBase();
    const cfg = await loadConfig();
    expect(cfg.logLevel).toBe("info");
  });

  it("production config enableApiDocs is false", async () => {
    setProdBase();
    const cfg = await loadConfig();
    expect(cfg.features.enableApiDocs).toBe(false);
  });

  it("production sentry tracesSampleRate defaults to 0.1", async () => {
    setProdBase();
    const cfg = await loadConfig();
    expect(cfg.sentry.tracesSampleRate).toBe(0.1);
  });

  it("production vpnCheckEnabled is true by default", async () => {
    setProdBase();
    const cfg = await loadConfig();
    expect(cfg.features.vpnCheckEnabled).toBe(true);
  });

  it("production paymentsEnabled is true by default", async () => {
    setProdBase();
    const cfg = await loadConfig();
    expect(cfg.features.paymentsEnabled).toBe(true);
  });
});
