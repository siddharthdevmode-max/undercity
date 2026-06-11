import { apiCall } from "./api";

export interface Property {
  id: number;
  name: string;
  description: string;
  price: number;
  daily_income: number;
  min_level: number;
  canAfford: boolean;
  unlocked: boolean;
  owned: boolean;
}

export interface PropertiesResponse {
  properties: Property[];
  owned: number[];
}

export interface CollectResult {
  message: string;
  totalIncome: number;
  money: number;
}

export const propertiesAPI = {
  list: (): Promise<PropertiesResponse> => apiCall("/properties"),
  buy: (propertyId: number): Promise<{ message: string; property: Property; money: number }> => apiCall("/properties/buy", {
    method: "POST", body: JSON.stringify({ propertyId }),
  }),
  collect: (): Promise<CollectResult> => apiCall("/properties/collect", { method: "POST" }),
};
