import { useEffect } from "react";
import { create } from "zustand";

const BASE_Z = 1000;
const Z_STEP = 10;

interface ModalStackState {
  stack: string[];
  register: (id: string) => void;
  unregister: (id: string) => void;
  getZIndex: (id: string) => number;
}

export const useModalStackStore = create<ModalStackState>((set, get) => ({
  stack: [],
  register: (id) => {
    set((s) => {
      if (s.stack.includes(id)) return s;
      return { stack: [...s.stack, id] };
    });
  },
  unregister: (id) => {
    set((s) => ({ stack: s.stack.filter((x) => x !== id) }));
  },
  getZIndex: (id) => {
    const idx = get().stack.indexOf(id);
    return idx === -1 ? BASE_Z : BASE_Z + idx * Z_STEP;
  },
}));

/** Register an overlay layer and return z-index values for backdrop + content. */
export function useModalLayer(id: string, open: boolean) {
  const register = useModalStackStore((s) => s.register);
  const unregister = useModalStackStore((s) => s.unregister);
  const stack = useModalStackStore((s) => s.stack);

  useEffect(() => {
    if (!open) return;
    register(id);
    return () => unregister(id);
  }, [open, id, register, unregister]);

  const idx = open ? stack.indexOf(id) : -1;
  const zIndex = idx === -1 ? BASE_Z : BASE_Z + idx * Z_STEP;

  return { backdropZ: zIndex, contentZ: zIndex + 1 };
}
