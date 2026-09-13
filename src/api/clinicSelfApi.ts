import { api } from '@/lib/api';
import { ensureArray } from '@/lib/utils';

export interface ClinicProfile {
  id: string;
  nameFr: string;
  nameAr?: string;
  email?: string;
  phone?: string;
  facilityType?: string;
  descriptionFr?: string;
  descriptionAr?: string;
  logoUrl?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  wilayaId?: string | number;
  baladyaId?: string | number;
  wilaya?: { id: string | number; nameFr: string; nameAr: string };
  baladya?: { id: string | number; nameFr: string; nameAr: string };
  isVerified?: boolean;
  isActive?: boolean;
  reviewsVisible?: boolean;
  [key: string]: unknown;
}

export interface ClinicDocument {
  id: string;
  name: string;
  fileUrl: string;
  filePath?: string;
  accessUrl?: string;
  fileId?: string;
  type?: string;
  mimeType?: string;
  status?: string;
  createdAt?: string;
}

export const DAY_OF_WEEK_ENUMS = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
] as const;

export type DayOfWeekEnum = (typeof DAY_OF_WEEK_ENUMS)[number];

export function toDayOfWeekEnum(day: number | string): DayOfWeekEnum {
  if (typeof day === "number") {
    return DAY_OF_WEEK_ENUMS[Math.abs(Math.floor(day)) % 7] || "SUNDAY";
  }
  const str = String(day).trim().toUpperCase();
  if (DAY_OF_WEEK_ENUMS.includes(str as DayOfWeekEnum)) {
    return str as DayOfWeekEnum;
  }
  const parsed = parseInt(str, 10);
  if (!isNaN(parsed)) {
    return DAY_OF_WEEK_ENUMS[Math.abs(parsed) % 7] || "SUNDAY";
  }
  return "SUNDAY";
}

export interface ClinicWorkingHour {
  id?: string;
  dayOfWeek: number | DayOfWeekEnum | string;
  openTime: string;
  closeTime: string;
  isOpen: boolean;
}

export interface ClinicRoom {
  id: string;
  name: string;
  specialtyId?: string;
  specialty?: { id: string; nameFr: string; nameAr: string };
  isActive?: boolean;
}

export interface ClinicDoctor {
  id: string;
  doctorId: string;
  clinicId: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  isActive: boolean;
  invitedBy?: string;
  createdAt?: string;
  doctor?: {
    id: string;
    firstName?: string;
    lastName?: string;
    firstNameFr?: string;
    firstNameAr?: string;
    lastNameFr?: string;
    lastNameAr?: string;
    name?: string;
    email?: string;
    phone?: string;
    avatarUrl?: string;
    photoUrl?: string;
    photoPath?: string;
    specialtyId?: string;
    specialtyName?: string;
    specialties?: Array<{
      id?: string;
      nameFr?: string;
      nameAr?: string;
      specialty?: { id: string; nameFr: string; nameAr: string };
    }>;
    specialty?: { id: string; nameFr: string; nameAr: string };
    practiceType?: 'INDEPENDENT' | 'CLINIC_BASED' | 'BOTH';
    yearsOfExp?: number;
    bioFr?: string;
    bioAr?: string;
    wilayaId?: string;
    baladyaId?: string;
    wilaya?: { id: string; nameFr: string; nameAr: string };
    baladya?: { id: string; nameFr: string; nameAr: string };
    isVerified?: boolean;
  };
}

export interface CreateClinicDoctorPayload {
  email: string;
  firstNameFr: string;
  firstNameAr: string;
  lastNameFr: string;
  lastNameAr: string;
  phone: string;
  wilayaId: string;
  baladyaId?: string;
  specialtyIds: string[];
  bioFr?: string;
  bioAr?: string;
  yearsOfExp?: number;
  practiceType?: 'INDEPENDENT' | 'CLINIC_BASED' | 'BOTH';
  latitude?: number;
  longitude?: number;
  logo?: File | null;
}

export interface ClinicGalleryItem {
  id: string;
  imageUrl: string;
  imagePath?: string;
  filePath?: string;
  captionFr?: string | null;
  captionAr?: string | null;
  title?: string;
  sortOrder?: number;
  isActive?: boolean;
  createdAt?: string;
}

