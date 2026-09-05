import { useMemo, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Sparkles, Info, TrendingUp, Calendar } from "lucide-react";
import { GlassCard } from "@/components/glass/GlassCard";
import { cn } from "@/lib/utils";

export interface DayHourDatum {
  day: number;   // 0=Sun..6=Sat
  hour: number;  // 0..23
  count: number;
  completed?: number;
  cancelled?: number;
  noShow?: number;
}

export interface DayHourHeatmapProps {
  data: DayHourDatum[];
  /** Number of hour-blocks (3h each = 8 blocks, 1h each = 24 blocks). Default 8. */
  hourBlocks?: 8 | 24;
  title?: string;
  subtitle?: string;
  tone?: "orange" | "primary" | "success" | "info";
  onCellClick?: (day: number, hourStart: number, hourEnd: number) => void;
  className?: string;
  // Optional raw data inputs for dynamic period filtering
  rawData?: any[];
  getDate?: (item: any) => string | undefined | null;
  getTime?: (item: any) => string | undefined | null;
  getStatus?: (item: any) => string | undefined | null;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS_8 = ["12am", "3am", "6am", "9am", "12pm", "3pm", "6pm", "9pm"];
const HOURS_24 = Array.from({ length: 24 }, (_, i) => {
  if (i === 0) return "12a";
  if (i === 12) return "12p";
  return i > 12 ? `${i - 12}p` : `${i}a`;
});

const TONE_COLORS: Record<NonNullable<DayHourHeatmapProps["tone"]>, { rgb: string; text: string }> = {
  orange: { rgb: "249, 115, 22", text: "text-orange-600 dark:text-orange-400" },
  primary: { rgb: "79, 70, 229", text: "text-primary-500" },
  success: { rgb: "16, 185, 129", text: "text-emerald-600 dark:text-emerald-400" },
  info: { rgb: "59, 130, 246", text: "text-blue-600 dark:text-blue-400" },
};

interface CellStats {
  count: number;
  completed: number;
  cancelled: number;
  noShow: number;
}

export function DayHourHeatmap({
  data,
  hourBlocks = 8,
  title = "Activity Heatmap",
  subtitle,
  tone = "orange",
  onCellClick,
  className,
  rawData,
  getDate,
  getTime,
  getStatus,
}: DayHourHeatmapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredCell, setHoveredCell] = useState<{
    dayIdx: number;
    hourIdx: number;
    stats: CellStats;
    x: number;
    y: number;
  } | null>(null);

  const [selectedPeriod, setSelectedPeriod] = useState<"7d" | "30d" | "90d" | "all">("all");

  const cols = hourBlocks;
  const hourLabels = cols === 8 ? HOURS_8 : HOURS_24;
  const blockSize = cols === 8 ? 3 : 1;

  // Filter raw data inside the component if supplied
  const activeData = useMemo(() => {
    if (!rawData || !getDate || !getTime) return data;

    const now = new Date();
    const cutoff =
      selectedPeriod === "7d"
        ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        : selectedPeriod === "30d"
        ? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        : selectedPeriod === "90d"
        ? new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        : null;

    const filtered = rawData.filter((item) => {
      const dateStr = getDate(item);
      if (!dateStr) return false;
      if (!cutoff) return true;
      const d = new Date(dateStr);
      return d >= cutoff;
    });

    return aggregateAppointmentsByDayHour(filtered, getDate, getTime, getStatus);
  }, [rawData, getDate, getTime, getStatus, selectedPeriod, data]);

  // Build 7×cols grid
  const { matrix, maxCount, totalBookings, peakCell } = useMemo(() => {
    const grid: CellStats[][] = Array.from({ length: 7 }, () =>
      Array.from({ length: cols }, () => ({
        count: 0, completed: 0, cancelled: 0, noShow: 0,
      })),
    );
    let max = 0;
    let total = 0;
    let peakD = 0, peakH = 0, peakC = 0;

    for (const d of activeData) {
      const dayIdx = d.day % 7;
      const hourIdx = Math.floor(d.hour / blockSize) % cols;
      const cell = grid[dayIdx][hourIdx];
      cell.count += d.count;
      cell.completed += d.completed ?? 0;
      cell.cancelled += d.cancelled ?? 0;
      cell.noShow += d.noShow ?? 0;
      total += d.count;
      if (cell.count > max) { max = cell.count; peakD = dayIdx; peakH = hourIdx; peakC = cell.count; }
    }

    return { matrix: grid, maxCount: max, totalBookings: total, peakCell: { day: peakD, hour: peakH, count: peakC } };
  }, [activeData, cols, blockSize]);

  const toneColor = TONE_COLORS[tone];

  // Summary stats
  const activeCells = useMemo(() => {
    let count = 0;
    for (let d = 0; d < 7; d++)
      for (let h = 0; h < cols; h++)
        if (matrix[d][h].count > 0) count++;
    return count;
  }, [matrix, cols]);

