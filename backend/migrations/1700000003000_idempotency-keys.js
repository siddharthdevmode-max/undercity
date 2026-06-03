/* eslint-disable camelcase */

exports.up = (pgm) => {
  pgm.createTable("idempotency_keys", {
    id:               { type: "serial",       primaryKey: true },
    user_id:          { type: "integer",      notNull: true, references: "users" },
    idempotency_key:  { type: "varchar(64)",  notNull: true },
    endpoint:         { type: "varchar(100)", notNull: true },
    response_body:    { type: "jsonb",        notNull: true, default: pgm.func("'{}'::jsonb") },
    created_at:       { type: "timestamptz",  notNull: true, default: pgm.func("NOW()") },
    expires_at:       { type: "timestamptz",  notNull: true },
  });

  pgm.addConstraint(
    "idempotency_keys",
    "idempotency_keys_user_key_unique",
    "UNIQUE (user_id, idempotency_key)"
  );

  pgm.createIndex("idempotency_keys", "expires_at");
  pgm.createIndex("idempotency_keys", ["user_id", "idempotency_key"]);
};

exports.down = (pgm) => {
  pgm.dropTable("idempotency_keys");
};
