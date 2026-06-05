exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable("payment_logs", {
    id: { type: "serial", primaryKey: true },
    user_id: {
      type: "integer",
      notNull: true,
      references: '"users"',
      onDelete: "CASCADE",
    },
    stripe_session_id: { type: "varchar(255)", notNull: true, unique: true },
    points_added:      { type: "integer",      notNull: true },
    amount_cents:      { type: "integer",      notNull: true },
    pack_id:           { type: "varchar(50)" },
    created_at: {
      type:    "timestamptz",
      notNull: true,
      default: pgm.func("NOW()"),
    },
  });

  pgm.addIndex("payment_logs", ["user_id"]);
  pgm.addIndex("payment_logs", ["stripe_session_id"]);
};

exports.down = (pgm) => {
  pgm.dropTable("payment_logs");
};
