import { api } from "@/lib/api";

export interface CurrentPriceResponse {
  price: number;
  updatedAt?: string;
}

export interface CreditPriceHistoryResponse {
  id: string;
  price: number;
  createdAt: string;
  updatedAt?: string;
}

export interface UpdatePriceResponse {
  oldPrice: number;
  newPrice: number;
  updatedAt?: string;
}

export const creditApi = {
  getCurrentPrice: async (): Promise<CurrentPriceResponse> => {
    const res = await api.get("/credit/v1/current");
    return res.data as CurrentPriceResponse;
  },

  getPriceHistory: async (limit?: number): Promise<CreditPriceHistoryResponse[]> => {
    const res = await api.get("/credit/v1/history", {
      params: limit ? { limit } : undefined,
    });
    return res.data as CreditPriceHistoryResponse[];
  },

  getAllPrices: async (): Promise<CreditPriceHistoryResponse[]> => {
    const res = await api.get("/credit/v1/all");
    return res.data as CreditPriceHistoryResponse[];
  },

  updatePrice: async (price: number): Promise<UpdatePriceResponse> => {
    const res = await api.put("/credit/v1/", { price });
    return res.data as UpdatePriceResponse;
  },
};
