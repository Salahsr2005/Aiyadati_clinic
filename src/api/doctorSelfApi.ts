import { api } from "@/lib/api";
import { applyMeta, normalizeList, type ListResult } from "@/lib/adminApi";
import type { AppointmentRow, AppointmentStatus } from "@/api/appointmentsApi";
import type { DoctorRow } from "@/api/doctorsApi";

/* ------------------------------------------------------------------ *
 * Doctor self-service API.
 * Every call here is scoped server-side to the authenticated doctor.
 * This module must never touch staff/admin endpoints.
 * ------------------------------------------------------------------ */

export interface GuestPatientRow {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  dateOfBirth?: string;
  wilayaId?: string | number;
  notes?: string;
  isGuest?: boolean;
  createdAt?: string;
}

export type DayOfWeek =
  | "SUNDAY" | "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY";

export interface AvailabilityRow {
  id: string;
  doctorId?: string;
  dayOfWeek: DayOfWeek | string;
  startTime: string;
  endTime: string;
  isActive?: boolean;
  clinicId?: string | null;
  clinic?: { id: string; nameFr?: string; nameAr?: string } | null;
  roomId?: string | null;
  room?: { id: string; name?: string } | null;
}

export interface AvailabilitySlotInput {
  dayOfWeek: DayOfWeek | string;
  startTime: string;
  endTime: string;
  clinicId?: string;
  roomId?: string;
}

export interface BreakRow {
  id: string;
  doctorId?: string;
  startDate: string;
  endDate: string;
  reason?: string | null;
  isAllDay: boolean;
  startTime?: string | null;
  endTime?: string | null;
}

export interface BreakInput {
  startDate: string;
  endDate: string;
  reason?: string;
  isAllDay?: boolean;
  startTime?: string;
  endTime?: string;
  /**
   * How the backend should treat booked appointments inside the break window.
   * BLOCK (default) → 409 with the conflict list; CANCEL_AND_REFUND → cancel + refund.
   */
  conflictStrategy?: "BLOCK" | "CANCEL_AND_REFUND";
}

export interface BreakConflict {
  appointmentId?: string;
  id?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  patientName?: string;
  status?: string;
}

export interface BreakConflictPreview {
  conflicts: BreakConflict[];
  affectedSlots: number;
  affectedAppointments: number;
  /** true when the preview endpoint is unreachable — the UI degrades gracefully. */
  unavailable?: boolean;
}


export type DoctorDocType = "degree" | "license" | "id_card" | "cv" | "certificate" | "other";

export interface DoctorDocumentRow {
  id: string;
  doctorId?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  docType?: DoctorDocType | string;
  accessUrl?: string;
  uploadedAt?: string;
}

export interface ClinicInvitationRow {
  id: string;
  clinicId: string;
  clinic?: {
    id: string;
    nameFr?: string;
    nameAr?: string;
    logoUrl?: string | null;
    address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    phone?: string | null;
    wilaya?: { id: string; nameFr?: string; nameAr?: string } | null;
  } | null;
  status?: "PENDING" | "ACCEPTED" | "REJECTED" | string;
  /** Backend `DoctorClinicInvitationResponse.invitedBy` — e.g. "clinic" | "doctor". */
  invitedBy?: string;
  isActive?: boolean;
  joinedAt?: string;
}


function safeArray<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && Array.isArray((data as any).items)) return (data as any).items as T[];
  if (data && typeof data === "object" && Array.isArray((data as any).slots)) return (data as any).slots as T[];
  if (data && typeof data === "object" && Array.isArray((data as any).data)) return (data as any).data as T[];
  return [];
}

