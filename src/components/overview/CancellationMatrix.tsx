import { useMemo, useState } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassCard } from "@/components/glass/GlassCard";
import type { AppointmentRow } from "@/api/appointmentsApi";
import { cn } from "@/lib/utils";

export interface CancellationMatrixProps {
  appointments?: AppointmentRow[];
  loading?: boolean;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) =>
  i === 0 ? "12a" : i < 12 ? `${i}a` : i === 12 ? "12p" : `${i - 12}p`,
);

interface CellData {
  cancelled: number;
  noShow: number;
  total: number;
}

export function CancellationMatrix({ appointments = [], loading = false }: CancellationMatrixProps) {
  const [hovered, setHovered] = useState<{
    dayIdx: number;
    hourIdx: number;
    cell: CellData;
    x: number;
    y: number;
  } | null>(null);

  const { grid, maxBad, totalBad, totalAll } = useMemo(() => {
    const g: CellData[][] = Array.from({ length: 7 }, () =>
      Array.from({ length: 24 }, () => ({ cancelled: 0, noShow: 0, total: 0 })),
    );
    let mx = 0;
    let tBad = 0;
    let tAll = 0;

    appointments.forEach((a) => {
      const dateStr = a.slot?.date;
      const timeStr = a.slot?.startTime;
      if (!dateStr || !timeStr) return;

      const day = new Date(dateStr).getDay();
      const hour = parseInt(timeStr.split(":")[0], 10);
      if (isNaN(hour) || hour < 0 || hour > 23) return;

      const cell = g[day][hour];
      cell.total++;
      tAll++;

      const status = (a.status ?? "").toUpperCase();
      if (status === "CANCELLED") { cell.cancelled++; tBad++; }
      if (status === "NO_SHOW") { cell.noShow++; tBad++; }

      const bad = cell.cancelled + cell.noShow;
      if (bad > mx) mx = bad;
    });

    return { grid: g, maxBad: mx, totalBad: tBad, totalAll: tAll };
  }, [appointments]);

  // Peak cancellation time
  const peak = useMemo(() => {
    let bestD = 0, bestH = 0, bestV = 0;
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        const v = grid[d][h].cancelled + grid[d][h].noShow;
        if (v > bestV) { bestV = v; bestD = d; bestH = h; }
      }
    }
    return { day: DAYS[bestD], hour: HOUR_LABELS[bestH], count: bestV };
  }, [grid]);

  if (loading) {
    return (
      <GlassCard className="p-5 border border-border/40 shadow-sm animate-pulse">
        <div className="h-[280px] w-full bg-muted/10 rounded-2xl" />
      </GlassCard>
    );
  }

  const rate = totalAll > 0 ? ((totalBad / totalAll) * 100).toFixed(1) : "0";

  return (
    <GlassCard className="p-5 border border-border/40 shadow-sm relative overflow-hidden">
      <div className="absolute -left-20 -bottom-20 h-40 w-40 rounded-full bg-red-500/5 blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-red-500/10 text-red-500">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight">Cancellation & No-Show Matrix</div>
            <div className="text-[10px] text-muted-foreground font-medium mt-0.5">
              {totalBad} incidents across {totalAll} appointments ({rate}%)
            </div>
          </div>
        </div>
        {peak.count > 0 && (
          <div className="inline-flex items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/5 px-2.5 py-1 text-[10px] font-bold text-red-500">
            Peak: {peak.day} {peak.hour}
          </div>
        )}
      </div>

      {/* 7 × 24 Grid */}
      <div className="relative w-full overflow-x-auto pb-1">
        <div className="min-w-[600px]">
          {/* Hour labels — show every 3rd */}
          <div className="flex pl-10 mb-1">
            {HOUR_LABELS.map((h, i) => (
              <div
                key={i}
                className={cn(
                  "flex-1 text-center text-[8px] font-semibold text-muted-foreground/60",
                  i % 3 !== 0 && "invisible",
                )}
              >
                {h}
              </div>
            ))}
          </div>

          <div className="space-y-[3px]">
            {DAYS.map((dayName, dayIdx) => (
              <div key={dayName} className="flex items-center">
                <div className="w-10 text-[10px] font-bold text-muted-foreground/70 uppercase select-none">
                  {dayName}
                </div>
                <div className="flex-1 flex gap-[2px]">
                  {grid[dayIdx].map((cell, hourIdx) => {
                    const bad = cell.cancelled + cell.noShow;
                    const intensity = maxBad > 0 ? bad / maxBad : 0;
                    const hasData = bad > 0;
                    const opacity = hasData ? 0.15 + intensity * 0.85 : 0.04;

                    return (
                      <div
                        key={hourIdx}
                        className="flex-1 h-7 rounded-[4px] transition-all duration-150 cursor-pointer"
                        style={{
                          background: hasData
                            ? `rgba(239, 68, 68, ${opacity})`
                            : "var(--muted)",
                          border: hasData
                            ? `1px solid rgba(239, 68, 68, ${0.08 + intensity * 0.35})`
                            : "1px solid transparent",
                        }}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const parent = e.currentTarget.closest(".relative")?.getBoundingClientRect();
                          setHovered({
                            dayIdx,
                            hourIdx,
                            cell,
                            x: rect.left - (parent?.left ?? 0) + rect.width / 2,
                            y: rect.top - (parent?.top ?? 0),
                          });
                        }}
                        onMouseLeave={() => setHovered(null)}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tooltip */}
        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.95 }}
              transition={{ duration: 0.1 }}
              className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-full"
              style={{ left: hovered.x, top: hovered.y - 6 }}
            >
              <div className="rounded-xl border border-border bg-popover/95 shadow-xl px-3 py-2 text-xs backdrop-blur-sm min-w-[140px]">
                <div className="font-bold text-red-500">
                  {hovered.cell.cancelled + hovered.cell.noShow === 0
                    ? "No incidents"
                    : `${hovered.cell.cancelled + hovered.cell.noShow} incidents`}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {DAYS[hovered.dayIdx]} at {HOUR_LABELS[hovered.hourIdx]}
                </div>
                {hovered.cell.total > 0 && (
                  <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 border-t border-border/40 pt-1.5">
                    <div>
                      <div className="text-[9px] uppercase text-muted-foreground">Cancelled</div>
                      <div className="text-[11px] font-semibold tabular-nums text-red-500">{hovered.cell.cancelled}</div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase text-muted-foreground">No-show</div>
                      <div className="text-[11px] font-semibold tabular-nums text-amber-500">{hovered.cell.noShow}</div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-[9px] uppercase text-muted-foreground">Rate</div>
                      <div className="text-[11px] font-semibold tabular-nums">
                        {Math.round(((hovered.cell.cancelled + hovered.cell.noShow) / hovered.cell.total) * 100)}%
                        <span className="text-muted-foreground font-normal"> of {hovered.cell.total}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="mx-auto h-0 w-0 border-x-[5px] border-x-transparent border-t-[5px] border-t-border" style={{ marginTop: -1 }} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground font-medium pt-2 border-t border-border/30">
        <span className="flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5" />
          7 × 24 hourly resolution
        </span>
        <div className="flex items-center gap-1.5">
          <span>None</span>
          <span className="h-2.5 w-2.5 rounded bg-muted opacity-40" />
          <span className="h-2.5 w-2.5 rounded bg-red-500/20" />
          <span className="h-2.5 w-2.5 rounded bg-red-500/50" />
          <span className="h-2.5 w-2.5 rounded bg-red-500/80" />
          <span className="h-2.5 w-2.5 rounded bg-red-500" />
          <span>Critical</span>
        </div>
      </div>
    </GlassCard>
  );
}
