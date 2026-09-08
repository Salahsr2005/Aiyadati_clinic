import { useState, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Calendar, Clock, Sparkles, AlertCircle, Info, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/glass/GlassCard";
import type { AppointmentSlotRow } from "@/api/clinicAppointmentsApi";

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
  onCancelSlots,
  isGenerating = false,
}: DoctorScheduleHeatmapProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  const containerRef = useRef<HTMLDivElement>(null);

  // Drag selection state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ dayIndex: number; hour: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ dayIndex: number; hour: number } | null>(null);
  const [focusedCell, setFocusedCell] = useState<{ dayIndex: number; hour: number } | null>(null);

  // Derive 7 days of the week starting from current week or selected date
  const weekDays = useMemo(() => {
    const base = selectedDate ? new Date(selectedDate) : new Date();
    const dayOfWeek = base.getDay(); // 0 = Sun
    // Sunday as start of week in AR / EN
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
      return "bg-primary-500 text-white shadow-lg shadow-primary-500/30 scale-105 border-primary-400 z-10";
    }
    switch (status) {
      case "AVAILABLE":
        return "bg-emerald-500/20 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/35";
      case "PARTIAL":
        return "bg-cyan-500/20 border-cyan-500/40 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/35";
      case "FULL":
        return "bg-amber-500/25 border-amber-500/50 text-amber-600 dark:text-amber-400 hover:bg-amber-500/40";
      case "CANCELLED":
        return "bg-rose-500/20 border-rose-500/40 text-rose-600 dark:text-rose-400 hover:bg-rose-500/35";
      default:
        return "bg-muted/15 border-border/20 text-muted-foreground/40 hover:bg-muted/30";
    }
  };

  // Drag handlers
  const handleMouseDown = (dayIndex: number, hour: number) => {
    setIsDragging(true);
    setDragStart({ dayIndex, hour });
    setDragCurrent({ dayIndex, hour });
    setFocusedCell({ dayIndex, hour });
  };

  const handleMouseEnter = (dayIndex: number, hour: number) => {
    if (isDragging && dragStart) {
      setDragCurrent({ dayIndex, hour });
    }
  };

  const handleMouseUp = () => {
    if (isDragging && dragStart && dragCurrent) {
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

  // Touch drag handlers
  const handleTouchStart = (dayIndex: number, hour: number) => {
    handleMouseDown(dayIndex, hour);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !dragStart) return;
    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    if (element) {
      const dayIdx = element.getAttribute("data-day-index");
      const hourVal = element.getAttribute("data-hour");
      if (dayIdx !== null && hourVal !== null) {
        setDragCurrent({ dayIndex: parseInt(dayIdx, 10), hour: parseInt(hourVal, 10) });
      }
    }
  };

  useEffect(() => {
    const globalMouseUp = () => {
      if (isDragging) {
        handleMouseUp();
      }
    };
    window.addEventListener("mouseup", globalMouseUp);
    return () => window.removeEventListener("mouseup", globalMouseUp);
  }, [isDragging, dragStart, dragCurrent]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent, dayIndex: number, hour: number) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setFocusedCell({ dayIndex, hour: Math.min(23, hour + (isRtl ? -1 : 1)) });
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setFocusedCell({ dayIndex, hour: Math.max(0, hour + (isRtl ? 1 : -1)) });
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedCell({ dayIndex: Math.min(6, dayIndex + 1), hour });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedCell({ dayIndex: Math.max(0, dayIndex - 1), hour });
    } else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      const day = weekDays[dayIndex];
      if (day && onGenerateSlots) {
        onGenerateSlots({ date: day.dateStr, startHour: hour, endHour: hour + 1 });
      }
    }
  };

  const isCellSelected = (dayIndex: number, hour: number) => {
    if (!dragStart || !dragCurrent) return false;
    const startD = Math.min(dragStart.dayIndex, dragCurrent.dayIndex);
    const endD = Math.max(dragStart.dayIndex, dragCurrent.dayIndex);
    const startH = Math.min(dragStart.hour, dragCurrent.hour);
    const endH = Math.max(dragStart.hour, dragCurrent.hour);

    return dayIndex >= startD && dayIndex <= endD && hour >= startH && hour <= endH;
  };

  // 12h label formatter
  const formatHourLabel = (h: number) => {
    if (h === 0) return "12 AM";
    if (h === 12) return "12 PM";
    return h > 12 ? `${h - 12} PM` : `${h} AM`;
  };

  return (
    <GlassCard className="p-5 border border-border/40 space-y-4 select-none">
      {/* Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/30">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary-500/10 text-primary-500">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">
              {t("schedule.heatmap.title", { defaultValue: "Interactive Weekly Schedule Matrix" })}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t("schedule.heatmap.subtitle", {
                defaultValue: "View slot density and drag to manage working hours & availability",
              })}
            </p>
          </div>
        </div>

        {/* Drag Hint & Status */}
        <div className="flex items-center gap-2 rounded-xl bg-primary-500/10 border border-primary-500/20 px-3 py-1.5 text-xs text-primary-600 dark:text-primary-400">
          <Info className="h-3.5 w-3.5 shrink-0" />
          <span>
            {t("schedule.heatmap.dragHint", {
              defaultValue: "Click and drag across time cells to generate or clear slots",
            })}
          </span>
        </div>
      </div>

      {/* Grid Matrix View */}
      <div
        ref={containerRef}
        onTouchMove={handleTouchMove}
        className="w-full overflow-x-auto pb-2 custom-scrollbar"
      >
        <div className="min-w-[760px]">
          {/* Hours Header Row */}
          <div className="flex items-center mb-2 text-[10px] font-bold text-muted-foreground/70">
            <div className="w-24 shrink-0 px-2 text-start">Day / Date</div>
            <div className="flex-1 grid grid-cols-24 gap-1 text-center">
              {Array.from({ length: 24 }).map((_, h) => (
                <div key={h} className="truncate">
                  {h % 3 === 0 ? formatHourLabel(h) : "•"}
                </div>
              ))}
            </div>
          </div>

          {/* Days Rows */}
          <div className="space-y-2">
            {weekDays.map((day, dayIndex) => {
              const isToday = new Date().toISOString().split("T")[0] === day.dateStr;
              const isSelectedDay = selectedDate === day.dateStr;

              return (
                <div
                  key={day.dateStr}
                  className={cn(
                    "flex items-center rounded-2xl border p-1.5 transition-all",
                    isSelectedDay
                      ? "border-primary-500/40 bg-primary-500/5 shadow-sm"
                      : "border-border/30 bg-muted/10 hover:border-border/60"
                  )}
                >
                  {/* Day Label Button */}
                  <button
                    type="button"
                    onClick={() => onDateSelect?.(day.dateStr)}
                    className="w-24 shrink-0 text-start px-2 py-1 rounded-xl hover:bg-muted/40 transition"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-foreground">{day.dayName}</span>
                      {isToday && (
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground tabular-nums">
                      {day.dateStr}
                    </div>
                  </button>

                  {/* 24-Hour Cells */}
                  <div className="flex-1 grid grid-cols-24 gap-1">
                    {Array.from({ length: 24 }).map((_, hour) => {
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
                          onMouseDown={() => handleMouseDown(dayIndex, hour)}
                          onMouseEnter={() => handleMouseEnter(dayIndex, hour)}
                          onTouchStart={() => handleTouchStart(dayIndex, hour)}
                          onKeyDown={(e) => handleKeyDown(e, dayIndex, hour)}
                          tabIndex={isFocused ? 0 : -1}
                          title={`${day.dayName} ${day.dateStr} @ ${formatHourLabel(
                            hour
                          )} — ${cellSlots.length} slot(s)`}
                          className={cn(
                            "h-8 rounded-xl border text-[10px] font-bold flex items-center justify-center transition-all duration-150 relative cursor-pointer outline-none",
                            getStatusColorClass(status, isSelected),
                            isFocused && "ring-2 ring-primary-500"
                          )}
                        >
                          {cellSlots.length > 0 ? (
                            <span className="tabular-nums opacity-90">{cellSlots.length}</span>
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

      {/* Legend Footer */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-border/30 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-md bg-muted/20 border border-border/40" />
            <span className="text-muted-foreground">
              {t("schedule.heatmap.noSlot", { defaultValue: "No Slot" })}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-md bg-emerald-500/20 border border-emerald-500/40" />
            <span className="text-foreground font-semibold">
              {t("schedule.heatmap.available", { defaultValue: "Available" })}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-md bg-cyan-500/20 border border-cyan-500/40" />
            <span className="text-foreground font-semibold">
              {t("schedule.heatmap.partial", { defaultValue: "Partially Booked" })}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-md bg-amber-500/25 border border-amber-500/50" />
            <span className="text-foreground font-semibold">
              {t("schedule.heatmap.full", { defaultValue: "Fully Booked" })}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-md bg-rose-500/20 border border-rose-500/40" />
            <span className="text-foreground font-semibold">
              {t("schedule.heatmap.cancelled", { defaultValue: "Cancelled" })}
            </span>
          </div>
        </div>

        {isGenerating && (
          <div className="flex items-center gap-2 text-primary-500 font-bold text-xs animate-pulse">
            <Clock className="h-4 w-4 animate-spin" />
            Updating schedule slots…
          </div>
        )}
      </div>
    </GlassCard>
  );
}
