import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AuthUser } from "@/types/api";

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  hydrated: boolean;
  remember: boolean;
  setSession: (token: string, user: AuthUser, remember: boolean) => void;
  setUser: (user: AuthUser | null) => void;
  setHydrated: (v: boolean) => void;
  clear: () => void;
}

const memoryStorage: Storage = {
  length: 0,
  clear: () => {},
  key: () => null,
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      hydrated: false,
      remember: true,
      setSession: (token, user, remember) => set({ token, user, remember }),
      setUser: (user) => set({ user }),
      setHydrated: (v) => set({ hydrated: v }),
      clear: () => set({ token: null, user: null }),
    }),
    {
      name: "iyadati-auth",
      storage: createJSONStorage(() =>
        typeof window === "undefined" ? memoryStorage : localStorage
      ),
      partialize: (s) => ({ token: s.token, user: s.user, remember: s.remember }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    }
  )
);