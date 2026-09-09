import axios, { AxiosError, type AxiosInstance } from "axios";
import { useAuthStore } from "@/store/auth";
import type { ErrorResponse } from "@/types/api";

export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  "https://api.serirsalah.me";

export const api: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  withCredentials: false,
  headers: { "Content-Type": "application/json", Accept: "application/json" },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }
  if (config.data instanceof FormData) {
    delete (config.headers as Record<string, unknown>)["Content-Type"];
    delete (config.headers as Record<string, unknown>)["content-type"];
  }
  return config;
});

let redirecting = false;
api.interceptors.response.use(
  (r) => {
    // Unwrap Iyadati envelope: { success, message, data, meta }
    if (r.data && typeof r.data === "object" && "data" in r.data && "success" in r.data) {
      const env = r.data as { data: unknown; meta?: unknown };
      (r as unknown as { meta?: unknown }).meta = env.meta;
      r.data = env.data;
    }
    return r;
  },
  (error: AxiosError<ErrorResponse>) => {
    if (error.response?.status === 401) {
      const store = useAuthStore.getState();
      if (store.token || store.user) {
        store.clear();
        if (typeof window !== "undefined" && !redirecting) {
          redirecting = true;
          const path = window.location.pathname;
          if (!path.startsWith("/login")) {
            window.location.href = "/login?expired=1";
          }
          setTimeout(() => (redirecting = false), 1000);
        }
      }
    }
    return Promise.reject(normalizeError(error));
  }
);

export function normalizeError(err: unknown): Error & { fields?: Record<string, string>; status?: number } {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as ErrorResponse | undefined;
    const msg = data?.message || data?.error || err.message || "Request failed";
    const e = new Error(msg) as Error & { fields?: Record<string, string>; status?: number };
    e.status = err.response?.status;
    if (data?.errors) {
      e.fields = Object.fromEntries(data.errors.map((v) => [v.field, v.message]));
    }
    return e;
  }
  return err instanceof Error ? err : new Error("Unknown error");
}