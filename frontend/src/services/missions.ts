import { apiCall } from "./api";

export interface Mission { id: number; name: string; description: string; objectives: unknown; rewards: unknown; min_level: number; repeatable: boolean; cooldown_h: number; status: string | null; progress: unknown; }

export const missionsAPI = {
  getAvailable: (): Promise<{ missions: Mission[] }> => apiCall("/missions/available"),
  start: (missionId: number): Promise<unknown> => apiCall("/missions/start", { method: "POST", body: JSON.stringify({ missionId }) }),
};
