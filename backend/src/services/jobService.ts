import { pool } from "../config/database";
import { ValidationError, NotFoundError } from "../utils/errors";

export async function listJobs(userId: number): Promise<{ jobs: unknown[]; currentJob: unknown | null }> {
  const userR = await pool.query<{ id: number; level: number; strength: number }>(
    `SELECT id, level, strength FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`, [userId]
  );
  if (userR.rows.length === 0) throw new NotFoundError("User");
  const user = userR.rows[0];

  const jobsR = await pool.query(
    `SELECT * FROM jobs WHERE is_active = TRUE ORDER BY min_level ASC`
  );

  const currentR = await pool.query(
    `SELECT j.*, uj.started_at FROM user_jobs uj
     JOIN jobs j ON j.id = uj.job_id WHERE uj.user_id = $1 LIMIT 1`,
    [userId]
  );

  const jobs = jobsR.rows.map((j: Record<string, unknown>) => ({
    ...j,
    qualified: user.level >= (j.min_level as number) && user.strength >= (j.min_stats as number),
  }));

  return { jobs, currentJob: currentR.rows[0] ?? null };
}

export async function applyJob(userId: number, jobId: number): Promise<{ message: string; job: unknown }> {
  const userR = await pool.query<{ id: number; level: number; strength: number }>(
    `SELECT id, level, strength FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`, [userId]
  );
  if (userR.rows.length === 0) throw new NotFoundError("User");
  const user = userR.rows[0];

  const jobR = await pool.query(`SELECT * FROM jobs WHERE id = $1 AND is_active = TRUE LIMIT 1`, [jobId]);
  if (jobR.rows.length === 0) throw new NotFoundError("Job");
  const job = jobR.rows[0] as Record<string, unknown>;

  if (user.level < (job.min_level as number)) {
    throw new ValidationError(`Need level ${job.min_level} for this job`);
  }
  if (user.strength < (job.min_stats as number)) {
    throw new ValidationError(`Need ${job.min_stats} strength for this job`);
  }

  const existingR = await pool.query(`SELECT id FROM user_jobs WHERE user_id = $1 LIMIT 1`, [userId]);
  if (existingR.rows.length > 0) {
    await pool.query(`UPDATE user_jobs SET job_id = $2, started_at = NOW() WHERE user_id = $1`, [userId, jobId]);
  } else {
    await pool.query(`INSERT INTO user_jobs (user_id, job_id) VALUES ($1, $2)`, [userId, jobId]);
  }

  return { message: `You now work as a ${job.name}`, job };
}

export async function work(userId: number): Promise<{ message: string; pay: number; energyCost: number; energy: number; money: number }> {
  const userR = await pool.query(
    `SELECT u.id, u.energy, u.money, j.name AS job_name, j.pay, j.energy_cost
     FROM users u
     JOIN user_jobs uj ON uj.user_id = u.id
     JOIN jobs j ON j.id = uj.job_id
     WHERE u.id = $1 AND u.deleted_at IS NULL LIMIT 1`,
    [userId]
  );

  if (userR.rows.length === 0) throw new ValidationError("You don't have a job. Apply at the job center first.");

  const row = userR.rows[0] as { id: number; energy: number; money: number; job_name: string; pay: number; energy_cost: number };

  if (row.energy < row.energy_cost) {
    throw new ValidationError(`Need ${row.energy_cost} energy to work. You have ${row.energy}.`);
  }

  await pool.query(
    `UPDATE users SET money = money + $2, energy = energy - $3, updated_at = NOW() WHERE id = $1`,
    [userId, row.pay, row.energy_cost]
  );

  return {
    message: `You worked as a ${row.job_name} and earned $${row.pay.toLocaleString()}`,
    pay: row.pay,
    energyCost: row.energy_cost,
    energy: row.energy - row.energy_cost,
    money: row.money + row.pay,
  };
}

export async function quitJob(userId: number): Promise<{ message: string }> {
  const result = await pool.query(`DELETE FROM user_jobs WHERE user_id = $1`, [userId]);
  if (result.rowCount === 0) throw new ValidationError("You don't have a job");
  return { message: "You quit your job" };
}
