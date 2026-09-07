import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ModalPortal } from "@/components/ui/ModalPortal";

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: string;
  danger?: boolean;
  variant?: "danger" | "primary" | string;
  confirmLabel?: string;
  confirmText?: string;
  isLoading?: boolean;
  typeToConfirm?: string;
  id?: string;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  danger,
  variant,
  confirmLabel,
  confirmText,
  isLoading,
  typeToConfirm,
  id = "confirm-dialog",
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setTyped("");
      setBusy(false);
    }
  }, [open]);

  const isDanger = danger || variant === "danger";
  const label = confirmLabel || confirmText || t("common.confirm", { defaultValue: "تأكيد" });
  const isDisabled = busy || !!isLoading || (typeToConfirm ? typed !== typeToConfirm : false);

  return (
    <ModalPortal id={id} open={open} onClose={onClose}>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            className="glass-strong w-full max-w-md rounded-3xl p-6"
          >
            <div className="mb-3 flex items-start gap-3">
              <div
                className={`grid h-10 w-10 place-items-center rounded-2xl ${isDanger ? "bg-danger/15 text-danger" : "bg-primary-500/15 text-primary-500"}`}
              >
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <div className="text-base font-semibold">{title}</div>
                {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
              </div>
            </div>
            {typeToConfirm && (
              <label className="block text-xs text-muted-foreground">
                {t("table.typeToConfirm", { defaultValue: "Type" })}{" "}
                <span className="font-mono text-foreground">{typeToConfirm}</span>{" "}
                {t("table.toConfirm", { defaultValue: "to confirm" })}
                <input
                  autoFocus
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-input bg-background/50 px-3 py-2 text-sm outline-none focus:border-primary-500"
                />
              </label>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-4 py-2 text-sm hover:bg-accent"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                disabled={isDisabled}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await onConfirm();
                  } finally {
                    setBusy(false);
                  }
                }}
                className={`rounded-xl px-4 py-2 text-sm font-medium text-white shadow-lg transition disabled:opacity-60 ${isDanger ? "bg-danger" : "bg-primary-500"}`}
              >
                {label}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </ModalPortal>
  );
}
