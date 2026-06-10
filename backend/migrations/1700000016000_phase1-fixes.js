/* eslint-disable camelcase */

// ============================================================
// PHASE 1 CRITICAL FIXES — ADDITIVE ONLY
//
// After audit (June 2026), root migrations were fixed directly.
// This migration handles only what couldn't be fixed upstream:
//
// 1. Ban columns on users (ban_type, ban_reason, ban_expires_at)
//    banCheck.ts requires these — were never in any prior migration.
//
// 2. Idempotency firebase_uid + response_status columns
//    Migration 005 was fixed to be nullable, but on existing deployments
//    that ran old migration 005, these columns may be missing.
//    ifNotExists guards make this safe for both cases.
//
// 3. payment_logs: stripe_session_id → payment_session_id rename
//    For existing deployments that ran old migration 012.
//    Fresh deployments have payment_session_id from the start.
//
// Everything else (auth_access_log unique constraint, slow_queries
// timestamp, trust_recovery firebase_uid index) is now fixed in
// the root migrations — no action needed here.
// ============================================================

exports.shorthands = undefined;

exports.up = (pgm) => {

  // ── 1. Ban columns ─────────────────────────────────────
  // banCheck.ts reads ban_type, ban_reason, ban_expires_at.
  // These were never in any migration until now.

  pgm.addColumns("users", {
    ban_type: {
      type:        "varchar(20)",
      default:     null,
      notNull:     false,
      ifNotExists: true,
    },
    ban_reason: {
      type:        "text",
      default:     null,
      notNull:     false,
      ifNotExists: true,
    },
    ban_expires_at: {
      type:        "timestamptz",
      default:     null,
      notNull:     false,
      ifNotExists: true,
    },
  });

  // CHECK constraint: valid ban types
  pgm.sql(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'users_ban_type_check'
      ) THEN
        ALTER TABLE users
          ADD CONSTRAINT users_ban_type_check
          CHECK (ban_type IS NULL OR ban_type IN ('soft', 'hard', 'shadow'));
      END IF;
    END $$;
  `);

  pgm.createIndex("users", "ban_expires_at", {
    name:        "idx_users_ban_expires_at",
    where:       "ban_expires_at IS NOT NULL",
    ifNotExists: true,
  });

  // ── 2. Idempotency — missing columns on existing deployments ──
  // Fresh deployments: migration 005 already has these — ifNotExists = no-op
  // Existing deployments with old migration 005: these are added here

  pgm.addColumns("idempotency_keys", {
    firebase_uid: {
      type:        "varchar(128)",
      notNull:     false,
      ifNotExists: true,
    },
    response_status: {
      type:        "integer",
      notNull:     false,
      default:     200,
      ifNotExists: true,
    },
  });

  // Idempotency user_id: make nullable for pre-auth requests
  // On existing deployments with old NOT NULL constraint
  pgm.alterColumn("idempotency_keys", "user_id", {
    type:    "integer",
    notNull: false,
  });

  // ── 3. payment_logs rename for existing deployments ────
  // Fresh deployments have payment_session_id from migration 012.
  // Existing deployments have stripe_session_id — rename it.
  pgm.sql(`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'payment_logs'
          AND column_name = 'stripe_session_id'
      ) THEN
        ALTER TABLE payment_logs
          RENAME COLUMN stripe_session_id TO payment_session_id;
      END IF;
    END $$;
  `);
};

exports.down = (pgm) => {
  // Restore stripe_session_id name for existing deployments
  pgm.sql(`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'payment_logs'
          AND column_name = 'payment_session_id'
      ) THEN
        ALTER TABLE payment_logs
          RENAME COLUMN payment_session_id TO stripe_session_id;
      END IF;
    END $$;
  `);

  pgm.dropColumns("idempotency_keys", ["firebase_uid", "response_status"]);

  pgm.alterColumn("idempotency_keys", "user_id", {
    type:    "integer",
    notNull: true,
  });

  pgm.dropIndex("users", [], {
    name:    "idx_users_ban_expires_at",
    ifExists: true,
  });

  // NOTE: Do NOT restore auth_access_log unique constraint in down.
  // That constraint blocked repeat logins and must never return.

  pgm.sql(`
    ALTER TABLE users
      DROP CONSTRAINT IF EXISTS users_ban_type_check;
  `);

  pgm.dropColumns("users", [
    "ban_type",
    "ban_reason",
    "ban_expires_at",
  ]);
};
