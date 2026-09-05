import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Info, Clock, Trash2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ScheduleHeatmap
 *
 * A GitHub-commit-style heatmap grid for setting weekly working hours.
 * - 30-minute granularity (48 cells per day)
 * - Rectangular drag-paint across days & hours
 * - Right-click / shift to erase
 * - Quick presets and per-day copy
 */

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
type Day = (typeof DAYS)[number];

const DAY_LABELS: Record<Day, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

const SLOTS_PER_DAY = 48; // 30-min slots

export interface ScheduleValue {
  open: string;
  close: string;
  closed: boolean;
}
export type WeeklySchedule = Record<string, ScheduleValue>;

interface Props {
  value: WeeklySchedule;
  onChange: (val: WeeklySchedule) => void;
}

/* ----- utils ----- */
const pad = (n: number) => String(n).padStart(2, "0");
const slotToLabel = (i: number) => `${pad(Math.floor(i / 2))}:${i % 2 ? "30" : "00"}`;

function scheduleToGrid(value: WeeklySchedule): Record<Day, boolean[]> {
  const grid = {} as Record<Day, boolean[]>;
  DAYS.forEach((d) => {
    const slots = Array(SLOTS_PER_DAY).fill(false);
    const v = value[d];
    if (v && !v.closed) {
      const [oh, om] = v.open.split(":").map(Number);
      const [ch, cm] = v.close.split(":").map(Number);
      const start = (oh || 0) * 2 + (om >= 30 ? 1 : 0);
      const end = (ch || 0) * 2 + (cm >= 30 ? 1 : 0);
      for (let i = start; i < end && i < SLOTS_PER_DAY; i++) slots[i] = true;
    }
    grid[d] = slots;
  });
  return grid;
}

function gridToSchedule(grid: Record<Day, boolean[]>): WeeklySchedule {
  const out: WeeklySchedule = {};
  DAYS.forEach((d) => {
    const active = grid[d]
      .map((v, i) => (v ? i : -1))
      .filter((i) => i !== -1);
    if (active.length === 0) {
      out[d] = { open: "09:00", close: "17:00", closed: true };
    } else {
      const min = Math.min(...active);
      const max = Math.max(...active) + 1;
      out[d] = {
        open: slotToLabel(min),
        close: max >= SLOTS_PER_DAY ? "24:00" : slotToLabel(max),
        closed: false,
      };
    }
  });
  return out;
}

function totalHours(slots: boolean[]) {
  return slots.filter(Boolean).length / 2;
}

