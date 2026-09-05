import { create } from "zustand";

export type DatePreset = "today" | "yesterday" | "7d" | "30d" | "90d" | "12m" | "all";

export interface DashboardFiltersState {
  datePreset: DatePreset;
  customFrom?: string; // ISO date string YYYY-MM-DD
  customTo?: string; // ISO date string YYYY-MM-DD
  doctorId?: string;
  clinicId?: string;
  specialtyId?: string;
  wilayaId?: string;
  status?: string;
  
  setDatePreset: (preset: DatePreset) => void;
  setCustomRange: (from?: string, to?: string) => void;
  setDoctorId: (id?: string) => void;
  setClinicId: (id?: string) => void;
  setSpecialtyId: (id?: string) => void;
  setWilayaId: (id?: string) => void;
  setStatus: (status?: string) => void;
  resetFilters: () => void;
}

export const useDashboardFiltersStore = create<DashboardFiltersState>((set) => ({
  datePreset: "30d",
  customFrom: undefined,
  customTo: undefined,
  doctorId: undefined,
  clinicId: undefined,
  specialtyId: undefined,
  wilayaId: undefined,
  status: undefined,

  setDatePreset: (datePreset) =>
    set({ datePreset, customFrom: undefined, customTo: undefined }),
  setCustomRange: (customFrom, customTo) =>
    set({ datePreset: "all", customFrom, customTo }),
  setDoctorId: (doctorId) => set({ doctorId }),
  setClinicId: (clinicId) => set({ clinicId }),
  setSpecialtyId: (specialtyId) => set({ specialtyId }),
  setWilayaId: (wilayaId) => set({ wilayaId }),
  setStatus: (status) => set({ status }),
  resetFilters: () =>
    set({
      datePreset: "30d",
      customFrom: undefined,
      customTo: undefined,
      doctorId: undefined,
      clinicId: undefined,
      specialtyId: undefined,
      wilayaId: undefined,
      status: undefined,
    }),
}));
