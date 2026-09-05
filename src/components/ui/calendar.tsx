import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface CalendarProps {
  mode?: "single" | "range";
  selected?: Date | string | { from?: Date | string; to?: Date | string };
  onSelect?: (date: Date | any) => void;
  startDate?: string;
  endDate?: string;
  onSelectRange?: (start: string, end: string) => void;
  className?: string;
  bookedDates?: Set<string>;
  modifiers?: Record<string, (date: Date) => boolean>;
  modifiersClassNames?: Record<string, string>;
  showOutsideDays?: boolean;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function Calendar({
  mode = "single",
  selected,
  onSelect,
  startDate,
  endDate,
  onSelectRange,
  className,
  bookedDates,
  modifiers,
}: CalendarProps) {
  // Normalize date inputs
  const selectedIso = useMemo(() => {
    if (!selected) return undefined;
    if (typeof selected === "string") return selected;
    if (selected instanceof Date) return toIso(selected);
    if (typeof selected === "object" && "from" in selected) {
      const from = selected.from instanceof Date ? toIso(selected.from) : selected.from;
      return from;
    }
    return undefined;
  }, [selected]);

  const rangeStartIso = useMemo(() => {
    if (startDate) return startDate;
    if (selected && typeof selected === "object" && "from" in selected && selected.from) {
      return selected.from instanceof Date ? toIso(selected.from) : String(selected.from);
    }
    return undefined;
  }, [startDate, selected]);

  const rangeEndIso = useMemo(() => {
    if (endDate) return endDate;
    if (selected && typeof selected === "object" && "to" in selected && selected.to) {
      return selected.to instanceof Date ? toIso(selected.to) : String(selected.to);
    }
    return undefined;
  }, [endDate, selected]);

  const initialDate = useMemo(() => {
    if (selectedIso) return new Date(selectedIso + "T00:00:00");
    if (rangeStartIso) return new Date(rangeStartIso + "T00:00:00");
    return new Date();
  }, [selectedIso, rangeStartIso]);

  const [currentMonth, setCurrentMonth] = useState(initialDate.getMonth());
  const [currentYear, setCurrentYear] = useState(initialDate.getFullYear());
  const [direction, setDirection] = useState<number>(0);
  const [showYearPicker, setShowYearPicker] = useState(false);

  // Temporary range selection state
  const [tempStart, setTempStart] = useState<string | undefined>(rangeStartIso);
  const [tempEnd, setTempEnd] = useState<string | undefined>(rangeEndIso);

  const handlePrevMonth = () => {
    setDirection(-1);
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    setDirection(1);
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const calendarDays = useMemo(() => {
    const days: { date: Date; iso: string; isCurrentMonth: boolean; isToday: boolean }[] = [];
    const todayIso = toIso(new Date());
    const firstDay = new Date(currentYear, currentMonth, 1);
    const startPad = firstDay.getDay();
    const prevLast = new Date(currentYear, currentMonth, 0).getDate();

    for (let i = startPad - 1; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - 1, prevLast - i);
      days.push({ date: d, iso: toIso(d), isCurrentMonth: false, isToday: toIso(d) === todayIso });
    }
    const curLast = new Date(currentYear, currentMonth + 1, 0).getDate();
    for (let i = 1; i <= curLast; i++) {
      const d = new Date(currentYear, currentMonth, i);
      const iso = toIso(d);
      days.push({ date: d, iso, isCurrentMonth: true, isToday: iso === todayIso });
    }
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(currentYear, currentMonth + 1, i);
      days.push({ date: d, iso: toIso(d), isCurrentMonth: false, isToday: toIso(d) === todayIso });
    }
    return days;
  }, [currentMonth, currentYear]);

  const handleDayClick = useCallback((d: Date, iso: string) => {
    if (mode === "single") {
      onSelect?.(d);
    } else {
      if (!tempStart || (tempStart && tempEnd && tempStart !== tempEnd)) {
        setTempStart(iso);
        setTempEnd(iso);
      } else if (iso < tempStart) {
        setTempStart(iso);
        onSelectRange?.(iso, tempEnd ?? iso);
      } else {
        setTempEnd(iso);
        onSelectRange?.(tempStart, iso);
      }
    }
  }, [mode, onSelect, onSelectRange, tempStart, tempEnd]);

  const applyPreset = (preset: "today" | "tomorrow" | "next7" | "thisMonth") => {
    const today = new Date();
    const todayIso = toIso(today);
    const future = (days: number) => {
      const d = new Date(today);
      d.setDate(today.getDate() + days);
      return d;
    };

    if (preset === "today") {
      setCurrentMonth(today.getMonth());
      setCurrentYear(today.getFullYear());
      onSelect?.(today);
    } else if (preset === "tomorrow") {
      const tom = future(1);
      setCurrentMonth(tom.getMonth());
      setCurrentYear(tom.getFullYear());
      onSelect?.(tom);
    } else if (preset === "next7") {
      const tom = future(1);
      const weekOut = future(7);
      onSelectRange?.(toIso(tom), toIso(weekOut));
    } else if (preset === "thisMonth") {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      onSelectRange?.(toIso(first), toIso(last));
    }
  };

  const yearsRange = useMemo(() => {
    const startYear = new Date().getFullYear() - 3;
    return Array.from({ length: 7 }, (_, i) => startYear + i);
  }, []);

  return (
    <div
      className={cn(
        "p-4 space-y-4 glass rounded-3xl border border-border/50 shadow-2xl bg-gradient-to-b from-card/90 via-card/60 to-card/90 backdrop-blur-xl w-full max-w-sm select-none transition-all",
        className
      )}
    >
      {/* Top Controls Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border/30">
        <button
          type="button"
          onClick={() => setShowYearPicker((v) => !v)}
          className="flex items-center gap-2 rounded-2xl px-3 py-1.5 hover:bg-muted/80 text-foreground transition font-bold text-sm group"
        >
          <CalendarIcon className="h-4 w-4 text-primary-500 group-hover:scale-110 transition-transform" />
          <span>
            {MONTH_NAMES[currentMonth]} {currentYear}
          </span>

        </button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              const now = new Date();
              setCurrentMonth(now.getMonth());
              setCurrentYear(now.getFullYear());
              onSelect?.(now);
            }}
            title="Reset to today"
            className="grid h-8 w-8 place-items-center rounded-xl p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition active:scale-95"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handlePrevMonth}
            className="grid h-8 w-8 place-items-center rounded-xl p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition active:scale-95"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            className="grid h-8 w-8 place-items-center rounded-xl p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition active:scale-95"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Preset Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-[11px] font-bold">
        <button
          type="button"
          onClick={() => applyPreset("today")}
          className="shrink-0 rounded-full bg-primary-500/10 px-3 py-1 text-primary-500 hover:bg-primary-500 hover:text-primary-foreground transition"
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => applyPreset("tomorrow")}
          className="shrink-0 rounded-full bg-muted/60 px-3 py-1 text-muted-foreground hover:bg-muted hover:text-foreground transition"
        >
          Tomorrow
        </button>
        {mode === "range" ? (
          <>
            <button
              type="button"
              onClick={() => applyPreset("next7")}
              className="shrink-0 rounded-full bg-muted/60 px-3 py-1 text-muted-foreground hover:bg-muted hover:text-foreground transition"
            >
              Next 7 Days
            </button>
            <button
              type="button"
              onClick={() => applyPreset("thisMonth")}
              className="shrink-0 rounded-full bg-muted/60 px-3 py-1 text-muted-foreground hover:bg-muted hover:text-foreground transition"
            >
              This Month
            </button>
          </>
        ) : null}
      </div>

      {/* Quick Month/Year Selector Overlay Grid */}
      {showYearPicker ? (
        <div className="space-y-4 py-2">
          <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Select Month</div>
          <div className="grid grid-cols-3 gap-2">
            {MONTH_NAMES.map((mName, idx) => (
              <button
                key={mName}
                type="button"
                onClick={() => {
                  setCurrentMonth(idx);
                  setShowYearPicker(false);
                }}
                className={cn(
                  "rounded-2xl p-2.5 text-xs font-bold transition text-center",
                  idx === currentMonth
                    ? "bg-primary-500 text-primary-foreground shadow-md"
                    : "glass hover:bg-muted text-foreground"
                )}
              >
                {mName.slice(0, 3)}
              </button>
            ))}
          </div>

          <div className="pt-2 border-t border-border/30">
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Select Year</div>
            <div className="flex flex-wrap gap-1.5">
              {yearsRange.map((yr) => (
                <button
                  key={yr}
                  type="button"
                  onClick={() => {
                    setCurrentYear(yr);
                    setShowYearPicker(false);
                  }}
                  className={cn(
                    "rounded-xl px-3 py-1 text-xs font-bold transition",
                    yr === currentYear
                      ? "bg-primary-500 text-primary-foreground"
                      : "glass text-muted-foreground hover:text-foreground"
                  )}
                >
                  {yr}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Standard Month Grid View */
        <div className="space-y-2">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 text-center text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/80">
            {WEEKDAYS.map((w, i) => (
              <div key={`${w}-${i}`} className="py-1">
                {w}
              </div>
            ))}
          </div>

          {/* Days Grid with Framer Motion slide */}
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={`${currentYear}-${currentMonth}`}
              initial={{ opacity: 0, x: direction * 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -direction * 20 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="grid grid-cols-7 gap-1"
            >
              {calendarDays.map((d, i) => {
                const isSel = mode === "single" && selectedIso === d.iso;
                const isRS = mode === "range" && (rangeStartIso === d.iso || tempStart === d.iso);
                const isRE = mode === "range" && (rangeEndIso === d.iso || tempEnd === d.iso);
                const inRange =
                  mode === "range" &&
                  rangeStartIso &&
                  rangeEndIso &&
                  d.iso >= rangeStartIso &&
                  d.iso <= rangeEndIso;

                const isBooked = bookedDates?.has(d.iso) || modifiers?.booked?.(d.date);

                return (
                  <motion.button
                    key={`${d.iso}-${i}`}
                    type="button"
                    whileTap={{ scale: 0.92 }}
                    onClick={() => handleDayClick(d.date, d.iso)}
                    className={cn(
                      "relative grid h-9 w-full place-items-center rounded-2xl text-xs font-bold transition-all",
                      !d.isCurrentMonth && "text-muted-foreground/25 font-normal",
                      d.isCurrentMonth && "text-foreground",
                      d.isToday && "ring-2 ring-primary-500/80 font-extrabold text-primary-500",
                      isSel &&
                        "bg-primary-500 text-primary-foreground font-extrabold shadow-lg shadow-primary-500/35 rounded-2xl scale-105 z-10",
                      inRange && !isRS && !isRE && "bg-primary-500/15 text-primary-500 rounded-none",
                      isRS &&
                        "bg-primary-500 text-primary-foreground font-extrabold rounded-l-2xl rounded-r-none shadow-md shadow-primary-500/30 z-10",
                      isRE &&
                        "bg-primary-500 text-primary-foreground font-extrabold rounded-r-2xl rounded-l-none shadow-md shadow-primary-500/30 z-10",
                      isRS && isRE && "rounded-2xl",
                    )}
                  >
                    <span>{d.date.getDate()}</span>

                    {/* Booking Indicator Dot */}
                    {isBooked && !isSel && !isRS && !isRE && (
                      <span className="absolute bottom-1 h-1 w-1 rounded-full bg-primary-500 ring-2 ring-primary-500/30" />
                    )}
                  </motion.button>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

export function CalendarDayButton() {
  return null;
}
