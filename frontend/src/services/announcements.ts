import { apiCall } from "./api";

export interface Announcement {
  id: number;
  title: string;
  body: string;
  priority: "low" | "normal" | "high" | "critical";
  active: boolean;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export const announcementsAPI = {
  getActive: (): Promise<{ announcements: Announcement[] }> =>
    apiCall("/v1/announcements"),

  getAll: (): Promise<{ announcements: Announcement[] }> =>
    apiCall("/v1/announcements/all"),

  create: (data: { title: string; body: string; priority?: string; active?: boolean }): Promise<{ announcement: Announcement }> =>
    apiCall("/v1/announcements", { method: "POST", body: JSON.stringify(data) }),

  update: (id: number, data: Partial<Announcement>): Promise<{ announcement: Announcement }> =>
    apiCall(`/v1/announcements/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  delete: (id: number): Promise<{ success: boolean }> =>
    apiCall(`/v1/announcements/${id}`, { method: "DELETE" }),
};
