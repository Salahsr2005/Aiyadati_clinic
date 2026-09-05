import { api } from "@/lib/api";
import { applyMeta, normalizeList, type ListResult } from "@/lib/adminApi";

export type AppointmentStatus =
  | "PENDING" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
export type AppointmentType = "IN_PERSON" | "VIDEO" | "HOME_VISIT";
export type PaymentMethod = "ON_SITE" | "CREDIT" | "CARD" | "CASH";

export interface AppointmentSlot {
  id: string;
  doctorId: string;
  clinicId?: string | null;
  roomId?: string | null;
  date: string;
  startTime: string;
  endTime: string;
  status?: string;
  maxPatients?: number;
  currentPatients?: number;
}

export interface AppointmentDoctor {
  id: string;
  firstNameFr?: string;
  lastNameFr?: string;
  firstNameAr?: string;
  lastNameAr?: string;
  photoUrl?: string;
}

export interface AppointmentPatient {
  id: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  avatarUrl?: string;
}

export interface GuestPatientRow {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string | null;
  dateOfBirth?: string | null;
  wilayaId?: string | null;
  notes?: string | null;
  createdBy?: string;
  createdAt?: string;
}

export interface AppointmentClinic {
  id: string;
  nameFr?: string;
  nameAr?: string;
  logoUrl?: string;
}

export interface AppointmentRow {
  id: string;
  slotId: string;
  slot?: AppointmentSlot;
  doctorId: string;
  doctor?: AppointmentDoctor;
  patientId?: string | null;
  patient?: AppointmentPatient | null;
  patientType?: "REGISTERED" | "GUEST" | string;
  guestPatientId?: string | null;
  guestPatient?: GuestPatientRow | AppointmentPatient | null;
  contactUserId?: string | null;
  contactUser?: AppointmentPatient | null;
  clinicId?: string | null;
  clinic?: AppointmentClinic | null;
  type?: AppointmentType | string;
  paymentMethod?: PaymentMethod | string;
  status?: AppointmentStatus | string;
  notes?: string | null;
  createdBy?: string;
  createdByType?: string;
  cancelledAt?: string | null;
  cancelledBy?: string | null;
  cancelledByRole?: "DOCTOR" | "PATIENT" | "CLINIC" | "ADMIN" | string | null;
  cancelReason?: string | null;
  confirmedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
  amount?: number;
}

export interface AppointmentListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  type?: string;
  paymentMethod?: string;
  doctorId?: string;
  patientId?: string;
  clinicId?: string;
  from?: string;
  to?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

function clean(p: Record<string, unknown>) {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(p)) {
    if (v === undefined || v === null || v === "") continue;
    if (typeof v === "boolean") out[k] = v ? "true" : "false";
    else out[k] = v as string | number;
  }
  return out;
}

export const appointmentsApi = {
  list: async (params: AppointmentListParams = {}): Promise<ListResult<AppointmentRow>> => {
    const res = await api.get("/appointment/v1/admin/appointments", {
      params: clean(params as Record<string, unknown>),
    });
    const meta = (res as unknown as { meta?: unknown }).meta;
    return applyMeta(
      normalizeList<AppointmentRow>(res.data, params.page ?? 1, params.limit ?? 20),
      meta,
    );
  },
  getById: async (id: string): Promise<AppointmentRow> => {
    const res = await api.get(`/appointment/v1/${id}`);
    return res.data as AppointmentRow;
  },
};

export function fullDoctorName(d?: AppointmentDoctor, locale: string = "fr") {
  if (!d) return "";
  const first = locale === "ar" ? d.firstNameAr || d.firstNameFr : d.firstNameFr || d.firstNameAr;
  const last = locale === "ar" ? d.lastNameAr || d.lastNameFr : d.lastNameFr || d.lastNameAr;
  return [first, last].filter(Boolean).join(" ");
}

