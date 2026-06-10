/* eslint-disable camelcase */

// Slow query log — populated by dbHelpers.ts when query exceeds threshold.
// Cleanup: run `npm run clean:idempotency` or schedule a cron to
// DELETE FROM slow_queries WHERE created_at < NOW() - INTERVAL '30 days'

exports.up = (pgm) => {
  pgm.createTable("slow_queries", {
    id:            { type: "serial",       primaryKey: true },
    query_text:    { type: "text",         notNull: true },
    duration_ms:   { type: "real",         notNull: true },      // float for sub-ms precision
    rows_returned: { type: "integer",      notNull: false },
    endpoint:      { type: "varchar(200)", notNull: false },
    user_id:       { type: "integer",      notNull: false },
    // BUG FIX: timestamptz (not timestamp) — consistent with all other tables
    created_at:    { type: "timestamptz",  notNull: true, default: pgm.func("NOW()") },
  });

  pgm.createIndex("slow_queries", "created_at",  { name: "idx_slow_queries_time" });
  pgm.createIndex("slow_queries", "duration_ms", { name: "idx_slow_queries_duration" });
  // For filtering by endpoint in the admin panel
  pgm.createIndex("slow_queries", "endpoint", {
    name: "idx_slow_queries_endpoint",
    where: "endpoint IS NOT NULL",
  });
};

exports.down = (pgm) => {
  pgm.dropTable("slow_queries", { cascade: true });
};

exports.shorthands = undefined;
