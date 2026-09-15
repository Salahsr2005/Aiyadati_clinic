import { useMemo, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Sparkles, Info, TrendingUp, Calendar } from "lucide-react";
import { useTranslation } from "react-i18next";
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
  title,
  subtitle,
  tone = "orange",
  onCellClick,
  className,
  rawData,
  getDate,
  getTime,
  getStatus,
}: DayHourHeatmapProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
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

  const resolvedTitle = title ?? t("overview.dayHourHeatmap.title", { defaultValue: "Activity Heatmap" });

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

    // Recompute DayHourDatum array from filtered items
    const map = new Map<string, CellStats>();
    filtered.forEach((item) => {
      const dateStr = getDate(item);
      const timeStr = getTime(item);
      if (!dateStr || !timeStr) return;

      const day = new Date(dateStr).getDay();
      const hour = parseInt(timeStr.split(":")[0], 10);
      if (isNaN(hour)) return;

      const key = `${day}-${hour}`;
      const existing = map.get(key) || { count: 0, completed: 0, cancelled: 0, noShow: 0 };
      existing.count++;

      const status = (getStatus ? getStatus(item) : "")?.toUpperCase();
      if (status === "COMPLETED") existing.completed++;
      if (status === "CANCELLED") existing.cancelled++;
      if (status === "NO_SHOW") existing.noShow++;

      map.set(key, existing);
    });

    const result: DayHourDatum[] = [];
    map.forEach((stats, key) => {
      const [d, h] = key.split("-").map(Number);
      result.push({ day: d, hour: h, ...stats });
    });
    return result;
  }, [data, rawData, getDate, getTime, getStatus, selectedPeriod]);

  // Aggregate into 7x(cols) matrix
  const { matrix, maxCount, totalBookings, activeCells, peakCell } = useMemo(() => {
    const grid: CellStats[][] = Array.from({ length: 7 }, () =>
      Array.from({ length: cols }, () => ({ count: 0, completed: 0, cancelled: 0, noShow: 0 }))
    );
    let max = 0;
    let total = 0;
    let active = 0;
    let peak = { day: 0, hour: 0, count: 0 };

    activeData.forEach((d) => {
      if (d.day >= 0 && d.day < 7 && d.hour >= 0 && d.hour < 24) {
        const colIdx = Math.floor(d.hour / blockSize) % cols;
        const cell = grid[d.day][colIdx];
        cell.count += d.count;
        cell.completed += d.completed || 0;
        cell.cancelled += d.cancelled || 0;
        cell.noShow += d.noShow || 0;
        total += d.count;
      }
    });

    for (let day = 0; day < 7; day++) {
      for (let c = 0; c < cols; c++) {
        const count = grid[day][c].count;
        if (count > max) max = count;
        if (count > 0) active++;
        if (count > peak.count) {
          peak = { day, hour: c, count };
        }
      }
    }

    return { matrix: grid, maxCount: max, totalBookings: total, activeCells: active, peakCell: peak };
  }, [activeData, cols, blockSize]);

  const toneColor = TONE_COLORS[tone];

  const handleCellClick = useCallback(
    (day: number, colIdx: number) => {
      if (!onCellClick) return;
      const hourStart = colIdx * blockSize;
      const hourEnd = hourStart + blockSize;
      onCellClick(day, hourStart, hourEnd);
    },
    [onCellClick, blockSize]
  );

  return (
    <GlassCard className={cn("p-5 border border-border/40 shadow-sm relative overflow-hidden flex flex-col justify-between", className)}>
      {/* Background glow */}
      <div
        className="absolute -end-24 -top-24 h-48 w-48 rounded-full blur-3xl pointer-events-none"
        style={{ background: `rgba(${toneColor.rgb}, 0.06)` }}
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
              <div className="text-sm font-bold tracking-tight">{resolvedTitle}</div>
              {subtitle && <div className="text-[10px] text-muted-foreground font-medium mt-0.5">{subtitle}</div>}
            </div>
          </div>
        </div>

        {/* Period Selector (if dynamic) */}
        {rawData && (
          <div className="inline-flex items-center rounded-xl bg-muted/60 p-0.5 ring-1 ring-border/20">
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
            <span className="text-muted-foreground">{t("overview.dayHourHeatmap.total", { defaultValue: "Total" })}</span>
            <span className="text-foreground">{totalBookings.toLocaleString()}</span>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-background/60 px-2.5 py-1 text-[10px] font-bold tabular-nums">
            <TrendingUp className="h-3 w-3 opacity-60" />
            <span className="text-muted-foreground">{t("overview.dayHourHeatmap.active", { defaultValue: "Active" })}</span>
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
          <div className="pe-2" style={{ minWidth: cols === 24 ? 620 : 420 }}>
            {/* Hour labels */}
            <div className="flex ps-10 mb-2">
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
                      <div className="text-[9px] text-muted-foreground">{t("overview.dayHourHeatmap.completed", { defaultValue: "Completed" })}</div>
                      <div className="font-bold text-success tabular-nums">{hoveredCell.stats.completed}</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-muted-foreground">{t("overview.dayHourHeatmap.cancelled", { defaultValue: "Cancelled" })}</div>
                      <div className="font-bold text-danger tabular-nums">{hoveredCell.stats.cancelled}</div>
                    </div>
                    {hoveredCell.stats.noShow > 0 && (
                      <div>
                        <div className="text-[9px] text-muted-foreground">{t("overview.dayHourHeatmap.noShows", { defaultValue: "No-shows" })}</div>
                        <div className="font-bold text-warning tabular-nums">{hoveredCell.stats.noShow}</div>
                      </div>
                    )}
                    {hoveredCell.stats.count > 0 && (
                      <div>
                        <div className="text-[9px] text-muted-foreground">{t("overview.dayHourHeatmap.completion", { defaultValue: "Completion" })}</div>
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
          <span>{t("overview.dayHourHeatmap.less", { defaultValue: "Less" })}</span>
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
          <span>{t("overview.dayHourHeatmap.more", { defaultValue: "More" })}</span>
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
