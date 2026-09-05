import type { ReactNode } from "react";

/** Mounted once at app root — all overlays portal to document.body with shared z-index stacking. */
export function ModalRoot() {
  return null;
}

export type ModalPortalProps = {
  id: string;
  open: boolean;
  onClose: () => void;
  backdropClassName?: string;
  children: ReactNode;
  /** When true, clicking the backdrop calls onClose. */
  dismissOnBackdrop?: boolean;
};
