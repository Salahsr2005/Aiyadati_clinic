import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { API_BASE_URL } from "@/lib/api";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function resolveFileUrl(url?: string | null): string {
  if (!url || typeof url !== "string") return "";

  let resolved = url.trim();
  if (!resolved || resolved === "null" || resolved === "undefined" || resolved === "[object Object]") return "";

  // Replace localhost or 127.0.0.1 host with API_BASE_URL
  if (resolved.includes("localhost") || resolved.includes("127.0.0.1")) {
    resolved = resolved.replace(/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/, API_BASE_URL);
  }

  // If already absolute HTTP(S) or blob or data URI
  if (/^(https?:|data:|blob:)/i.test(resolved)) {
    return resolved;
  }

  // If raw UUID file ID
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resolved)) {
    return `${API_BASE_URL}/api/v1/files/public/${resolved}`;
  }

  // If path starting with files/public/ or /files/public/
  if (resolved.startsWith("/files/public/") || resolved.startsWith("files/public/")) {
    const clean = resolved.replace(/^\/?files\/public\//, "");
    return `${API_BASE_URL}/api/v1/files/public/${clean}`;
  }

  // If relative path starting with /api/v1/
  if (resolved.startsWith("/api/v1/")) {
    return `${API_BASE_URL}${resolved}`;
  }

  // If relative path starting with slash
  if (resolved.startsWith("/")) {
    return `${API_BASE_URL}${resolved}`;
  }

  // Otherwise relative path without leading slash
  return `${API_BASE_URL}/${resolved}`;
}

export function openFileUrl(url?: string | null): void {
  if (!url) return;
  const fullUrl = resolveFileUrl(url);
  if (!fullUrl) return;

  if (typeof window !== "undefined") {
    window.open(fullUrl, "_blank", "noopener,noreferrer");
  }
}

export function ensureArray<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.items)) return obj.items as T[];
    if (Array.isArray(obj.data)) return obj.data as T[];
    if (Array.isArray(obj.doctors)) return obj.doctors as T[];
    if (Array.isArray(obj.rooms)) return obj.rooms as T[];
    if (Array.isArray(obj.services)) return obj.services as T[];
    if (Array.isArray(obj.gallery)) return obj.gallery as T[];
    if (Array.isArray(obj.workingHours)) return obj.workingHours as T[];
    if (Array.isArray(obj.hours)) return obj.hours as T[];
    if (Array.isArray(obj.documents)) return obj.documents as T[];
    if (Array.isArray(obj.slots)) return obj.slots as T[];
    if (Array.isArray(obj.results)) return obj.results as T[];
  }
  return [];
}
