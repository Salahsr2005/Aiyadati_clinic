import { AlertTriangle, UserX, Loader2 } from "lucide-react";
import { ModalPortal } from "@/components/ui/ModalPortal";
import { useTranslation } from "react-i18next";

interface NoShowConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  patientName?: string;
  isSubmitting?: boolean;
}

export function NoShowConfirmDialog({
  open,
  onClose,
  onConfirm,
  patientName,
  isSubmitting,
}: NoShowConfirmDialogProps) {
  const { t } = useTranslation();
  if (!open) return null;

  return (
    <ModalPortal
      id="no-show-confirm-dialog"
      open={open}
      onClose={onClose}
      backdropClassName="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
    >
      <div
        className="glass w-full max-w-md rounded-3xl border border-warning/30 bg-card p-6 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-warning/15 text-warning">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Mark as No-Show?</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Confirm that {patientName ? <strong className="text-foreground">{patientName}</strong> : "the patient"} did not attend this consultation.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-warning/20 bg-warning/10 p-3.5 text-xs text-warning-foreground space-y-1.5 font-medium">
          <div className="flex items-center gap-1.5 font-bold text-warning">
            <UserX className="h-4 w-4 shrink-0" /> Important Consequences
          </div>
          <p className="text-[11px] leading-relaxed opacity-90">
            This action increments the patient's no-show count. Registered patient accounts are <strong>automatically suspended after 3 no-shows</strong>.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/30">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl border border-border/40 px-4 py-2 text-xs font-bold text-foreground hover:bg-muted/30 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 rounded-xl bg-warning text-warning-foreground px-4 py-2 text-xs font-bold shadow-md hover:bg-warning/90 transition disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserX className="h-4 w-4" />}
            Confirm No-Show
          </button>
        </div>
      </div>
    </ModalPortal>
  );
}
