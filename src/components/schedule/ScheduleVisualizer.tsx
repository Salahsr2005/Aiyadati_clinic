import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueries } from "@/lib/queryClient";
import { ChevronLeft, ChevronRight, LayoutGrid, Clock, DoorOpen, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { qk } from "@/lib/queryKeys";
import { clinicAppointmentsApi, type DoctorSlot } from "@/api/clinicAppointmentsApi";
import { getDoctorColor } from "@/lib/doctorColor";

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parseTime(t?: string | null): number | null {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h)) return null;
  return h + (m || 0) / 60;
}

interface ScheduleVisualizerProps {
  /** For single-day mode — pass slots directly */
  slots?: DoctorSlot[];
  selectedDate?: string;
  doctorName?: string;
  onSelectSlot?: (slot: DoctorSlot) => void;
  /** For week-timeline mode — pass doctorId and we'll fetch slots per day */
  doctorId?: string;
  /** Optional availability rows for showing template bands */
  weeklyAvailability?: any[];
  className?: string;
}

const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function ScheduleVisualizer({
  slots: singleDaySlots,
  selectedDate,
  doctorName,
  onSelectSlot,
  doctorId,
  weeklyAvailability,
  className,
}: ScheduleVisualizerProps) {
  const { t } = useTranslation();
  const [hover, setHover] = useState<{ x: number; y: number; slot: DoctorSlot } | null>(null);
  const color = doctorId ? getDoctorColor(doctorId) : null;

  // Week-based mode when doctorId is provided
  const isWeekMode = !!doctorId;
  const [weekOffset, setWeekOffset] = useState(0);

  const weekDates = useMemo(() => {
    const today = new Date();
    const dow = (today.getDay() + 6) % 7; // 0 = Monday
    const monday = new Date(today);
    monday.setDate(today.getDate() - dow + weekOffset * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  }, [weekOffset]);

  const weekIso = weekDates.map(toISO);

  const slotQueries = useQueries({
    queries: isWeekMode
      ? weekIso.map((date) => ({
          queryKey: qk.clinicSelf.doctorSlots(doctorId!, { date }),
          queryFn: () => clinicAppointmentsApi.getDoctorSlots(doctorId!, { date }),
          staleTime: 30_000,
        }))
      : [],
  });

  const ticks = [0, 6, 12, 18, 24];

  // ------- WEEK TIMELINE MODE -------
  if (isWeekMode) {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4 text-primary-500" />
            <span className="text-xs font-bold text-muted-foreground">
              {weekIso[0]} → {weekIso[6]}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setWeekOffset((w) => w - 1)}
              className="grid h-7 w-7 place-items-center rounded-lg hover:bg-muted transition cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
            </button>
            <button
              type="button"
              onClick={() => setWeekOffset(0)}
              className="rounded-lg px-2 py-1 text-[11px] font-bold text-primary-500 hover:bg-primary-500/10 transition cursor-pointer"
            >
              {t("schedule.visualizer.thisWeek", { defaultValue: "This Week" })}
            </button>
            <button
              type="button"
              onClick={() => setWeekOffset((w) => w + 1)}
              className="grid h-7 w-7 place-items-center rounded-lg hover:bg-muted transition cursor-pointer"
            >
              <ChevronRight className="h-4 w-4 rtl:rotate-180" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar pb-1">
          <div className="min-w-[720px] space-y-1.5">
            <div className="flex pl-16 text-[10px] font-semibold text-muted-foreground/70">
              {ticks.map((h) => (
                <div key={h} style={{ position: "relative", width: `${100 / 4}%` }}>
                  {h}:00
                </div>
              ))}
            </div>

            {weekDates.map((d, i) => {
              const iso = weekIso[i];
              const rows: DoctorSlot[] = Array.isArray(slotQueries[i]?.data) ? (slotQueries[i]!.data as DoctorSlot[]) : [];

              return (
                <div key={iso} className="flex items-center gap-2">
                  <div className="w-16 shrink-0 text-[10px] font-bold uppercase tracking-wide text-foreground">
                    {DAY_SHORT[i]}
                    <div className="text-[9px] font-normal text-muted-foreground/70">
                      {d.getDate()}/{d.getMonth() + 1}
                    </div>
                  </div>
                  <div className="relative flex-1 overflow-hidden rounded-lg bg-muted/30 h-10 transition-all">
                    {/* Hour grid lines */}
                    <div className="pointer-events-none absolute inset-0 flex">
                      {Array.from({ length: 24 }).map((_, h) => (
                        <div key={h} className="flex-1 border-e border-border/20 last:border-e-0" />
                      ))}
                    </div>

                    {/* Slot blocks */}
                    {rows.map((s) => {
                      const from = parseTime(s.startTime);
                      const to = parseTime(s.endTime);
                      if (from === null || to === null) return null;
                      const status = String(s.status || "").toLowerCase();
                      const slotColor =
                        status === "available" ? "bg-emerald-500" : status === "full" || status === "booked" ? "bg-amber-500" : "bg-muted-foreground/40";
                      return (
                        <div
                          key={s.id}
                          className={cn("absolute top-1 bottom-1 rounded-[4px] cursor-pointer hover:scale-y-110 transition", slotColor)}
                          style={{ left: `${(from / 24) * 100}%`, width: `${Math.max(0.6, ((to - from) / 24) * 100)}%` }}
                          onMouseMove={(e) =>
                            setHover({ x: e.clientX, y: e.clientY, slot: s })
                          }
                          onMouseLeave={() => setHover(null)}
                          onClick={() => onSelectSlot?.(s)}
                        />
                      );
                    })}

                    {rows.length === 0 && (
                      <div className="absolute inset-0 grid place-items-center text-[9px] uppercase tracking-wider text-muted-foreground/60">
                        {t("schedule.visualizer.noTemplate", { defaultValue: "No slots" })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-border/30 text-[11px] font-semibold text-muted-foreground">
          <LegendItem colorClass="bg-emerald-500" label={t("schedule.filters.available", { defaultValue: "Available" })} />
          <LegendItem colorClass="bg-amber-500" label={t("schedule.filters.full", { defaultValue: "Booked" })} />
          <LegendItem colorClass="bg-muted-foreground/40" label={t("schedule.filters.cancelled", { defaultValue: "Cancelled/Blocked" })} />
        </div>

        {hover && (
          <HoverTooltip hover={hover} t={t} />
        )}
      </div>
    );
  }

  // ------- SINGLE DAY MODE -------
  const daySlots = singleDaySlots || [];
  const dayTicks = [8, 10, 12, 14, 16, 18, 20];

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
          {daySlots.length} {t("schedule.totalSlots", { defaultValue: "Total Slots" }).toLowerCase()}
        </div>
      </div>

      <div className="overflow-x-auto custom-scrollbar pb-1">
        <div className="min-w-[640px] space-y-2">
          <div className="flex pl-16 rtl:pl-0 rtl:pr-16 text-[10px] font-semibold text-muted-foreground/70 justify-between pr-2 rtl:pr-0 rtl:pl-2">
            {dayTicks.map((h) => (
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

              {daySlots.map((s) => {
                const from = parseTime(s.startTime);
                const to = parseTime(s.endTime);
                if (from === null || to === null) return null;
                const startRatio = Math.max(0, Math.min(1, (from - 8) / 12));
                const endRatio = Math.max(0, Math.min(1, (to - 8) / 12));
                const widthRatio = Math.max(0.02, endRatio - startRatio);

                const status = String(s.status || "AVAILABLE").toUpperCase();
                const slotColor =
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
                      slotColor
                    )}
                    style={{ left: `${startRatio * 100}%`, width: `${widthRatio * 100}%` }}
                    onMouseMove={(e) => setHover({ x: e.clientX, y: e.clientY, slot: s })}
                    onMouseLeave={() => setHover(null)}
                  >
                    <span className="truncate">
                      {s.startTime?.slice(0, 5)}
                    </span>
                  </button>
                );
              })}

              {daySlots.length === 0 && (
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

      {hover && <HoverTooltip hover={hover} t={t} />}
    </div>
  );
}

function HoverTooltip({ hover, t }: { hover: { x: number; y: number; slot: DoctorSlot }; t: any }) {
  return (
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
