import { api } from "@/lib/api";
import { applyMeta, normalizeList, type ListResult } from "@/lib/adminApi";

export interface UserRow {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  dateOfBirth?: string;
  wilayaId?: string;
  wilaya?: { id: string; code?: number; nameFr?: string; nameAr?: string };
  isVerified: boolean;
  isSuspended: boolean;
  suspensionReason?: string | null;
  suspendedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
  noShowCount?: number;
  trustPoints?: number;
  trustLevel?: number;
  avatarUrl?: string;
}

export interface UserListParams {
  search?: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  wilayaId?: string;
  isVerified?: boolean;
  isSuspended?: boolean;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
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

export const usersApi = {
  list: async (params: UserListParams = {}): Promise<ListResult<UserRow>> => {
    const res = await api.get("/user/v1", { params: cleanParams(params as Record<string, unknown>) });
    const meta = (res as unknown as { meta?: unknown }).meta;
    return applyMeta(normalizeList<UserRow>(res.data, params.page ?? 1, params.limit ?? 20), meta);
  },
  getById: async (id: string): Promise<UserRow> => {
    const res = await api.get(`/user/v1/id/${id}`);
    return res.data as UserRow;
  },
  getByEmail: async (email: string): Promise<UserRow> => {
    const res = await api.get(`/user/v1/email/${encodeURIComponent(email)}`);
    return res.data as UserRow;
  },
  suspend: async (id: string, reason: string) => {
    const res = await api.post(`/user/v1/${id}/suspend`, { reason });
    return res.data as UserRow;
  },
  unsuspend: async (id: string) => {
    const res = await api.post(`/user/v1/${id}/unsuspend`, {});
    return res.data as UserRow;
  },
  getWallet: async (id: string) => {
    const res = await api.get(`/wallet/v1/user/${id}`);
    return res.data as { balance?: number; credits?: number; [k: string]: unknown };
  },
  grantCredits: async (id: string, credits: number, reason?: string) => {
    const res = await api.post(`/wallet/v1/user/${id}/grant`, { credits, reason });
    return res.data;
  },
};