export const doctorSelfApi = {
  profile: () => api.get<DoctorRow>("/doctor/v1/me/profile").then((r) => r.data),

  complete: (payload: FormData | Record<string, unknown>) =>
    api
      .patch<DoctorRow>("/doctor/v1/me/complete", payload, {
        headers:
          typeof FormData !== "undefined" && payload instanceof FormData
            ? { "Content-Type": "multipart/form-data" }
            : undefined,
      })
      .then((r) => r.data),

  availability: {
    get: async (): Promise<AvailabilityRow[]> => {
      try {
        const res = await api.get("/doctor/v1/me/availability");
        return safeArray<AvailabilityRow>(res.data);
      } catch {
        return [];
      }
    },
    set: async (slots: AvailabilitySlotInput[]): Promise<AvailabilityRow[]> => {
      const res = await api.put("/doctor/v1/me/availability", { slots });
      return safeArray<AvailabilityRow>(res.data);
    },
    remove: (id: string) => api.delete(`/doctor/v1/me/availability/${id}`).then((r) => r.data),
  },

  breaks: {
    list: async (): Promise<BreakRow[]> => {
      try {
        const res = await api.get("/doctor/v1/me/breaks");
        return safeArray<BreakRow>(res.data);
      } catch {
        return [];
      }
    },
    /** Dry-run: returns the appointments a break would disrupt, without writing. */
    preview: async (payload: BreakInput): Promise<BreakConflictPreview> => {
      try {
        const res = await api.post("/doctor/v1/me/breaks/preview", payload);
        const data = (res.data ?? {}) as Partial<BreakConflictPreview> & { conflicts?: BreakConflict[] };
        const conflicts = data.conflicts ?? [];
        return {
          conflicts,
          affectedSlots: data.affectedSlots ?? 0,
          affectedAppointments: data.affectedAppointments ?? conflicts.length,
        };
      } catch {
        return { conflicts: [], affectedSlots: 0, affectedAppointments: 0, unavailable: true };
      }
    },
    create: (payload: BreakInput) =>
      api.post<BreakRow>("/doctor/v1/me/breaks", payload).then((r) => r.data),
    update: (id: string, payload: Partial<BreakInput>) =>
      api.patch<BreakRow>(`/doctor/v1/me/breaks/${id}`, payload).then((r) => r.data),
    remove: (id: string) => api.delete(`/doctor/v1/me/breaks/${id}`).then((r) => r.data),
  },


  documents: {
    list: async (): Promise<DoctorDocumentRow[]> => {
      try {
        const res = await api.get("/doctor/v1/me/documents");
        return safeArray<DoctorDocumentRow>(res.data);
      } catch {
        return [];
      }
    },
    upload: (formData: FormData) =>
      api
        .post<DoctorDocumentRow>("/doctor/v1/me/documents", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        })
        .then((r) => r.data),
    remove: (id: string) => api.delete(`/doctor/v1/me/documents/${id}`).then((r) => r.data),
  },

  clinicInvitations: {
    list: async (): Promise<ClinicInvitationRow[]> => {
      try {
        const res = await api.get("/doctor/v1/me/clinic-invitations");
        return safeArray<ClinicInvitationRow>(res.data);
      } catch {
        return [];
      }
    },
    accept: (id: string) =>
      api.post(`/doctor/v1/me/clinic-invitations/${id}/accept`, {}).then((r) => r.data),
    reject: (id: string) =>
      api.post(`/doctor/v1/me/clinic-invitations/${id}/reject`, {}).then((r) => r.data),
  },

  requestClinic: (payload: { clinicId: string; message?: string }) =>
    api.post("/doctor/v1/me/clinics/request", payload).then((r) => r.data),

  patients: {
    search: async (q: string): Promise<PatientSearchResult[]> => {
      const term = q ? q.trim() : "";
      if (!term) return [];

      const resultsMap = new Map<string, PatientSearchResult>();

      const addResult = (u: any) => {
        if (!u) return;
        const id = u.id || u.userId || u.patientId;
        if (!id) return;
        if (!resultsMap.has(id)) {
          resultsMap.set(id, {
            id,
            firstName: u.firstName || u.name?.split(" ")[0] || u.email?.split("@")[0] || "",
            lastName: u.lastName || u.name?.split(" ").slice(1).join(" ") || "",
            email: u.email || "",
            phone: u.phone || "",
            avgAppointments: u.avgAppointments,
          });
        }
      };

      // 1. Doctor-specific patient search endpoint
      try {
        const res = await api.get("/appointment/v1/doctor/patients/search", {
          params: { q: term, search: term, email: term, phone: term },
        });
        const items = safeArray<any>(res.data);
        items.forEach(addResult);
      } catch {
        // Fallback
      }

      // 2. Doctor patients list endpoint
      try {
        const res = await api.get("/appointment/v1/doctor/patients", {
          params: { q: term, search: term, limit: 50 },
        });
        const items = safeArray<any>(res.data);
        items.forEach(addResult);
      } catch {
        // Fallback
      }

      // 3. Direct user directory lookup (/user/v1)
      try {
        const isEmail = term.includes("@");
        const isPhone = /^[0-9+\s-]{4,}$/.test(term);

        const params: Record<string, string | number> = { limit: 30 };
        if (isEmail) params.email = term;
        else if (isPhone) params.phone = term;
        else params.search = term;

        const res = await api.get("/user/v1", { params });
        const items = safeArray<any>(res.data);
        items.forEach(addResult);
      } catch {
        // Fallback
      }

      // 4. Fallback: try email direct lookup if email format
      if (term.includes("@")) {
        try {
          const res = await api.get(`/user/v1/email/${encodeURIComponent(term)}`);
          if (res.data) addResult(res.data);
        } catch {
          // Fallback
        }
      }

      // 5. Consent patients endpoint
      try {
        const res = await api.get("/consent/v1/doctor/patients");
        const items = safeArray<any>(res.data);
        items.forEach((item) => {
          const p = item.patient || item;
          if (p) {
            const name = `${p.firstName || ""} ${p.lastName || ""}`.toLowerCase();
            const phone = String(p.phone || "").toLowerCase();
            const email = String(p.email || "").toLowerCase();
            const lowerTerm = term.toLowerCase();
            if (name.includes(lowerTerm) || phone.includes(lowerTerm) || email.includes(lowerTerm)) {
              addResult(p);
            }
          }
        });
      } catch {
        // Fallback
      }

      // 6. Doctor appointments history (extract patient objects matching search)
      try {
        const res = await api.get("/appointment/v1/doctor/appointments", { params: { limit: 100 } });
        const items = safeArray<any>(res.data);
        items.forEach((r) => {
          const p = r.patient || r.contactUser;
          if (p) {
            const name = `${p.firstName || ""} ${p.lastName || ""}`.toLowerCase();
            const phone = String(p.phone || "").toLowerCase();
            const email = String(p.email || "").toLowerCase();
            const lowerTerm = term.toLowerCase();
            if (name.includes(lowerTerm) || phone.includes(lowerTerm) || email.includes(lowerTerm)) {
              addResult(p);
            }
          }
        });
      } catch {
        // Fallback
      }

      return Array.from(resultsMap.values());
    },
  },

  guestPatients: {
    list: async (params: { page?: number; limit?: number } = {}): Promise<ListResult<GuestPatientRow>> => {
      const res = await api.get("/appointment/v1/guest-patients", { params });
      return applyMeta(normalizeList<GuestPatientRow>(res.data, params.page ?? 1, params.limit ?? 20), (res as any).meta);
    },
    search: async (q: string): Promise<GuestPatientRow[]> => {
      const term = q ? q.trim() : "";
      if (!term || term.length < 2) return [];

      const resultsMap = new Map<string, GuestPatientRow>();

      const addResult = (g: any) => {
        if (!g || !g.id) return;
        if (!resultsMap.has(g.id)) {
          resultsMap.set(g.id, g);
        }
      };

      try {
        const res = await api.get("/appointment/v1/guest-patients/search", {
          params: { q: term, search: term, email: term, phone: term },
        });
        const items = safeArray<GuestPatientRow>(res.data);
        items.forEach(addResult);
      } catch {
        // Fallback
      }

      if (resultsMap.size === 0) {
        try {
          const res = await api.get("/appointment/v1/guest-patients", {
            params: { search: term, q: term, limit: 50 },
          });
          const items = safeArray<GuestPatientRow>(res.data);
          items.forEach(addResult);
        } catch {
          // Fallback
        }
      }

      return Array.from(resultsMap.values());
    },
    getById: (id: string) => api.get<GuestPatientRow>(`/appointment/v1/guest-patients/${id}`).then((r) => r.data),
    create: (payload: GuestPatientInput) => api.post<GuestPatientRow>("/appointment/v1/guest-patients", payload).then((r) => r.data),
    update: (id: string, payload: Partial<GuestPatientInput>) => api.patch<GuestPatientRow>(`/appointment/v1/guest-patients/${id}`, payload).then((r) => r.data),
  },
};

