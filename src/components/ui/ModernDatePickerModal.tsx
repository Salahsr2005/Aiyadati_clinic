import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar as CalendarIcon, X, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModernDatePickerModalProps {
  mode?: "single" | "range";
  value?: string;
  startDate?: string;
  endDate?: string;
  onSelect?: (date: string) => void;
  onSelectRange?: (start: string, end: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function fmtIso(year: number, monthIdx: number, day: number): string {
  return `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseIso(iso?: string) {
  if (!iso) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
  }
  const [y, m, d] = iso.split("-").map(Number);
  if (!isNaN(y) && !isNaN(m) && !isNaN(d)) return { year: y, month: m - 1, day: d };
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
}

function getMonthGrid(year: number, month: number) {
  const firstDayObj = new Date(year, month, 1);
  let startingDayOfWeek = firstDayObj.getDay(); // 0 is Sun, 1 is Mon...
  startingDayOfWeek = startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1; // Mon = 0

  const numDaysCurrent = new Date(year, month + 1, 0).getDate();
  const numDaysPrev = new Date(year, month, 0).getDate();

  const cells: Array<{
    dateIso: string;
    dayNum: number;
    isCurrentMonth: boolean;
    isToday: boolean;
  }> = [];

  const todayIsoStr = new Date().toISOString().slice(0, 10);

  // Prev month padding
  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    const d = numDaysPrev - i;
    const prevMonthIdx = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const iso = fmtIso(prevYear, prevMonthIdx, d);
    cells.push({ dateIso: iso, dayNum: d, isCurrentMonth: false, isToday: iso === todayIsoStr });
  }

  // Current month days
  for (let d = 1; d <= numDaysCurrent; d++) {
    const iso = fmtIso(year, month, d);
    cells.push({ dateIso: iso, dayNum: d, isCurrentMonth: true, isToday: iso === todayIsoStr });
  }

  // Next month padding
  const totalNeeded = cells.length > 35 ? 42 : 35;
  const remaining = totalNeeded - cells.length;
  for (let d = 1; d <= remaining; d++) {
    const nextMonthIdx = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    const iso = fmtIso(nextYear, nextMonthIdx, d);
    cells.push({ dateIso: iso, dayNum: d, isCurrentMonth: false, isToday: iso === todayIsoStr });
  }

  return cells;
}

export function ModernDatePickerModal({
  mode = "single",
  value,
  startDate,
  endDate,
  onSelect,
  onSelectRange,
  label,
  placeholder = "Select date",
  className,
}: ModernDatePickerModalProps) {
  const [open, setOpen] = useState(false);

  // Single date state
  const [tempSingle, setTempSingle] = useState(value || new Date().toISOString().slice(0, 10));

  // Range date state
  const [tempStart, setTempStart] = useState(startDate || new Date().toISOString().slice(0, 10));
  const [tempEnd, setTempEnd] = useState(() => {
    if (endDate) return endDate;
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });

  // Range step state for two-click range selection
  const [rangeSelectingStep, setRangeSelectingStep] = useState<"start" | "end">("start");

  // Display view month & year
  const initialParse = parseIso(mode === "single" ? value : startDate);
  const [viewYear, setViewYear] = useState(initialParse.year);
  const [viewMonth, setViewMonth] = useState(initialParse.month);

  // Sync external props on change
  useEffect(() => {
    if (value) {
      setTempSingle(value);
      const p = parseIso(value);
      setViewYear(p.year);
      setViewMonth(p.month);
    }
  }, [value]);

  useEffect(() => {
    if (startDate) {
      setTempStart(startDate);
      const p = parseIso(startDate);
      setViewYear(p.year);
      setViewMonth(p.month);
    }
    if (endDate) setTempEnd(endDate);
  }, [startDate, endDate]);

  // Escape key to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  // Calendar month grid cells
  const monthGrid = useMemo(() => getMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleCellClick = (iso: string) => {
    if (mode === "single") {
      setTempSingle(iso);
    } else {
      if (rangeSelectingStep === "start") {
        setTempStart(iso);
        setTempEnd(iso);
        setRangeSelectingStep("end");
      } else {
        if (iso < tempStart) {
          setTempStart(iso);
          setTempEnd(tempStart);
        } else {
          setTempEnd(iso);
        }
        setRangeSelectingStep("start");
      }
    }
  };

  const applyPreset = (preset: "today" | "tomorrow" | "next7" | "thisMonth") => {
    const today = new Date();
    const todayIsoStr = today.toISOString().slice(0, 10);

    const future = (n: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() + n);
      return d.toISOString().slice(0, 10);
    };

    if (mode === "single") {
      if (preset === "today") setTempSingle(todayIsoStr);
      else if (preset === "tomorrow") setTempSingle(future(1));
      const p = parseIso(preset === "today" ? todayIsoStr : future(1));
      setViewYear(p.year);
      setViewMonth(p.month);
    } else {
      let s = todayIsoStr;
      let e = future(7);

      if (preset === "today") { s = todayIsoStr; e = todayIsoStr; }
      else if (preset === "tomorrow") { s = future(1); e = future(1); }
      else if (preset === "next7") { s = todayIsoStr; e = future(7); }
      else if (preset === "thisMonth") {
        const first = new Date(today.getFullYear(), today.getMonth(), 1);
        const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        s = first.toISOString().slice(0, 10);
        e = last.toISOString().slice(0, 10);
      }

      setTempStart(s);
      setTempEnd(e);
      const p = parseIso(s);
      setViewYear(p.year);
      setViewMonth(p.month);
      setRangeSelectingStep("start");
    }
  };

  const handleConfirm = () => {
    if (mode === "single") {
      onSelect?.(tempSingle);
    } else {
      const finalStart = tempStart <= tempEnd ? tempStart : tempEnd;
      const finalEnd = tempStart <= tempEnd ? tempEnd : tempStart;
      onSelectRange?.(finalStart, finalEnd);
    }
    setOpen(false);
  };

  const displayText = useMemo(() => {
    if (mode === "single") {
      return value
        ? new Date(value + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
        : placeholder;
    }
    if (startDate && endDate) {
      const s = new Date(startDate + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
      const e = new Date(endDate + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
      return `${s} – ${e}`;
    }
    return placeholder;
  }, [mode, value, startDate, endDate, placeholder]);

  return (
    <>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-medium text-foreground",
          "bg-card border border-border/40 shadow-sm hover:shadow-md hover:border-primary-500/40",
          "active:scale-[0.98] transition-all cursor-pointer",
          className,
        )}
      >
        <CalendarIcon className="h-4 w-4 text-primary-500 shrink-0" />
        <span className="truncate">{displayText}</span>
      </button>

      {/* Modal Portal */}
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              key="calendar-picker-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm"
              style={{ zIndex: 99999 }}
              onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
            >
              <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 30, scale: 0.96 }}
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
                className="w-full overflow-hidden bg-popover text-popover-foreground border border-border/50 shadow-2xl rounded-t-2xl sm:rounded-2xl sm:max-w-[420px]"
              >
                {/* Header */}
                <div className="px-5 py-3.5 border-b border-border/30 flex items-center justify-between">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-foreground truncate">
                      {label ?? (mode === "single" ? "Select Date" : "Select Date Range")}
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5 font-medium truncate">
                      {mode === "single"
                        ? tempSingle
                        : `${tempStart}  →  ${tempEnd}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="p-4 space-y-3.5">
                  {/* Quick Presets */}
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-[11px] font-medium">
                    {[
                      { id: "today", label: "Today" },
                      { id: "tomorrow", label: "Tomorrow" },
                      ...(mode === "range"
                        ? [{ id: "next7", label: "Next 7 Days" }, { id: "thisMonth", label: "This Month" }]
                        : []),
                    ].map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => applyPreset(p.id as any)}
                        className="shrink-0 rounded-lg bg-muted/50 px-2.5 py-1 text-muted-foreground hover:bg-muted hover:text-foreground transition font-semibold"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  {/* Visual Calendar Header Navigation */}
                  <div className="flex items-center justify-between px-1">
                    <button
                      type="button"
                      onClick={prevMonth}
                      className="rounded-xl p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-xs font-extrabold text-foreground">
                      {MONTH_NAMES[viewMonth]} {viewYear}
                    </span>
                    <button
                      type="button"
                      onClick={nextMonth}
                      className="rounded-xl p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Calendar Weekday Names Row */}
                  <div className="grid grid-cols-7 text-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    {WEEKDAY_NAMES.map((wd) => (
                      <div key={wd} className="py-1">{wd}</div>
                    ))}
                  </div>

                  {/* Interactive Calendar Days Grid */}
                  <div className="grid grid-cols-7 gap-1">
                    {monthGrid.map((cell) => {
                      const { dateIso, dayNum, isCurrentMonth, isToday } = cell;

                      let isSelected = false;
                      let isRangeStart = false;
                      let isRangeEnd = false;
                      let isInRange = false;

                      if (mode === "single") {
                        isSelected = dateIso === tempSingle;
                      } else {
                        const s = tempStart <= tempEnd ? tempStart : tempEnd;
                        const e = tempStart <= tempEnd ? tempEnd : tempStart;
                        isRangeStart = dateIso === s;
                        isRangeEnd = dateIso === e;
                        isSelected = isRangeStart || isRangeEnd;
                        isInRange = dateIso > s && dateIso < e;
                      }

                      return (
                        <button
                          key={dateIso}
                          type="button"
                          onClick={() => handleCellClick(dateIso)}
                          className={cn(
                            "relative h-9 w-full rounded-xl text-xs font-bold transition flex items-center justify-center",
                            !isCurrentMonth && "text-muted-foreground/30 font-normal",
                            isCurrentMonth && !isSelected && !isInRange && "text-foreground hover:bg-muted/70",
                            isToday && !isSelected && "border border-primary-500/50 text-primary-500 font-extrabold",
                            isInRange && "bg-primary-500/15 text-primary-600 rounded-none",
                            isSelected && "bg-primary-500 text-white shadow-md font-black z-10",
                            isRangeStart && tempStart !== tempEnd && "rounded-l-xl rounded-r-none",
                            isRangeEnd && tempStart !== tempEnd && "rounded-r-xl rounded-l-none"
                          )}
                        >
                          {dayNum}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="px-5 py-3 border-t border-border/30 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-xl px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary-500 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-primary-600 active:scale-[0.98] transition"
                  >
                    <Check className="h-3.5 w-3.5" /> Confirm Date
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
