/* eslint-disable camelcase */

exports.up = (pgm) => {
  pgm.addColumns("users", {
    energy: { type: "integer", notNull: true, default: 100 },
    max_energy: { type: "integer", notNull: true, default: 100 },
    happiness: { type: "integer", notNull: true, default: 50 },
    hospital_until: { type: "timestamptz", default: null }
  });
};

exports.down = (pgm) => {
  pgm.dropColumns("users", [
    "energy",
    "max_energy",
    "happiness",
    "hospital_until"
  ]);
};
