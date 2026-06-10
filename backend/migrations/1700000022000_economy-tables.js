/* eslint-disable camelcase */

exports.up = (pgm) => {

  // ── Items ──────────────────────────────────────────────
  pgm.createTable("items", {
    id:          { type: "serial",       primaryKey: true },
    name:        { type: "varchar(100)", notNull: true },
    description: { type: "text",         notNull: true },
    category:    { type: "varchar(20)",  notNull: true },
    base_price:  { type: "bigint",       notNull: true, default: 0 },
    usable:      { type: "boolean",      notNull: true, default: false },
    sellable:    { type: "boolean",      notNull: true, default: true },
    tradeable:   { type: "boolean",      notNull: true, default: true },
    is_active:   { type: "boolean",      notNull: true, default: true },
    created_at:  { type: "timestamptz",  notNull: true, default: pgm.func("NOW()") },
  });

  pgm.addConstraint("items", "items_category_check",
    "CHECK (category IN ('weapon', 'armor', 'drug', 'medical', 'misc'))"
  );

  pgm.createIndex("items", "category", { name: "idx_items_category", where: "is_active = TRUE" });
  pgm.createIndex("items", "is_active", { name: "idx_items_active" });

  // ── User Inventory ─────────────────────────────────────
  pgm.createTable("user_inventory", {
    id:          { type: "serial",      primaryKey: true },
    user_id:     { type: "integer",     notNull: true, references: "users" },
    item_id:     { type: "integer",     notNull: true, references: "items" },
    quantity:    { type: "integer",     notNull: true, default: 1 },
    acquired_at: { type: "timestamptz", notNull: true, default: pgm.func("NOW()") },
  });

  pgm.addConstraint("user_inventory", "user_inventory_user_item_unique",
    "UNIQUE (user_id, item_id)"
  );

  pgm.createIndex("user_inventory", "user_id", { name: "idx_inventory_user_id" });
  pgm.createIndex("user_inventory", "item_id", { name: "idx_inventory_item_id" });

  // ── Market Listings ────────────────────────────────────
  pgm.createTable("market_listings", {
    id:             { type: "serial",       primaryKey: true },
    seller_id:      { type: "integer",      notNull: true, references: "users" },
    item_id:        { type: "integer",      notNull: true, references: "items" },
    quantity:       { type: "integer",      notNull: true, default: 1 },
    quantity_left:  { type: "integer",      notNull: true, default: 1 },
    price_per_unit: { type: "bigint",       notNull: true },
    sold:           { type: "boolean",      notNull: true, default: false },
    listed_at:      { type: "timestamptz",  notNull: true, default: pgm.func("NOW()") },
    expires_at:     { type: "timestamptz",  notNull: true },
  });

  pgm.addConstraint("market_listings", "market_listings_quantity_check",
    "CHECK (quantity > 0 AND quantity_left >= 0 AND quantity_left <= quantity)"
  );
  pgm.addConstraint("market_listings", "market_listings_price_check",
    "CHECK (price_per_unit > 0)"
  );

  pgm.createIndex("market_listings", "seller_id",      { name: "idx_market_seller_id" });
  pgm.createIndex("market_listings", "item_id",         { name: "idx_market_item_id" });
  pgm.createIndex("market_listings", "expires_at",      { name: "idx_market_expires", where: "sold = FALSE" });
  pgm.createIndex("market_listings", ["item_id", "price_per_unit"], {
    name: "idx_market_item_price", where: "sold = FALSE AND quantity_left > 0",
  });

  // ── Bank Transactions ──────────────────────────────────
  pgm.createTable("bank_transactions", {
    id:            { type: "bigserial",    primaryKey: true },
    user_id:       { type: "integer",      notNull: true, references: "users" },
    type:          { type: "varchar(20)",  notNull: true },
    amount:        { type: "bigint",       notNull: true },
    balance_before:{ type: "bigint",       notNull: true },
    balance_after: { type: "bigint",       notNull: true },
    reference_type:{ type: "varchar(30)",  default: null },
    reference_id:  { type: "varchar(100)", default: null },
    description:   { type: "text",         default: null },
    created_at:    { type: "timestamptz",  notNull: true, default: pgm.func("NOW()") },
  });

  pgm.addConstraint("bank_transactions", "bank_transactions_type_check",
    "CHECK (type IN ('deposit', 'withdraw', 'transfer_in', 'transfer_out', " +
    "'crime_reward', 'crime_penalty', 'market_sale', 'market_purchase', " +
    "'referral_bonus', 'admin_adjust', 'item_use', 'tax'))"
  );

  pgm.createIndex("bank_transactions", "user_id",     { name: "idx_bank_user_id" });
  pgm.createIndex("bank_transactions", "created_at",  { name: "idx_bank_created_at" });
  pgm.createIndex("bank_transactions", "type",        { name: "idx_bank_type" });

  // ── Referrals ─────────────────────────────────────────
  pgm.createTable("referrals", {
    id:             { type: "serial",       primaryKey: true },
    referrer_id:    { type: "integer",      notNull: true, references: "users" },
    referred_id:    { type: "integer",      notNull: true, references: "users", unique: true },
    referral_code:  { type: "varchar(20)",  notNull: true },
    reward_given:   { type: "boolean",      notNull: true, default: false },
    created_at:     { type: "timestamptz",  notNull: true, default: pgm.func("NOW()") },
  });

  pgm.createIndex("referrals", "referrer_id",   { name: "idx_ref_referrer" });
  pgm.createIndex("referrals", "referral_code", { name: "idx_ref_code" });
  pgm.createIndex("referrals", "reward_given",  { name: "idx_ref_reward", where: "reward_given = FALSE" });

  // ── User Settings (for economy preferences) ──────────
  pgm.createTable("user_settings", {
    user_id:            { type: "integer",  notNull: true, references: "users", primaryKey: true },
    email_notifications:{ type: "boolean",  notNull: true, default: true },
    show_online:        { type: "boolean",  notNull: true, default: true },
    created_at:         { type: "timestamptz", notNull: true, default: pgm.func("NOW()") },
    updated_at:         { type: "timestamptz", notNull: true, default: pgm.func("NOW()") },
  });
};

exports.down = (pgm) => {
  pgm.dropTable("user_settings",       { cascade: true });
  pgm.dropTable("referrals",           { cascade: true });
  pgm.dropTable("bank_transactions",   { cascade: true });
  pgm.dropTable("market_listings",     { cascade: true });
  pgm.dropTable("user_inventory",      { cascade: true });
  pgm.dropTable("items",               { cascade: true });
};

exports.shorthands = undefined;
