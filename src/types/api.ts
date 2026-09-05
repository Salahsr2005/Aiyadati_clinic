// API response types for Iyadati backend
// All endpoints under https://api.serirsalah.me/api/v1/*

export type Role = "SUPER_ADMIN" | "ADMIN" | "USER" | "DOCTOR" | "CLINIC" | string;

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  role: Role;
  adminRole?: string;
  avatarUrl?: string;
  [key: string]: unknown;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface ErrorResponse {
  message?: string;
  error?: string;
  errors?: ValidationError[];
  statusCode?: number;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages?: number;
}

// ==== Analytics ====
export interface OverviewStats {
  totalUsers: number;
  totalDoctors: number;
  totalClinics: number;
  totalAppointments: number;
  totalRevenue: number;
  completedAppointments?: number;
  cancelledAppointments?: number;
  [key: string]: unknown;
}

export interface AppointmentStats {
  total?: number;
  byStatus?: Array<{ status: string; count: number }>;
  byDate?: Array<{ date: string; count: number }>;
  [key: string]: unknown;
}

export interface RevenueStats {
  total?: number;
  byMonth?: Array<{ month: string; amount: number; count?: number }>;
  [key: string]: unknown;
}

export interface UserStats {
  total?: number;
  byTrustLevel?: Array<{ level: string; count: number }>;
  byWilaya?: Array<{ wilayaId: string | number; wilayaName?: string; count: number }>;
  [key: string]: unknown;
}

export interface DoctorStats {
  total?: number;
  topByAppointments?: TopDoctor[];
  topByRating?: TopDoctor[];
  [key: string]: unknown;
}

export interface TopDoctor {
  doctorId: string;
  doctorName: string;
  count: number;
  avgRating?: number;
  [key: string]: unknown;
}

export interface ClinicStats {
  total?: number;
  topByAppointments?: TopClinic[];
  topByRating?: TopClinic[];
  [key: string]: unknown;
}

export interface TopClinic {
  clinicId: string;
  clinicName: string;
  count: number;
  avgRating?: number;
  [key: string]: unknown;
}

// ==== Wilaya / Baladya ====
export interface Wilaya {
  id: string | number;
  nameFr: string;
  nameAr: string;
  code?: string;
  baladyatCount?: number;
}

export interface Baladya {
  id: string | number;
  wilayaId: string | number;
  nameFr: string;
  nameAr: string;
}