export const clinicSelfApi = {
  getProfile: async (): Promise<ClinicProfile> => {
    const res = await api.get('/clinic/v1/me/profile');
    return res.data as ClinicProfile;
  },

  updateProfile: async (formData: FormData): Promise<ClinicProfile> => {
    try {
      const res = await api.patch('/clinic/v1/me/complete', formData);
      return res.data as ClinicProfile;
    } catch (err: any) {
      // Fallback if complete profile endpoint reports already completed
      try {
        const res = await api.patch('/clinic/v1/me/profile', formData);
        return res.data as ClinicProfile;
      } catch {
        throw err;
      }
    }
  },

  getDocuments: async (): Promise<ClinicDocument[]> => {
    const res = await api.get('/clinic/v1/me/documents');
    return ensureArray<ClinicDocument>(res.data);
  },

  uploadDocument: async (formData: FormData): Promise<ClinicDocument> => {
    const res = await api.post('/clinic/v1/me/documents', formData);
    return res.data as ClinicDocument;
  },

  deleteDocument: async (id: string): Promise<void> => {
    await api.delete(`/clinic/v1/me/documents/${id}`);
  },

  getWorkingHours: async (): Promise<ClinicWorkingHour[]> => {
    const res = await api.get('/clinic/v1/me/working-hours');
    return ensureArray<ClinicWorkingHour>(res.data);
  },

  upsertWorkingHours: async (hours: ClinicWorkingHour[]): Promise<ClinicWorkingHour[]> => {
    const formattedHours = hours.map((h) => ({
      dayOfWeek: toDayOfWeekEnum(h.dayOfWeek),
      openTime: h.openTime || "08:00",
      closeTime: h.closeTime || "17:00",
      isOpen: Boolean(h.isOpen),
    }));
    const res = await api.post('/clinic/v1/me/working-hours', { hours: formattedHours });
    return ensureArray<ClinicWorkingHour>(res.data);
  },

  getRooms: async (): Promise<ClinicRoom[]> => {
    const res = await api.get('/clinic/v1/me/rooms');
    return ensureArray<ClinicRoom>(res.data);
  },

  createRoom: async (payload: { name: string; specialtyId?: string }): Promise<ClinicRoom> => {
    const res = await api.post('/clinic/v1/me/rooms', payload);
    return res.data as ClinicRoom;
  },

  updateRoom: async (id: string, payload: Partial<Pick<ClinicRoom, 'name' | 'specialtyId'>>): Promise<ClinicRoom> => {
    const res = await api.patch(`/clinic/v1/me/rooms/${id}`, payload);
    return res.data as ClinicRoom;
  },

  toggleRoomActive: async (id: string, isActive: boolean): Promise<ClinicRoom> => {
    const res = await api.patch(`/clinic/v1/me/rooms/${id}`, { isActive });
    return res.data as ClinicRoom;
  },

  deleteRoom: async (id: string): Promise<void> => {
    await api.delete(`/clinic/v1/me/rooms/${id}`);
  },

  getDoctors: async (): Promise<ClinicDoctor[]> => {
    const res = await api.get('/clinic/v1/me/doctors');
    return ensureArray<ClinicDoctor>(res.data);
  },

  createDoctor: async (payload: CreateClinicDoctorPayload | FormData): Promise<ClinicDoctor> => {
    let body: FormData;
    if (payload instanceof FormData) {
      body = payload;
    } else {
      body = new FormData();
      body.append("email", payload.email.trim().toLowerCase());
      body.append("firstNameFr", payload.firstNameFr.trim());
      body.append("firstNameAr", payload.firstNameAr.trim());
      body.append("lastNameFr", payload.lastNameFr.trim());
      body.append("lastNameAr", payload.lastNameAr.trim());
      body.append("phone", payload.phone.trim());
      body.append("wilayaId", payload.wilayaId);
      if (payload.baladyaId) body.append("baladyaId", payload.baladyaId);
      body.append("specialtyIds", JSON.stringify(payload.specialtyIds));
      if (payload.bioFr) body.append("bioFr", payload.bioFr.trim());
      if (payload.bioAr) body.append("bioAr", payload.bioAr.trim());
      if (payload.yearsOfExp !== undefined) body.append("yearsOfExp", String(payload.yearsOfExp));
      if (payload.practiceType) body.append("practiceType", payload.practiceType);
      if (payload.latitude !== undefined) body.append("latitude", String(payload.latitude));
      if (payload.longitude !== undefined) body.append("longitude", String(payload.longitude));
      if (payload.logo) body.append("logo", payload.logo);
    }
    const res = await api.post('/clinic/v1/me/doctors', body);
    return res.data as ClinicDoctor;
  },

  inviteDoctor: async (doctorId: string): Promise<ClinicDoctor> => {
    const res = await api.post('/clinic/v1/me/doctors/invite', { doctorId });
    return res.data as ClinicDoctor;
  },

  acceptDoctor: async (id: string): Promise<ClinicDoctor> => {
    const res = await api.post(`/clinic/v1/me/doctors/${id}/accept`);
    return res.data as ClinicDoctor;
  },

  rejectDoctor: async (id: string): Promise<ClinicDoctor> => {
    const res = await api.post(`/clinic/v1/me/doctors/${id}/reject`);
    return res.data as ClinicDoctor;
  },

  removeDoctor: async (id: string): Promise<void> => {
    await api.delete(`/clinic/v1/me/doctors/${id}`);
  },

  getGallery: async (): Promise<ClinicGalleryItem[]> => {
    const res = await api.get('/clinic/v1/me/gallery');
    return ensureArray<ClinicGalleryItem>(res.data);
  },

  uploadGalleryImage: async (formData: FormData): Promise<ClinicGalleryItem> => {
    const res = await api.post('/clinic/v1/me/gallery', formData);
    return res.data as ClinicGalleryItem;
  },

  updateGalleryImage: async (
    id: string,
    payload: { captionFr?: string | null; captionAr?: string | null; sortOrder?: number; title?: string }
  ): Promise<ClinicGalleryItem> => {
    const body: Record<string, unknown> = {};
    if (payload.captionFr !== undefined) body.captionFr = payload.captionFr;
    if (payload.captionAr !== undefined) body.captionAr = payload.captionAr;
    if (payload.sortOrder !== undefined) body.sortOrder = payload.sortOrder;
    if (payload.title !== undefined && payload.captionFr === undefined) {
      body.captionFr = payload.title;
    }
    const res = await api.patch(`/clinic/v1/me/gallery/${id}`, body);
    return res.data as ClinicGalleryItem;
  },

  deleteGalleryImage: async (id: string): Promise<void> => {
    await api.delete(`/clinic/v1/me/gallery/${id}`);
  },

  /**
   * Search for platform doctors for invitation purposes.
   * Tries public endpoint first, falls back to admin endpoint.
   * Returns empty array on failure (no 403 propagation).
   */
  searchPlatformDoctors: async (search?: string, limit = 20): Promise<Array<{
    id: string;
    email?: string;
    firstNameFr?: string;
    firstNameAr?: string;
    lastNameFr?: string;
    lastNameAr?: string;
    phone?: string;
    photoUrl?: string;
    specialties?: Array<{ specialty?: { id: string; nameFr?: string; nameAr?: string } }>;
    isVerified?: boolean;
  }>> => {
    const term = (search || "").trim();
    const params: Record<string, unknown> = { limit };
    if (term) params.search = term;

    // Try public doctor search first
    try {
      const res = await api.get('/public/v1/doctors', { params });
      const raw = res.data;
      if (Array.isArray(raw)) return raw;
      if (raw && typeof raw === "object") {
        if (Array.isArray((raw as any).items)) return (raw as any).items;
        if (Array.isArray((raw as any).data)) return (raw as any).data;
      }
    } catch {
      // public endpoint may not exist
    }

    // Fallback: try doctor list endpoint
    try {
      const res = await api.get('/doctor/v1', { params });
      const raw = res.data;
      if (Array.isArray(raw)) return raw;
      if (raw && typeof raw === "object") {
        if (Array.isArray((raw as any).items)) return (raw as any).items;
        if (Array.isArray((raw as any).data)) return (raw as any).data;
      }
    } catch {
      // admin endpoint forbidden for clinic tokens — return empty
    }

    return [];
  },
};
