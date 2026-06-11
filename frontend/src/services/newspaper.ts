import { apiCall } from "./api";

export interface Article { id: number; title: string; content: string; category: string; important: boolean; created_at: string; }

export const newspaperAPI = {
  getArticles: (category?: string, page?: number): Promise<{ articles: Article[]; total: number }> => {
    const p = new URLSearchParams();
    if (category) p.set("category", category);
    if (page) p.set("page", String(page));
    return apiCall(`/newspaper/articles?${p}`);
  },
};
