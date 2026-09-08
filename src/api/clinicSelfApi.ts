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
  type?: string;
  mimeType?: string;
  status?: string;
  createdAt?: string;
}

export interface ClinicWorkingHour {
  id?: string;
  dayOfWeek: number;
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
  createdAt?: string;
  doctor?: {
    id: string;
    firstName?: string;
    lastName?: string;
    name?: string;
    email?: string;
    phone?: string;
    avatarUrl?: string;
    photoUrl?: string;
    specialtyId?: string;
    specialtyName?: string;
    specialty?: { id: string; nameFr: string; nameAr: string };
  };
}

export interface ClinicGalleryItem {
  id: string;
  imageUrl: string;
  title?: string;
  sortOrder?: number;
  createdAt?: string;
}

export const clinicSelfApi = {
  getProfile: async (): Promise<ClinicProfile> => {
    const res = await api.get('/clinic/v1/me/profile');
    return res.data as ClinicProfile;
  },

  updateProfile: async (formData: FormData): Promise<ClinicProfile> => {
    const res = await api.patch('/clinic/v1/me/complete', formData);
    return res.data as ClinicProfile;
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
    const res = await api.post('/clinic/v1/me/working-hours', { hours });
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

  updateGalleryImage: async (id: string, payload: { sortOrder?: number; title?: string }): Promise<ClinicGalleryItem> => {
    const res = await api.patch(`/clinic/v1/me/gallery/${id}`, payload);
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
