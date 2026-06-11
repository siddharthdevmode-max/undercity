import { apiCall } from "./api";

export interface ReferralStats {
  totalReferrals: number;
  totalEarned: number;
  referralCode: string | null;
}

export const referralAPI = {
  getCode: (): Promise<{ referralCode: string }> => apiCall("/referral/my-code"),
  applyCode: (code: string): Promise<{ message: string; bonusCash: number; bonusXp: number }> => apiCall("/referral/apply", {
    method: "POST", body: JSON.stringify({ code }),
  }),
  getStats: (): Promise<ReferralStats> => apiCall("/referral/stats"),
};