export interface PatientSearchResult {
  id: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  avgAppointments?: number;
}

export interface GuestPatientInput {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  dateOfBirth?: string;
  wilayaId?: string;
  notes?: string;
}

/* ---------------------- Appointments / slots ---------------------- */

export interface DoctorAppointmentParams {
  date?: string;
  status?: AppointmentStatus | string;
  page?: number;
  limit?: number;
}

export interface DoctorAppointmentStats {
  pending: number;
  confirmed: number;
  in_progress: number;
  completed: number;
  cancelled: number;
  no_show: number;
  total: number;
}

export interface SlotRow {
  id: string;
  doctorId?: string;
  clinicId?: string | null;
  roomId?: string | null;
  date: string;
  startTime: string;
  endTime: string;
  status: "available" | "full" | "cancelled" | string;
  maxPatients?: number;
  currentPatients?: number;
}

export interface SlotConfig {
  id?: string;
  doctorId?: string;
  slotDuration: number;
  bufferTime: number;
  maxPerSlot?: number;
}

function clean(p: Record<string, unknown>): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(p)) {
    if (v === undefined || v === null || v === "") continue;
    out[k] = typeof v === "boolean" ? String(v) : (v as string | number);
  }
  return out;
}

const guestPatientCache = new Map<string, GuestPatientRow>();

