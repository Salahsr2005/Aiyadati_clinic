import { api } from "@/lib/api";

export interface ReviewRow {
  id: string;
  rating: number;
  comment?: string | null;
  review?: string | null;
  response?: string | null;
  userId?: string;
  patientId?: string;
  doctorId?: string;
  clinicId?: string;
  isVisible?: boolean;
  user?: { id: string; firstName?: string; lastName?: string; avatarUrl?: string };
  patient?: { id: string; firstName?: string; lastName?: string; avatarUrl?: string };
  createdAt: string;
  updatedAt?: string;
}

export interface ReviewStats {
  average?: number;
  avgRating?: number;
  count?: number;
  totalReviews?: number;
  reviewVisibility?: string;
  distribution?: Record<string, number> | Array<{ stars: number; count: number }>;
}

export const reviewsApi = {
  doctor: async (doctorId: string): Promise<ReviewRow[]> => {
    try {
      const res = await api.get(`/review/v1/doctor/${doctorId}`);
      const raw = res.data;
      if (Array.isArray(raw)) return raw;
      if (raw && typeof raw === "object" && Array.isArray((raw as any).items)) return (raw as any).items;
      if (raw && typeof raw === "object" && Array.isArray((raw as any).data)) return (raw as any).data;
      return [];
    } catch {
      return [];
    }
  },
  doctorStats: async (doctorId: string): Promise<ReviewStats> => {
    try {
      const res = await api.get(`/review/v1/doctor/${doctorId}/stats`);
      return (res.data as ReviewStats) ?? {};
    } catch {
      return {};
    }
  },
  setVisibility: (payload: { reviewVisibility: string }) =>
    api.patch("/review/v1/doctor/me/visibility", payload).then((r) => r.data),

  clinic: async (clinicId: string): Promise<ReviewRow[]> => {
    try {
      const res = await api.get(`/review/v1/clinic/${clinicId}`);
      const raw = res.data;
      if (Array.isArray(raw)) return raw;
      if (raw && typeof raw === "object" && Array.isArray((raw as any).items)) return (raw as any).items;
      return [];
    } catch {
      return [];
    }
  },
  clinicStats: async (clinicId: string): Promise<ReviewStats> => {
    try {
      const res = await api.get(`/review/v1/clinic/${clinicId}/stats`);
      return (res.data as ReviewStats) ?? {};
    } catch {
      return {};
    }
  },
  setClinicVisibility: async (payload: { isVisible: boolean }) => {
    return api.patch<unknown, { reviewsVisible: boolean }>('/review/v1/clinic/me/visibility', payload);
  },
  respondToReview: async (reviewId: string, payload: { response: string }): Promise<ReviewRow> => {
    return api.post<unknown, ReviewRow>(`/review/v1/clinic/me/${reviewId}/response`, payload);
  },
};
