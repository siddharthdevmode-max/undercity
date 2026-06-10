/* eslint-disable camelcase */

exports.up = (pgm) => {

  // ── Weapons (tier 1-5) ────────────────────────────────
  pgm.sql(`
    INSERT INTO items (name, description, category, base_price, usable, sellable, tradeable) VALUES
      ('Brass Knuckles',    'Simple but effective. +2 attack.',                             'weapon',   1500,   false, true, true),
      ('Switchblade',       'Fast and concealable. +5 attack.',                             'weapon',   8000,   false, true, true),
      ('Baseball Bat',      'The classic persuader. +10 attack.',                           'weapon',   25000,  false, true, true),
      ('Sawn-off Shotgun',  'Illegal in most states. +20 attack.',                          'weapon',   100000, false, true, true),
      ('Assault Rifle',     'Military-grade firepower. +40 attack.',                        'weapon',   500000, false, true, true),
      ('Katana',            'Deadly precision blade. +30 attack.',                          'weapon',   250000, false, true, true),
      ('Taser',             'Non-lethal but effective. +8 attack, 50% stun chance.',         'weapon',   45000,  false, true, true),
      ('Molotov Cocktail',  'Area denial. +15 attack, may cause burning.',                   'weapon',   60000,  false, true, true)
  `);

  // ── Armor ──────────────────────────────────────────────
  pgm.sql(`
    INSERT INTO items (name, description, category, base_price, usable, sellable, tradeable) VALUES
      ('Leather Jacket',    'Basic protection. +2 defense.',                                 'armor',    2000,   false, true, true),
      ('Kevlar Vest',       'Stops most handgun rounds. +10 defense.',                       'armor',    50000,  false, true, true),
      ('Reinforced Coat',   'Hidden plating. +5 defense.',                                    'armor',    15000,  false, true, true),
      ('Urban Camo Gear',   'Blend into the city. +8 defense, harder to spot.',              'armor',    80000,  false, true, true)
  `);

  // ── Drugs (consumables) ───────────────────────────────
  pgm.sql(`
    INSERT INTO items (name, description, category, base_price, usable, sellable, tradeable) VALUES
      ('First Aid Kit',     'Restore 25 life instantly.',                                    'medical',  5000,   true, true, true),
      ('Painkillers',       'Restore 15 life. Reduces pain effects.',                        'medical',  3000,   true, true, true),
      ('Antibiotics',       'Prevent infection from crit fails. Lasts 24h.',                 'medical',  12000,  true, true, true),
      ('Adrenaline Shot',   'Temporary +10 strength for 30 minutes.',                        'medical',  20000,  true, true, true),
      ('Energy Drink',      'Restore 20 energy instantly.',                                   'drug',     1000,   true, true, true),
      ('Nerve Tonic',       'Restore 10 nerve instantly.',                                    'drug',     15000,  true, true, true),
      ('Smoke Grenade',     'Escape from combat. Single use.',                                'misc',     2500,   true, true, true)
  `);

  // ── Misc ──────────────────────────────────────────────
  pgm.sql(`
    INSERT INTO items (name, description, category, base_price, usable, sellable, tradeable) VALUES
      ('Lockpicks',         '+15 success on B&E crimes. Consumed on use.',                   'misc',     10000,  true, true, true),
      ('Disguise Kit',      'Reduce jail time by 30%. Single use.',                           'misc',     35000,  true, true, true),
      ('Burner Phone',      'Untraceable. Reduces chance of being identified.',               'misc',     5000,   true, true, true),
      ('Fake ID',           'Access to restricted areas. Single event use.',                  'misc',     20000,  true, true, true),
      ('Jail Keycard',      'Bust yourself out of jail. Single use.',                         'misc',     75000,  true, true, true),
      ('Encrypted Drive',   'Contains valuable data. Can be sold for high profit.',            'misc',     40000,  false, true, true)
  `);
};

exports.down = (pgm) => {
  pgm.sql("DELETE FROM items");
};

exports.shorthands = undefined;
