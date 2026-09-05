import { api } from "@/lib/api";

/* ------------------------------------------------------------------ *
 * Advertisements (public) + News tape (authenticated).
 * Backend: /api/v1/advertisements/v1/*  and  /api/v1/news/v1/*
 * ------------------------------------------------------------------ */

export type AdPosition =
  | "HOME_TOP"
  | "HOME_MIDDLE"
  | "HOME_BOTTOM"
  | "DOCTOR_LIST"
  | "CLINIC_LIST"
  | "APPOINTMENT_SUCCESS"
  | "CUSTOM";

export type AdLanguage = "ARABIC" | "FRENCH" | "ENGLISH";

export interface AdvertisementRow {
  id: string;
  language: AdLanguage;
  title: string;
  description: string | null;
  link: string | null;
  titleAr: string | null;
  titleFr: string | null;
  titleEn: string | null;
  descriptionAr: string | null;
  descriptionFr: string | null;
  descriptionEn: string | null;
  imageUrl: string;
  position: AdPosition;
  sortOrder: number;
  startsAt: string | null;
  expiresAt: string | null;
  viewCount: number;
  clickCount: number;
}

export interface NewsRow {
  id: string;
  content: string;
  contentAr: string | null;
  contentFr: string | null;
  contentEn: string | null;
  link: string | null;
  priority: number;
  startsAt: string | null;
  expiresAt: string | null;
  viewCount: number;
  createdAt: string;
}

function list<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    for (const key of ["items", "data", "results"]) {
      if (Array.isArray(d[key])) return d[key] as T[];
    }
  }
  return [];
}

/** Maps the UI locale onto the backend's AdLanguage enum. */
export function toAdLanguage(locale: string): AdLanguage {
  if (locale.startsWith("ar")) return "ARABIC";
  if (locale.startsWith("en")) return "ENGLISH";
  return "FRENCH";
}

/** Picks the localized field with a graceful fallback chain. */
export function pickContent(
  locale: string,
  variants: { ar?: string | null; fr?: string | null; en?: string | null; fallback: string },
): string {
  const order = locale.startsWith("ar")
    ? [variants.ar, variants.fr, variants.en]
    : locale.startsWith("en")
      ? [variants.en, variants.fr, variants.ar]
      : [variants.fr, variants.en, variants.ar];
  return order.find((v) => v && v.trim())?.trim() || variants.fallback;
}

export const advertisementsApi = {
  active: async (params: {
    position?: AdPosition;
    wilayaId?: string;
    audience?: string;
    language?: AdLanguage;
    limit?: number;
  } = {}): Promise<AdvertisementRow[]> => {
    try {
      const res = await api.get("/advertisements/v1/public/active", {
        params: Object.fromEntries(
          Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""),
        ),
      });
      return list<AdvertisementRow>(res.data);
    } catch {
      return [];
    }
  },
  trackView: (id: string) =>
    api.post(`/advertisements/v1/public/${id}/view`, {}).catch(() => undefined),
  trackClick: (id: string) =>
    api.post(`/advertisements/v1/public/${id}/click`, {}).catch(() => undefined),
};

export const newsApi = {
  active: async (params: { wilayaId?: string; limit?: number } = {}): Promise<NewsRow[]> => {
    try {
      const res = await api.get("/news/v1/active", {
        params: {
          userType: "DOCTOR",
          limit: params.limit ?? 10,
          ...(params.wilayaId ? { wilayaId: params.wilayaId } : {}),
        },
      });
      return list<NewsRow>(res.data);
    } catch {
      return [];
    }
  },
  trackView: (id: string) => api.post(`/news/v1/${id}/view`, {}).catch(() => undefined),
};
