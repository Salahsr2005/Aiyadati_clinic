import { api } from "@/lib/api";
import { applyMeta, normalizeList, type ListResult } from "@/lib/adminApi";

export interface SpecialtyRow {
  id: string;
  nameFr?: string;
  nameAr?: string;
  descriptionFr?: string;
  descriptionAr?: string;
  imageUrl?: string | null;
  iconUrl?: string | null;
  isArchived?: boolean;
  doctorsCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SpecialtyListParams {
  page?: number;
  limit?: number;
  search?: string;
  includeArchived?: boolean;
}

export interface SpecialtyInput {
  nameFr: string;
  nameAr: string;
  descriptionFr?: string;
  descriptionAr?: string;
}

function cleanParams(p: Record<string, unknown>) {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(p)) {
    if (v === undefined || v === null || v === "") continue;
    if (typeof v === "boolean") out[k] = v ? "true" : "false";
    else out[k] = v as string | number;
  }
  return out;
}

export const specialtyApi = {
  list: async (params: SpecialtyListParams = {}): Promise<ListResult<SpecialtyRow>> => {
    const res = await api.get("/specialty/v1", {
      params: cleanParams(params as Record<string, unknown>),
    });
    const meta = (res as unknown as { meta?: unknown }).meta;
    return applyMeta(normalizeList<SpecialtyRow>(res.data, params.page ?? 1, params.limit ?? 20), meta);
  },
  getById: async (id: string): Promise<SpecialtyRow> => {
    const res = await api.get(`/specialty/v1/${id}`);
    return res.data as SpecialtyRow;
  },
  create: async (payload: SpecialtyInput | FormData): Promise<SpecialtyRow> => {
    const res = await api.post("/specialty/v1", payload);
    return res.data as SpecialtyRow;
  },
  update: async (id: string, payload: Partial<SpecialtyInput> | FormData): Promise<SpecialtyRow> => {
    const res = await api.patch(`/specialty/v1/${id}`, payload);
    return res.data as SpecialtyRow;
  },
  remove: async (id: string) => {
    const res = await api.delete(`/specialty/v1/${id}`);
    return res.data;
  },
  restore: async (id: string): Promise<SpecialtyRow> => {
    const res = await api.post(`/specialty/v1/${id}/restore`, {});
    return res.data as SpecialtyRow;
  },
};
