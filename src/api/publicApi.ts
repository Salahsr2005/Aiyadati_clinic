import { api } from "@/lib/api";
import { applyMeta, normalizeList, type ListResult } from "@/lib/adminApi";

/* ------------------------------------------------------------------ *
 * Public marketplace API — unauthenticated /public/v1/* endpoints
 * used to browse clinics from the doctor portal without staff scope.
 * ------------------------------------------------------------------ */

export interface PublicClinicRow {
  id: string;
  nameFr?: string;
  nameAr?: string;
  phone?: string;
  logoUrl?: string | null;
  descriptionFr?: string | null;
  descriptionAr?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isCompleted?: boolean;
  wilaya?: { id: string; code?: number; nameFr?: string; nameAr?: string } | null;
  baladya?: { id: string; nameFr?: string; nameAr?: string } | null;
}

export interface PublicClinicListParams {
  search?: string;
  wilayaId?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PublicClinicDoctor {
  id: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  specialty?: { id: string; nameFr?: string; nameAr?: string } | null;
  avatarUrl?: string | null;
}

export interface PublicClinicGalleryImage {
  id: string;
  url: string;
  caption?: string | null;
}

function clean(p: Record<string, unknown>) {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(p)) {
    if (v === undefined || v === null || v === "") continue;
    out[k] = typeof v === "boolean" ? String(v) : (v as string | number);
  }
  return out;
}

function safeArray<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && Array.isArray((data as any).items)) return (data as any).items as T[];
  if (data && typeof data === "object" && Array.isArray((data as any).data)) return (data as any).data as T[];
  return [];
}

export const publicClinicsApi = {
  list: async (params: PublicClinicListParams = {}): Promise<ListResult<PublicClinicRow>> => {
    const res = await api.get("/public/v1/clinics", {
      params: clean(params as Record<string, unknown>),
    });
    const meta = (res as unknown as { meta?: unknown }).meta;
    return applyMeta(
      normalizeList<PublicClinicRow>(res.data, params.page ?? 1, params.limit ?? 20),
      meta,
    );
  },

  getById: async (id: string): Promise<PublicClinicRow> => {
    const res = await api.get(`/public/v1/clinics/${id}`);
    return res.data as PublicClinicRow;
  },

  getDoctors: async (id: string): Promise<PublicClinicDoctor[]> => {
    try {
      const res = await api.get(`/public/v1/clinics/${id}/doctors`);
      return safeArray<PublicClinicDoctor>(res.data);
    } catch {
      return [];
    }
  },

  getGallery: async (id: string): Promise<PublicClinicGalleryImage[]> => {
    try {
      const res = await api.get(`/public/v1/clinics/${id}/gallery`);
      return safeArray<PublicClinicGalleryImage>(res.data);
    } catch {
      return [];
    }
  },
};
