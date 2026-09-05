import { api } from "@/lib/api";
import { applyMeta, normalizeList, type ListResult } from "@/lib/adminApi";

export interface NotificationRow {
  id: string;
  userId?: string;
  title?: string;
  body?: string;
  type?: string;
  data?: Record<string, unknown> | null;
  isRead?: boolean;
  readAt?: string | null;
  createdAt: string;
}

export interface NotificationListParams {
  page?: number;
  limit?: number;
  isRead?: boolean;
  type?: string;
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

export const notificationsApi = {
  myList: async (params: NotificationListParams = {}): Promise<ListResult<NotificationRow>> => {
    const res = await api.get("/notification/v1/my-notifications", {
      params: clean(params as Record<string, unknown>),
    });
    const meta = (res as unknown as { meta?: unknown }).meta;
    return applyMeta(
      normalizeList<NotificationRow>(res.data, params.page ?? 1, params.limit ?? 20),
      meta,
    );
  },
  markRead: async (id: string) => {
    const res = await api.patch(`/notification/v1/${id}/read`, {});
    return res.data;
  },
  markAllRead: async () => {
    const res = await api.patch("/notification/v1/read-all", {});
    return res.data;
  },
  test: async (payload: { token?: string; title?: string; body?: string }) => {
    const res = await api.post("/notification/v1/test", payload);
    return res.data;
  },
  registerDevice: async (payload: { token: string; platform?: string }) => {
    const res = await api.post("/notification/v1/register-device", payload);
    return res.data;
  },
  unregisterDevice: async (token: string) => {
    const res = await api.delete("/notification/v1/unregister-device", { data: { token } });
    return res.data;
  },
};
