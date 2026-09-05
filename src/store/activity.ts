import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ActivityLevel = "info" | "success" | "warning" | "danger";

export interface ActivityEntry {
  id: string;
  ts: number;
  actor?: string;
  action: string;
  resource: string;
  resourceId?: string;
  target?: string;
  level: ActivityLevel;
  meta?: Record<string, unknown>;
}

interface ActivityState {
  entries: ActivityEntry[];
  log: (entry: Omit<ActivityEntry, "id" | "ts">) => void;
  clear: () => void;
}

const MAX = 500;

export const useActivityStore = create<ActivityState>()(
  persist(
    (set) => ({
      entries: [],
      log: (entry) =>
        set((s) => ({
          entries: [
            {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              ts: Date.now(),
              ...entry,
            },
            ...s.entries,
          ].slice(0, MAX),
        })),
      clear: () => set({ entries: [] }),
    }),
    { name: "iyadati.activity.v1" },
  ),
);

export function logActivity(entry: Omit<ActivityEntry, "id" | "ts">) {
  useActivityStore.getState().log(entry);
}
