import { api } from '@/lib/api';
import { ensureArray } from '@/lib/utils';

export interface ServiceImage {
  id: string;
  imageUrl: string;
  createdAt?: string;
}

export interface ServiceDoctorAssignment {
  id: string;
  serviceId: string;
  doctorId: string;
  isPrimary?: boolean;
  doctor?: {
    id: string;
    firstName?: string;
    lastName?: string;
    name?: string;
    avatarUrl?: string;
    photoUrl?: string;
    specialtyName?: string;
  };
}

export interface ClinicService {
  id: string;
  nameFr: string;
  nameAr?: string;
  descriptionFr?: string;
  descriptionAr?: string;
  isActive?: boolean;
  sortOrder?: number;
  durationMinutes?: number;
  price?: number;
  images?: ServiceImage[];
  assignedDoctors?: ServiceDoctorAssignment[];
  createdAt?: string;
}

export interface CreateServicePayload {
  nameFr: string;
  nameAr?: string;
  descriptionFr?: string;
  descriptionAr?: string;
  sortOrder?: number;
  durationMinutes?: number;
  price?: number;
}

export interface UpdateServicePayload {
  nameFr?: string;
  nameAr?: string;
  descriptionFr?: string;
  descriptionAr?: string;
  isActive?: boolean;
  sortOrder?: number;
  durationMinutes?: number;
  price?: number;
}

export const clinicServicesApi = {
  list: async (): Promise<ClinicService[]> => {
    const raw = await api.get<unknown, unknown>('/clinic-services/v1/me');
    return ensureArray<ClinicService>(raw);
  },

  getDetail: async (id: string): Promise<ClinicService> => {
    return api.get<unknown, ClinicService>(`/clinic-services/v1/me/${id}`);
  },

  create: async (payload: CreateServicePayload): Promise<ClinicService> => {
    const body = {
      nameFr: payload.nameFr,
      nameAr: payload.nameAr || undefined,
      descriptionFr: payload.descriptionFr || undefined,
      descriptionAr: payload.descriptionAr || undefined,
      sortOrder: payload.sortOrder || undefined,
    };
    return api.post<unknown, ClinicService>('/clinic-services/v1/me', body);
  },

  update: async (id: string, payload: UpdateServicePayload): Promise<ClinicService> => {
    return api.patch<unknown, ClinicService>(`/clinic-services/v1/me/${id}`, payload);
  },

  delete: async (id: string): Promise<void> => {
    return api.delete(`/clinic-services/v1/me/${id}`);
  },

  uploadImage: async (id: string, formData: FormData): Promise<ServiceImage> => {
    return api.post<unknown, ServiceImage>(`/clinic-services/v1/me/${id}/images`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  deleteImage: async (id: string, imageId: string): Promise<void> => {
    return api.delete(`/clinic-services/v1/me/${id}/images/${imageId}`);
  },

  getAssignedDoctors: async (id: string): Promise<ServiceDoctorAssignment[]> => {
    const raw = await api.get<unknown, unknown>(`/clinic-services/v1/me/${id}/doctors`);
    return ensureArray<ServiceDoctorAssignment>(raw);
  },

  assignDoctor: async (
    id: string,
    payload: { doctorId: string; isPrimary?: boolean }
  ): Promise<ServiceDoctorAssignment> => {
    return api.post<unknown, ServiceDoctorAssignment>(`/clinic-services/v1/me/${id}/doctors`, payload);
  },

  unassignDoctor: async (id: string, doctorId: string): Promise<void> => {
    return api.delete(`/clinic-services/v1/me/${id}/doctors/${doctorId}`);
  },
};
