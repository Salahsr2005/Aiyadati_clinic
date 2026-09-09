import { useState, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Clock, Sparkles, Info, Calendar, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/glass/GlassCard";
import type { DoctorSlot } from "@/api/clinicAppointmentsApi";

type AppointmentSlotRow = DoctorSlot;

export interface DoctorScheduleHeatmapProps {
  slots: AppointmentSlotRow[];
  selectedDate?: string;
  onDateSelect?: (date: string) => void;
  onGenerateSlots?: (payload: { date: string; startHour: number; endHour: number }) => void;
  onCancelSlots?: (payload: { date: string; startHour: number; endHour: number }) => void;
  isGenerating?: boolean;
}

export function DoctorScheduleHeatmap({
  slots = [],
  selectedDate,
  onDateSelect,
  onGenerateSlots,
  isGenerating = false,
}: DoctorScheduleHeatmapProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  const containerRef = useRef<HTMLDivElement>(null);

  // View range mode: "PEAK" (08:00 - 20:00) vs "FULL_24" (00:00 - 23:00)
  const [viewRangeMode, setViewRangeMode] = useState<"PEAK" | "FULL_24">("PEAK");

  const hourList = useMemo(() => {
    if (viewRangeMode === "PEAK") {
      return Array.from({ length: 13 }).map((_, i) => i + 8); // 8 AM to 8 PM (8..20)
    }
    return Array.from({ length: 24 }).map((_, i) => i);
  }, [viewRangeMode]);

  // Drag / Swipe selection state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ dayIndex: number; hour: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ dayIndex: number; hour: number } | null>(null);
  const [focusedCell, setFocusedCell] = useState<{ dayIndex: number; hour: number } | null>(null);
  const [hoveredSlotInfo, setHoveredSlotInfo] = useState<{ dayName: string; dateStr: string; hour: number; slotsCount: number; status: string } | null>(null);

  // Derive 7 days of the week starting from current week or selected date
  const weekDays = useMemo(() => {
    const base = selectedDate ? new Date(selectedDate) : new Date();
    const dayOfWeek = base.getDay(); // 0 = Sun
    const sun = new Date(base);
    sun.setDate(base.getDate() - dayOfWeek);

    return Array.from({ length: 7 }).map((_, idx) => {
      const d = new Date(sun);
      d.setDate(sun.getDate() + idx);
      const dateStr = d.toISOString().split("T")[0];
      const dayName = d.toLocaleDateString(i18n.language, { weekday: "short" });
      const dayNum = d.getDate();
      return { dateStr, dayName, dayNum, fullDate: d };
    });
  }, [selectedDate, i18n.language]);

  // Index slots by date and hour (0..23)
  const slotMatrix = useMemo(() => {
    const matrix: Record<string, Record<number, AppointmentSlotRow[]>> = {};

    weekDays.forEach((day) => {
      matrix[day.dateStr] = {};
      for (let h = 0; h < 24; h++) {
        matrix[day.dateStr][h] = [];
      }
    });

    slots.forEach((slot) => {
      const dateStr = slot.date.split("T")[0];
      if (matrix[dateStr]) {
        const hour = parseInt(slot.startTime.split(":")[0], 10);
        if (!isNaN(hour) && hour >= 0 && hour < 24) {
          matrix[dateStr][hour].push(slot);
        }
      }
    });

    return matrix;
  }, [slots, weekDays]);

  // Determine density/status cell color
  const getCellStatus = (dateStr: string, hour: number) => {
    const cellSlots = slotMatrix[dateStr]?.[hour] || [];
    if (cellSlots.length === 0) return "NO_SLOT";

    const isAllCancelled = cellSlots.every((s) => s.status === "CANCELLED");
    if (isAllCancelled) return "CANCELLED";

    const activeSlots = cellSlots.filter((s) => s.status !== "CANCELLED");
    if (activeSlots.length === 0) return "CANCELLED";

    const totalPatients = activeSlots.reduce((acc, s) => acc + (s.currentPatients || 0), 0);
    const maxCapacity = activeSlots.reduce((acc, s) => acc + (s.maxPatients || 1), 0);

    if (totalPatients >= maxCapacity) return "FULL";
    if (totalPatients > 0) return "PARTIAL";
    return "AVAILABLE";
  };

  const getStatusColorClass = (status: string, isSelected: boolean) => {
    if (isSelected) {
      return "bg-primary-500 border-primary-400 text-white shadow-lg ring-4 ring-primary-500/30 scale-125 z-20";
    }
    switch (status) {
      case "AVAILABLE":
        return "bg-emerald-500/20 border-emerald-500/50 text-emerald-600 dark:text-emerald-400 font-extrabold shadow-xs hover:bg-emerald-500/40 hover:scale-115";
      case "PARTIAL":
        return "bg-cyan-500/25 border-cyan-500/60 text-cyan-600 dark:text-cyan-400 font-extrabold shadow-xs hover:bg-cyan-500/40 hover:scale-115";
      case "FULL":
        return "bg-amber-500/30 border-amber-500/70 text-amber-600 dark:text-amber-400 font-extrabold shadow-xs hover:bg-amber-500/45 hover:scale-115";
      case "CANCELLED":
        return "bg-rose-500/20 border-rose-500/50 text-rose-600 dark:text-rose-400 font-bold hover:bg-rose-500/35 hover:scale-115";
      default:
        return "bg-muted/15 border-border/25 text-muted-foreground/30 hover:border-primary-500/40 hover:bg-primary-500/10 hover:text-primary-500 hover:scale-110";
    }
  };

  // Pointer drag / swipe handlers
  const handlePointerDown = (dayIndex: number, hour: number, e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    setDragStart({ dayIndex, hour });
    setDragCurrent({ dayIndex, hour });
    setFocusedCell({ dayIndex, hour });
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

  useEffect(() => {
    const globalUp = () => {
      if (isDragging) {
        setIsDragging(false);
        if (dragStart && dragCurrent) {
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
        }
        setDragStart(null);
        setDragCurrent(null);
      }
    };
    window.addEventListener("pointerup", globalUp);
    return () => window.removeEventListener("pointerup", globalUp);
  }, [isDragging, dragStart, dragCurrent, weekDays, onGenerateSlots]);

  const isCellSelected = (dayIndex: number, hour: number) => {
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
    <GlassCard className="p-5 border border-border/40 space-y-4 select-none">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/30">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary-500/10 text-primary-500">
            <Sparkles className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              {t("schedule.heatmap.title", { defaultValue: "Interactive Circular Schedule Matrix" })}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t("schedule.heatmap.subtitle", {
                defaultValue: "Swipe or drag circular time cells to instantly set doctor working hours",
              })}
            </p>
          </div>
        </div>

        {/* View Mode Toggle Pills */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewRangeMode("PEAK")}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer",
              viewRangeMode === "PEAK"
                ? "bg-primary-500 text-white shadow-xs"
                : "bg-accent/40 text-muted-foreground hover:text-foreground"
            )}
          >
            {t("schedule.heatmap.peakHours", { defaultValue: "Peak Hours (8 AM - 8 PM)" })}
          </button>
          <button
            type="button"
            onClick={() => setViewRangeMode("FULL_24")}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer",
              viewRangeMode === "FULL_24"
                ? "bg-primary-500 text-white shadow-xs"
                : "bg-accent/40 text-muted-foreground hover:text-foreground"
            )}
          >
            {t("schedule.heatmap.fullHours", { defaultValue: "Full 24 Hours" })}
          </button>
        </div>
      </div>

      {/* Circular Grid Matrix View */}
      <div
        ref={containerRef}
        className="w-full overflow-x-auto pb-2 custom-scrollbar touch-none"
      >
        <div className="min-w-[680px]">
          {/* Hours Header Row */}
          <div className="flex items-center mb-2.5 text-[10px] font-extrabold text-muted-foreground/70">
            <div className="w-24 shrink-0 px-2 text-start flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-primary-500" />
              <span>Day / Date</span>
            </div>
            <div
              className="flex-1 grid gap-1 text-center"
              style={{ gridTemplateColumns: `repeat(${hourList.length}, minmax(0, 1fr))` }}
            >
              {hourList.map((h) => (
                <div key={h} className="truncate">
                  {formatHourLabel(h)}
                </div>
              ))}
            </div>
          </div>

          {/* Days Rows */}
          <div className="space-y-2.5">
            {weekDays.map((day, dayIndex) => {
              const isToday = new Date().toISOString().split("T")[0] === day.dateStr;
              const isSelectedDay = selectedDate === day.dateStr;

              return (
                <div
                  key={day.dateStr}
                  className={cn(
                    "flex items-center rounded-2xl border p-2 transition-all",
                    isSelectedDay
                      ? "border-primary-500/40 bg-primary-500/5 shadow-sm"
                      : "border-border/30 bg-accent/20 hover:border-border/60"
                  )}
                >
                  {/* Day Label Button */}
                  <button
                    type="button"
                    onClick={() => onDateSelect?.(day.dateStr)}
                    className="w-24 shrink-0 text-start px-2 py-1 rounded-xl hover:bg-muted/40 transition cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-foreground">{day.dayName}</span>
                      {isToday && (
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground tabular-nums font-mono mt-0.5">
                      {day.dateStr.slice(5)}
                    </div>
                  </button>

                  {/* Circular Hour Cells */}
                  <div
                    className="flex-1 grid gap-1.5 place-items-center"
                    style={{ gridTemplateColumns: `repeat(${hourList.length}, minmax(0, 1fr))` }}
                  >
                    {hourList.map((hour) => {
                      const status = getCellStatus(day.dateStr, hour);
                      const isSelected = isCellSelected(dayIndex, hour);
                      const isFocused =
                        focusedCell?.dayIndex === dayIndex && focusedCell?.hour === hour;
                      const cellSlots = slotMatrix[day.dateStr]?.[hour] || [];

                      return (
                        <button
                          type="button"
                          key={hour}
                          data-day-index={dayIndex}
                          data-hour={hour}
                          onPointerDown={(e) => handlePointerDown(dayIndex, hour, e)}
                          onPointerEnter={() => handlePointerEnter(dayIndex, hour)}
                          onPointerUp={handlePointerUp}
                          onMouseEnter={() =>
                            setHoveredSlotInfo({
                              dayName: day.dayName,
                              dateStr: day.dateStr,
                              hour,
                              slotsCount: cellSlots.length,
                              status,
                            })
                          }
                          onMouseLeave={() => setHoveredSlotInfo(null)}
                          tabIndex={isFocused ? 0 : -1}
                          title={`${day.dayName} ${day.dateStr} @ ${formatHourLabel(
                            hour
                          )} — ${cellSlots.length} slot(s)`}
                          className={cn(
                            "h-7 w-7 sm:h-8 sm:w-8 rounded-full border text-[11px] font-extrabold flex items-center justify-center transition-all duration-200 cursor-pointer outline-none relative shadow-xs",
                            getStatusColorClass(status, isSelected),
                            isFocused && "ring-2 ring-primary-500"
                          )}
                        >
                          {cellSlots.length > 0 ? (
                            <span className="tabular-nums opacity-95">{cellSlots.length}</span>
                          ) : null}
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

      {/* Slot Hover Detail Strip */}
      {hoveredSlotInfo && (
        <div className="flex items-center gap-2 rounded-xl bg-accent/40 border border-border/40 px-3 py-1.5 text-xs text-foreground animate-fadeIn">
          <Info className="h-4 w-4 text-primary-500 shrink-0" />
          <span className="font-semibold">
            {hoveredSlotInfo.dayName} ({hoveredSlotInfo.dateStr}) @ {formatHourLabel(hoveredSlotInfo.hour)}:
          </span>
          <span className="font-bold text-primary-500">
            {hoveredSlotInfo.slotsCount > 0 ? `${hoveredSlotInfo.slotsCount} Active Slot(s)` : "No Slots (Swipe to generate)"}
          </span>
        </div>
      )}

      {/* Legend & Status Strip */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-border/30 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-muted/20 border border-border/40" />
            <span className="text-muted-foreground text-[11px]">
              {t("schedule.heatmap.noSlot", { defaultValue: "No Slot" })}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-emerald-500/25 border border-emerald-500/50" />
            <span className="text-foreground font-semibold text-[11px]">
              {t("schedule.heatmap.available", { defaultValue: "Available" })}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-cyan-500/25 border border-cyan-500/50" />
            <span className="text-foreground font-semibold text-[11px]">
              {t("schedule.heatmap.partial", { defaultValue: "Partially Booked" })}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-amber-500/30 border border-amber-500/60" />
            <span className="text-foreground font-semibold text-[11px]">
              {t("schedule.heatmap.full", { defaultValue: "Fully Booked" })}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-rose-500/25 border border-rose-500/50" />
            <span className="text-foreground font-semibold text-[11px]">
              {t("schedule.heatmap.cancelled", { defaultValue: "Cancelled" })}
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
