/* eslint-disable camelcase */

exports.up = (pgm) => {
  // deleted_at exists in initial schema (migration 001).
  // This migration adds deletion_reason for GDPR audit trail.
  pgm.addColumns("users", {
    deletion_reason: { type: "text", ifNotExists: true },
  });

  // BUG FIX: removed useless index on primary key (id).
  // A partial index on the PK adds zero benefit — PK is already indexed.
  // The partial index on deleted_at IS NULL is in migration 002 (baseline-indexes).
  // Nothing else needed here.
};

exports.down = (pgm) => {
  pgm.dropColumns("users", ["deletion_reason"]);
};

exports.shorthands = undefined;
