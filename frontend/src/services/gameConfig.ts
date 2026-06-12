import { apiCall } from "./api";

export interface GameConfigEntry {
  key: string;
  value: string;
  type: "string" | "number" | "boolean" | "json";
  label: string;
  description: string;
  updated_at: string;
}

export const gameConfigAPI = {
  getPublic: (): Promise<{ config: Record<string, unknown> }> =>
    apiCall("/v1/game-config"),

  getAll: (): Promise<{ config: GameConfigEntry[] }> =>
    apiCall("/v1/game-config/all"),

  update: (key: string, value: unknown): Promise<{ config: GameConfigEntry }> =>
    apiCall(`/v1/game-config/${encodeURIComponent(key)}`, {
      method: "PATCH",
      body: JSON.stringify({ value }),
    }),
};
