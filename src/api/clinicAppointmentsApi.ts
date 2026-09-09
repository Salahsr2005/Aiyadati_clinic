import { api } from '@/lib/api';
import { normalizeList } from '@/lib/adminApi';
import { ensureArray } from '@/lib/utils';
import { usersApi, type UserRow } from '@/api/usersApi';
import type { Paginated } from '@/types/api';

export interface DoctorSlot {
  id: string;
  doctorId: string;
  clinicId?: string;
  roomId?: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  status?: string; // "available" | "booked" | "cancelled"
  isBooked?: boolean;
  isCancelled?: boolean;
  maxPatients?: number;
  currentPatients?: number;
  room?: { id: string; name: string };
  doctor?: { id: string; name?: string; firstName?: string; lastName?: string; firstNameFr?: string; lastNameFr?: string; avatarUrl?: string; photoUrl?: string };
}

export interface GuestPatient {
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

export type GuestPatientRow = GuestPatient;

export type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export interface ClinicAppointmentRow {
  id: string;
  slotId?: string;
  status: AppointmentStatus;
  type?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  notes?: string;
  cancelReason?: string;
  patientType?: 'REGISTERED' | 'GUEST';
  createdBy?: string;
  createdByType?: 'user' | 'doctor' | 'clinic';
  confirmedAt?: string;
  confirmedBy?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  createdAt?: string;
  updatedAt?: string;
  slot?: DoctorSlot;
  doctorId?: string;
  doctor?: {
    id: string;
    firstName?: string;
    lastName?: string;
    firstNameFr?: string;
    lastNameFr?: string;
    name?: string;
    avatarUrl?: string;
    photoUrl?: string;
    specialtyName?: string;
  };
  patientId?: string;
  patient?: {
    id: string;
    firstName?: string;
    lastName?: string;
    name?: string;
    email?: string;
    phone?: string;
    avatarUrl?: string;
    isGuest?: boolean;
  };
  guestPatientId?: string;
  guestPatient?: GuestPatient;
  clinicId?: string;
  contactUserId?: string;
  contactUser?: any;
}

export interface ClinicAppointmentParams {
  page?: number;
  limit?: number;
  date?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  doctorId?: string;
  search?: string;
}

export interface BookAppointmentPayload {
  slotId: string;
  type?: string;
  paymentMethod?: string;
  patientId?: string;
  guestPatient?: {
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
    dateOfBirth?: string;
    wilayaId?: string | number;
    notes?: string;
  };
  contactUserId?: string;
  notes?: string;
}

const guestPatientCache = new Map<string, GuestPatient>();

async function resolveMissingGuestPatients(items: ClinicAppointmentRow[]): Promise<ClinicAppointmentRow[]> {
  if (!items || items.length === 0) return items;

  const missingIds = Array.from(
    new Set(
      items
        .filter((r) => r.guestPatientId && (!r.guestPatient || !r.guestPatient.firstName) && !guestPatientCache.has(r.guestPatientId!))
        .map((r) => r.guestPatientId!)
    )
  );

  if (missingIds.length > 0) {
    await Promise.allSettled(
      missingIds.map(async (gid) => {
        try {
          const res = await api.get<unknown, any>(`/appointment/v1/guest-patients/${gid}`);
          const raw = (res && typeof res === "object" && "data" in res) ? (res as any).data : res;
          const g = raw as GuestPatient;
          if (g && (g.id || g.firstName)) {
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
          guestPatient: r.guestPatient ? { ...cached, ...r.guestPatient } : cached,
        };
      }
    }
    return r;
  });
}

export const clinicAppointmentsApi = {
  // All clinic slots
  listSlots: async (params?: { date?: string; startDate?: string; endDate?: string }): Promise<DoctorSlot[]> => {
    const raw = await api.get<unknown, unknown>(`/appointment/v1/clinic/slots`, { params });
    return ensureArray<DoctorSlot>(raw);
  },

  // Slots per doctor
  getDoctorSlots: async (
    doctorId: string,
    params?: { date?: string; startDate?: string; endDate?: string }
  ): Promise<DoctorSlot[]> => {
    const raw = await api.get<unknown, unknown>(`/appointment/v1/clinic/doctors/${doctorId}/slots`, {
      params,
    });
    return ensureArray<DoctorSlot>(raw);
  },

  generateDoctorSlots: async (
    doctorId: string,
    payload: { startDate: string; endDate: string; roomId?: string; force?: boolean }
  ): Promise<{ created: number; slots: DoctorSlot[] }> => {
    if (!doctorId || !doctorId.trim()) {
      throw new Error("Please select a doctor first to generate schedule slots.");
    }
    const res = await api.post(
      `/appointment/v1/clinic/doctors/${doctorId}/slots/generate`,
      payload
    );
    return res.data as { created: number; slots: DoctorSlot[] };
  },

  cancelDoctorSlotsDate: async (
    doctorId: string,
    payload: { date: string; reason?: string }
  ): Promise<{ cancelled: number }> => {
    if (!doctorId || !doctorId.trim()) {
      throw new Error("Please select a doctor first to cancel schedule slots.");
    }
    const res = await api.post(
      `/appointment/v1/clinic/doctors/${doctorId}/slots/cancel-date`,
      payload
    );
    return res.data as { cancelled: number };
  },

  addQuickDoctorSlot: async (
    doctorId: string,
    payload: { date: string; startTime: string; endTime: string; roomId?: string; maxPatients?: number }
  ): Promise<DoctorSlot> => {
    if (!doctorId || !doctorId.trim()) {
      throw new Error("Please select a doctor first to add a quick slot.");
    }
    const res = await api.post(
      `/appointment/v1/clinic/doctors/${doctorId}/slots/quick`,
      payload
    );
    return res.data as DoctorSlot;
  },

  // Clinic Appointments list
  listAppointments: async (
    params?: ClinicAppointmentParams
  ): Promise<Paginated<ClinicAppointmentRow>> => {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const raw = await api.get<unknown, unknown>('/appointment/v1/clinic/appointments', {
      params: { ...params, page, limit },
    });
    const listResult = normalizeList<ClinicAppointmentRow>(raw, page, limit);
    const resolvedItems = await resolveMissingGuestPatients(listResult.items || []);
    return {
      data: resolvedItems,
      total: listResult.total,
      page: listResult.page,
      limit: listResult.limit,
      totalPages: listResult.totalPages,
    };
  },

  // Book appointment on behalf of patient (with fallback for doctor-owned/unassigned slots)
  bookAppointment: async (payload: BookAppointmentPayload): Promise<ClinicAppointmentRow> => {
    try {
      return await api.post<unknown, ClinicAppointmentRow>('/appointment/v1/clinic/book', payload);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || '';
      const strMsg = typeof msg === 'string' ? msg : JSON.stringify(msg);
      if (
        strMsg.includes('Slot does not belong') ||
        strMsg.includes('not belong to your clinic') ||
        err?.response?.status === 400
      ) {
        try {
          return await api.post<unknown, ClinicAppointmentRow>('/appointment/v1/book', payload);
        } catch {
          throw err;
        }
      }
      throw err;
    }
  },

  // Update appointment status
  updateStatus: async (
    id: string,
    payload: { status: string; cancelReason?: string }
  ): Promise<ClinicAppointmentRow> => {
    return api.patch<unknown, ClinicAppointmentRow>(
      `/appointment/v1/clinic/appointments/${id}/status`,
      payload
    );
  },

  confirmAppointment: async (id: string, payload?: { notes?: string }): Promise<ClinicAppointmentRow> => {
    return api.post<unknown, ClinicAppointmentRow>(`/appointment/v1/appointments/${id}/confirm`, payload);
  },

  // Guest Patients CRUD
  listGuestPatients: async (params?: { page?: number; limit?: number; search?: string }): Promise<Paginated<GuestPatient>> => {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const raw = await api.get<unknown, unknown>('/appointment/v1/guest-patients', {
      params: { ...params, page, limit },
    });
    const listResult = normalizeList<GuestPatient>(raw, page, limit);
    return {
      data: listResult.items,
      total: listResult.total,
      page: listResult.page,
      limit: listResult.limit,
      totalPages: listResult.totalPages,
    };
  },

  searchGuestPatients: async (query: string): Promise<GuestPatient[]> => {
    const raw = await api.get<unknown, unknown>('/appointment/v1/guest-patients/search', {
      params: { query },
    });
    return ensureArray<GuestPatient>(raw);
  },

  searchAppPatients: async (query: string): Promise<UserRow[]> => {
    const term = query.trim();
    if (!term || term.length < 2) return [];

    const resultsMap = new Map<string, UserRow>();
    const addResult = (u: any) => {
      if (!u) return;
      const id = u.id || u.userId || u.patientId;
      if (!id) return;
      if (!resultsMap.has(id)) {
        resultsMap.set(id, u);
      }
    };

    // 1. General search via /user/v1
    try {
      const res = await usersApi.list({ search: term, limit: 20 });
      (res.items || []).forEach(addResult);
    } catch {
      // Fallback
    }

    // 2. Direct phone lookup if numeric
    if (/^[0-9+\s-]{4,}$/.test(term)) {
      try {
        const res = await api.get<unknown, any>(`/user/v1/phone/${encodeURIComponent(term)}`);
        const raw = (res && typeof res === "object" && "data" in res) ? (res as any).data : res;
        if (raw && (raw.id || raw.email)) addResult(raw);
      } catch {
        // Fallback
      }
    }

    // 3. Direct email lookup if contains @
    if (term.includes("@")) {
      try {
        const u = await usersApi.getByEmail(term);
        if (u && u.id) addResult(u);
      } catch {
        // Fallback
      }
    }

    return Array.from(resultsMap.values());
  },

  createGuestPatient: async (payload: Omit<GuestPatient, 'id' | 'createdAt'>): Promise<GuestPatient> => {
    return api.post<unknown, GuestPatient>('/appointment/v1/guest-patients', payload);
  },

  getGuestPatient: async (id: string): Promise<GuestPatient> => {
    return api.get<unknown, GuestPatient>(`/appointment/v1/guest-patients/${id}`);
  },

  updateGuestPatient: async (id: string, payload: Partial<GuestPatient>): Promise<GuestPatient> => {
    return api.patch<unknown, GuestPatient>(`/appointment/v1/guest-patients/${id}`, payload);
  },
};
