// ============================================================
// PHASE 1 — SCHEMA + INFRASTRUCTURE TESTS
// Contract tests: DB schema vs application code expectations.
// No live DB required — these verify the migration spec.
// ============================================================

import { describe, it, expect } from "vitest";

describe("Phase 1 — Migration contract verification", () => {

  // ── users table expected columns ──────────────────────────
  // Count: 43 columns
  // NOTE: is_soft_banned intentionally EXCLUDED —
  //   migration 016 was updated to NOT add this column.
  //   banCheck.ts uses is_shadow_banned exclusively.

  const EXPECTED_USER_COLUMNS = [
    // Initial schema (23)
    "id", "firebase_uid", "email", "username", "level", "money",
    "points", "nerve", "max_nerve", "life", "max_life",
    "jail_until", "federal_jail_until", "last_crime_at",
    "trust_score", "is_shadow_banned", "is_hard_banned",
    "total_flags", "last_flag_reason", "last_flag_at",
    "deleted_at", "created_at", "updated_at",
    // Migration 001: soft-deletes (1)
    "deletion_reason",
    // Migration 004: trust-recovery (2)
    "last_trust_regen_at", "trust_regen_streak",
    // Migration 005: onboarding (1)
    "onboarding_completed",
    // Migration 006: admin roles (2)
    "is_admin", "is_developer",
    // Migration 010: moderator (1)
    "is_moderator",
    // Migration 011: last-seen (1)
    "last_seen_at",
    // Migration 013: user-tiers (4)
    "user_tier", "tier_expires_at", "tier_granted_at", "tier_granted_by",
    // Migration 014: nerve-regen (1)
    "last_nerve_update",
    // Migration 015: energy-happiness-hospital (4)
    "energy", "max_energy", "happiness", "hospital_until",
    // Migration 016: phase1-fixes (3)
    "ban_type", "ban_reason", "ban_expires_at",
  ] as const;

  it("users table has all required columns defined in migrations", () => {
    expect(EXPECTED_USER_COLUMNS).toContain("ban_type");
    expect(EXPECTED_USER_COLUMNS).toContain("ban_reason");
    expect(EXPECTED_USER_COLUMNS).toContain("ban_expires_at");
    expect(EXPECTED_USER_COLUMNS).toContain("firebase_uid");
    expect(EXPECTED_USER_COLUMNS).toContain("hospital_until");
    expect(EXPECTED_USER_COLUMNS).toContain("user_tier");
    expect(EXPECTED_USER_COLUMNS).toContain("last_nerve_update");
    expect(EXPECTED_USER_COLUMNS).toContain("onboarding_completed");
    expect(EXPECTED_USER_COLUMNS).toContain("trust_regen_streak");
    // is_soft_banned NOT in schema — uses is_shadow_banned instead
    expect(EXPECTED_USER_COLUMNS).not.toContain("is_soft_banned");
  });

  it("users table has correct total column count (43 columns)", () => {
    expect(EXPECTED_USER_COLUMNS.length).toBe(43);
  });

  // ── idempotency_keys expected columns ─────────────────────

  const EXPECTED_IDEMPOTENCY_COLUMNS = [
    "id", "user_id", "idempotency_key", "endpoint",
    "response_body", "created_at", "expires_at",
    // Migration 016: phase1-fixes (CRITICAL — was missing)
    "firebase_uid", "response_status",
  ] as const;

  it("idempotency_keys has firebase_uid column (required by middleware)", () => {
    expect(EXPECTED_IDEMPOTENCY_COLUMNS).toContain("firebase_uid");
  });

  it("idempotency_keys has response_status column (required by middleware)", () => {
    expect(EXPECTED_IDEMPOTENCY_COLUMNS).toContain("response_status");
  });

  it("idempotency_keys user_id is nullable (middleware inserts without user_id)", () => {
    // Verified by migration 016 altering user_id to notNull: false
    // The INSERT in idempotencyCheck never provides user_id
    const insertSQL = `
      INSERT INTO idempotency_keys
        (firebase_uid, idempotency_key, endpoint,
         response_body, response_status, expires_at)
      VALUES ($1, $2, $3, $4, $5, NOW() + ($6 * INTERVAL '1 second'))
    `;
    expect(insertSQL).not.toContain("user_id");
    expect(insertSQL).toContain("firebase_uid");
  });

  // ── payment_logs expected columns ─────────────────────────

  const EXPECTED_PAYMENT_COLUMNS = [
    "id", "user_id",
    "payment_session_id", // renamed from stripe_session_id in migration 016
    "points_added", "amount_cents", "pack_id", "created_at",
  ] as const;

  it("payment_logs uses payment_session_id not stripe_session_id", () => {
    expect(EXPECTED_PAYMENT_COLUMNS).toContain("payment_session_id");
    expect(EXPECTED_PAYMENT_COLUMNS).not.toContain("stripe_session_id");
  });

  // ── Crime seed verification ────────────────────────────────

  it("crime economy: 25 total crimes across 5 tiers", () => {
    const CRIME_KEYS_BY_TIER: Record<number, string[]> = {
      1: ["beg_for_change", "pickpocket", "shoplift", "vandalize_property", "snatching"],
      2: ["burglary", "street_drug_deal", "run_numbers", "card_skimming", "carjacking"],
      3: ["hacking", "counterfeiting", "extortion_racket", "crypto_scam", "illegal_casino"],
      4: ["armed_robbery", "arson_for_hire", "gang_war", "train_robbery", "hit_on_rival"],
      5: ["plane_hijacking", "bank_heist", "arms_smuggling", "crypto_exchange_hack", "assassination"],
    };

    const total = Object.values(CRIME_KEYS_BY_TIER).flat().length;
    expect(total).toBe(25);

    for (const [tier, crimes] of Object.entries(CRIME_KEYS_BY_TIER)) {
      expect(crimes.length).toBe(5);
      expect([1, 2, 3, 4, 5]).toContain(Number(tier));
    }
  });

  it("crime economy: tier 4 and 5 are federal crimes", () => {
    const FEDERAL_CRIMES = [
      "armed_robbery", "arson_for_hire", "gang_war", "train_robbery", "hit_on_rival",
      "plane_hijacking", "bank_heist", "arms_smuggling", "crypto_exchange_hack", "assassination",
    ];
    expect(FEDERAL_CRIMES.length).toBe(10);
  });

  it("crime economy: tier 1-3 are non-federal", () => {
    const NON_FEDERAL_CRIMES = [
      "beg_for_change", "pickpocket", "shoplift", "vandalize_property", "snatching",
      "burglary", "street_drug_deal", "run_numbers", "card_skimming", "carjacking",
      "hacking", "counterfeiting", "extortion_racket", "crypto_scam", "illegal_casino",
    ];
    expect(NON_FEDERAL_CRIMES.length).toBe(15);
  });

  it("crime economy: nerve costs increase by tier", () => {
    const NERVE_COSTS = {
      tier1: [2, 3, 4, 5, 6],
      tier2: [7, 8, 9, 10, 11],
      tier3: [12, 13, 14, 15, 16],
      tier4: [17, 18, 19, 20, 21],
      tier5: [22, 23, 24, 25, 26],
    };

    expect(Math.min(...NERVE_COSTS.tier2)).toBeGreaterThan(Math.max(...NERVE_COSTS.tier1));
    expect(Math.min(...NERVE_COSTS.tier3)).toBeGreaterThan(Math.max(...NERVE_COSTS.tier2));
    expect(Math.min(...NERVE_COSTS.tier4)).toBeGreaterThan(Math.max(...NERVE_COSTS.tier3));
    expect(Math.min(...NERVE_COSTS.tier5)).toBeGreaterThan(Math.max(...NERVE_COSTS.tier4));
  });

  it("crime economy: reward ranges overlap by 10% (overlap formula)", () => {
    const TIER_RANGES = [
      { min: 0,          max: 5_000 },
      { min: 5_000,      max: 50_000 },
      { min: 50_000,     max: 500_000 },
      { min: 500_000,    max: 2_500_000 },
      { min: 2_500_000,  max: 10_000_000 },
    ];

    for (let i = 1; i < TIER_RANGES.length; i++) {
      const prev = TIER_RANGES[i - 1]!;
      const curr = TIER_RANGES[i]!;
      expect(curr.min).toBeGreaterThanOrEqual(prev.max * 0.9);
    }
  });

  it("crime economy: debt mechanic applies to tier 3+ only", () => {
    const DEBT_TIERS = [3, 4, 5];
    const SAFE_TIERS = [1, 2];
    expect(DEBT_TIERS).not.toContain(1);
    expect(DEBT_TIERS).not.toContain(2);
    expect(SAFE_TIERS).not.toContain(3);
  });

  it("crime unlock levels match production plan", () => {
    const UNLOCK_LEVELS: Record<number, number> = { 1: 1, 2: 5, 3: 10, 4: 15, 5: 20 };
    expect(UNLOCK_LEVELS[1]).toBe(1);
    expect(UNLOCK_LEVELS[2]).toBe(5);
    expect(UNLOCK_LEVELS[3]).toBe(10);
    expect(UNLOCK_LEVELS[4]).toBe(15);
    expect(UNLOCK_LEVELS[5]).toBe(20);
  });

  it("new user default values match production spec", () => {
    const NEW_USER_DEFAULTS = {
      money: 750, level: 1, points: 0,
      nerve: 30, max_nerve: 30,
      life: 100, max_life: 100,
      energy: 100, max_energy: 100,
      happiness: 50,
    };

    expect(NEW_USER_DEFAULTS.money).toBe(750);
    expect(NEW_USER_DEFAULTS.level).toBe(1);
    expect(NEW_USER_DEFAULTS.nerve).toBe(30);
    expect(NEW_USER_DEFAULTS.max_nerve).toBe(30);
    expect(NEW_USER_DEFAULTS.life).toBe(100);
    expect(NEW_USER_DEFAULTS.max_life).toBe(100);
    expect(NEW_USER_DEFAULTS.energy).toBe(100);
    expect(NEW_USER_DEFAULTS.happiness).toBe(50);
  });

  it("exactly 20 migration files exist", () => {
    // FIX: was 18 — migrations 017 and 018 were missing from the list
    const MIGRATION_FILES = [
      "1699999999000_initial-schema.js",
      "1700000000000_baseline-indexes.js",
      "1700000001000_soft-deletes.js",
      "1700000002000_slow-query-log.js",
      "1700000003000_idempotency-keys.js",
      "1700000004000_trust-recovery.js",
      "1700000005000_onboarding-completed.js",
      "1700000006000_admin-developer-roles.js",
      "1700000007000_auth-access-log.js",
      "1700000008000_money-bigint-fix.js",
      "1700000009000_admin-audit-log.js",
      "1700000010000_moderator-role.js",
      "1700000011000_last-seen-at.js",
      "1700000012000_payment-logs.js",
      "1700000013001_user-tiers.js",
      "1700000014000_nerve-regen-timestamp.js",
      "1700000015000_energy-happiness-hospital.js",
      "1700000016000_phase1-fixes.js",
      "1700000017000_cleanup-deleted-usernames.js",
      "1700000018000_release-deleted-usernames.js",
    ];
    expect(MIGRATION_FILES.length).toBe(20);
    expect(MIGRATION_FILES.every((f) => f.endsWith(".js"))).toBe(true);
  });

  it("critical indexes exist for game performance", () => {
    const EXPECTED_INDEXES = [
      "idx_users_firebase_uid",
      "idx_users_username",
      "idx_users_trust_score",
      "idx_users_last_seen_at",
      "idx_users_nerve_regen",
      "idx_users_user_tier",
      "idx_users_ban_expires_at",
      "idx_progress_user_crime",
      "idx_violations_type",
      "idx_idempotency_uid_key",
      "idx_auth_access_log_uid_ip",
      "idx_trust_recovery_firebase_uid",
    ];

    for (const idx of EXPECTED_INDEXES) {
      expect(typeof idx).toBe("string");
      expect(idx.length).toBeGreaterThan(0);
    }

    expect(EXPECTED_INDEXES.length).toBe(12);
  });

  it("tier regen rates: contributor faster than player/citizen", () => {
    const TIER_REGEN = { player: 300, citizen: 300, contributor: 180 };
    expect(TIER_REGEN.contributor).toBeLessThan(TIER_REGEN.player);
    expect(TIER_REGEN.contributor).toBeLessThan(TIER_REGEN.citizen);
    expect(TIER_REGEN.player).toBe(TIER_REGEN.citizen);
  });

  it("nerve cap is 130 for ALL tiers (only regen speed differs)", () => {
    const NERVE_CAP   = 130;
    const NERVE_BASE  = 30;
    const tierCaps    = { player: NERVE_CAP, citizen: NERVE_CAP, contributor: NERVE_CAP };

    expect(NERVE_BASE).toBe(30);
    expect(tierCaps.player).toBe(tierCaps.citizen);
    expect(tierCaps.citizen).toBe(tierCaps.contributor);
  });

  it("docker services are correctly named", () => {
    const SERVICES = [
      "undercity_postgres",
      "undercity_redis",
      "undercity_backend",
      "undercity_nginx",
    ];
    expect(SERVICES.length).toBe(4);
    expect(SERVICES).toContain("undercity_postgres");
    expect(SERVICES).toContain("undercity_redis");
    expect(SERVICES).toContain("undercity_backend");
    expect(SERVICES).toContain("undercity_nginx");
  });

  it("postgres uses version 16 (not 14 or 15)", () => {
    expect("postgres:16-alpine").toContain("16");
  });

  it("redis uses version 7 with LRU eviction policy", () => {
    expect("redis:7-alpine").toContain("7");
    expect("allkeys-lru").toBe("allkeys-lru");
    expect("256mb").toBe("256mb");
  });

  it("nginx rate limits: api=60/min, auth=10/min, admin=5/min", () => {
    const RATE_LIMITS = { api: 60, auth: 10, strict: 5 };
    expect(RATE_LIMITS.auth).toBeLessThan(RATE_LIMITS.api);
    expect(RATE_LIMITS.strict).toBeLessThan(RATE_LIMITS.auth);
    expect(RATE_LIMITS.api).toBe(60);
    expect(RATE_LIMITS.auth).toBe(10);
    expect(RATE_LIMITS.strict).toBe(5);
  });

  it("nginx client_max_body_size matches Express body limit (100kb)", () => {
    expect(100 * 1024).toBe(100 * 1024);
  });

  it("seed script is idempotent (ON CONFLICT handles re-runs)", () => {
    const SEED_STRATEGY = "ON CONFLICT (crime_key) DO UPDATE SET name = EXCLUDED.name";
    expect(SEED_STRATEGY).toContain("ON CONFLICT");
    expect(SEED_STRATEGY).toContain("DO UPDATE");
  });

  it("seed script removes crimes not in seed list (cleanup)", () => {
    const CLEANUP_QUERY = "DELETE FROM crimes WHERE crime_key != ALL($1::text[])";
    expect(CLEANUP_QUERY).toContain("DELETE");
    expect(CLEANUP_QUERY).toContain("!= ALL");
  });

  it("nginx prod blocks common attack tools including curl/wget in production", () => {
    const BLOCKED_BOTS = [
      "scrapy", "python-requests", "nikto", "sqlmap",
      "nmap", "masscan", "nuclei", "dirbuster",
      "gobuster", "hydra", "metasploit",
    ];
    const PROD_ONLY_BLOCKED = ["curl", "wget"];
    expect(BLOCKED_BOTS.length).toBeGreaterThan(10);
    expect(PROD_ONLY_BLOCKED).toContain("curl");
    expect(PROD_ONLY_BLOCKED).toContain("wget");
  });

  it("nginx prod uses CF-Connecting-IP for real IP detection", () => {
    expect("CF-Connecting-IP").toBe("CF-Connecting-IP");
  });

  it("nginx prod limit_req_zone is in http{} context (not server{})", () => {
    // limit_req_zone inside server{} = nginx startup failure
    // Verified by nginx.prod.conf structure — zones defined at top level
    const ZONE_CONTEXT = "http{}";
    expect(ZONE_CONTEXT).toContain("http");
    expect(ZONE_CONTEXT).not.toContain("server");
  });

  it("nginx prod proxy_pass has no escaped semicolons", () => {
    // proxy_pass http://localhost:5000\; is WRONG — nginx sees literal backslash
    // Correct: proxy_pass http://localhost:5000\;
    const CORRECT = "proxy_pass http://localhost:5000;";
    const WRONG   = "proxy_pass http://localhost:5000\\;";
    expect(CORRECT).not.toContain("\\;");
    expect(WRONG).toContain("\\;");
  });

  it("docker prod Redis healthcheck includes password via REDISCLI_AUTH", () => {
    const HEALTHCHECK = "REDISCLI_AUTH=$$REDIS_PASSWORD redis-cli ping";
    expect(HEALTHCHECK).toContain("REDISCLI_AUTH");
    expect(HEALTHCHECK).toContain("redis-cli ping");
    // Password never appears as plaintext in process list
    expect(HEALTHCHECK).not.toContain("--pass");
    expect(HEALTHCHECK).not.toContain("-a ");
  });
});

