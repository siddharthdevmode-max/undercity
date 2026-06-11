import { publicCall } from "./api";

export interface LeaderboardEntry {
  rank: number;
  id: number;
  username: string;
  level: number;
  value: number;
}

export interface LeaderboardResponse {
  data: LeaderboardEntry[];
  total: number;
  page: number;
  limit: number;
  offset: number;
}

export const leaderboardAPI = {
  get: (type: "level" | "money" | "crimes" | "points", page = 1, limit = 20): Promise<LeaderboardResponse> =>
    publicCall(`/v1/leaderboard/${type}?page=${page}&limit=${limit}`),
};