export function fullPatientName(
  p?: AppointmentRow | AppointmentPatient | null,
  guestPatient?: GuestPatientRow | AppointmentPatient | null,
  contactUser?: AppointmentPatient | null,
): string {
  if (!p) {
    const target = guestPatient || contactUser;
    if (!target) return "";
    return [target.firstName, target.lastName].filter(Boolean).join(" ");
  }

  if (typeof p === "object") {
    const row = p as any;

    // 1. Direct name properties on object
    if (row.firstName || row.lastName) {
      const name = [row.firstName, row.lastName].filter(Boolean).join(" ");
      if (name) return name;
    }
    if (row.guestFirstName || row.guestLastName) {
      const name = [row.guestFirstName, row.guestLastName].filter(Boolean).join(" ");
      if (name) return name;
    }
    if (row.patientFirstName || row.patientLastName) {
      const name = [row.patientFirstName, row.patientLastName].filter(Boolean).join(" ");
      if (name) return name;
    }
    if (row.guestName) return String(row.guestName);
    if (row.patientName) return String(row.patientName);
    if (row.contactName) return String(row.contactName);
    if (row.name) return String(row.name);

    // 2. Nested objects on row
    const target = row.patient || row.guestPatient || row.contactUser || guestPatient || contactUser;
    if (target) {
      const name = [target.firstName, target.lastName].filter(Boolean).join(" ");
      if (name) return name;
      if (target.name) return String(target.name);
    }
  }

  const fallbackTarget = (p as AppointmentPatient) || guestPatient || contactUser;
  if (!fallbackTarget) return "";
  return [fallbackTarget.firstName, fallbackTarget.lastName].filter(Boolean).join(" ");
}

export function getPatientPhone(p?: AppointmentRow | AppointmentPatient | null): string {
  if (!p) return "—";
  if (typeof p === "object") {
    const row = p as any;
    if (row.phone) return String(row.phone);
    if (row.guestPhone) return String(row.guestPhone);
    if (row.contactPhone) return String(row.contactPhone);
    const target = row.patient || row.guestPatient || row.contactUser;
    if (target?.phone) return String(target.phone);
  }
  return "—";
}