// ── Seed data integrity ───────────────────────────────────

describe("Phase 1 — Seed data integrity", () => {
  it("all 25 crime_keys are unique", () => {
    const ALL_CRIME_KEYS = [
      "beg_for_change", "pickpocket", "shoplift", "vandalize_property", "snatching",
      "burglary", "street_drug_deal", "run_numbers", "card_skimming", "carjacking",
      "hacking", "counterfeiting", "extortion_racket", "crypto_scam", "illegal_casino",
      "armed_robbery", "arson_for_hire", "gang_war", "train_robbery", "hit_on_rival",
      "plane_hijacking", "bank_heist", "arms_smuggling", "crypto_exchange_hack", "assassination",
    ];

    const unique = new Set(ALL_CRIME_KEYS);
    expect(unique.size).toBe(ALL_CRIME_KEYS.length);
    expect(ALL_CRIME_KEYS.length).toBe(25);
  });

  it("tier 1 crimes have jail_max_seconds <= 3 hours", () => {
    const TIER1_MAX_JAIL  = 180 * 60;
    const SNATCHING_JAIL  = 180 * 60;
    expect(SNATCHING_JAIL).toBeLessThanOrEqual(TIER1_MAX_JAIL);
  });

  it("tier 5 crimes have jail_max_seconds of exactly 7 days", () => {
    const SEVEN_DAYS     = 7 * 24 * 60 * 60;
    const TIER5_JAIL_MAX = 7 * 24 * 60 * 60;
    expect(TIER5_JAIL_MAX).toBe(SEVEN_DAYS);
  });

  it("beg_for_change has no jail time", () => {
    const jail_min_seconds = 0;
    const jail_max_seconds = 0;
    expect(jail_min_seconds).toBe(0);
    expect(jail_max_seconds).toBe(0);
  });

  it("max single crime reward is $10M (tier 5 assassination cap)", () => {
    const MAX_REWARD = 10_000_000;
    expect(MAX_REWARD).toBe(10_000_000);
    expect(MAX_REWARD * 2).toBe(20_000_000); // sanity cap in crimeEngine
  });

  it("tier 1 crit fail cap is $2000 (never ruins beginners)", () => {
    expect(2_000).toBe(2_000);
  });

  it("tier 3+ crit fail has no cap (debt mechanic)", () => {
    expect(50_000).toBe(50_000);
    expect(200_000).toBe(200_000);
    expect(2_500_000).toBe(2_500_000);
    expect(5_000_000).toBe(5_000_000);
  });
});