  const handleCellClick = useCallback((dayIdx: number, hourIdx: number) => {
    if (!onCellClick) return;
    onCellClick(dayIdx, hourIdx * blockSize, (hourIdx + 1) * blockSize);
  }, [onCellClick, blockSize]);

  return (
    <GlassCard className={cn("p-5 border border-border/40 shadow-sm relative flex flex-col", className)}>
      {/* Background glow */}
      <div
        className="absolute -right-24 -top-24 h-48 w-48 rounded-full blur-3xl pointer-events-none"
        style={{ background: `rgba(${toneColor.rgb}, 0.05)` }}
      />

      {/* Header */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <div
              className="grid h-8 w-8 shrink-0 place-items-center rounded-xl"
              style={{ background: `rgba(${toneColor.rgb}, 0.1)`, color: `rgb(${toneColor.rgb})` }}
            >
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight">{title}</div>
              {subtitle && (
                <div className="text-[10px] text-muted-foreground font-medium mt-0.5">{subtitle}</div>
              )}
            </div>
          </div>
        </div>

        {/* Period Selector Tabs */}
        {rawData && (
          <div className="flex rounded-xl bg-muted/40 border border-border/40 p-1">
            {(["7d", "30d", "90d", "all"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setSelectedPeriod(p)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition-all",
                  selectedPeriod === p
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {/* Summary chips */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-background/60 px-2.5 py-1 text-[10px] font-bold tabular-nums">
            <Calendar className="h-3 w-3 opacity-60" />
            <span className="text-muted-foreground">Total</span>
            <span className="text-foreground">{totalBookings.toLocaleString()}</span>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-background/60 px-2.5 py-1 text-[10px] font-bold tabular-nums">
            <TrendingUp className="h-3 w-3 opacity-60" />
            <span className="text-muted-foreground">Active</span>
            <span className="text-foreground">{activeCells}/{7 * cols}</span>
          </div>
          {peakCell.count > 0 && (
            <div
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold"
              style={{ borderColor: `rgba(${toneColor.rgb}, 0.2)`, background: `rgba(${toneColor.rgb}, 0.08)`, color: `rgb(${toneColor.rgb})` }}
            >
              <Sparkles className="h-3 w-3" />
              <span>Peak: {DAYS[peakCell.day]} {hourLabels[peakCell.hour]}</span>
            </div>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="relative flex-1 flex flex-col justify-center" ref={containerRef}>
        <div className="w-full overflow-x-auto pb-1 custom-scrollbar">
          <div className="pr-2" style={{ minWidth: cols === 24 ? 620 : 420 }}>
            {/* Hour labels */}
            <div className="flex pl-10 mb-2">
              {hourLabels.map((hr) => (
                <div
                  key={hr}
                  className={cn(
                    "flex-1 text-center text-[10px] font-semibold text-muted-foreground/80 tracking-tight",
                    cols === 24 && "text-[8px]",
                  )}
                >
                  {cols === 24 ? (hourLabels.indexOf(hr) % 3 === 0 ? hr : "") : hr}
                </div>
              ))}
            </div>

            {/* Matrix rows */}
            <div className="space-y-1.5">
              {DAYS.map((dayName, dayIdx) => (
                <div key={dayName} className="flex items-center">
                  <div className="w-10 text-[10px] font-bold text-muted-foreground/70 uppercase select-none">
                    {dayName}
                  </div>
                  <div className="flex-1 flex gap-1.5">
                    {matrix[dayIdx].map((cellStats, hourIdx) => {
                      const intensity = maxCount > 0 ? cellStats.count / maxCount : 0;
                      const hasData = cellStats.count > 0;
                      const opacity = hasData ? 0.15 + intensity * 0.85 : 0.04;
                      const bgStyle = hasData
                        ? `rgba(${toneColor.rgb}, ${opacity})`
                        : "var(--muted)";
                      const borderStyle = hasData
                        ? `rgba(${toneColor.rgb}, ${0.1 + intensity * 0.4})`
                        : "transparent";

                      return (
                        <div
                          key={hourIdx}
                          className={cn(
                            "flex-1 rounded-lg transition-all duration-200 relative",
                            onCellClick && hasData ? "cursor-pointer hover:ring-2 hover:ring-offset-1" : "cursor-default",
                          )}
                          style={{
                            height: cols === 24 ? 28 : 36,
                            background: bgStyle,
                            border: `1px solid ${borderStyle}`,
                            ...(onCellClick && hasData ? { ["--tw-ring-color" as string]: `rgba(${toneColor.rgb}, 0.4)` } : {}),
                          }}
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const parentRect = containerRef.current?.getBoundingClientRect();
                            setHoveredCell({
                              dayIdx,
                              hourIdx,
                              stats: cellStats,
                              x: rect.left - (parentRect?.left ?? 0) + rect.width / 2,
                              y: rect.top - (parentRect?.top ?? 0),
                            });
                          }}
                          onMouseLeave={() => setHoveredCell(null)}
                          onClick={() => hasData && handleCellClick(dayIdx, hourIdx)}
                        >
                          {hasData && intensity > 0.7 && (
                            <span
                              className="absolute inset-0 m-auto h-1.5 w-1.5 rounded-full opacity-60 animate-pulse"
                              style={{ background: `rgb(${toneColor.rgb})` }}
                            />
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

        {/* Tooltip */}
        <AnimatePresence>
          {hoveredCell && (
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.95 }}
              transition={{ duration: 0.1 }}
              className="pointer-events-none absolute z-50 -translate-x-1/2 -translate-y-full"
              style={{ left: hoveredCell.x, top: hoveredCell.y - 6 }}
            >
              <div className="rounded-xl border border-border bg-popover/95 shadow-xl px-3 py-2.5 text-xs backdrop-blur-sm min-w-[170px]">
                <div className="font-bold" style={{ color: `rgb(${toneColor.rgb})` }}>
                  {hoveredCell.stats.count === 0 ? "No activity" : `${hoveredCell.stats.count} events`}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {DAYS[hoveredCell.dayIdx]}s between {hourLabels[hoveredCell.hourIdx]} – {hourLabels[(hoveredCell.hourIdx + 1) % cols] || "12am"}
                </div>

                {hoveredCell.stats.count > 0 && (hoveredCell.stats.completed > 0 || hoveredCell.stats.cancelled > 0) && (
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-border/40 pt-2">
                    <div>
                      <div className="text-[9px] text-muted-foreground">Completed</div>
                      <div className="font-bold text-success tabular-nums">{hoveredCell.stats.completed}</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-muted-foreground">Cancelled</div>
                      <div className="font-bold text-danger tabular-nums">{hoveredCell.stats.cancelled}</div>
                    </div>
                    {hoveredCell.stats.noShow > 0 && (
                      <div>
                        <div className="text-[9px] text-muted-foreground">No-shows</div>
                        <div className="font-bold text-warning tabular-nums">{hoveredCell.stats.noShow}</div>
                      </div>
                    )}
                    {hoveredCell.stats.count > 0 && (
                      <div>
                        <div className="text-[9px] text-muted-foreground">Completion</div>
                        <div className="font-bold text-success tabular-nums">{Math.round((hoveredCell.stats.completed / hoveredCell.stats.count) * 100)}%</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {/* Arrow */}
              <div className="mx-auto h-0 w-0 border-x-[5px] border-x-transparent border-t-[5px] border-t-popover" style={{ marginTop: -1 }} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Legend */}
      <div className="mt-3 flex items-center justify-between gap-3 pt-2 border-t border-border/30">
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium">
          <Info className="h-3 w-3" />
          {onCellClick ? "Click a cell to filter" : `${7 * cols} day-hour slots`}
        </div>
        <div className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium">
          <span>Less</span>
          {[0.04, 0.2, 0.4, 0.65, 0.9].map((op, i) => (
            <span
              key={i}
              className="inline-block rounded-sm"
              style={{
                width: 11,
                height: 11,
                background: i === 0 ? "var(--muted)" : `rgba(${toneColor.rgb}, ${op})`,
              }}
            />
          ))}
          <span>More</span>
        </div>
      </div>
    </GlassCard>
  );
}

/** Utility: build DayHourDatum[] from appointment records */
export function aggregateAppointmentsByDayHour<T>(
  items: T[],
  getDate: (x: T) => string | undefined | null,
  getTime: (x: T) => string | undefined | null,
  getStatus?: (x: T) => string | undefined | null,
): DayHourDatum[] {
  const map = new Map<string, DayHourDatum>();

  for (const item of items) {
    const dateStr = getDate(item);
    const timeStr = getTime(item);
    if (!dateStr || !timeStr) continue;

    const day = new Date(dateStr).getDay();
    const hour = parseInt(timeStr.split(":")[0], 10);
    if (isNaN(hour)) continue;

    const key = `${day}-${hour}`;
    if (!map.has(key)) {
      map.set(key, { day, hour, count: 0, completed: 0, cancelled: 0, noShow: 0 });
    }
    const entry = map.get(key)!;
    entry.count++;

    if (getStatus) {
      const status = (getStatus(item) ?? "").toUpperCase();
      if (status === "COMPLETED") entry.completed = (entry.completed ?? 0) + 1;
      if (status === "CANCELLED") entry.cancelled = (entry.cancelled ?? 0) + 1;
      if (status === "NO_SHOW") entry.noShow = (entry.noShow ?? 0) + 1;
    }
  }

  return Array.from(map.values());
}
