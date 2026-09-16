import { useState, useMemo, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Clock,
  Sparkles,
  Info,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Zap,
  CheckCircle2,
  Users,
  DoorOpen,
  CalendarRange,
  RotateCcw,
} from "lucide-react";
import { format, addDays, subDays, startOfWeek, endOfWeek, addWeeks, subWeeks } from "date-fns";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/glass/GlassCard";
import type { DoctorSlot } from "@/api/clinicAppointmentsApi";

export interface DoctorScheduleHeatmapProps {
  slots: DoctorSlot[];
  selectedDate?: string;
  onDateSelect?: (date: string) => void;
  onGenerateSlots?: (payload: { date: string; startHour: number; endHour: number }) => void;
  onQuickAddSlot?: (payload: { date: string; hour: number }) => void;
  isGenerating?: boolean;
}

export function DoctorScheduleHeatmap({
  slots = [],
  selectedDate,
  onDateSelect,
  onGenerateSlots,
  onQuickAddSlot,
  isGenerating = false,
}: DoctorScheduleHeatmapProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  const containerRef = useRef<HTMLDivElement>(null);

  // Active base date for week view
  const [currentWeekBase, setCurrentWeekBase] = useState<Date>(() =>
    selectedDate ? new Date(selectedDate) : new Date()
  );

  // Synchronize with external selectedDate changes
  useEffect(() => {
    if (selectedDate) {
      setCurrentWeekBase(new Date(selectedDate));
    }
  }, [selectedDate]);

  // View range mode: "PEAK" (08:00 - 20:00) vs "FULL_24" (00:00 - 23:00)
  const [viewRangeMode, setViewRangeMode] = useState<"PEAK" | "FULL_24">("PEAK");
  const [densityFilter, setDensityFilter] = useState<"ALL" | "AVAILABLE" | "BOOKED" | "CANCELLED">("ALL");

  const hourList = useMemo(() => {
    if (viewRangeMode === "PEAK") {
      return Array.from({ length: 13 }).map((_, i) => i + 8); // 8 AM to 8 PM (8..20)
    }
    return Array.from({ length: 24 }).map((_, i) => i);
  }, [viewRangeMode]);

  // Compute 7 days of current week
  const weekStart = useMemo(() => startOfWeek(currentWeekBase, { weekStartsOn: 0 }), [currentWeekBase]);
  const weekEnd = useMemo(() => endOfWeek(currentWeekBase, { weekStartsOn: 0 }), [currentWeekBase]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }).map((_, idx) => {
      const d = addDays(weekStart, idx);
      const dateStr = format(d, "yyyy-MM-dd");
      const dayName = format(d, "EEE");
      const fullDayName = format(d, "EEEE");
      const dayNum = format(d, "d");
      const isToday = format(new Date(), "yyyy-MM-dd") === dateStr;
      const isSelected = selectedDate === dateStr;
      return { dateStr, dayName, fullDayName, dayNum, fullDate: d, isToday, isSelected };
    });
  }, [weekStart, selectedDate]);

  // Index slots by date and hour (0..23)
  const slotMatrix = useMemo(() => {
    const matrix: Record<string, Record<number, DoctorSlot[]>> = {};

    weekDays.forEach((day) => {
      matrix[day.dateStr] = {};
      for (let h = 0; h < 24; h++) {
        matrix[day.dateStr][h] = [];
      }
    });

    slots.forEach((slot) => {
      const dateStr = slot.date?.slice(0, 10);
      if (matrix[dateStr]) {
        const hour = parseInt(slot.startTime?.slice(0, 2) || "0", 10);
        if (!isNaN(hour) && hour >= 0 && hour < 24) {
          matrix[dateStr][hour].push(slot);
        }
      }
    });

    return matrix;
  }, [slots, weekDays]);

  // Drag / Swipe selection state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ dayIndex: number; hour: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ dayIndex: number; hour: number } | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{
    dayName: string;
    dateStr: string;
    hour: number;
    slots: DoctorSlot[];
    status: string;
    x: number;
    y: number;
  } | null>(null);

  // Density & status calculations
  const getCellStatus = (dateStr: string, hour: number) => {
    const cellSlots = slotMatrix[dateStr]?.[hour] || [];
    if (cellSlots.length === 0) return "NO_SLOT";

    const isAllCancelled = cellSlots.every((s) => String(s.status || "").toLowerCase() === "cancelled" || s.isCancelled);
    if (isAllCancelled) return "CANCELLED";

    const activeSlots = cellSlots.filter((s) => String(s.status || "").toLowerCase() !== "cancelled" && !s.isCancelled);
    if (activeSlots.length === 0) return "CANCELLED";

    const totalPatients = activeSlots.reduce((acc, s) => acc + (s.currentPatients || 0), 0);
    const maxCapacity = activeSlots.reduce((acc, s) => acc + (s.maxPatients || 1), 0);

    if (totalPatients >= maxCapacity) return "FULL";
    if (totalPatients > 0) return "PARTIAL";
    return "AVAILABLE";
  };

  const getStatusColorClass = (status: string, isSelected: boolean, isHighlightedByFilter: boolean) => {
    if (isSelected) {
      return "bg-primary-500 border-primary-300 text-white shadow-lg ring-4 ring-primary-500/40 scale-110 z-20";
    }
    if (!isHighlightedByFilter) {
      return "opacity-25 bg-muted/10 border-border/20 text-muted-foreground/40";
    }
    switch (status) {
      case "AVAILABLE":
        return "bg-emerald-500/20 border-emerald-500/50 text-emerald-700 dark:text-emerald-300 font-extrabold hover:bg-emerald-500/40 hover:scale-110 shadow-xs";
      case "PARTIAL":
        return "bg-cyan-500/20 border-cyan-500/50 text-cyan-700 dark:text-cyan-300 font-extrabold hover:bg-cyan-500/40 hover:scale-110 shadow-xs";
      case "FULL":
        return "bg-amber-500/25 border-amber-500/60 text-amber-700 dark:text-amber-300 font-extrabold hover:bg-amber-500/45 hover:scale-110 shadow-xs";
      case "CANCELLED":
        return "bg-rose-500/20 border-rose-500/50 text-rose-700 dark:text-rose-300 font-bold hover:bg-rose-500/35 hover:scale-110 shadow-xs";
      default:
        return "bg-muted/15 border-dashed border-border/40 text-muted-foreground/40 hover:border-primary-500/50 hover:bg-primary-500/10 hover:text-primary-500 hover:scale-105";
    }
  };

  // Drag handlers
  const handlePointerDown = (dayIndex: number, hour: number, e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    setDragStart({ dayIndex, hour });
    setDragCurrent({ dayIndex, hour });
  };

  const handlePointerEnter = (dayIndex: number, hour: number) => {
    if (isDragging && dragStart) {
      setDragCurrent({ dayIndex, hour });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging && dragStart && dragCurrent) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      setIsDragging(false);
      const targetDay = weekDays[dragStart.dayIndex];
      if (targetDay && onGenerateSlots) {
        const startH = Math.min(dragStart.hour, dragCurrent.hour);
        const endH = Math.max(dragStart.hour, dragCurrent.hour) + 1;
        onGenerateSlots({
          date: targetDay.dateStr,
          startHour: startH,
          endHour: endH,
        });
      }
      setDragStart(null);
      setDragCurrent(null);
    }
  };

  const isCellSelectedInDrag = (dayIndex: number, hour: number) => {
    if (!dragStart || !dragCurrent) return false;
    const startD = Math.min(dragStart.dayIndex, dragCurrent.dayIndex);
    const endD = Math.max(dragStart.dayIndex, dragCurrent.dayIndex);
    const startH = Math.min(dragStart.hour, dragCurrent.hour);
    const endH = Math.max(dragStart.hour, dragCurrent.hour);

    return dayIndex >= startD && dayIndex <= endD && hour >= startH && hour <= endH;
  };

  const formatHourLabel = (h: number) => {
    if (h === 0) return "12 AM";
    if (h === 12) return "12 PM";
    return h > 12 ? `${h - 12} PM` : `${h} AM`;
  };

  return (
    <GlassCard className="p-4 sm:p-6 border border-border/40 space-y-4 select-none">
      {/* 1. Week Header & Interactive Navigation Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/30">
        {/* Week Navigator */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-accent/30 rounded-2xl p-1 border border-border/40">
            <button
              type="button"
              onClick={() => setCurrentWeekBase((prev) => subWeeks(prev, 1))}
              className="p-1.5 rounded-xl hover:bg-accent text-muted-foreground hover:text-foreground transition cursor-pointer"
              title="Previous Week"
            >
              <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
            </button>

            <button
              type="button"
              onClick={() => setCurrentWeekBase(new Date())}
              className="px-3 py-1 text-xs font-bold text-foreground hover:bg-accent rounded-xl transition cursor-pointer"
            >
              {t("schedule.inspector.presetThisWeek", { defaultValue: "This Week" })}
            </button>

            <button
              type="button"
              onClick={() => setCurrentWeekBase((prev) => addWeeks(prev, 1))}
              className="p-1.5 rounded-xl hover:bg-accent text-muted-foreground hover:text-foreground transition cursor-pointer"
              title="Next Week"
            >
              <ChevronRight className="h-4 w-4 rtl:rotate-180" />
            </button>
          </div>

          <div>
            <div className="text-sm font-black text-foreground flex items-center gap-2">
              <CalendarRange className="h-4 w-4 text-primary-500" />
              <span>
                {format(weekStart, "MMM d")} – {format(weekEnd, "MMM d, yyyy")}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {t("schedule.weekly.dragHint", { defaultValue: "Click or drag across hours to create or inspect slots" })}
            </p>
          </div>
        </div>

        {/* View Mode & Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Density Filter */}
          <div className="flex items-center gap-1 bg-accent/20 rounded-xl p-1 border border-border/30">
            {(["ALL", "AVAILABLE", "BOOKED", "CANCELLED"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setDensityFilter(f)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition cursor-pointer",
                  densityFilter === f
                    ? "bg-primary-500 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t(`schedule.filters.${f.toLowerCase()}`, { defaultValue: f })}
              </button>
            ))}
          </div>

          {/* Peak Hours vs Full 24 Hours */}
          <div className="flex items-center gap-1 bg-accent/30 rounded-xl p-0.5 border border-border/30">
            <button
              type="button"
              onClick={() => setViewRangeMode("PEAK")}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer",
                viewRangeMode === "PEAK" ? "bg-primary-500 text-white" : "text-muted-foreground hover:text-foreground"
              )}
            >
              8 AM – 8 PM
            </button>
            <button
              type="button"
              onClick={() => setViewRangeMode("FULL_24")}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer",
                viewRangeMode === "FULL_24" ? "bg-primary-500 text-white" : "text-muted-foreground hover:text-foreground"
              )}
            >
              24 Hours
            </button>
          </div>
        </div>
      </div>

      {/* 2. Drag / Selection Progress Indicator Banner */}
      {isDragging && dragStart && dragCurrent && (
        <div className="flex items-center justify-between p-3 rounded-2xl bg-primary-500/15 border border-primary-500/40 text-primary-500 text-xs font-bold animate-pulse">
          <span className="flex items-center gap-1.5">
            <Sparkles className="h-4 w-4" />
            Selecting: {weekDays[dragStart.dayIndex]?.fullDayName} @ {formatHourLabel(Math.min(dragStart.hour, dragCurrent.hour))} → {formatHourLabel(Math.max(dragStart.hour, dragCurrent.hour) + 1)}
          </span>
          <span className="text-[11px] bg-primary-500 text-white px-2 py-0.5 rounded-full font-black">
            {Math.abs(dragCurrent.hour - dragStart.hour) + 1} Hours Window
          </span>
        </div>
      )}

      {/* 3. Heatmap Grid Matrix */}
      <div ref={containerRef} className="w-full overflow-x-auto pb-2 custom-scrollbar touch-none">
        <div className="min-w-[720px] space-y-2">
          {/* Header Row: Hours */}
          <div className="flex items-center mb-1 text-[10px] font-extrabold text-muted-foreground/70">
            <div className="w-28 shrink-0 px-2 text-start flex items-center gap-1.5">
              <CalendarIcon className="h-3.5 w-3.5 text-primary-500" />
              <span>Day / Date</span>
            </div>
            <div
              className="flex-1 grid gap-1.5 text-center"
              style={{ gridTemplateColumns: `repeat(${hourList.length}, minmax(0, 1fr))` }}
            >
              {hourList.map((h) => (
                <div key={h} className="truncate font-mono">
                  {formatHourLabel(h)}
                </div>
              ))}
            </div>
          </div>

          {/* Rows for Each of the 7 Days */}
          <div className="space-y-2">
            {weekDays.map((day, dayIndex) => {
              const daySlots = Object.values(slotMatrix[day.dateStr] || {}).flat();
              const availableCount = daySlots.filter((s) => String(s.status || "").toLowerCase() === "available").length;
              const bookedCount = daySlots.filter((s) => {
                const st = String(s.status || "").toLowerCase();
                return st === "booked" || st === "full" || s.isBooked;
              }).length;

              return (
                <div
                  key={day.dateStr}
                  className={cn(
                    "flex items-center rounded-2xl border p-2.5 transition-all duration-200",
                    day.isSelected
                      ? "border-primary-500/50 bg-primary-500/10 shadow-sm ring-1 ring-primary-500/20"
                      : "border-border/30 bg-muted/10 hover:border-border/60 hover:bg-muted/20"
                  )}
                >
                  {/* Day Header Button */}
                  <button
                    type="button"
                    onClick={() => onDateSelect?.(day.dateStr)}
                    className="w-28 shrink-0 text-start px-2 py-1 rounded-xl hover:bg-accent/40 transition cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-foreground">{day.dayName}</span>
                      <span className="text-[11px] font-mono text-muted-foreground">{day.dayNum}</span>
                      {day.isToday && (
                        <span className="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/30 animate-pulse" />
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-semibold flex items-center gap-2 mt-0.5">
                      <span>{daySlots.length} slots</span>
                      {availableCount > 0 && <span className="text-emerald-500 font-bold">{availableCount} free</span>}
                    </div>
                  </button>

                  {/* Hourly Cells for this day */}
                  <div
                    className="flex-1 grid gap-1.5 place-items-center"
                    style={{ gridTemplateColumns: `repeat(${hourList.length}, minmax(0, 1fr))` }}
                  >
                    {hourList.map((hour) => {
                      const status = getCellStatus(day.dateStr, hour);
                      const isSelectedInDrag = isCellSelectedInDrag(dayIndex, hour);
                      const cellSlots = slotMatrix[day.dateStr]?.[hour] || [];

                      const isHighlighted =
                        densityFilter === "ALL" ||
                        (densityFilter === "AVAILABLE" && status === "AVAILABLE") ||
                        (densityFilter === "BOOKED" && (status === "FULL" || status === "PARTIAL")) ||
                        (densityFilter === "CANCELLED" && status === "CANCELLED");

                      return (
                        <button
                          type="button"
                          key={hour}
                          data-day-index={dayIndex}
                          data-hour={hour}
                          onPointerDown={(e) => handlePointerDown(dayIndex, hour, e)}
                          onPointerEnter={() => handlePointerEnter(dayIndex, hour)}
                          onPointerUp={handlePointerUp}
                          onClick={() => {
                            if (!isDragging) {
                              onDateSelect?.(day.dateStr);
                              if (cellSlots.length === 0 && onQuickAddSlot) {
                                onQuickAddSlot({ date: day.dateStr, hour });
                              }
                            }
                          }}
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setHoveredCell({
                              dayName: day.fullDayName,
                              dateStr: day.dateStr,
                              hour,
                              slots: cellSlots,
                              status,
                              x: rect.left + rect.width / 2,
                              y: rect.top,
                            });
                          }}
                          onMouseLeave={() => setHoveredCell(null)}
                          className={cn(
                            "h-8 w-8 sm:h-9 sm:w-9 rounded-xl border text-[11px] font-black flex items-center justify-center transition-all duration-150 cursor-pointer outline-none relative",
                            getStatusColorClass(status, isSelectedInDrag, isHighlighted)
                          )}
                          title={`${day.fullDayName} ${day.dateStr} @ ${formatHourLabel(hour)} — ${cellSlots.length} slot(s)`}
                        >
                          {cellSlots.length > 0 ? (
                            <span className="tabular-nums">{cellSlots.length}</span>
                          ) : (
                            <Plus className="h-3 w-3 opacity-0 hover:opacity-100 transition" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. Live Floating Popover on Hover */}
      {hoveredCell && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full mb-2 rounded-2xl border border-border/60 bg-popover/95 p-3 text-xs shadow-2xl backdrop-blur-md text-popover-foreground space-y-1.5 min-w-[200px]"
          style={{ left: hoveredCell.x, top: hoveredCell.y - 8 }}
        >
          <div className="flex items-center justify-between font-black text-primary-500">
            <span>
              {hoveredCell.dayName} @ {formatHourLabel(hoveredCell.hour)}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent uppercase">
              {hoveredCell.status}
            </span>
          </div>
          <div className="text-muted-foreground text-[11px]">
            {hoveredCell.slots.length > 0
              ? `${hoveredCell.slots.length} active consultation slot(s)`
              : "No slots scheduled. Drag or click to add."}
          </div>
        </div>
      )}

      {/* 5. Legend & Density Summary Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-border/30 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-lg bg-emerald-500/20 border border-emerald-500/50" />
            <span className="text-foreground font-bold text-[11px]">
              {t("schedule.filters.available", { defaultValue: "Available" })}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-lg bg-cyan-500/20 border border-cyan-500/50" />
            <span className="text-foreground font-bold text-[11px]">
              Partially Booked
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-lg bg-amber-500/25 border border-amber-500/60" />
            <span className="text-foreground font-bold text-[11px]">
              {t("schedule.filters.full", { defaultValue: "Fully Booked" })}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-lg bg-rose-500/20 border border-rose-500/50" />
            <span className="text-foreground font-bold text-[11px]">
              {t("schedule.filters.cancelled", { defaultValue: "Cancelled" })}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-lg bg-muted/15 border-dashed border-border/40" />
            <span className="text-muted-foreground text-[11px]">
              Empty / Unassigned
            </span>
          </div>
        </div>

        {isGenerating && (
          <div className="flex items-center gap-2 text-primary-500 font-bold text-xs animate-pulse">
            <Clock className="h-4 w-4 animate-spin" />
            Generating schedule slots…
          </div>
        )}
      </div>
    </GlassCard>
  );
}
