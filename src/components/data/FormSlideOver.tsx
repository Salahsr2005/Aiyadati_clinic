import { X } from "lucide-react";
import type { ReactNode } from "react";
import { ModalPortal } from "@/components/ui/ModalPortal";
import { motion, AnimatePresence } from "framer-motion";

interface FormSlideOverProps {
  id: string;
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
}

export function FormSlideOver({
  id,
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: FormSlideOverProps) {
  return (
    <ModalPortal
      id={id}
      open={open}
      onClose={onClose}
      backdropClassName="fixed inset-0 z-[1000] flex justify-end bg-black/60 backdrop-blur-sm"
    >
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", damping: 25, stiffness: 220 }}
            className="relative flex h-full w-full max-w-lg flex-col border-s border-border/40 bg-background/95 shadow-2xl backdrop-blur-md md:max-w-xl"
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-border/40 p-6">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-foreground">{title}</h2>
                {description && (
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border/40 bg-background/50 text-muted-foreground transition hover:bg-accent hover:text-foreground focus:outline-none"
                aria-label="close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6">
              {children}
            </div>

            {/* Sticky Action Footer */}
            {footer && (
              <div className="flex items-center justify-end gap-3 border-t border-border/40 bg-muted/20 p-5 backdrop-blur-md">
                {footer}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </ModalPortal>
  );
}
