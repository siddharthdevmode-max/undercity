import { pool } from "../config/database";

export interface LeaderboardEntry {
  rank: number;
  id: number;
  username: string;
  level: number;
  value: number;
}

export async function getLeaderboard(
  type: "level" | "money" | "crimes" | "points",
  limit = 20,
  offset = 0
): Promise<{ entries: LeaderboardEntry[]; total: number }> {
  let orderCol: string;
  let joinClause = "";

  switch (type) {
    case "level":
      orderCol = "u.level DESC, u.points DESC";
      break;
    case "money":
      orderCol = "u.money DESC";
      break;
    case "points":
      orderCol = "u.points DESC";
      break;
    case "crimes":
      joinClause = `JOIN (
        SELECT user_id, SUM(attempts) AS total_crimes
        FROM crime_progress GROUP BY user_id
      ) cp ON cp.user_id = u.id`;
      orderCol = "cp.total_crimes DESC";
      break;
    default:
      orderCol = "u.level DESC";
  }

  const valueCol = type === "crimes" ? "cp.total_crimes"
    : type === "level" ? "u.level"
    : type === "money" ? "u.money"
    : "u.points";

  const [countR, rowsR] = await Promise.all([
    pool.query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM users u WHERE u.deleted_at IS NULL`
    ),
    pool.query(
      `SELECT u.id, u.username, u.level, ${valueCol} AS value
       FROM users u ${joinClause}
       WHERE u.deleted_at IS NULL
       ORDER BY ${orderCol}
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    ),
  ]);

  const entries: LeaderboardEntry[] = rowsR.rows.map((row: Record<string, unknown>, i: number) => ({
    rank: offset + i + 1,
    id: row["id"] as number,
    username: row["username"] as string,
    level: row["level"] as number,
    value: row["value"] as number,
  }));

  return { entries, total: countR.rows[0]?.total ?? 0 };
}
