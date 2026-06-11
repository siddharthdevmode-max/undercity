import { apiCall } from "./api";

export interface PlayResult {
  game: string;
  bet: number;
  payout: number;
  result: string;
  message: string;
  money: number;
}

export const casinoAPI = {
  play: (game: string, bet: number): Promise<PlayResult> => apiCall("/casino/play", {
    method: "POST", body: JSON.stringify({ game, bet }),
  }),
};
