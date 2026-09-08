import type { Locale } from "@/store/ui";

export interface LocalizedEntity {
  nameFr?: string;
  nameAr?: string;
  code?: number;
  id?: string;
}

/** Pick the best localized display name for a bilingual entity. */
export function localizedName(
  entity: LocalizedEntity | undefined | null,
  locale: Locale,
  fallback = "—",
): string {
  if (!entity) return fallback;
  const primary = locale === "ar" ? entity.nameAr || entity.nameFr : entity.nameFr || entity.nameAr;
  if (primary) return primary;
  if (entity.code != null) return `#${entity.code}`;
  return fallback;
}

export function resolveWilaya(
  wilayaId: string | undefined | null,
  wilayaMap: Map<string, LocalizedEntity & { id: string; code?: number }>,
  locale: Locale,
  relation?: LocalizedEntity | null,
): string {
  if (relation) {
    const name = localizedName(relation, locale, "");
    if (name) return name;
  }
  if (wilayaId) {
    const fromMap = wilayaMap.get(wilayaId);
    if (fromMap) {
      const name = localizedName(fromMap, locale, "");
      if (name) return name;
      if (fromMap.code != null) return `#${fromMap.code}`;
    }
  }
  return locale === "ar" ? "Unknown" : locale === "fr" ? "Inconnu" : "Unknown";
}

export function resolveSpecialty(
  specialty: LocalizedEntity & { id?: string } | string | undefined | null,
  specialtyMap: Map<string, LocalizedEntity & { id: string }> | undefined,
  locale: Locale,
): string {
  if (!specialty) return "—";
  if (typeof specialty === "string") {
    const fromMap = specialtyMap?.get(specialty);
    if (fromMap) return localizedName(fromMap, locale);
    return "Specialty";
  }
  return localizedName(specialty, locale);
}

export function resolveBaladya(
  baladya: LocalizedEntity | undefined | null,
  locale: Locale,
  baladyaId?: string | null,
): string {
  if (baladya) return localizedName(baladya, locale);
  return "—";
}

/** Pick localized text from FR/AR field pair (bio, description, address, etc.). */
export function localizedBilingual(
  fr: string | undefined | null,
  ar: string | undefined | null,
  locale: Locale,
  fallback = "—",
): string {
  if (locale === "ar") return ar || fr || fallback;
  return fr || ar || fallback;
}

/** Localized doctor/person name from FR/AR fields. */
export function localizedPersonName(
  fields: {
    firstNameFr?: string;
    firstNameAr?: string;
    lastNameFr?: string;
    lastNameAr?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
  },
  locale: Locale,
): string {
  const first =
    locale === "ar"
      ? fields.firstNameAr || fields.firstNameFr || fields.firstName
      : fields.firstNameFr || fields.firstNameAr || fields.firstName;
  const last =
    locale === "ar"
      ? fields.lastNameAr || fields.lastNameFr || fields.lastName
      : fields.lastNameFr || fields.lastNameAr || fields.lastName;
  const full = [first, last].filter(Boolean).join(" ");
  return full || fields.email || "—";
}
