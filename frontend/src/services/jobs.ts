import { apiCall } from "./api";

export interface Job {
  id: number;
  name: string;
  description: string;
  pay: number;
  energy_cost: number;
  min_level: number;
  min_stats: number;
  qualified: boolean;
}

export interface JobsResponse {
  jobs: Job[];
  currentJob: (Job & { started_at: string }) | null;
}

export interface WorkResult {
  message: string;
  pay: number;
  energyCost: number;
  energy: number;
  money: number;
}

export const jobsAPI = {
  list: (): Promise<JobsResponse> => apiCall("/jobs"),
  apply: (jobId: number): Promise<{ message: string; job: Job }> => apiCall("/jobs/apply", {
    method: "POST", body: JSON.stringify({ jobId }),
  }),
  work: (): Promise<WorkResult> => apiCall("/jobs/work", { method: "POST" }),
  quit: (): Promise<{ message: string }> => apiCall("/jobs/quit", { method: "POST" }),
};
