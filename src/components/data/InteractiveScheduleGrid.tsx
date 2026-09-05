import { useState, useRef, useEffect } from "react";
import { Clock, HelpCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ScheduleValue {
  open: string;
  close: string;
  closed: boolean;
}

export type WeeklySchedule = Record<string, ScheduleValue>;

interface InteractiveScheduleGridProps {
  value: WeeklySchedule;
  onChange: (val: WeeklySchedule) => void;
}

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const DAY_LABELS: Record<string, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

export function InteractiveScheduleGrid({ value, onChange }: InteractiveScheduleGridProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ day: string; hour: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ day: string; hour: number } | null>(null);
  const [dragMode, setDragMode] = useState<"select" | "deselect">("select");

  // Keep internal grid matrix state
  // day -> boolean[24] representing active hours
  const [grid, setGrid] = useState<Record<string, boolean[]>>(() => {
    const initial: Record<string, boolean[]> = {};
    DAYS.forEach((d) => {
      const dayVal = value[d];
      const hours = Array(24).fill(false);
      if (dayVal && !dayVal.closed) {
        const startHour = parseInt(dayVal.open.split(":")[0], 10);
        const endHour = parseInt(dayVal.close.split(":")[0], 10);
        if (!isNaN(startHour) && !isNaN(endHour)) {
          for (let i = startHour; i < endHour; i++) {
            if (i >= 0 && i < 24) hours[i] = true;
          }
        }
      }
      initial[d] = hours;
    });
    return initial;
  });

  // Sync internal grid changes back to parent
  const syncToParent = (newGrid: Record<string, boolean[]>) => {
    const updated: WeeklySchedule = {};
    DAYS.forEach((d) => {
      const hours = newGrid[d];
      const selectedIndices = hours
        .map((selected, idx) => (selected ? idx : -1))
        .filter((idx) => idx !== -1);

      if (selectedIndices.length === 0) {
        updated[d] = { open: "09:00", close: "17:00", closed: true };
      } else {
        const minHour = Math.min(...selectedIndices);
        const maxHour = Math.max(...selectedIndices) + 1; // span to end of hour
        const pad = (n: number) => String(n).padStart(2, "0");
        updated[d] = {
          open: `${pad(minHour)}:00`,
          close: `${pad(maxHour)}:00`,
          closed: false,
        };
      }
    });
    onChange(updated);
  };

  const handleMouseDown = (day: string, hour: number) => {
    const currentlyActive = grid[day][hour];
    const newMode = currentlyActive ? "deselect" : "select";
    setDragMode(newMode);
    setIsDragging(true);
    setDragStart({ day, hour });
    setDragCurrent({ day, hour });

    // Update single cell immediately
    const updatedGrid = { ...grid };
    updatedGrid[day] = [...updatedGrid[day]];
    updatedGrid[day][hour] = newMode === "select";
    setGrid(updatedGrid);
  };

  const handleMouseEnter = (day: string, hour: number) => {
    if (!isDragging || !dragStart) return;
    setDragCurrent({ day, hour });

    // Multi-select inside the bounding drag box (standard drag behaviors)
    // Only drag on the same day to make time block selection super clean
    if (day !== dragStart.day) return;

    const startH = Math.min(dragStart.hour, hour);
    const endH = Math.max(dragStart.hour, hour);
    const isSelecting = dragMode === "select";

    setGrid((prev) => {
      const updated = { ...prev };
      updated[day] = [...updated[day]];
      for (let h = startH; h <= endH; h++) {
        updated[day][h] = isSelecting;
      }
      return updated;
    });
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      setDragStart(null);
      setDragCurrent(null);
      syncToParent(grid);
    }
  };

  useEffect(() => {
    const onGlobalMouseUp = () => handleMouseUp();
    window.addEventListener("mouseup", onGlobalMouseUp);
    return () => window.removeEventListener("mouseup", onGlobalMouseUp);
  }, [isDragging, grid]);

  // Convert hour number to 12h/24h label
  const getHourLabel = (h: number) => {
    if (h === 0) return "12am";
    if (h === 12) return "12pm";
    return h > 12 ? `${h - 12}pm` : `${h}am`;
  };

  return (
    <div className="flex flex-col gap-4 select-none">
      <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/10 bg-emerald-500/5 p-3.5 text-xs text-emerald-600 dark:text-emerald-400">
        <Info className="h-4 w-4 shrink-0" />
        <div>
          Click and drag horizontally on any day to paint operational hours.
          Working hours are saved as a single continuous block.
        </div>
      </div>

      <div className="w-full overflow-x-auto pb-2 custom-scrollbar">
        <div className="min-w-[620px] pr-2">
          {/* Header Row (Hours ruler) */}
          <div className="flex pl-10 mb-2">
            {Array.from({ length: 24 }).map((_, h) => (
              <div
                key={h}
                className="flex-1 text-center text-[8px] font-semibold text-muted-foreground/80 tracking-tight"
              >
                {h % 3 === 0 ? getHourLabel(h) : ""}
              </div>
            ))}
          </div>

          {/* Grid Rows */}
          <div className="space-y-1.5">
            {DAYS.map((day) => {
              const hours = grid[day];
              const selectedIndices = hours
                .map((selected, idx) => (selected ? idx : -1))
                .filter((idx) => idx !== -1);
              const hasHours = selectedIndices.length > 0;

              return (
                <div key={day} className="flex items-center">
                  {/* Day Name */}
                  <div className="w-10 text-[10px] font-bold text-muted-foreground/70 uppercase select-none">
                    {DAY_LABELS[day]}
                  </div>

                  {/* Hourly Blocks */}
                  <div className="flex-1 flex gap-1.5">
                    {hours.map((active, hour) => {
                      const bgStyle = active
                        ? "rgba(16, 185, 129, 0.85)"
                        : "rgba(16, 185, 129, 0.04)";
                      const borderStyle = active
                        ? "rgba(16, 185, 129, 0.4)"
                        : "transparent";

                      return (
                        <div
                          key={hour}
                          onMouseDown={() => handleMouseDown(day, hour)}
                          onMouseEnter={() => handleMouseEnter(day, hour)}
                          className={cn(
                            "flex-1 h-7 rounded-lg cursor-pointer transition-all duration-150 relative border hover:scale-[1.03]",
                            active ? "shadow-[0_1px_3px_rgba(16,185,129,0.2)]" : "hover:bg-muted"
                          )}
                          style={{
                            background: bgStyle,
                            borderColor: borderStyle,
                          }}
                          title={`${DAY_LABELS[day]} at ${hour}:00`}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7">
        {DAYS.map((day) => {
          const hours = grid[day];
          const selectedIndices = hours
            .map((selected, idx) => (selected ? idx : -1))
            .filter((idx) => idx !== -1);
          const hasHours = selectedIndices.length > 0;

          const minHour = hasHours ? Math.min(...selectedIndices) : 0;
          const maxHour = hasHours ? Math.max(...selectedIndices) + 1 : 0;

          return (
            <div
              key={day}
              className={cn(
                "rounded-xl border p-2 flex flex-col justify-between transition-all",
                hasHours
                  ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
                  : "border-border/40 bg-muted/10 text-muted-foreground/60"
              )}
            >
              <div className="text-[9px] font-bold uppercase tracking-wider">
                {DAY_LABELS[day]}
              </div>
              <div className="mt-0.5 text-xs font-semibold tracking-tight tabular-nums">
                {hasHours ? `${minHour}:00 – ${maxHour}:00` : "Closed"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
