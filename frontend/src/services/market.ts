import { apiCall } from "./api";

export interface MarketListing {
  id: number;
  seller_id: number;
  item_id: number;
  quantity: number;
  quantity_left: number;
  price_per_unit: number;
  sold: boolean;
  listed_at: string;
  expires_at: string;
  item_name: string;
  category: string;
  seller_username: string;
}

export interface MarketListingsResponse {
  data: MarketListing[];
  total: number;
  page: number;
  limit: number;
  offset: number;
}

export interface MyListingsResponse {
  listings: MarketListing[];
}

export interface ListItemResponse {
  message: string;
  listing: MarketListing;
}

export interface BuyItemResponse {
  message: string;
  listing: MarketListing;
  totalCost: number;
}

export interface CancelListingResponse {
  message: string;
}

export const marketAPI = {
  getListings: (params?: {
    page?: number;
    limit?: number;
    q?: string;
    category?: string;
    sort?: string;
    order?: string;
  }): Promise<MarketListingsResponse> => {
    const search = new URLSearchParams();
    if (params?.page) search.set("page", String(params.page));
    if (params?.limit) search.set("limit", String(params.limit));
    if (params?.q) search.set("q", params.q);
    if (params?.category) search.set("category", params.category);
    if (params?.sort) search.set("sort", params.sort);
    if (params?.order) search.set("order", params.order);
    const qs = search.toString();
    return apiCall(`/market/listings${qs ? `?${qs}` : ""}`);
  },

  getMyListings: (): Promise<MyListingsResponse> =>
    apiCall("/market/my-listings"),

  listItem: (itemId: number, quantity: number, price: number): Promise<ListItemResponse> =>
    apiCall("/market/list", {
      method: "POST",
      body: JSON.stringify({ itemId, quantity, price }),
    }),

  buyItem: (listingId: number): Promise<BuyItemResponse> =>
    apiCall(`/market/buy/${listingId}`, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  cancelListing: (listingId: number): Promise<CancelListingResponse> =>
    apiCall(`/market/listing/${listingId}`, {
      method: "DELETE",
      body: JSON.stringify({}),
    }),
};
