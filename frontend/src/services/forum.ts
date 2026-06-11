import { apiCall } from "./api";

export interface Category {
  id: number; name: string; description: string; sort_order: number; thread_count: string; last_post: string | null;
}
export interface Thread {
  id: number; category_id: number; title: string; content: string; is_pinned: boolean; is_locked: boolean;
  created_at: string; updated_at: string; username: string; post_count: string;
}
export interface Post {
  id: number; content: string; created_at: string; username: string;
}

export const forumAPI = {
  getCategories: (): Promise<{ categories: Category[] }> => apiCall("/forum/categories"),
  getThreads: (categoryId?: number, page?: number): Promise<{ threads: Thread[]; total: number }> => {
    const params = new URLSearchParams();
    if (categoryId) params.set("category", String(categoryId));
    if (page) params.set("page", String(page));
    return apiCall(`/forum/threads?${params}`);
  },
  getThread: (id: number): Promise<{ thread: Thread; posts: Post[] }> => apiCall(`/forum/threads/${id}`),
  createThread: (categoryId: number, title: string, content: string): Promise<Thread> => apiCall("/forum/threads", {
    method: "POST", body: JSON.stringify({ categoryId, title, content }),
  }),
  reply: (threadId: number, content: string): Promise<Post> => apiCall(`/forum/threads/${threadId}/reply`, {
    method: "POST", body: JSON.stringify({ content }),
  }),
};