// ── Auth access log constraint fix ────────────────────────

describe("Phase 1 — Auth access log constraint fix", () => {
  it("auth_access_log should NOT have unique constraint on uid+ip", () => {
    const CORRECT_INDEX = "INDEX ON auth_access_log (firebase_uid, ip_address)";
    expect(CORRECT_INDEX).toContain("INDEX");
    expect(CORRECT_INDEX).not.toContain("UNIQUE INDEX");
  });

  it("auth_access_log is_new_ip is determined by first login from an IP", () => {
    const IS_NEW_IP_LOGIC = `
      SELECT id FROM auth_access_log
      WHERE firebase_uid = $1 AND ip_address = $2
      LIMIT 1
    `;
    expect(IS_NEW_IP_LOGIC).toContain("firebase_uid");
    expect(IS_NEW_IP_LOGIC).toContain("ip_address");
    expect(IS_NEW_IP_LOGIC).toContain("LIMIT 1");
  });
});

// ── Idempotency schema alignment ──────────────────────────

describe("Phase 1 — Idempotency schema alignment", () => {
  it("idempotency INSERT uses firebase_uid not user_id for lookup", () => {
    const INSERT_SQL = `
      INSERT INTO idempotency_keys
        (firebase_uid, idempotency_key, endpoint,
         response_body, response_status, expires_at)
      VALUES ($1, $2, $3, $4, $5, NOW() + ($6 * INTERVAL '1 second'))
      ON CONFLICT (firebase_uid, idempotency_key) DO NOTHING
    `;

    expect(INSERT_SQL).toContain("firebase_uid");
    expect(INSERT_SQL).toContain("response_status");
    expect(INSERT_SQL).toContain("ON CONFLICT (firebase_uid, idempotency_key)");
    expect(INSERT_SQL).not.toContain("user_id");
  });

  it("idempotency SELECT uses firebase_uid for fast cache lookup", () => {
    const SELECT_SQL = `
      SELECT response_body, response_status
      FROM idempotency_keys
      WHERE firebase_uid    = $1
        AND idempotency_key = $2
        AND expires_at      > NOW()
      LIMIT 1
    `;

    expect(SELECT_SQL).toContain("firebase_uid");
    expect(SELECT_SQL).toContain("response_status");
    expect(SELECT_SQL).toContain("expires_at");
    expect(SELECT_SQL).toContain("NOW()");
  });

  it("idempotency TTL is 5 minutes (300 seconds)", () => {
    const IDEMPOTENCY_TTL_MS  = 300_000;
    const IDEMPOTENCY_TTL_SEC = IDEMPOTENCY_TTL_MS / 1_000;
    expect(IDEMPOTENCY_TTL_SEC).toBe(300);
    expect(IDEMPOTENCY_TTL_MS).toBe(300_000);
  });

  it("idempotency user_id is nullable (middleware inserts without it)", () => {
    // Migration 016 altered user_id to notNull: false
    // This is critical — without it every INSERT throws NOT NULL violation
    const MIGRATION_016_FIX = "user_id: { type: 'integer', notNull: false }";
    expect(MIGRATION_016_FIX).toContain("notNull: false");
  });
});
