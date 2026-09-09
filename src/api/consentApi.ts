import { api } from "@/lib/api";

/* ------------------------------------------------------------------ *
 * Patient consent + medical documents, doctor side.
 * Backend: /api/v1/consent/v1/doctor/*
 * ------------------------------------------------------------------ */

export type ConsentLevel = "NONE" | "BASIC" | "LIMITED" | "FULL" | "CUSTOM" | string;

export interface ConsentPatientRow {
  id: string;
  patientId: string;
  doctorId: string;
  level: ConsentLevel;
  accessLevel: "FULL" | "LIMITED" | "NONE" | string;
  documentCount: number;
  customDocumentIds?: string[];
  expiresAt: string | null;
  isActive: boolean;
  consentedAt: string;
  revokedAt: string | null;
  patient?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
}

export interface PatientDocumentRow {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  title: string | null;
  description: string | null;
  docDate: string | null;
  /** Pre-signed URL produced by the backend — short lived. */
  accessUrl: string;
  accessedAt?: string;
}

function list<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    for (const key of ["documents", "items", "data", "results"]) {
      if (Array.isArray(d[key])) return d[key] as T[];
    }
  }
  return [];
}

/** Error shape used by the UI to distinguish "no consent" from a real failure. */
export interface ConsentError extends Error {
  noConsent?: boolean;
}

export const doctorConsentApi = {
  /** Patients who granted this doctor access to their records. */
  patients: async (): Promise<ConsentPatientRow[]> => {
    try {
      const res = await api.get("/consent/v1/doctor/patients");
      return list<ConsentPatientRow>(res.data);
    } catch {
      return [];
    }
  },

  /**
   * Documents this doctor may read for a given patient.
   * A 403 means the patient has not shared anything — surfaced as `noConsent`.
   */
  documents: async (
    patientId: string,
    params: { page?: number; limit?: number } = {},
  ): Promise<{ documents: PatientDocumentRow[]; total: number }> => {
    try {
      const res = await api.get(`/consent/v1/doctor/patients/${patientId}/documents`, {
        params: { page: params.page ?? 1, limit: params.limit ?? 50 },
      });
      const documents = list<PatientDocumentRow>(res.data);
      const meta = (res as unknown as { meta?: { total?: number } }).meta;
      return { documents, total: meta?.total ?? documents.length };
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 403 || status === 404) {
        const e = new Error("no-consent") as ConsentError;
        e.noConsent = true;
        throw e;
      }
      throw err;
    }
  },

  /** Doctor attaches a report/prescription to the patient's record. */
  upload: (patientId: string, formData: FormData) =>
    api
      .post<PatientDocumentRow>(`/consent/v1/doctor/patients/${patientId}/documents`, formData)
      .then((r) => r.data),
};
