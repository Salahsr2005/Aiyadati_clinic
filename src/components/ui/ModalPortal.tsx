import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useModalLayer } from "@/store/modalStack";
import type { ModalPortalProps } from "@/components/ui/modal-root";
import { cn } from "@/lib/utils";

export function ModalPortal({
  id,
  open,
  onClose,
  backdropClassName = "fixed inset-0 bg-black/50 backdrop-blur-sm",
  children,
  dismissOnBackdrop = true,
  layout = "center",
}: ModalPortalProps & { layout?: "center" | "custom" }) {
  const { backdropZ, contentZ } = useModalLayer(id, open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ zIndex: backdropZ }}
            className={cn(backdropClassName, layout === "center" && "grid place-items-center p-4")}
            onClick={dismissOnBackdrop ? onClose : undefined}
          />
          <div
            style={{ zIndex: contentZ }}
            className={layout === "center" ? "pointer-events-none fixed inset-0 grid place-items-center p-4" : undefined}
            onClick={layout === "center" ? onClose : undefined}
          >
            <div
              className={layout === "center" ? "pointer-events-auto" : undefined}
              onClick={(e) => e.stopPropagation()}
            >
              {children}
            </div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
