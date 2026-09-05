import { api } from "@/lib/api";
import type {
  AppointmentStats,
  ClinicStats,
  DoctorStats,
  OverviewStats,
  RevenueStats,
  UserStats,
} from "@/types/api";

export const analyticsApi = {
  overview: () =>
    api.get<OverviewStats>("/analytics/v1/overview").then((r) => r.data),
  appointments: () =>
    api.get<AppointmentStats>("/analytics/v1/appointments").then((r) => r.data),
  revenue: () => api.get<RevenueStats>("/analytics/v1/revenue").then((r) => r.data),
  users: () => api.get<UserStats>("/analytics/v1/users").then((r) => r.data),
  doctors: () => api.get<DoctorStats>("/analytics/v1/doctors").then((r) => r.data),
  clinics: () => api.get<ClinicStats>("/analytics/v1/clinics").then((r) => r.data),
};