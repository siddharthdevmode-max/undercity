/**
 * Migration: ensure all soft-deleted users have anonymized usernames
 * Fixes any accounts deleted before the username-release fix was deployed
 */
exports.up = async (db) => {
  // Find deleted users who still have their original username (not anonymized)
  await db.query(`
    UPDATE users
    SET username = CONCAT('deleted_', id::text)
    WHERE deleted_at IS NOT NULL
      AND username NOT LIKE 'deleted_%'
  `);
};

exports.down = async (_db) => {
  // Cannot reverse — original usernames are gone
};
