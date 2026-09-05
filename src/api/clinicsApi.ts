import { api } from "@/lib/api";
import { applyMeta, normalizeList, type ListResult } from "@/lib/adminApi";

export interface WorkingHours {
  day?: string;
  open?: string;
  close?: string;
  closed?: boolean;
}

export interface ClinicRow {
  id: string;
  nameFr?: string;
  nameAr?: string;
  descriptionFr?: string;
  descriptionAr?: string;
  logoUrl?: string | null;
  coverUrl?: string | null;
  wilayaId?: string;
  wilaya?: { id: string; code?: number; nameFr?: string; nameAr?: string };
  baladyaId?: string;
  baladya?: { id: string; nameFr?: string; nameAr?: string } | null;
  addressFr?: string;
  addressAr?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  reviewCount?: number;
  doctorsCount?: number;
  servicesCount?: number;
  isVerified?: boolean;
  isSuspended?: boolean;
  status?: string;
  verificationStatus?: string;
  facilityType?: "CLINIC" | "HOSPITAL";
  workingHours?: WorkingHours[] | Record<string, WorkingHours>;
  createdAt?: string;
  updatedAt?: string;
}

export interface ClinicListParams {
  page?: number;
  limit?: number;
  search?: string;
  wilayaId?: string;
  isVerified?: boolean;
  isSuspended?: boolean;
  status?: string;
  minRating?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface CreateClinicInput {
  nameFr: string;
  nameAr: string;
  email: string;
  phone: string;
  password?: string;
  wilayaId: string;
  baladyaId?: string | null;
  facilityType?: "CLINIC" | "HOSPITAL";
  descriptionFr?: string | null;
  descriptionAr?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface UpdateClinicInput {
  nameFr?: string;
  nameAr?: string;
  email?: string;
  phone?: string;
  wilayaId?: string;
  baladyaId?: string | null;
  facilityType?: "CLINIC" | "HOSPITAL";
  descriptionFr?: string | null;
  descriptionAr?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

function clean(p: Record<string, unknown>) {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(p)) {
    if (v === undefined || v === null || v === "") continue;
    if (typeof v === "boolean") out[k] = v ? "true" : "false";
    else out[k] = v as string | number;
  }
  return out;
}

export const clinicsApi = {
  list: async (params: ClinicListParams = {}): Promise<ListResult<ClinicRow>> => {
    const res = await api.get("/clinic/v1", {
      params: clean(params as Record<string, unknown>),
    });
    const meta = (res as unknown as { meta?: unknown }).meta;
    return applyMeta(
      normalizeList<ClinicRow>(res.data, params.page ?? 1, params.limit ?? 20),
      meta,
    );
  },
  getById: async (id: string): Promise<ClinicRow> => {
    const res = await api.get(`/clinic/v1/${id}`);
    return res.data as ClinicRow;
  },
  create: async (payload: CreateClinicInput): Promise<ClinicRow> => {
    const res = await api.post("/clinic/v1", payload);
    return res.data as ClinicRow;
  },
  update: async (id: string, payload: UpdateClinicInput): Promise<ClinicRow> => {
    const res = await api.patch(`/clinic/v1/${id}`, payload);
    return res.data as ClinicRow;
  },
  verify: async (id: string) => {
    const res = await api.post(`/clinic/v1/${id}/verify`, {});
    return res.data as ClinicRow;
  },
  suspend: async (id: string, reason?: string) => {
    const res = await api.post(`/clinic/v1/${id}/suspend`, { reason });
    return res.data as ClinicRow;
  },
  unsuspend: async (id: string) => {
    const res = await api.post(`/clinic/v1/${id}/unsuspend`, {});
    return res.data as ClinicRow;
  },
  getRooms: async (id: string) => {
    const res = await api.get(`/clinic/v1/${id}/rooms`);
    return res.data;
  },
  createRoom: async (id: string, payload: Record<string, unknown>) => {
    const res = await api.post(`/clinic/v1/${id}/rooms`, payload);
    return res.data;
  },
  updateRoom: async (clinicId: string, roomId: string, payload: Record<string, unknown>) => {
    const res = await api.patch(`/clinic/v1/${clinicId}/rooms/${roomId}`, payload);
    return res.data;
  },
  deleteRoom: async (clinicId: string, roomId: string) => {
    const res = await api.delete(`/clinic/v1/${clinicId}/rooms/${roomId}`);
    return res.data;
  },
  getWorkingHours: async (id: string) => {
    const res = await api.get(`/clinic/v1/${id}/working-hours`);
    return res.data;
  },
  setWorkingHours: async (id: string, payload: unknown) => {
    const res = await api.put(`/clinic/v1/${id}/working-hours`, payload);
    return res.data;
  },
  getGallery: async (id: string) => {
    const res = await api.get(`/clinic/v1/${id}/gallery`);
    return res.data;
  },
  uploadGalleryImage: async (id: string, formData: FormData) => {
    const res = await api.post(`/clinic/v1/${id}/gallery`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },
  updateGalleryImage: async (clinicId: string, imageId: string, payload: Record<string, unknown>) => {
    const res = await api.patch(`/clinic/v1/${clinicId}/gallery/${imageId}`, payload);
    return res.data;
  },
  deleteGalleryImage: async (clinicId: string, imageId: string) => {
    const res = await api.delete(`/clinic/v1/${clinicId}/gallery/${imageId}`);
    return res.data;
  },
  getClinicDoctors: async (id: string) => {
    const res = await api.get(`/clinic/v1/${id}/doctors`);
    return res.data;
  },
  uploadLogo: async (id: string, formData: FormData) => {
    const res = await api.post(`/clinic/v1/${id}/logo`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },
  uploadDocument: async (id: string, formData: FormData) => {
    const res = await api.post(`/clinic/v1/${id}/documents`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },
  deleteDocument: async (clinicId: string, docId: string) => {
    const res = await api.delete(`/clinic/v1/${clinicId}/documents/${docId}`);
    return res.data;
  },
  getDocuments: async (id: string) => {
    const res = await api.get(`/clinic/v1/${id}/documents`);
    return res.data;
  },
};