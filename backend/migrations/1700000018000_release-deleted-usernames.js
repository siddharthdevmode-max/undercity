exports.up = async function (db) {
  await db.query(`
    UPDATE users
    SET username = CONCAT('deleted_', id::text)
    WHERE deleted_at IS NOT NULL
      AND username NOT LIKE 'deleted_%'
      AND COALESCE(is_admin, false) = false
      AND COALESCE(is_developer, false) = false
  `);
};

exports.down = async function () {
  // irreversible
};
