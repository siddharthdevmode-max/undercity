import { apiCall } from "./api";

export interface TierInfo {
  tier: string;
  label: string;
  price: number;
  duration_days: number;
  nerve_regen_rate: string;
  energy_regen_rate: string;
  features: string[];
  is_subscription: boolean;
}

export interface TiersResponse {
  tiers: TierInfo[];
  payments_enabled: boolean;
  current_tier?: string;
}

export interface CheckoutResponse {
  url: string;
}

export const paymentsAPI = {
  getTiers: (): Promise<TiersResponse> =>
    apiCall("/v1/payments/tiers"),

  getCheckoutUrl: (tier: "citizen" | "contributor"): Promise<CheckoutResponse> =>
    apiCall(`/v1/payments/checkout?tier=${encodeURIComponent(tier)}`),
};
