import { api } from "@/lib/api";

// Generic list params
export interface ListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  [key: string]: string | number | undefined;
}

export interface ListResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages?: number;
  raw?: unknown;
}

// Normalize the assorted shapes the Iyadati API returns.
// After the axios envelope-unwrap, `data` can be:
//   - Array<T>
//   - { items|data|results|rows: Array<T>, total|totalCount|count, page, limit }
//   - Array-of-arrays or wrapped again under a resource key.
export function normalizeList<T = unknown>(payload: unknown, fallbackPage = 1, fallbackLimit = 20): ListResult<T> {
  if (Array.isArray(payload)) {
    return { items: payload as T[], total: payload.length, page: fallbackPage, limit: fallbackLimit };
  }
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    const items =
      (p.items as T[] | undefined) ??
      (p.data as T[] | undefined) ??
      (p.results as T[] | undefined) ??
      (p.rows as T[] | undefined) ??
      (p.records as T[] | undefined) ??
      [];
    const total =
      (p.total as number | undefined) ??
      (p.totalCount as number | undefined) ??
      (p.count as number | undefined) ??
      (Array.isArray(items) ? items.length : 0);
    const page = (p.page as number | undefined) ?? (p.currentPage as number | undefined) ?? fallbackPage;
    const limit = (p.limit as number | undefined) ?? (p.pageSize as number | undefined) ?? fallbackLimit;
    const totalPages = (p.totalPages as number | undefined) ?? Math.max(1, Math.ceil(total / Math.max(1, limit)));
    return { items: Array.isArray(items) ? items : [], total, page, limit, totalPages, raw: payload };
  }
  return { items: [], total: 0, page: fallbackPage, limit: fallbackLimit };
}

// Merge a top-level `meta` object (from the axios response) into normalized list
export function applyMeta<T>(result: ListResult<T>, meta: unknown): ListResult<T> {
  if (!meta || typeof meta !== "object") return result;
  const m = meta as Record<string, unknown>;
  const total = (m.total as number | undefined) ?? result.total;
  const page = (m.page as number | undefined) ?? result.page;
  const limit = (m.limit as number | undefined) ?? result.limit;
  const totalPages =
    (m.totalPages as number | undefined) ?? Math.max(1, Math.ceil(total / Math.max(1, limit)));
  return { ...result, total, page, limit, totalPages };
}

function cleanParams(p?: ListParams): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  if (!p) return out;
  for (const [k, v] of Object.entries(p)) {
    if (v === undefined || v === null || v === "") continue;
    out[k] = v as string | number;
  }
  return out;
}

// Map high-level resource names to the actual Iyadati REST paths.
// The backend uses /{resource_singular}/v1/... — not a single /admin/v1 root.
const RESOURCE_PATHS: Record<string, string> = {
  users: "/user/v1",
  doctors: "/doctor/v1",
  clinics: "/clinic/v1",
  appointments: "/appointment/v1/admin/appointments",
  specialties: "/specialty/v1",
  admins: "/admin/v1",
  locations: "/location/v1/wilayas",
  wilayas: "/location/v1/wilayas",
  wallet: "/wallet/v1/transactions",
  transactions: "/wallet/v1/transactions",
  notifications: "/notification/v1/my-notifications",
  support: "/chat/v1/support/rooms",
  reviews: "/review/v1/doctor",
};

export function resolveResourcePath(resource: string): string {
  if (resource.startsWith("/")) return resource;
  return RESOURCE_PATHS[resource] ?? `/${resource}/v1`;
}

// Resource client. `resource` may be a known key (users, doctors, …)
// or a raw path starting with "/".
export function adminResource<T = unknown>(resource: string) {
  const base = resolveResourcePath(resource);
  return {
    list: async (params?: ListParams) => {
      const res = await api.get(base, { params: cleanParams(params) });
      const meta = (res as unknown as { meta?: unknown }).meta;
      return applyMeta(
        normalizeList<T>(res.data, params?.page ?? 1, params?.limit ?? 20),
        meta,
      );
    },
    get: async (id: string) => {
      const res = await api.get(`${base}/${id}`);
      return res.data as T;
    },
    create: async (payload: Partial<T> | FormData) => {
      const res = await api.post(base, payload);
      return res.data as T;
    },
    update: async (id: string, payload: Partial<T> | FormData) => {
      const res = await api.patch(`${base}/${id}`, payload);
      return res.data as T;
    },
    remove: async (id: string) => {
      const res = await api.delete(`${base}/${id}`);
      return res.data;
    },
    action: async (id: string, action: string, payload?: unknown) => {
      const res = await api.post(`${base}/${id}/${action}`, payload ?? {});
      return res.data;
    },
    custom: async (path: string, params?: ListParams) => {
      const res = await api.get(`${base}/${path}`, { params: cleanParams(params) });
      return res.data;
    },
  };
}

export function isForbidden(err: unknown): boolean {
  const e = err as { status?: number };
  return e?.status === 403;
}