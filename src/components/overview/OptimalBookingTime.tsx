import { useMemo, useState } from "react";
import { Clock, Info, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { GlassCard } from "@/components/glass/GlassCard";
import type { AppointmentRow } from "@/api/appointmentsApi";
import { cn } from "@/lib/utils";

export interface OptimalBookingTimeProps {
  appointments?: AppointmentRow[];
  loading?: boolean;
}

const HOURS = ["12am", "3am", "6am", "9am", "12pm", "3pm", "6pm", "9pm"];

interface CellStats {
  count: number;
  completed: number;
  cancelled: number;
  noShow: number;
  avgResponseMin: number | null;
}

export function OptimalBookingTime({ appointments = [], loading = false }: OptimalBookingTimeProps) {
  const { t } = useTranslation();
  const [hoveredCell, setHoveredCell] = useState<{
    dayIdx: number;
    hourIdx: number;
    stats: CellStats;
    x: number;
    y: number;
  } | null>(null);

  const DAYS = [
    t("schedule.daysShort.sun", { defaultValue: "Sun" }),
    t("schedule.daysShort.mon", { defaultValue: "Mon" }),
    t("schedule.daysShort.tue", { defaultValue: "Tue" }),
    t("schedule.daysShort.wed", { defaultValue: "Wed" }),
    t("schedule.daysShort.thu", { defaultValue: "Thu" }),
    t("schedule.daysShort.fri", { defaultValue: "Fri" }),
    t("schedule.daysShort.sat", { defaultValue: "Sat" }),
  ];

  // Compute 7x8 matrix with richer statistics per cell
  const { matrix, maxCount, totalBookings } = useMemo(() => {
    const grid: CellStats[][] = Array.from({ length: 7 }, () =>
      Array.from({ length: 8 }, () => ({
        count: 0,
        completed: 0,
        cancelled: 0,
        noShow: 0,
        avgResponseMin: null,
      })),
    );
    let max = 0;
    let total = 0;

    appointments.forEach((appt) => {
      const dateStr = appt.slot?.date;
      const timeStr = appt.slot?.startTime;
      if (!dateStr || !timeStr) return;

      const day = new Date(dateStr).getDay();
      const hour = parseInt(timeStr.split(":")[0], 10);
      if (isNaN(hour)) return;

      const hourSlot = Math.floor(hour / 3) % 8;
      const cell = grid[day][hourSlot];
      cell.count++;
      total++;

      const status = (appt.status ?? "").toUpperCase();
      if (status === "COMPLETED") cell.completed++;
      if (status === "CANCELLED") cell.cancelled++;
      if (status === "NO_SHOW") cell.noShow++;

      // Calculate response time (createdAt → confirmedAt)
      if (appt.confirmedAt && appt.createdAt) {
        const created = new Date(appt.createdAt).getTime();
        const confirmed = new Date(appt.confirmedAt).getTime();
        if (confirmed > created) {
          const diffMin = (confirmed - created) / 60000;
          // Running average
          if (cell.avgResponseMin === null) {
            cell.avgResponseMin = diffMin;
          } else {
            const prevTotal = cell.count - 1;
            cell.avgResponseMin =
              (cell.avgResponseMin * prevTotal + diffMin) / cell.count;
          }
        }
      }
    });

    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 8; h++) {
        if (grid[d][h].count > max) max = grid[d][h].count;
      }
    }

    return { matrix: grid, maxCount: max, totalBookings: total };
  }, [appointments]);

  // Find optimal posting time
  const optimalTime = useMemo(() => {
    let bestDay = 0;
    let bestHour = 0;
    let bestCount = 0;

    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 8; h++) {
        if (matrix[d][h].count > bestCount) {
          bestCount = matrix[d][h].count;
          bestDay = d;
          bestHour = h;
        }
      }
    }

    return {
      day: DAYS[bestDay],
      time: HOURS[bestHour],
      count: bestCount,
    };
  }, [matrix, DAYS]);

  if (loading) {
    return (
      <GlassCard className="p-5 border border-border/40 shadow-sm animate-pulse">
        <div className="h-[250px] w-full bg-muted/10 rounded-2xl" />
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-5 border border-border/40 shadow-sm relative overflow-hidden flex flex-col justify-between h-full">
      {/* Background radial highlight */}
      <div className="absolute -end-24 -top-24 h-48 w-48 rounded-full bg-orange-500/5 blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-orange-500/10 text-orange-500">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight">{t("overview.optimalBooking.title", { defaultValue: "Optimal Booking Time" })}</div>
              <div className="text-[10px] text-muted-foreground font-medium mt-0.5">
                Hourly hotspot map showing when patients schedule appointments
              </div>
            </div>
          </div>
        </div>

        {optimalTime.count > 0 && (
          <div className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/20 bg-orange-500/5 px-2.5 py-1 text-[10px] font-bold text-orange-600 dark:text-orange-400">
            <Sparkles className="h-3 w-3" />
            <span>Peak: {optimalTime.day} at {optimalTime.time}</span>
          </div>
        )}
      </div>

      {/* Grid Container */}
      <div className="relative mt-2 flex-1 flex flex-col justify-center">
        {/* Heatmap table/grid */}
        <div className="w-full overflow-x-auto pb-1 custom-scrollbar">
          <div className="min-w-[420px] pe-2">
            {/* Hour Labels (X-Axis) */}
            <div className="flex ps-10 mb-2">
              {HOURS.map((hr) => (
                <div
                  key={hr}
                  className="flex-1 text-center text-[10px] font-bold text-muted-foreground/80 tracking-wider uppercase select-none"
                >
                  {hr}
                </div>
              ))}
            </div>

            {/* Matrix rows (Days) */}
            <div className="space-y-1.5">
              {DAYS.map((dayName, dayIdx) => (
                <div key={dayName} className="flex items-center">
                  {/* Day Label (Y-Axis) */}
                  <div className="w-10 text-[10px] font-bold text-muted-foreground/80 select-none">
                    {dayName}
                  </div>

                  {/* 8 Hour cells */}
                  <div className="flex-1 flex gap-1.5">
                    {matrix[dayIdx].map((cellStats, hourIdx) => {
                      const count = cellStats.count;
                      const intensity = maxCount > 0 ? count / maxCount : 0;
                      const hasData = count > 0;
                      const opacity = hasData ? 0.15 + intensity * 0.85 : 0.04;
                      const bgStyle = hasData
                        ? `rgba(249, 115, 22, ${opacity})`
                        : "var(--muted)";
                      const borderStyle = hasData
                        ? `rgba(249, 115, 22, ${0.1 + intensity * 0.4})`
                        : "transparent";

                      return (
                        <div
                          key={hourIdx}
                          className={cn(
                            "flex-1 h-8 rounded-md transition-all duration-200 cursor-pointer relative",
                            hasData && "hover:scale-105 hover:z-20",
                          )}
                          style={{
                            background: bgStyle,
                            border: `1px solid ${borderStyle}`,
                          }}
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const parentRect = e.currentTarget.parentElement?.parentElement?.parentElement?.getBoundingClientRect();
                            setHoveredCell({
                              dayIdx,
                              hourIdx,
                              stats: cellStats,
                              x: rect.left - (parentRect?.left ?? 0) + rect.width / 2,
                              y: rect.top - (parentRect?.top ?? 0),
                            });
                          }}
                          onMouseLeave={() => setHoveredCell(null)}
                        >
                          {hasData && intensity > 0.7 && (
                            <span className="absolute inset-0 m-auto h-1.5 w-1.5 rounded-full bg-orange-500 opacity-60 animate-pulse" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tooltip Overlay */}
        <AnimatePresence>
          {hoveredCell && (
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.95 }}
              transition={{ duration: 0.1 }}
              className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-full"
              style={{ left: hoveredCell.x, top: hoveredCell.y - 6 }}
            >
              <div className="rounded-xl border border-border bg-popover/95 shadow-xl px-3 py-2 text-xs backdrop-blur-sm min-w-[160px]">
                <div className="font-bold text-orange-600 dark:text-orange-400">
                  {hoveredCell.stats.count === 0 ? "No bookings" : `${hoveredCell.stats.count} bookings`}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {DAYS[hoveredCell.dayIdx]}s between {HOURS[hoveredCell.hourIdx]} – {HOURS[(hoveredCell.hourIdx + 1) % 8]}
                </div>

                {hoveredCell.stats.count > 0 && (
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-border/40 pt-2">
                    <TooltipStat
                      label={t("overview.optimalBooking.completion", { defaultValue: "Completion" })}
                      value={`${Math.round((hoveredCell.stats.completed / hoveredCell.stats.count) * 100)}%`}
                      tone="success"
                    />
                    <TooltipStat
                      label={t("overview.optimalBooking.cancellation", { defaultValue: "Cancellation" })}
                      value={`${Math.round(((hoveredCell.stats.cancelled + hoveredCell.stats.noShow) / hoveredCell.stats.count) * 100)}%`}
                      tone="danger"
                    />
                    <TooltipStat
                      label={t("overview.optimalBooking.completed", { defaultValue: "Completed" })}
                      value={String(hoveredCell.stats.completed)}
                    />
                    <TooltipStat
                      label={t("overview.optimalBooking.noShows", { defaultValue: "No-shows" })}
                      value={String(hoveredCell.stats.noShow)}
                      tone="warning"
                    />
                    {hoveredCell.stats.avgResponseMin !== null && (
                      <div className="col-span-2 mt-0.5">
                        <TooltipStat
                          label={t("overview.optimalBooking.avgResponse", { defaultValue: "Avg response" })}
                          value={formatDuration(hoveredCell.stats.avgResponseMin)}
                          tone="primary"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="mx-auto h-0 w-0 border-x-[5px] border-x-transparent border-t-[5px] border-t-border" style={{ marginTop: -1 }} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Info */}
      <div className="mt-4 flex items-center justify-between text-[10px] text-muted-foreground font-medium pt-2 border-t border-border/30">
        <span className="flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5 text-muted-foreground" />
          Based on {totalBookings.toLocaleString()} booked appointments
        </span>
        <div className="flex items-center gap-1.5">
          <span>{t("overview.optimalBooking.quiet", { defaultValue: "Quiet" })}</span>
          <span className="h-2.5 w-2.5 rounded bg-muted opacity-40" />
          <span className="h-2.5 w-2.5 rounded bg-orange-500/20" />
          <span className="h-2.5 w-2.5 rounded bg-orange-500/50" />
          <span className="h-2.5 w-2.5 rounded bg-orange-500/80" />
          <span className="h-2.5 w-2.5 rounded bg-orange-500" />
          <span>{t("overview.optimalBooking.busy", { defaultValue: "Busy" })}</span>
        </div>
      </div>
    </GlassCard>
  );
}

function TooltipStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "danger" | "warning" | "primary";
}) {
  const toneColor = tone ? {
    success: "text-emerald-500",
    danger: "text-red-500",
    warning: "text-amber-500",
    primary: "text-blue-500",
  }[tone] : "text-foreground";

  return (
    <div>
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("text-[11px] font-semibold tabular-nums", toneColor)}>{value}</div>
    </div>
  );
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  if (minutes < 1440) return `${(minutes / 60).toFixed(1)}h`;
  return `${(minutes / 1440).toFixed(1)}d`;
}
