import type { i18n as I18nType, TFunction } from "i18next";

/**
 * Shared enum → human label resolver.
 *
 * Looks up `<group>.<VALUE>` in the active locale and falls back to a
 * humanised version of the raw backend enum when the key is missing.
 * In dev it warns loudly so missing translations are caught immediately
 * instead of silently shipping SCREAMING_SNAKE_CASE to Arabic users.
 */
export type EnumGroup =
  | "status"
  | "type"
  | "payment"
  | "dayOfWeek"
  | "practiceType"
  | "reviewVisibility"
  | "inviteStatus"
  | "facilityType"
  | "docType"
  | "cancelledByRole";

const warned = new Set<string>();

export function humanizeEnum(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function translateEnum(
  t: TFunction,
  i18n: I18nType | undefined,
  group: EnumGroup | string,
  value?: string | null,
  opts?: { normalize?: "upper" | "lower" | "none" },
): string {
  if (value === undefined || value === null || value === "") return "—";
  const raw = String(value);
  const normalize = opts?.normalize ?? "upper";
  const key =
    normalize === "upper" ? raw.toUpperCase() : normalize === "lower" ? raw.toLowerCase() : raw;
  const i18nKey = `${group}.${key}`;

  if (i18n?.exists?.(i18nKey)) return t(i18nKey);

  // Try the opposite casing before giving up (backend casing is inconsistent).
  const altKey = `${group}.${normalize === "upper" ? raw.toLowerCase() : raw.toUpperCase()}`;
  if (i18n?.exists?.(altKey)) return t(altKey);

  if (import.meta.env.DEV && !warned.has(i18nKey)) {
    warned.add(i18nKey);
    // eslint-disable-next-line no-console
    console.warn(`[i18n] Missing enum translation for "${i18nKey}" — falling back to raw value.`);
  }
  return humanizeEnum(raw);
}
