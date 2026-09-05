import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