async function resolveMissingGuestPatients(items: AppointmentRow[]): Promise<AppointmentRow[]> {
  if (!items || items.length === 0) return items;

  const missingIds = Array.from(
    new Set(
      items
        .filter((r) => r.guestPatientId && !r.guestPatient && !guestPatientCache.has(r.guestPatientId!))
        .map((r) => r.guestPatientId!)
    )
  );

  if (missingIds.length > 0) {
    await Promise.allSettled(
      missingIds.map(async (gid) => {
        try {
          const res = await api.get(`/appointment/v1/guest-patients/${gid}`);
          const raw = res.data;
          const g = (raw && typeof raw === "object" && "data" in raw ? (raw as any).data : raw) as GuestPatientRow;
          if (g && (g.id || (g as any).firstName)) {
            guestPatientCache.set(gid, g);
          }
        } catch {
          // ignore
        }
      })
    );
  }

  return items.map((r) => {
    if (r.guestPatientId) {
      const cached = guestPatientCache.get(r.guestPatientId);
      if (cached) {
        return {
          ...r,
          guestPatient: (r.guestPatient ? { ...cached, ...r.guestPatient } : cached) as AppointmentRow["guestPatient"],
        };
      }
    }
    return r;
  });
}

export const doctorAppointmentsApi = {
  list: async (params: DoctorAppointmentParams = {}): Promise<ListResult<AppointmentRow>> => {
    const res = await api.get("/appointment/v1/doctor/appointments", {
      params: clean(params as Record<string, unknown>),
    });
    const meta = (res as unknown as { meta?: unknown }).meta;
    const listResult = applyMeta(
      normalizeList<AppointmentRow>(res.data, params.page ?? 1, params.limit ?? 10),
      meta,
    );
    listResult.items = await resolveMissingGuestPatients(listResult.items || []);
    return listResult;
  },

  pending: async (): Promise<AppointmentRow[]> => {
    const res = await doctorAppointmentsApi.list({ status: "PENDING", limit: 100 });
    return res.items;
  },

  stats: async (date?: string): Promise<DoctorAppointmentStats> => {
    try {
      const res = await doctorAppointmentsApi.list({ date, page: 1, limit: 1000 });
      const items = res.items || [];
      const counts: DoctorAppointmentStats = {
        pending: 0,
        confirmed: 0,
        in_progress: 0,
        completed: 0,
        cancelled: 0,
        no_show: 0,
        total: items.length,
      };
      for (const app of items) {
        const st = String(app.status || "").toUpperCase();
        if (st === "PENDING") counts.pending++;
        else if (st === "CONFIRMED") counts.confirmed++;
        else if (st === "IN_PROGRESS") counts.in_progress++;
        else if (st === "COMPLETED") counts.completed++;
        else if (st === "CANCELLED") counts.cancelled++;
        else if (st === "NO_SHOW") counts.no_show++;
      }
      return counts;
    } catch {
      return { pending: 0, confirmed: 0, in_progress: 0, completed: 0, cancelled: 0, no_show: 0, total: 0 };
    }
  },

  book: (payload: {
    slotId: string;
    type?: "IN_PERSON" | "VIDEO" | "HOME_VISIT" | string;
    paymentMethod?: "CREDIT" | "ON_SITE" | string;
    patientId?: string;
    guestPatient?: GuestPatientInput;
    contactUserId?: string;
    notes?: string;
  }) => api.post<AppointmentRow>("/appointment/v1/book", payload).then((r) => r.data),

  confirm: (id: string, payload?: { notes?: string }) =>
    api.post(`/appointment/v1/appointments/${id}/confirm`, payload || {}).then((r) => r.data),

  updateStatus: (id: string, status: AppointmentStatus | string, cancelReason?: string) =>
    api.patch(`/appointment/v1/${id}/status`, { status, cancelReason }).then((r) => r.data),

  config: {
    get: () =>
      api
        .get<SlotConfig | null>("/appointment/v1/doctor/config")
        .then((r) => r.data)
        .catch(() => null),
    set: (payload: SlotConfig) =>
      api.put<SlotConfig>("/appointment/v1/doctor/config", payload).then((r) => r.data),
  },

  slots: {
    listByDate: async (date: string): Promise<SlotRow[]> => {
      try {
        const res = await api.get("/appointment/v1/doctor/slots", { params: { date } });
        return safeArray<SlotRow>(res.data);
      } catch {
        return [];
      }
    },
    quickCreate: (payload: { date: string; startTime: string; endTime: string; clinicId?: string; roomId?: string }) =>
      api.post<SlotRow>("/appointment/v1/doctor/slots/quick", payload).then((r) => r.data),
    generate: (payload: { startDate: string; endDate: string; clinicId?: string; roomId?: string }) =>
      api.post("/appointment/v1/doctor/slots/generate", payload).then((r) => r.data),
    cancelDate: (payload: { date: string; reason?: string }) =>
      api.post("/appointment/v1/doctor/slots/cancel-date", payload).then((r) => r.data),
    remove: (id: string) => api.delete(`/appointment/v1/doctor/slots/${id}`).then((r) => r.data),
  },
};
