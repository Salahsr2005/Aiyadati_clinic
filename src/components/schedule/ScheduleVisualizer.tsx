import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, LayoutGrid } from "lucide-react";
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
  const [hover, setHover] = useState<{ x: number; y: number; text: string } | null>(null);

  const ticks = [8, 10, 12, 14, 16, 18, 20];

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-4 w-4 text-primary-500" />
          <span className="text-xs font-bold text-muted-foreground">
            Schedule Timeline for {selectedDate}
          </span>
        </div>
        <div className="text-xs text-muted-foreground font-semibold">
          {slots.length} total slots
        </div>
      </div>

      <div className="overflow-x-auto custom-scrollbar pb-1">
        <div className="min-w-[640px] space-y-2">
          <div className="flex pl-16 text-[10px] font-semibold text-muted-foreground/70 justify-between pr-2">
            {ticks.map((h) => (
              <div key={h}>{String(h).padStart(2, "0")}:00</div>
            ))}
          </div>

          <div className="relative flex items-center gap-2">
            <div className="w-16 shrink-0 text-[11px] font-bold uppercase tracking-wide text-foreground">
              Slots
            </div>
            <div className="relative flex-1 h-12 overflow-hidden rounded-xl bg-accent/30 border border-border/40">
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
                    ? "bg-success hover:bg-success/80"
                    : status === "BOOKED" || status === "CONFIRMED"
                      ? "bg-danger hover:bg-danger/80"
                      : "bg-warning hover:bg-warning/80";

                return (
                  <div
                    key={s.id}
                    className={cn("absolute top-1.5 bottom-1.5 rounded-lg transition cursor-pointer shadow-xs", color)}
                    style={{ left: `${startRatio * 100}%`, width: `${widthRatio * 100}%` }}
                    onMouseMove={(e) =>
                      setHover({
                        x: e.clientX,
                        y: e.clientY,
                        text: `${s.startTime?.slice(0, 5)}–${s.endTime?.slice(0, 5)} · Status: ${status}`,
                      })
                    }
                    onMouseLeave={() => setHover(null)}
                  />
                );
              })}

              {slots.length === 0 && (
                <div className="absolute inset-0 grid place-items-center text-xs font-semibold text-muted-foreground/60">
                  No slots scheduled for this date
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-border/30 text-[11px] font-semibold text-muted-foreground">
        <LegendItem colorClass="bg-success" label="Available Slot" />
        <LegendItem colorClass="bg-danger" label="Booked Slot" />
        <LegendItem colorClass="bg-warning" label="Reserved / Pending" />
      </div>

      {hover && (
        <div
          className="pointer-events-none fixed z-50 rounded-xl border border-border/60 bg-popover/95 px-3 py-1.5 text-xs font-semibold shadow-xl backdrop-blur-md text-popover-foreground"
          style={{ left: hover.x + 12, top: hover.y + 12 }}
        >
          {hover.text}
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
