exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable("slow_queries", {
    id: "id",
    query_text: { type: "text", notNull: true },
    duration_ms: { type: "integer", notNull: true },
    rows_returned: { type: "integer", notNull: false },
    endpoint: { type: "varchar(200)", notNull: false },
    user_id: { type: "integer", notNull: false },
    created_at: { type: "timestamp", notNull: true, default: pgm.func("CURRENT_TIMESTAMP") },
  });
  pgm.createIndex("slow_queries", "created_at", { name: "idx_slow_queries_time" });
  pgm.createIndex("slow_queries", "duration_ms", { name: "idx_slow_queries_duration" });
};

exports.down = (pgm) => {
  pgm.dropTable("slow_queries");
};
