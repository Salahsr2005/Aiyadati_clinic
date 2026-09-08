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
    const res = await api.get('/clinic-services/v1/me');
    return ensureArray<ClinicService>(res.data);
  },

  getDetail: async (id: string): Promise<ClinicService> => {
    const res = await api.get(`/clinic-services/v1/me/${id}`);
    return res.data as ClinicService;
  },

  create: async (payload: CreateServicePayload): Promise<ClinicService> => {
    const body = {
      nameFr: payload.nameFr,
      nameAr: payload.nameAr || undefined,
      descriptionFr: payload.descriptionFr || undefined,
      descriptionAr: payload.descriptionAr || undefined,
      sortOrder: payload.sortOrder || undefined,
    };
    const res = await api.post('/clinic-services/v1/me', body);
    return res.data as ClinicService;
  },

  update: async (id: string, payload: UpdateServicePayload): Promise<ClinicService> => {
    const res = await api.patch(`/clinic-services/v1/me/${id}`, payload);
    return res.data as ClinicService;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/clinic-services/v1/me/${id}`);
  },

  uploadImage: async (id: string, formData: FormData): Promise<ServiceImage> => {
    const res = await api.post(`/clinic-services/v1/me/${id}/images`, formData);
    return res.data as ServiceImage;
  },

  deleteImage: async (id: string, imageId: string): Promise<void> => {
    await api.delete(`/clinic-services/v1/me/${id}/images/${imageId}`);
  },

  getAssignedDoctors: async (id: string): Promise<ServiceDoctorAssignment[]> => {
    const res = await api.get(`/clinic-services/v1/me/${id}/doctors`);
    return ensureArray<ServiceDoctorAssignment>(res.data);
  },

  assignDoctor: async (
    id: string,
    payload: { doctorId: string; isPrimary?: boolean }
  ): Promise<ServiceDoctorAssignment> => {
    const res = await api.post(`/clinic-services/v1/me/${id}/doctors`, payload);
    return res.data as ServiceDoctorAssignment;
  },

  unassignDoctor: async (id: string, doctorId: string): Promise<void> => {
    await api.delete(`/clinic-services/v1/me/${id}/doctors/${doctorId}`);
  },
};
