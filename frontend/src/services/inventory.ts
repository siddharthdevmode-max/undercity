import { apiCall } from "./api";

export interface InventoryItem {
  id: number;
  user_id: number;
  item_id: number;
  quantity: number;
  acquired_at: string;
  item_name: string;
  item_description: string;
  item_category: string;
  item_usable: boolean;
  item_base_price: number;
}

export interface InventoryResponse {
  data: InventoryItem[];
  total: number;
  page: number;
  limit: number;
  offset: number;
}

export interface UseItemResponse {
  message: string;
  effects: Record<string, number>;
  remaining: number;
}

export interface DropItemResponse {
  message: string;
}

export const inventoryAPI = {
  getInventory: (params?: {
    page?: number;
    limit?: number;
    category?: string;
  }): Promise<InventoryResponse> => {
    const search = new URLSearchParams();
    if (params?.page) search.set("page", String(params.page));
    if (params?.limit) search.set("limit", String(params.limit));
    if (params?.category) search.set("category", params.category);
    const qs = search.toString();
    return apiCall(`/inventory${qs ? `?${qs}` : ""}`);
  },

  useItem: (itemId: number, quantity = 1): Promise<UseItemResponse> =>
    apiCall("/inventory/use", {
      method: "POST",
      body: JSON.stringify({ itemId, quantity }),
    }),

  dropItem: (itemId: number, quantity = 1): Promise<DropItemResponse> =>
    apiCall("/inventory/drop", {
      method: "POST",
      body: JSON.stringify({ itemId, quantity }),
    }),
};
