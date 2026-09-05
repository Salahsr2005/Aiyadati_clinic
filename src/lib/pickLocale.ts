import type { Locale } from "@/store/ui";

export function pickLocaleField<T extends Record<string, unknown>>(
  obj: T | null | undefined,
  base: string,
  locale: Locale
): string {
  if (!obj) return "";
  const fr = (obj[`${base}Fr`] as string | undefined) ?? "";
  const ar = (obj[`${base}Ar`] as string | undefined) ?? "";
  if (locale === "ar") return ar || fr || "";
  return fr || ar || "";
}