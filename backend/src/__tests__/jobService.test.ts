import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../config/database", () => ({ pool: { query: vi.fn() }, withTransaction: vi.fn() }));
vi.mock("../utils/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { pool } from "../config/database";
import { listJobs, applyJob, work, quitJob } from "../services/jobService";

describe("jobService", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe("listJobs", () => {
    it("returns jobs with qualification status", async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({ rows: [{ id: 1, level: 5, strength: 50 }], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rows: [{ id: 10, name: "Test Job", description: "", pay: 1000, energy_cost: 10, min_level: 5, min_stats: 50 }], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rows: [{ id: 1, job_id: 5 }], rowCount: 1 } as never);
      const result = await listJobs(1);
      expect(result.jobs.length).toBeGreaterThan(0);
      expect(result.currentJob).toBeDefined();
    });
  });

  describe("applyJob", () => {
    it("applies when qualified", async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({ rows: [{ id: 1, level: 5, strength: 100 }], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rows: [{ id: 10, name: "Bouncer", min_level: 5, min_stats: 50 }], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never)
        .mockResolvedValueOnce({ rowCount: 1 } as never);
      const result = await applyJob(1, 10);
      expect(result.job.name).toBe("Bouncer");
    });

    it("throws if not qualified", async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({ rows: [{ id: 1, level: 2, strength: 10 }], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rows: [{ id: 10, name: "Bouncer", min_level: 5, min_stats: 50 }], rowCount: 1 } as never);
      await expect(applyJob(1, 10)).rejects.toThrow(/level|stat/i);
    });
  });

  describe("work", () => {
    it("returns pay when energy sufficient", async () => {
      vi.mocked(pool.query)
        .mockResolvedValueOnce({ rows: [{ id: 1, energy: 50, money: 10000, job_name: "Bouncer", pay: 2000, energy_cost: 10 }], rowCount: 1 } as never)
        .mockResolvedValueOnce({ rowCount: 1 } as never);
      const result = await work(1);
      expect(result.pay).toBe(2000);
    });

    it("throws if no current job", async () => {
      vi.mocked(pool.query).mockResolvedValueOnce({ rows: [], rowCount: 0 } as never);
      await expect(work(1)).rejects.toThrow(/job/i);
    });
  });

  describe("quitJob", () => {
    it("quits current job", async () => {
      vi.mocked(pool.query).mockResolvedValueOnce({ rowCount: 1 } as never);
      await expect(quitJob(1)).resolves.not.toThrow();
    });
  });
});
