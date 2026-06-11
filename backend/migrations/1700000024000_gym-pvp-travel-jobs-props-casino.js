/* eslint-disable camelcase */

exports.up = (pgm) => {

  // ── 1. Gym: Battle Stats on users ────────────────────
  pgm.addColumns("users", {
    strength:  { type: "integer", notNull: true, default: 0 },
    speed:     { type: "integer", notNull: true, default: 0 },
    defense:   { type: "integer", notNull: true, default: 0 },
    dexterity: { type: "integer", notNull: true, default: 0 },
  });

  // ── 2. PvP: Attack log ───────────────────────────────
  pgm.createTable("pvp_attacks", {
    id:             { type: "serial",      primaryKey: true },
    attacker_id:    { type: "integer",     notNull: true, references: "users" },
    target_id:      { type: "integer",     notNull: true, references: "users" },
    result:         { type: "varchar(20)", notNull: true },
    attacker_hp:    { type: "integer",     notNull: true },
    target_hp:      { type: "integer",     notNull: true },
    money_stolen:   { type: "bigint",      notNull: true, default: 0 },
    attacker_nerve: { type: "integer",     notNull: true },
    created_at:     { type: "timestamptz", notNull: true, default: pgm.func("NOW()") },
  });

  pgm.createIndex("pvp_attacks", "attacker_id", { name: "idx_pvp_attacker" });
  pgm.createIndex("pvp_attacks", "target_id",   { name: "idx_pvp_target" });
  pgm.createIndex("pvp_attacks", "created_at",  { name: "idx_pvp_created" });

  pgm.addConstraint("pvp_attacks", "pvp_attacks_result_check",
    "CHECK (result IN ('attacker_win', 'target_win', 'mugged', 'hospitalized', 'stalemate'))"
  );

  // ── 3. Travel: Cities ────────────────────────────────
  pgm.createTable("cities", {
    id:           { type: "serial",       primaryKey: true },
    name:         { type: "varchar(50)",  notNull: true, unique: true },
    description:  { type: "text",         notNull: true },
    country:      { type: "varchar(50)",  notNull: true },
    flight_cost:  { type: "bigint",       notNull: true, default: 0 },
    flight_time:  { type: "integer",      notNull: true, default: 300 },  // seconds
    min_level:    { type: "integer",      notNull: true, default: 15 },
    is_active:    { type: "boolean",      notNull: true, default: true },
    created_at:   { type: "timestamptz",  notNull: true, default: pgm.func("NOW()") },
  });

  pgm.createTable("travel_history", {
    id:          { type: "serial",      primaryKey: true },
    user_id:     { type: "integer",     notNull: true, references: "users" },
    city_id:     { type: "integer",     notNull: true, references: "cities" },
    departed_at: { type: "timestamptz", notNull: true, default: pgm.func("NOW()") },
    arrived_at:  { type: "timestamptz", notNull: true },
    returned:    { type: "boolean",     notNull: true, default: false },
  });

  pgm.createIndex("travel_history", "user_id",     { name: "idx_travel_user" });
  pgm.createIndex("travel_history", "arrived_at",  { name: "idx_travel_arrival" });

  // ── 4. Jobs ──────────────────────────────────────────
  pgm.createTable("jobs", {
    id:          { type: "serial",       primaryKey: true },
    name:        { type: "varchar(50)",  notNull: true, unique: true },
    description: { type: "text",         notNull: true },
    pay:         { type: "bigint",       notNull: true, default: 1000 },
    energy_cost: { type: "integer",      notNull: true, default: 10 },
    min_level:   { type: "integer",      notNull: true, default: 1 },
    min_stats:   { type: "integer",      notNull: true, default: 0 },
    is_active:   { type: "boolean",      notNull: true, default: true },
    created_at:  { type: "timestamptz",  notNull: true, default: pgm.func("NOW()") },
  });

  pgm.createTable("user_jobs", {
    id:        { type: "serial",      primaryKey: true },
    user_id:   { type: "integer",     notNull: true, references: "users", unique: true },
    job_id:    { type: "integer",     notNull: true, references: "jobs" },
    started_at: { type: "timestamptz", notNull: true, default: pgm.func("NOW()") },
  });

  // ── 5. Properties ────────────────────────────────────
  pgm.createTable("properties", {
    id:           { type: "serial",       primaryKey: true },
    name:         { type: "varchar(100)", notNull: true, unique: true },
    description:  { type: "text",         notNull: true },
    price:        { type: "bigint",       notNull: true },
    daily_income: { type: "bigint",       notNull: true, default: 0 },
    min_level:    { type: "integer",      notNull: true, default: 1 },
    is_active:    { type: "boolean",      notNull: true, default: true },
    created_at:   { type: "timestamptz",  notNull: true, default: pgm.func("NOW()") },
  });

  pgm.createTable("user_properties", {
    id:          { type: "serial",      primaryKey: true },
    user_id:     { type: "integer",     notNull: true, references: "users" },
    property_id: { type: "integer",     notNull: true, references: "properties" },
    purchased_at:{ type: "timestamptz", notNull: true, default: pgm.func("NOW()") },
    foreclosed:  { type: "boolean",     notNull: true, default: false },
  });

  pgm.addConstraint("user_properties", "user_properties_unique",
    "UNIQUE (user_id, property_id)"
  );

  // ── 6. Casino ────────────────────────────────────────
  pgm.createTable("casino_log", {
    id:          { type: "serial",      primaryKey: true },
    user_id:     { type: "integer",     notNull: true, references: "users" },
    game:        { type: "varchar(30)", notNull: true },
    bet:         { type: "bigint",      notNull: true },
    payout:      { type: "bigint",      notNull: true, default: 0 },
    result:      { type: "varchar(20)", notNull: true },
    created_at:  { type: "timestamptz", notNull: true, default: pgm.func("NOW()") },
  });

  pgm.createIndex("casino_log", "user_id",    { name: "idx_casino_user" });
  pgm.createIndex("casino_log", "created_at", { name: "idx_casino_created" });

  // ── Seed Cities ──────────────────────────────────────
  pgm.sql(`
    INSERT INTO cities (name, description, country, flight_cost, flight_time, min_level) VALUES
      ('London',        'The historic capital. Black market goods flow through the Thames.',                'UK',      5000,   600,  15),
      ('Tokyo',         'Neon-lit streets hide the Yakuza-controlled underground.',                         'Japan',   8000,   900,  15),
      ('Dubai',         'Oil money and illegal auctions — if you have the cash, they have the goods.',      'UAE',     12000,  720,  15),
      ('Sao Paulo',     'Favela-ruled chaos. Cheap goods, high risk.',                                      'Brazil',  3000,   1080, 15),
      ('Moscow',        'Bratva territory. Heavy weapons flow freely here.',                                'Russia',  10000,  840,  15),
      ('Bangkok',       'The smuggling capital of Southeast Asia. Exotic goods at bargain prices.',         'Thailand',4000,   780,  15)
  `);

  // ── Seed Jobs ────────────────────────────────────────
  pgm.sql(`
    INSERT INTO jobs (name, description, pay, energy_cost, min_level, min_stats) VALUES
      ('Street Sweeper',   'Clean the streets. Low pay, low effort.',         500,   5,  1,  0),
      ('Cashier',          'Work a register. Steady income.',                  1200,  10, 2,  0),
      ('Bouncer',          'Throw out troublemakers. Requires some muscle.',   2500,  15, 5,  50),
      ('Taxi Driver',      'Drive the night shift. Decent tips.',             4000,  20, 8,  0),
      ('Mechanic',         'Fix cars in a chop shop. Good money.',            6000,  25, 10, 100),
      ('Smuggler',         'Move contraband across borders. High risk, high pay.', 10000, 30, 15, 250),
      ('Hacker',           'Digital heists. Top-tier income for the skilled.', 15000, 35, 20, 500)
  `);

  // ── Seed Properties ──────────────────────────────────
  pgm.sql(`
    INSERT INTO properties (name, description, price, daily_income, min_level) VALUES
      ('Shack',             'A rundown shack in the slums. Better than the street.',               50000,    500,   1),
      ('Studio Apartment',  'A small studio in a decent neighborhood.',                            200000,   2000,  3),
      ('Safe House',        'A hidden location. Good for lying low.',                              500000,   5000,  5),
      ('Brownstone',        'A classic city brownstone. Respectable.',                            1500000,  15000,  8),
      ('Warehouse',         'Industrial space. Store goods, run operations.',                     3000000,  30000,  10),
      ('Luxury Penthouse',  'Top-floor living with skyline views. Status symbol.',                8000000,  80000,  15),
      ('Private Island',    'Ultimate luxury. Complete privacy. For the true kingpin.',          25000000, 250000, 20)
  `);
};

exports.down = (pgm) => {
  pgm.dropTable("casino_log",        { cascade: true });
  pgm.dropTable("user_properties",   { cascade: true });
  pgm.dropTable("properties",        { cascade: true });
  pgm.dropTable("user_jobs",         { cascade: true });
  pgm.dropTable("jobs",              { cascade: true });
  pgm.dropTable("travel_history",    { cascade: true });
  pgm.dropTable("cities",            { cascade: true });
  pgm.dropTable("pvp_attacks",       { cascade: true });
  pgm.dropColumns("users", ["strength", "speed", "defense", "dexterity"]);
};
