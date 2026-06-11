import { apiCall } from "./api";

export interface Gang { id: number; name: string; tag: string; description: string; leader_id: number; bank: number; respect: number; created_at: string; member_count?: string; }
export interface Member { id: number; user_id: number; role: string; joined_at: string; username: string; }
export interface Alliance { id: number; gang_a_id: number; gang_b_id: number; status: string; created_at: string; gang_name: string; gang_tag: string; }
export interface War { id: number; attacker_id: number; defender_id: number; status: string; attacker_score: number; defender_score: number; started_at: string; ended_at: string | null; attacker_name: string; defender_name: string; }

export const gangsAPI = {
  list: (): Promise<Gang[]> => apiCall("/gang/list"),
  my: (): Promise<{ gang: Gang | null; members?: Member[] }> => apiCall("/gang/my"),
  create: (name: string, tag: string, description: string): Promise<Gang> => apiCall("/gang/create", { method: "POST", body: JSON.stringify({ name, tag, description }) }),
  join: (gangId: number): Promise<{ message: string }> => apiCall("/gang/join", { method: "POST", body: JSON.stringify({ gangId }) }),
  leave: (): Promise<{ message: string }> => apiCall("/gang/leave", { method: "POST" }),
  kick: (userId: number): Promise<{ message: string }> => apiCall("/gang/kick", { method: "POST", body: JSON.stringify({ userId }) }),
  getAlliances: (): Promise<{ alliances: Alliance[] }> => apiCall("/linked-gangs"),
  requestAlliance: (gangId: number): Promise<{ message: string }> => apiCall("/linked-gangs/request", { method: "POST", body: JSON.stringify({ gangId }) }),
  respondAlliance: (allianceId: number, accept: boolean): Promise<{ message: string }> => apiCall("/linked-gangs/respond", { method: "POST", body: JSON.stringify({ allianceId, accept }) }),
  getWars: (): Promise<{ wars: War[] }> => apiCall("/gang-wars"),
  declareWar: (gangId: number): Promise<{ message: string }> => apiCall("/gang-wars/declare", { method: "POST", body: JSON.stringify({ gangId }) }),
};
