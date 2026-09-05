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
    return api.get<unknown, ClinicProfile>('/clinic/v1/me/profile');
  },

  updateProfile: async (formData: FormData): Promise<ClinicProfile> => {
    return api.patch<unknown, ClinicProfile>('/clinic/v1/me/complete', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  getDocuments: async (): Promise<ClinicDocument[]> => {
    const raw = await api.get<unknown, unknown>('/clinic/v1/me/documents');
    return ensureArray<ClinicDocument>(raw);
  },

  uploadDocument: async (formData: FormData): Promise<ClinicDocument> => {
    return api.post<unknown, ClinicDocument>('/clinic/v1/me/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  deleteDocument: async (id: string): Promise<void> => {
    return api.delete(`/clinic/v1/me/documents/${id}`);
  },

  getWorkingHours: async (): Promise<ClinicWorkingHour[]> => {
    const raw = await api.get<unknown, unknown>('/clinic/v1/me/working-hours');
    return ensureArray<ClinicWorkingHour>(raw);
  },

  upsertWorkingHours: async (hours: ClinicWorkingHour[]): Promise<ClinicWorkingHour[]> => {
    const raw = await api.post<unknown, unknown>('/clinic/v1/me/working-hours', { hours });
    return ensureArray<ClinicWorkingHour>(raw);
  },

  getRooms: async (): Promise<ClinicRoom[]> => {
    const raw = await api.get<unknown, unknown>('/clinic/v1/me/rooms');
    return ensureArray<ClinicRoom>(raw);
  },

  createRoom: async (payload: { name: string; specialtyId?: string }): Promise<ClinicRoom> => {
    return api.post<unknown, ClinicRoom>('/clinic/v1/me/rooms', payload);
  },

  getDoctors: async (): Promise<ClinicDoctor[]> => {
    const raw = await api.get<unknown, unknown>('/clinic/v1/me/doctors');
    return ensureArray<ClinicDoctor>(raw);
  },

  inviteDoctor: async (doctorId: string): Promise<ClinicDoctor> => {
    return api.post<unknown, ClinicDoctor>('/clinic/v1/me/doctors/invite', { doctorId });
  },

  acceptDoctor: async (id: string): Promise<ClinicDoctor> => {
    return api.post<unknown, ClinicDoctor>(`/clinic/v1/me/doctors/${id}/accept`);
  },

  rejectDoctor: async (id: string): Promise<ClinicDoctor> => {
    return api.post<unknown, ClinicDoctor>(`/clinic/v1/me/doctors/${id}/reject`);
  },

  removeDoctor: async (id: string): Promise<void> => {
    return api.delete(`/clinic/v1/me/doctors/${id}`);
  },

  getGallery: async (): Promise<ClinicGalleryItem[]> => {
    const raw = await api.get<unknown, unknown>('/clinic/v1/me/gallery');
    return ensureArray<ClinicGalleryItem>(raw);
  },

  uploadGalleryImage: async (formData: FormData): Promise<ClinicGalleryItem> => {
    return api.post<unknown, ClinicGalleryItem>('/clinic/v1/me/gallery', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
