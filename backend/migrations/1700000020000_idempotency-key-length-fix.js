/* eslint-disable camelcase */

// ============================================================
// FIX: idempotency_keys.idempotency_key varchar(64) → varchar(128)
//
// The middleware validates keys up to MAX_KEY_LENGTH = 128 chars.
// The DB column was only varchar(64) — keys between 65-128 chars
// would hit a string_data_right_truncation error (PG code 22001).
//
// UUID v4 is 36 chars — well within the old limit.
// But we validate up to 128 chars in middleware for forward compatibility.
// Align DB to match middleware contract.
// ============================================================

exports.up = (pgm) => {
  pgm.alterColumn("idempotency_keys", "idempotency_key", {
    type:    "varchar(128)",
    notNull: true,
  });
};

exports.down = (pgm) => {
  pgm.alterColumn("idempotency_keys", "idempotency_key", {
    type:    "varchar(64)",
    notNull: true,
  });
};
