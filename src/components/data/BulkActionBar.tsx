import type { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

export function BulkActionBar({
  count,
  onClear,
  children,
  label,
}: {
  count: number;
  onClear: () => void;
  children: ReactNode;
  label?: string;
}) {
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ y: 24, opacity: 0, scale: 0.98 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 24, opacity: 0, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 32 }}
          className="fixed inset-x-0 bottom-4 z-40 mx-auto flex max-w-3xl items-center gap-3 rounded-3xl border border-border/60 bg-background/85 px-4 py-2.5 shadow-2xl backdrop-blur-xl"
          role="region"
          aria-label="Bulk actions"
        >
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-primary-500 text-xs font-semibold text-white tabular-nums">
              {count > 99 ? "99+" : count}
            </div>
            <div className="text-sm">
              <span className="font-medium">{count.toLocaleString()}</span>{" "}
              <span className="text-muted-foreground">{label ?? "selected"}</span>
            </div>
          </div>
          <div className="ms-auto flex flex-wrap items-center gap-2">{children}</div>
          <button
            onClick={onClear}
            className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Clear selection"
          >
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
