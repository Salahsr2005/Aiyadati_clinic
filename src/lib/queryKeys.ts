// Centralized react-query keys. Single source of truth so mutations can
// invalidate precisely and cache lookups stay stable across the app.

type Params = Record<string, unknown> | undefined;

function stable(p: Params) {
  if (!p) return {};
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(p).sort()) {
    const v = p[k];
    if (v === undefined || v === null || v === "") continue;
    out[k] = v;
  }
  return out;
}

export const qk = {
  auth: {
    me: () => ["auth", "me"] as const,
  },
  analytics: {
    all: () => ["analytics"] as const,
    overview: () => ["analytics", "overview"] as const,
    appointments: () => ["analytics", "appointments"] as const,
    revenue: () => ["analytics", "revenue"] as const,
    users: () => ["analytics", "users"] as const,
    doctors: () => ["analytics", "doctors"] as const,
    clinics: () => ["analytics", "clinics"] as const,
  },
  doctors: {
    all: () => ["doctors"] as const,
    list: (p?: Params) => ["doctors", "list", stable(p)] as const,
    detail: (id: string) => ["doctors", "detail", id] as const,
    documents: (id: string) => ["doctors", "documents", id] as const,
    availability: (id: string) => ["doctors", "availability", id] as const,
    reviews: (id: string) => ["doctors", "reviews", id] as const,
    reviewStats: (id: string) => ["doctors", "reviewStats", id] as const,
  },
  publicClinics: {
    all: () => ["publicClinics"] as const,
    list: (p?: Params) => ["publicClinics", "list", stable(p)] as const,
    detail: (id: string) => ["publicClinics", "detail", id] as const,
    doctors: (id: string) => ["publicClinics", "doctors", id] as const,
    gallery: (id: string) => ["publicClinics", "gallery", id] as const,
  },
  clinics: {
    all: () => ["clinics"] as const,
    list: (p?: Params) => ["clinics", "list", stable(p)] as const,
    detail: (id: string) => ["clinics", "detail", id] as const,
    rooms: (id: string) => ["clinics", "rooms", id] as const,
    gallery: (id: string) => ["clinics", "gallery", id] as const,
    workingHours: (id: string) => ["clinics", "workingHours", id] as const,
    doctors: (id: string) => ["clinics", "doctors", id] as const,
    reviews: (id: string) => ["clinics", "reviews", id] as const,
    reviewStats: (id: string) => ["clinics", "reviewStats", id] as const,
    documents: (id: string) => ["clinics", "documents", id] as const,
  },
  users: {
    all: () => ["users"] as const,
    list: (p?: Params) => ["users", "list", stable(p)] as const,
    detail: (id: string) => ["users", "detail", id] as const,
    wallet: (id: string) => ["users", "wallet", id] as const,
  },
  appointments: {
    all: () => ["appointments"] as const,
    list: (p?: Params) => ["appointments", "list", stable(p)] as const,
    detail: (id: string) => ["appointments", "detail", id] as const,
  },
  wallet: {
    all: () => ["wallet"] as const,
    transactions: (p?: Params) => ["wallet", "transactions", stable(p)] as const,
    userWallet: (id: string) => ["wallet", "user", id] as const,
  },
  specialties: {
    all: () => ["specialties"] as const,
    list: (p?: Params) => ["specialties", "list", stable(p)] as const,
    detail: (id: string) => ["specialties", "detail", id] as const,
  },
  locations: {
    all: () => ["locations"] as const,
    wilayas: () => ["locations", "wilayas"] as const,
    wilaya: (id: string | number) => ["locations", "wilaya", String(id)] as const,
    baladyat: (wilayaId: string | number) =>
      ["locations", "baladyat", String(wilayaId)] as const,
  },
  notifications: {
    all: () => ["notifications"] as const,
    list: (p?: Params) => ["notifications", "list", stable(p)] as const,
  },
  admins: {
    all: () => ["admins"] as const,
    list: (p?: Params) => ["admins", "list", stable(p)] as const,
  },
  support: {
    rooms: (p?: Params) => ["support", "rooms", stable(p)] as const,
    messages: (roomId: string) => ["support", "messages", roomId] as const,
  },
  credit: {
    all: () => ["credit"] as const,
    current: () => ["credit", "current"] as const,
    history: (limit?: number) => ["credit", "history", limit] as const,
  },
  /** Doctor self-service namespace — never mixed with the admin `doctors.*` keys. */
  doctorSelf: {
    all: () => ["doctorSelf"] as const,
    profile: () => ["doctorSelf", "profile"] as const,
    availability: () => ["doctorSelf", "availability"] as const,
    breaks: () => ["doctorSelf", "breaks"] as const,
    documents: () => ["doctorSelf", "documents"] as const,
    invitations: () => ["doctorSelf", "invitations"] as const,
    appointments: (p?: Params) => ["doctorSelf", "appointments", stable(p)] as const,
    appointmentsAll: () => ["doctorSelf", "appointments"] as const,
    pending: () => ["doctorSelf", "pending"] as const,
    stats: (date?: string) => ["doctorSelf", "stats", date ?? "today"] as const,
    config: () => ["doctorSelf", "config"] as const,
    slots: (date: string) => ["doctorSelf", "slots", date] as const,
    slotsAll: () => ["doctorSelf", "slots"] as const,
    analytics: (id: string, period?: string) => ["doctorSelf", "analytics", id, period ?? "last30days"] as const,
    revenue: (id: string, period?: string) => ["doctorSelf", "revenue", id, period ?? "last30days"] as const,
    reviews: (id: string) => ["doctorSelf", "reviews", id] as const,
    reviewStats: (id: string) => ["doctorSelf", "reviewStats", id] as const,
  },
  content: {
    all: () => ["content"] as const,
    news: () => ["content", "news"] as const,
    ads: (position?: string) => ["content", "ads", position ?? "all"] as const,
  },
  consent: {
    all: () => ["consent"] as const,
    patients: () => ["consent", "patients"] as const,
    documents: (patientId: string) => ["consent", "documents", patientId] as const,
  },
  clinicSelf: {
    all: () => ["clinicSelf"] as const,
    profile: () => ["clinicSelf", "profile"] as const,
    documents: () => ["clinicSelf", "documents"] as const,
    workingHours: () => ["clinicSelf", "workingHours"] as const,
    rooms: () => ["clinicSelf", "rooms"] as const,
    doctors: () => ["clinicSelf", "doctors"] as const,
    gallery: () => ["clinicSelf", "gallery"] as const,
    services: (p?: Params) => ["clinicSelf", "services", stable(p)] as const,
    serviceDetail: (id: string) => ["clinicSelf", "services", id] as const,
    serviceDoctors: (id: string) => ["clinicSelf", "services", id, "doctors"] as const,
    appointments: (p?: Params) => ["clinicSelf", "appointments", stable(p)] as const,
    doctorSlots: (doctorId: string, p?: Params) => ["clinicSelf", "slots", doctorId, stable(p)] as const,
    guestPatients: (p?: Params) => ["clinicSelf", "guestPatients", stable(p)] as const,
    guestPatientDetail: (id: string) => ["clinicSelf", "guestPatients", id] as const,
    reviews: (p?: Params) => ["clinicSelf", "reviews", stable(p)] as const,
  },
  dashboard: {
    all: () => ["dashboard"] as const,
    kpis: () => ["dashboard", "kpis"] as const,
    profile: () => ["dashboard", "profile"] as const,
    workingHours: () => ["dashboard", "workingHours"] as const,
    rooms: () => ["dashboard", "rooms"] as const,
    services: () => ["dashboard", "services"] as const,
    gallery: () => ["dashboard", "gallery"] as const,
    doctors: () => ["dashboard", "doctors"] as const,
    pendingInvites: () => ["dashboard", "pendingInvites"] as const,
    appointments: (p?: Params) => ["dashboard", "appointments", stable(p)] as const,
    reviews: () => ["dashboard", "reviews"] as const,
  },
} as const;
