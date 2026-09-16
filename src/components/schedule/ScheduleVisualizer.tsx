import { useState } from "react";
import { LayoutGrid, DoorOpen, User, Clock, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { DoctorSlot } from "@/api/clinicAppointmentsApi";

function parseTime(t?: string | null): number | null {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h)) return null;
  return h + (m || 0) / 60;
}

export function ScheduleVisualizer({
  slots = [],
  selectedDate,
  doctorName,
  onSelectSlot,
  className,
}: {
  slots: DoctorSlot[];
  selectedDate: string;
  doctorName?: string;
  onSelectSlot?: (slot: DoctorSlot) => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const [hover, setHover] = useState<{ x: number; y: number; slot: DoctorSlot } | null>(null);

  const ticks = [8, 10, 12, 14, 16, 18, 20];

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-4 w-4 text-primary-500" />
          <span className="text-xs font-bold text-muted-foreground">
            {t("schedule.timeline.title", { defaultValue: "Consultation Timeline" })} ({selectedDate})
          </span>
        </div>
        <div className="text-xs text-muted-foreground font-semibold">
          {slots.length} {t("schedule.totalSlots", { defaultValue: "Total Slots" }).toLowerCase()}
        </div>
      </div>

      <div className="overflow-x-auto custom-scrollbar pb-1">
        <div className="min-w-[640px] space-y-2">
          <div className="flex pl-16 rtl:pl-0 rtl:pr-16 text-[10px] font-semibold text-muted-foreground/70 justify-between pr-2 rtl:pr-0 rtl:pl-2">
            {ticks.map((h) => (
              <div key={h}>{String(h).padStart(2, "0")}:00</div>
            ))}
          </div>

          <div className="relative flex items-center gap-2">
            <div className="w-16 shrink-0 text-[11px] font-bold uppercase tracking-wide text-foreground">
              {t("schedule.timeline.title", { defaultValue: "Slots" })}
            </div>
            <div className="relative flex-1 h-14 overflow-hidden rounded-2xl bg-accent/30 border border-border/40">
              <div className="pointer-events-none absolute inset-0 flex">
                {Array.from({ length: 12 }).map((_, h) => (
                  <div key={h} className="flex-1 border-e border-border/20 last:border-e-0" />
                ))}
              </div>

              {/* Generated slots */}
              {slots.map((s) => {
                const from = parseTime(s.startTime);
                const to = parseTime(s.endTime);
                if (from === null || to === null) return null;
                // Scale between 8:00 (8.0) and 20:00 (20.0)
                const startRatio = Math.max(0, Math.min(1, (from - 8) / 12));
                const endRatio = Math.max(0, Math.min(1, (to - 8) / 12));
                const widthRatio = Math.max(0.02, endRatio - startRatio);

                const status = String(s.status || "AVAILABLE").toUpperCase();
                const color =
                  status === "AVAILABLE"
                    ? "bg-emerald-500 hover:bg-emerald-400 text-white"
                    : status === "BOOKED" || status === "FULL" || status === "CONFIRMED"
                      ? "bg-amber-500 hover:bg-amber-400 text-white"
                      : "bg-rose-500 hover:bg-rose-400 text-white";

                return (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => onSelectSlot?.(s)}
                    className={cn(
                      "absolute top-1.5 bottom-1.5 rounded-xl transition cursor-pointer shadow-sm flex items-center justify-center text-[10px] font-bold overflow-hidden px-1 border border-white/20 hover:scale-105 z-10",
                      color
                    )}
                    style={{ left: `${startRatio * 100}%`, width: `${widthRatio * 100}%` }}
                    onMouseMove={(e) =>
                      setHover({
                        x: e.clientX,
                        y: e.clientY,
                        slot: s,
                      })
                    }
                    onMouseLeave={() => setHover(null)}
                  >
                    <span className="truncate">
                      {s.startTime?.slice(0, 5)}
                    </span>
                  </button>
                );
              })}

              {slots.length === 0 && (
                <div className="absolute inset-0 grid place-items-center text-xs font-semibold text-muted-foreground/60">
                  {t("schedule.timeline.empty", { defaultValue: "No slots scheduled for this date" })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-border/30 text-[11px] font-semibold text-muted-foreground">
        <LegendItem colorClass="bg-emerald-500" label={t("schedule.filters.available", { defaultValue: "Available" })} />
        <LegendItem colorClass="bg-amber-500" label={t("schedule.filters.full", { defaultValue: "Booked" })} />
        <LegendItem colorClass="bg-rose-500" label={t("schedule.filters.cancelled", { defaultValue: "Cancelled" })} />
      </div>

      {hover && (
        <div
          className="pointer-events-none fixed z-50 rounded-2xl border border-border/60 bg-popover/95 p-3 text-xs shadow-2xl backdrop-blur-md text-popover-foreground space-y-1.5 min-w-[200px]"
          style={{ left: Math.min(window.innerWidth - 220, hover.x + 12), top: hover.y + 12 }}
        >
          <div className="flex items-center justify-between font-bold text-primary-500">
            <span className="flex items-center gap-1 font-mono">
              <Clock className="h-3 w-3" />
              {hover.slot.startTime?.slice(0, 5)} – {hover.slot.endTime?.slice(0, 5)}
            </span>
            <span className="capitalize text-[10px] px-1.5 py-0.5 rounded-full bg-accent">
              {hover.slot.status || "available"}
            </span>
          </div>

          {hover.slot.room?.name && (
            <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
              <DoorOpen className="h-3 w-3 text-primary-500" />
              <span>{hover.slot.room.name}</span>
            </div>
          )}

          {typeof hover.slot.maxPatients === "number" && (
            <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
              <User className="h-3 w-3 text-primary-500" />
              <span>
                {t("schedule.timeline.slotCapacity", { defaultValue: "Capacity" })}: {hover.slot.currentPatients ?? 0}/{hover.slot.maxPatients}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LegendItem({ colorClass, label }: { colorClass: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2.5 w-2.5 rounded-full", colorClass)} />
      {label}
    </span>
  );
}
