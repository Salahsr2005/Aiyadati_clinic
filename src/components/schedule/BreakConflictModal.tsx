import { useState } from "react";
import { AlertTriangle, Calendar, Clock, User, ShieldAlert, Loader2 } from "lucide-react";
import { ModalPortal } from "@/components/ui/ModalPortal";
import type { BreakConflict } from "@/api/doctorSelfApi";

interface BreakConflictModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (strategy: "BLOCK" | "CANCEL_AND_REFUND") => void;
  conflicts: BreakConflict[];
  startDate: string;
  endDate: string;
  isSubmitting?: boolean;
}

export function BreakConflictModal({
  open,
  onClose,
  onConfirm,
  conflicts,
  startDate,
  endDate,
  isSubmitting,
}: BreakConflictModalProps) {
  const [selectedStrategy, setSelectedStrategy] = useState<"BLOCK" | "CANCEL_AND_REFUND">("BLOCK");

  if (!open) return null;

  return (
    <ModalPortal
      id="break-conflict-modal"
      open={open}
      onClose={onClose}
      backdropClassName="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
    >
      <div
        className="glass w-full max-w-lg rounded-3xl border border-warning/40 bg-card p-6 shadow-2xl space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-border/30 pb-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-warning/15 text-warning">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Time Off Schedule Conflict</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Break dates ({startDate} → {endDate}) overlap with {conflicts.length} booked appointment{conflicts.length === 1 ? "" : "s"}.
            </p>
          </div>
        </div>

        {/* Affected Appointments Roster */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
            Affected Booked Appointments ({conflicts.length}):
          </label>
          <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1.5 p-1">
            {conflicts.map((c, i) => (
              <div key={c.id || c.appointmentId || i} className="flex items-center justify-between p-2.5 rounded-xl border border-border/40 bg-muted/20 text-xs">
                <div className="flex items-center gap-2">
                  <User className="h-3.5 w-3.5 text-primary-500 shrink-0" />
                  <span className="font-bold text-foreground">{c.patientName || "Patient"}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground font-mono text-[11px]">
                  <Calendar className="h-3 w-3" /> {c.date}
                  {c.startTime && <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" /> {c.startTime}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Strategy Selector */}
        <div className="space-y-2 pt-2 border-t border-border/30">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
            Select Conflict Resolution Strategy:
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSelectedStrategy("BLOCK")}
              className={`p-3 rounded-2xl border text-left text-xs transition ${
                selectedStrategy === "BLOCK"
                  ? "border-warning bg-warning/15 text-foreground shadow-xs"
                  : "border-border/40 bg-muted/10 hover:bg-muted/30 text-muted-foreground"
              }`}
            >
              <div className="font-bold flex items-center gap-1.5 text-warning mb-1">
                <ShieldAlert className="h-4 w-4" /> Block Unbooked
              </div>
              <p className="text-[10px] leading-snug opacity-90">
                Cancel unbooked slots only. Booked appointments stay active and must be handled manually.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setSelectedStrategy("CANCEL_AND_REFUND")}
              className={`p-3 rounded-2xl border text-left text-xs transition ${
                selectedStrategy === "CANCEL_AND_REFUND"
                  ? "border-danger bg-danger/15 text-foreground shadow-xs"
                  : "border-border/40 bg-muted/10 hover:bg-muted/30 text-muted-foreground"
              }`}
            >
              <div className="font-bold flex items-center gap-1.5 text-danger mb-1">
                <AlertTriangle className="h-4 w-4" /> Cancel & Refund All
              </div>
              <p className="text-[10px] leading-snug opacity-90">
                Cancel all conflicting appointments, auto-refund paid credits, and notify patients.
              </p>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/30">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl border border-border/40 px-4 py-2 text-xs font-bold hover:bg-muted/20 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(selectedStrategy)}
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary-500 px-5 py-2 text-xs font-bold text-primary-foreground shadow-md hover:bg-primary-600 transition disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Time Off"}
          </button>
        </div>
      </div>
    </ModalPortal>
  );
}
