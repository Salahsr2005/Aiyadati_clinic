import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useModalLayer } from "@/store/modalStack";

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = "max-w-xl",
  id = "drawer",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children?: ReactNode;
  footer?: ReactNode;
  width?: string;
  id?: string;
}) {
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
            onClick={onClose}
            style={{ zIndex: backdropZ }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            style={{ zIndex: contentZ }}
            className={`fixed inset-y-0 end-0 flex w-full ${width} flex-col bg-background shadow-2xl rtl:left-0 rtl:right-auto`}
          >
            <div className="glass flex items-start justify-between gap-4 rounded-none border-b px-5 py-4">
              <div className="min-w-0">
                {title && <div className="truncate text-base font-semibold">{title}</div>}
                {subtitle && (
                  <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
                )}
              </div>
              <button
                onClick={onClose}
                className="glass grid h-8 w-8 place-items-center rounded-full"
                aria-label="close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
            {footer && (
              <div className="glass rounded-none border-t px-5 py-3">{footer}</div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