export function ScheduleHeatmap({ value, onChange }: Props) {
  const [grid, setGrid] = useState<Record<Day, boolean[]>>(() => scheduleToGrid(value));
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    startDay: number;
    startSlot: number;
    mode: "paint" | "erase";
    snapshot: Record<Day, boolean[]>;
  } | null>(null);
  const [hover, setHover] = useState<{ day: number; slot: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  // Sync when parent value changes externally
  useEffect(() => {
    setGrid(scheduleToGrid(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(value)]);

  const commit = (next: Record<Day, boolean[]>) => {
    setGrid(next);
    onChange(gridToSchedule(next));
  };

  const applyRect = (
    snapshot: Record<Day, boolean[]>,
    startDay: number,
    startSlot: number,
    endDay: number,
    endSlot: number,
    mode: "paint" | "erase",
  ) => {
    const next = { ...snapshot } as Record<Day, boolean[]>;
    const dMin = Math.min(startDay, endDay);
    const dMax = Math.max(startDay, endDay);
    const sMin = Math.min(startSlot, endSlot);
    const sMax = Math.max(startSlot, endSlot);
    for (let di = dMin; di <= dMax; di++) {
      const day = DAYS[di];
      next[day] = [...snapshot[day]];
      for (let si = sMin; si <= sMax; si++) {
        next[day][si] = mode === "paint";
      }
    }
    return next;
  };

  const onCellDown = (dayIdx: number, slot: number, e: React.MouseEvent) => {
    e.preventDefault();
    const erase = e.shiftKey || e.button === 2 || grid[DAYS[dayIdx]][slot];
    const mode: "paint" | "erase" = erase ? "erase" : "paint";
    const snapshot = { ...grid } as Record<Day, boolean[]>;
    DAYS.forEach((d) => (snapshot[d] = [...grid[d]]));
    dragRef.current = { startDay: dayIdx, startSlot: slot, mode, snapshot };
    setDragging(true);
    setGrid(applyRect(snapshot, dayIdx, slot, dayIdx, slot, mode));
  };

  const onCellEnter = (dayIdx: number, slot: number) => {
    setHover({ day: dayIdx, slot });
    const drag = dragRef.current;
    if (!drag) return;
    setGrid(applyRect(drag.snapshot, drag.startDay, drag.startSlot, dayIdx, slot, drag.mode));
  };

  useEffect(() => {
    const up = () => {
      if (dragRef.current) {
        dragRef.current = null;
        setDragging(false);
        // commit final state
        setGrid((g) => {
          onChange(gridToSchedule(g));
          return g;
        });
      }
    };
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, [onChange]);

  /* ---- presets ---- */
  const preset = (name: "business" | "weekdays" | "247" | "morning" | "evening" | "clear") => {
    const next: Record<Day, boolean[]> = {} as Record<Day, boolean[]>;
    DAYS.forEach((d) => {
      const slots = Array(SLOTS_PER_DAY).fill(false);
      if (name === "247") slots.fill(true);
      if (name === "business" && d !== "sun") for (let i = 18; i < 34; i++) slots[i] = true; // 09:00-17:00
      if (name === "weekdays" && d !== "sat" && d !== "sun") for (let i = 16; i < 36; i++) slots[i] = true; // 08:00-18:00
      if (name === "morning") for (let i = 14; i < 24; i++) slots[i] = true; // 07:00-12:00
      if (name === "evening") for (let i = 28; i < 42; i++) slots[i] = true; // 14:00-21:00
      next[d] = slots;
    });
    commit(next);
  };

  const copyToAll = (source: Day) => {
    const next: Record<Day, boolean[]> = {} as Record<Day, boolean[]>;
    DAYS.forEach((d) => (next[d] = [...grid[source]]));
    commit(next);
  };

  const clearDay = (day: Day) => {
    const next = { ...grid, [day]: Array(SLOTS_PER_DAY).fill(false) };
    commit(next);
  };

  const totalWeek = useMemo(
    () => DAYS.reduce((sum, d) => sum + totalHours(grid[d]), 0),
    [grid],
  );

  const heatIntensity = (idx: number, slot: number) => {
    if (!grid[DAYS[idx]][slot]) return 0;
    // Neighbours count for intensity
    let n = 1;
    if (grid[DAYS[idx]][slot - 1]) n++;
    if (grid[DAYS[idx]][slot + 1]) n++;
    if (idx > 0 && grid[DAYS[idx - 1]][slot]) n++;
    if (idx < DAYS.length - 1 && grid[DAYS[idx + 1]][slot]) n++;
    return n; // 1..5
  };

  return (
    <div
      ref={containerRef}
      onContextMenu={(e) => e.preventDefault()}
      className="select-none"
    >
      {/* Header info + presets */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 text-[11px] text-emerald-500">
          <Info className="h-3.5 w-3.5" />
          Click &amp; drag across days and hours to paint. Shift-drag or right-drag to erase.
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {totalWeek.toFixed(1)}h / week
          </span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <PresetBtn onClick={() => preset("business")} label="Business hours" />
        <PresetBtn onClick={() => preset("weekdays")} label="Weekdays 8–18" />
        <PresetBtn onClick={() => preset("morning")} label="Mornings" />
        <PresetBtn onClick={() => preset("evening")} label="Afternoons" />
        <PresetBtn onClick={() => preset("247")} label="24 / 7" icon={<Zap className="h-3 w-3" />} />
        <PresetBtn
          onClick={() => preset("clear")}
          label="Clear all"
          icon={<Trash2 className="h-3 w-3" />}
          danger
        />
      </div>

      {/* Heatmap */}
      <div className="mt-5 overflow-x-auto custom-scrollbar">
        <div className="min-w-[720px]">
          {/* Hour ruler */}
          <div className="flex pl-14">
            {Array.from({ length: 24 }).map((_, h) => (
              <div key={h} className="flex-1 text-center text-[9px] font-semibold text-muted-foreground/70">
                {h % 2 === 0 ? (h === 0 ? "12a" : h === 12 ? "12p" : h > 12 ? `${h - 12}p` : `${h}a`) : ""}
              </div>
            ))}
          </div>

          <div className="mt-2 space-y-1">
            {DAYS.map((day, di) => {
              const slots = grid[day];
              const dayHours = totalHours(slots);
              return (
                <div key={day} className="flex items-center gap-1">
                  {/* Row header */}
                  <div className="w-14 shrink-0">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">
                      {DAY_LABELS[day]}
                    </div>
                    <div className="text-[9px] tabular-nums text-muted-foreground/50">
                      {dayHours ? `${dayHours}h` : "—"}
                    </div>
                  </div>

                  {/* Row cells */}
                  <div className="flex flex-1 gap-[2px]">
                    {slots.map((active, si) => {
                      const intensity = heatIntensity(di, si);
                      const isHalf = si % 2 === 1;
                      return (
                        <div
                          key={si}
                          onMouseDown={(e) => onCellDown(di, si, e)}
                          onMouseEnter={() => onCellEnter(di, si)}
                          className={cn(
                            "h-7 flex-1 cursor-pointer rounded-[3px] transition-all",
                            !active && "bg-muted/30 hover:bg-muted/50",
                            active && "shadow-[0_0_0_1px_rgba(16,185,129,0.15)]",
                          )}
                          style={{
                            backgroundColor: active
                              ? `hsla(160, 84%, ${Math.max(28, 55 - intensity * 5)}%, ${0.55 + intensity * 0.08})`
                              : undefined,
                            marginLeft: isHalf ? 0 : undefined,
                          }}
                          title={`${DAY_LABELS[day]} · ${slotToLabel(si)}`}
                        />
                      );
                    })}
                  </div>

                  {/* Row actions */}
                  <div className="flex w-16 shrink-0 items-center justify-end gap-1 opacity-0 transition group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => copyToAll(day)}
                      title="Copy to all days"
                      className="rounded-md p-1 text-muted-foreground/70 hover:bg-muted hover:text-foreground"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => clearDay(day)}
                      title="Clear day"
                      className="rounded-md p-1 text-muted-foreground/70 hover:bg-muted hover:text-danger"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend + Summary */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Less
          {[1, 2, 3, 4, 5].map((n) => (
            <span
              key={n}
              className="h-3 w-3 rounded-[3px]"
              style={{
                backgroundColor: `hsla(160, 84%, ${Math.max(28, 55 - n * 5)}%, ${0.55 + n * 0.08})`,
              }}
            />
          ))}
          More
        </div>
        {hover && !dragging && (
          <div className="flex items-center gap-1.5 rounded-full border border-border/40 bg-background/60 px-3 py-1 text-[10px] font-semibold tabular-nums text-muted-foreground">
            <Clock className="h-3 w-3 text-primary-500" />
            {DAY_LABELS[DAYS[hover.day]]} · {slotToLabel(hover.slot)}
          </div>
        )}
      </div>

      {/* Day summary chips */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7">
        {DAYS.map((day) => {
          const slots = grid[day];
          const active = slots.map((v, i) => (v ? i : -1)).filter((i) => i !== -1);
          const has = active.length > 0;
          const from = has ? slotToLabel(Math.min(...active)) : "—";
          const to = has
            ? Math.max(...active) + 1 >= SLOTS_PER_DAY
              ? "24:00"
              : slotToLabel(Math.max(...active) + 1)
            : "—";
          return (
            <div
              key={day}
              className={cn(
                "rounded-2xl border p-2.5 transition",
                has
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : "border-border/40 bg-muted/10 text-muted-foreground/60",
              )}
            >
              <div className="text-[9px] font-bold uppercase tracking-wider">{DAY_LABELS[day]}</div>
              <div className="mt-1 text-xs font-semibold tabular-nums text-foreground">
                {has ? `${from} – ${to}` : "Closed"}
              </div>
              <div className="mt-0.5 text-[9px] tabular-nums text-muted-foreground/70">
                {has ? `${totalHours(slots)}h` : "0h"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PresetBtn({
  label,
  icon,
  danger,
  onClick,
}: {
  label: string;
  icon?: React.ReactNode;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition",
        danger
          ? "border-danger/30 bg-danger/5 text-danger hover:bg-danger/10"
          : "border-border/50 bg-background/50 text-muted-foreground hover:border-primary-500/40 hover:bg-primary-500/5 hover:text-primary-500",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
