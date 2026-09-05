import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ModernDatePickerModal } from "@/components/ui/ModernDatePickerModal";

export interface RegenerateConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (fromDate: string) => void;
  reasonLabel: string;
  rangeStart: string;
  rangeEnd: string;
  futureAvailableCount: number;
  futureBookedCount: number;
  isPending?: boolean;
}

export function RegenerateConfirmDialog({
  open,
  onClose,
  onConfirm,
  reasonLabel,
  rangeStart,
  rangeEnd,
  futureAvailableCount,
  futureBookedCount,
  isPending,
}: RegenerateConfirmDialogProps) {
  const { t } = useTranslation();
  const [fromDate, setFromDate] = useState(rangeStart);

  useEffect(() => {
    if (open) setFromDate(rangeStart);
  }, [open, rangeStart]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md rounded-3xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-warning/15 text-warning">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <DialogTitle>{t("schedule.regenerateDialog.title")}</DialogTitle>
          </div>
          <DialogDescription>
            {t("schedule.regenerateDialog.description", { reason: reasonLabel })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="rounded-2xl border border-border/40 bg-muted/10 p-3.5 text-xs space-y-1.5">
            <div className="flex justify-between font-semibold">
              <span className="text-muted-foreground">{t("schedule.regenerateDialog.affectedRange")}</span>
              <span className="font-mono">{rangeStart} → {rangeEnd}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span className="text-muted-foreground">{t("schedule.regenerateDialog.futureAvailable")}</span>
              <span className="text-success">{futureAvailableCount}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span className="text-muted-foreground">{t("schedule.regenerateDialog.futureBooked")}</span>
              <span className="text-danger">{futureBookedCount}</span>
            </div>
          </div>

          {futureBookedCount > 0 && (
            <p className="text-[11px] font-semibold text-warning bg-warning/10 rounded-xl px-3 py-2">
              {t("schedule.regenerateDialog.bookedPreservedNote", { count: futureBookedCount })}
            </p>
          )}

          <div>
            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
              {t("schedule.regenerateDialog.regenerateFrom")}
            </label>
            <ModernDatePickerModal mode="single" value={fromDate} onSelect={setFromDate} className="w-full" />
          </div>
        </div>

        <DialogFooter>
          <button
            onClick={onClose}
            className="rounded-2xl px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted transition"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={() => onConfirm(fromDate)}
            disabled={isPending}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary-500 px-5 py-2 text-xs font-bold text-primary-foreground shadow-md hover:bg-primary-600 transition disabled:opacity-50"
          >
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t("schedule.regenerateDialog.confirm")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
