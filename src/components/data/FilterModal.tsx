import { AnimatePresence, motion } from "framer-motion";
import { X, SlidersHorizontal } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useModalLayer } from "@/store/modalStack";

export function FilterButton({
  count,
  onClick,
}: {
  count?: number;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      onClick={onClick}
      className="glass inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition hover:bg-accent/60"
    >
      <SlidersHorizontal className="h-3.5 w-3.5" />
      <span>{t("filters.open")}</span>
      {count ? (
        <span className="ml-1 rounded-full bg-primary-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
          {count}
        </span>
      ) : null}
    </button>
  );
}

export function FilterModal({
  open,
  onClose,
  onApply,
  onReset,
  title,
  children,
  id = "filter-modal",
}: {
  open: boolean;
  onClose: () => void;
  onApply?: () => void;
  onReset?: () => void;
  title?: string;
  children: ReactNode;
  id?: string;
}) {
  const { t } = useTranslation();
  const { backdropZ, contentZ } = useModalLayer(id, open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
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
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            style={{ zIndex: contentZ }}
            className="fixed left-1/2 top-1/2 w-[min(92vw,640px)] max-h-[85vh] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-border bg-background shadow-2xl"
          >
            <div className="glass flex items-center justify-between border-b px-5 py-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <SlidersHorizontal className="h-4 w-4 text-primary-500" />
                {title ?? t("filters.open")}
              </div>
              <button
                onClick={onClose}
                className="glass grid h-8 w-8 place-items-center rounded-full"
                aria-label="close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto px-5 py-5">{children}</div>
            <div className="glass flex items-center justify-between gap-2 border-t px-5 py-3">
              <button
                onClick={() => {
                  onReset?.();
                }}
                className="rounded-full px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                {t("filters.reset")}
              </button>
              <button
                onClick={() => {
                  onApply?.();
                  onClose();
                }}
                className="rounded-full bg-primary-500 hover:bg-primary-700 transition-colors px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-primary-500/20"
              >
                {t("filters.apply")}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function FilterSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-5">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

export function FilterChip({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs transition",
        active
          ? "border-primary-500/40 bg-primary-500/15 text-primary-500 font-medium"
          : "border-border bg-muted/30 text-foreground/70 hover:bg-accent/60",
      )}
    >
      {children}
    </button>
  );
}
