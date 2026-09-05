import { api } from "@/lib/api";
import { applyMeta, normalizeList, type ListResult } from "@/lib/adminApi";

export interface DoctorSpecialty {
  id: string;
  doctorId?: string;
  specialtyId?: string;
  specialty?: {
    id: string;
    nameFr?: string;
    nameAr?: string;
    descriptionFr?: string | null;
    descriptionAr?: string | null;
    imagePath?: string | null;
    iconUrl?: string | null;
  };
}

export interface DoctorRow {
  id: string;
  email: string;
  firstNameFr?: string;
  firstNameAr?: string;
  lastNameFr?: string;
  lastNameAr?: string;
  phone?: string;
  wilayaId?: string;
  wilaya?: { id: string; code?: number; nameFr?: string; nameAr?: string };
  baladyaId?: string | null;
  baladya?: { id: string; nameFr?: string; nameAr?: string } | null;
  bioFr?: string;
  bioAr?: string;
  photoPath?: string;
  photoUrl?: string;
  yearsOfExp?: number;
  practiceType?: "INDEPENDENT" | "CLINIC_BASED" | "BOTH" | string;
  latitude?: number;
  longitude?: number;
  specialties?: DoctorSpecialty[];
  isVerified: boolean;
  isSuspended: boolean;
  isRegistered?: boolean;
  isCompleted?: boolean;
  rejectionReason?: string | null;
  rating?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface DoctorListParams {
  search?: string;
  wilayaId?: string;
  specialtyId?: string;
  practiceType?: string;
  isVerified?: boolean;
  isSuspended?: boolean;
  isCompleted?: boolean;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface CreateDoctorInput {
  email: string;
  password?: string;
  firstNameFr: string;
  firstNameAr: string;
  lastNameFr: string;
  lastNameAr: string;
  phone: string;
  wilayaId: string;
  specialtyIds?: string[];
}

export interface DoctorUpdateInput {
  firstNameFr?: string;
  firstNameAr?: string;
  lastNameFr?: string;
  lastNameAr?: string;
  phone?: string;
  email?: string;
  wilayaId?: string;
  specialtyIds?: string[];
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

export const doctorsApi = {
  list: async (params: DoctorListParams = {}): Promise<ListResult<DoctorRow>> => {
    const res = await api.get("/doctor/v1", {
      params: cleanParams(params as unknown as Record<string, unknown>),
    });
    const meta = (res as unknown as { meta?: unknown }).meta;
    return applyMeta(normalizeList<DoctorRow>(res.data, params.page ?? 1, params.limit ?? 20), meta);
  },
  getById: async (id: string): Promise<DoctorRow> => {
    const res = await api.get(`/doctor/v1/${id}`);
    return res.data as DoctorRow;
  },
  create: async (payload: CreateDoctorInput): Promise<DoctorRow> => {
    const res = await api.post("/doctor/v1", payload);
    return res.data as DoctorRow;
  },
  update: async (id: string, patch: DoctorUpdateInput): Promise<DoctorRow> => {
    const res = await api.patch(`/doctor/v1/${id}`, patch);
    return res.data as DoctorRow;
  },
  verify: async (id: string) => {
    const res = await api.post(`/doctor/v1/${id}/verify`, {});
    return res.data as DoctorRow;
  },
  reject: async (id: string, reason: string) => {
    const res = await api.post(`/doctor/v1/${id}/reject`, { reason });
    return res.data as DoctorRow;
  },
  suspend: async (id: string) => {
    const res = await api.post(`/doctor/v1/${id}/suspend`, {});
    return res.data as DoctorRow;
  },
  unsuspend: async (id: string) => {
    const res = await api.post(`/doctor/v1/${id}/unsuspend`, {});
    return res.data as DoctorRow;
  },
  getDocuments: async (id: string) => {
    const res = await api.get(`/doctor/v1/${id}/documents`);
    return res.data;
  },
  getAvailability: async (id: string) => {
    const res = await api.get(`/doctor/v1/${id}/availability`);
    return res.data;
  },
};