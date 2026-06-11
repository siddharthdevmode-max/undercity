import { apiCall } from "./api";

export interface BankBalance {
  money: number;
  points: number;
}

export interface BankUser {
  id: number;
  username: string;
  money: number;
  points: number;
}

export interface BankTransaction {
  id: number;
  user_id: number;
  type: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  reference_type: string | null;
  reference_id: string | null;
  description: string | null;
  created_at: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  offset: number;
}

export interface DepositResponse {
  message: string;
  user: BankUser;
}

export interface WithdrawResponse {
  message: string;
  user: BankUser;
}

export interface TransferResponse {
  message: string;
  sender: BankUser;
  recipient: BankUser;
  taxPaid: number;
}

export const bankAPI = {
  getBalance: (): Promise<BankBalance> =>
    apiCall("/bank/balance"),

  deposit: (amount: number): Promise<DepositResponse> =>
    apiCall("/bank/deposit", {
      method: "POST",
      body: JSON.stringify({ amount }),
    }),

  withdraw: (amount: number): Promise<WithdrawResponse> =>
    apiCall("/bank/withdraw", {
      method: "POST",
      body: JSON.stringify({ amount }),
    }),

  transfer: (username: string, amount: number): Promise<TransferResponse> =>
    apiCall("/bank/transfer", {
      method: "POST",
      body: JSON.stringify({ username, amount }),
    }),

  getHistory: (page = 1, limit = 20): Promise<PaginatedResponse<BankTransaction>> =>
    apiCall(`/bank/history?page=${page}&limit=${limit}`),
};
