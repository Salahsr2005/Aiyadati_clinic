import { api } from '@/lib/api';
import type { AuthResponse, AuthUser } from '@/types/api';

export interface ClinicLoginPayload {
  email: string;
  password: string;
}

export interface ClinicRegisterPayload {
  nameFr: string;
  nameAr?: string;
  email: string;
  phone: string;
  password: string;
  wilayaId: string | number;
  baladyaId?: string | number;
  facilityType?: string;
  descriptionAr?: string;
  descriptionFr?: string;
  latitude?: number;
  longitude?: number;
}

export const authApi = {
  loginClinic: async (payload: ClinicLoginPayload): Promise<AuthResponse> => {
    return api.post<unknown, AuthResponse>('/auth/v1/clinic/login', payload);
  },
  registerClinic: async (payload: ClinicRegisterPayload): Promise<AuthResponse> => {
    return api.post<unknown, AuthResponse>('/auth/v1/clinic/register', payload);
  },
  getMe: async (): Promise<AuthUser> => {
    return api.get<unknown, AuthUser>('/auth/v1/me');
  },
  logout: async (): Promise<void> => {
    return api.post('/auth/v1/logout');
  },
};