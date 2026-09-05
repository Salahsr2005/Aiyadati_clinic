import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ViewMode } from "@/components/data/ViewToggle";

export type Locale = "en" | "fr" | "ar";
/** @deprecated use ThemeMode */
export type Theme = "light" | "dark";
export type ThemeMode = "light" | "dark" | "system";
export type ColorPalette = "indigo" | "emerald" | "sunset" | "ocean";

export const COLOR_PALETTES: ColorPalette[] = ["indigo", "emerald", "sunset", "ocean"];

interface UIState {
  locale: Locale;
  themeMode: ThemeMode;
  colorPalette: ColorPalette;
  sidebarCollapsed: boolean;
  usersView: ViewMode;
  doctorsView: ViewMode;
  clinicsView: ViewMode;
  appointmentsView: ViewMode;
  setLocale: (l: Locale) => void;
  setThemeMode: (t: ThemeMode) => void;
  setColorPalette: (p: ColorPalette) => void;
  toggleSidebar: () => void;
  setUsersView: (v: ViewMode) => void;
  setDoctorsView: (v: ViewMode) => void;
  setClinicsView: (v: ViewMode) => void;
  setAppointmentsView: (v: ViewMode) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      locale: "fr",
      themeMode: "light",
      colorPalette: "indigo",
      sidebarCollapsed: false,
      usersView: "grid",
      doctorsView: "grid",
      clinicsView: "grid",
      appointmentsView: "kanban",
      setLocale: (locale) => set({ locale }),
      setThemeMode: (themeMode) => set({ themeMode }),
      setColorPalette: (colorPalette) => set({ colorPalette }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setUsersView: (usersView) => set({ usersView }),
      setDoctorsView: (doctorsView) => set({ doctorsView }),
      setClinicsView: (clinicsView) => set({ clinicsView }),
      setAppointmentsView: (appointmentsView) => set({ appointmentsView }),
    }),
    {
      name: "iyadati-ui",
      version: 2,
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Record<string, unknown>;
        if (version < 2) {
          const legacyTheme = state.theme as Theme | undefined;
          state.themeMode = legacyTheme === "dark" ? "dark" : legacyTheme === "light" ? "light" : "light";
          state.colorPalette = "indigo";
          delete state.theme;
        }
        if (!COLOR_PALETTES.includes(state.colorPalette as ColorPalette)) {
          state.colorPalette = "indigo";
        }
        if (!["light", "dark", "system"].includes(state.themeMode as string)) {
          state.themeMode = "light";
        }
        return state as unknown as UIState;
      },
    },
  ),
);