export function getCancellationOrigin(
  r?: AppointmentRow | null,
  lang: string = "fr"
): { role: string; label: string } {
  if (!r) return { role: "UNKNOWN", label: getCancelLabel("UNKNOWN", lang) };
  const row = r as any;

  const st = String(row.status || "").toUpperCase();
  if (st !== "CANCELLED") {
    return { role: "NONE", label: "" };
  }

  // 1. Explicit cancelledByRole / canceledByRole / cancelledRole
  const explicitRole = String(
    row.cancelledByRole ||
    row.canceledByRole ||
    row.cancelledRole ||
    row.canceledRole ||
    ""
  ).toUpperCase();

  if (explicitRole.includes("PATIENT") || explicitRole.includes("USER")) {
    return { role: "PATIENT", label: getCancelLabel("PATIENT", lang) };
  }
  if (explicitRole.includes("DOCTOR") || explicitRole.includes("PRACTITIONER")) {
    return { role: "DOCTOR", label: getCancelLabel("DOCTOR", lang) };
  }
  if (explicitRole.includes("CLINIC") || explicitRole.includes("FACILITY")) {
    return { role: "CLINIC", label: getCancelLabel("CLINIC", lang) };
  }
  if (explicitRole.includes("ADMIN") || explicitRole.includes("SUPERADMIN")) {
    return { role: "ADMIN", label: getCancelLabel("ADMIN", lang) };
  }
  if (explicitRole.includes("SYSTEM") || explicitRole.includes("EXPIRED")) {
    return { role: "SYSTEM", label: getCancelLabel("SYSTEM", lang) };
  }

  // 2. Inspect cancelledBy / canceledBy string against entity IDs and role patterns
  const cb = String(row.cancelledBy || row.canceledBy || "");
  if (cb) {
    const cbUpper = cb.toUpperCase();
    if (cbUpper.includes("PATIENT") || cbUpper.includes("USER")) {
      return { role: "PATIENT", label: getCancelLabel("PATIENT", lang) };
    }
    if (cbUpper.includes("DOCTOR") || cbUpper.includes("PRACTITIONER")) {
      return { role: "DOCTOR", label: getCancelLabel("DOCTOR", lang) };
    }
    if (cbUpper.includes("CLINIC") || cbUpper.includes("FACILITY")) {
      return { role: "CLINIC", label: getCancelLabel("CLINIC", lang) };
    }

    // Compare UUIDs
    if (row.doctorId && cb === String(row.doctorId)) {
      return { role: "DOCTOR", label: getCancelLabel("DOCTOR", lang) };
    }
    if (row.patientId && cb === String(row.patientId)) {
      return { role: "PATIENT", label: getCancelLabel("PATIENT", lang) };
    }
    if (row.guestPatientId && cb === String(row.guestPatientId)) {
      return { role: "PATIENT", label: getCancelLabel("PATIENT", lang) };
    }
    if (row.patient?.id && cb === String(row.patient.id)) {
      return { role: "PATIENT", label: getCancelLabel("PATIENT", lang) };
    }
    if (row.contactUserId && cb === String(row.contactUserId)) {
      return { role: "PATIENT", label: getCancelLabel("PATIENT", lang) };
    }
    if (row.clinicId && cb === String(row.clinicId)) {
      return { role: "CLINIC", label: getCancelLabel("CLINIC", lang) };
    }
    if (row.createdBy && cb === String(row.createdBy)) {
      const cbt = String(row.createdByType || "").toLowerCase();
      if (cbt === "user" || cbt === "patient") {
        return { role: "PATIENT", label: getCancelLabel("PATIENT", lang) };
      }
      if (cbt === "doctor") {
        return { role: "DOCTOR", label: getCancelLabel("DOCTOR", lang) };
      }
    }
  }

  // 3. Fallback: inspect cancelReason text
  const reason = String(row.cancelReason || "").toLowerCase();
  if (reason.includes("patient") || reason.includes("user") || reason.includes("client")) {
    return { role: "PATIENT", label: getCancelLabel("PATIENT", lang) };
  }
  if (reason.includes("doctor") || reason.includes("schedule") || reason.includes("practitioner")) {
    return { role: "DOCTOR", label: getCancelLabel("DOCTOR", lang) };
  }

  // 4. Fallback: check createdByType if cancelledAt exists
  if (row.cancelledAt) {
    if (String(row.createdByType || "").toLowerCase() === "user") {
      return { role: "PATIENT", label: getCancelLabel("PATIENT", lang) };
    }
  }

  return { role: "UNKNOWN", label: getCancelLabel("UNKNOWN", lang) };
}

function getCancelLabel(role: string, lang: string): string {
  const isAr = lang.startsWith("ar");
  const isEn = lang.startsWith("en");
  switch (role) {
    case "PATIENT":
      return isAr ? "ملغى من المريض" : isEn ? "Canceled by Patient" : "Annulé par le patient";
    case "DOCTOR":
      return isAr ? "ملغى من الطبيب" : isEn ? "Canceled by Doctor" : "Annulé par le médecin";
    case "CLINIC":
      return isAr ? "ملغى من العيادة" : isEn ? "Canceled by Clinic" : "Annulé par la clinique";
    case "ADMIN":
      return isAr ? "ملغى من المشرف" : isEn ? "Canceled by Admin" : "Annulé par l'administrateur";
    case "SYSTEM":
      return isAr ? "منتهي تلقائياً (النظام)" : isEn ? "Auto-expired (System)" : "Expiré (Système)";
    default:
      return isAr ? "ملغى" : isEn ? "Canceled" : "Annulé";
  }
}