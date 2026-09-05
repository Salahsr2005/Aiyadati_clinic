import { useMemo, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Info, Calendar as CalendarIcon, TrendingUp, Zap, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/glass/GlassCard";
import { StatusBadge } from "@/components/data/StatusBadge";
import { Drawer } from "@/components/data/Drawer";
import type { ClinicAppointmentRow } from "@/api/clinicAppointmentsApi";

export interface HeatmapDatum<T = ClinicAppointmentRow> {
  /** ISO date string YYYY-MM-DD */
  date: string;
  count: number;
  appointments?: T[];
}

interface ActivityHeatmapProps<T = ClinicAppointmentRow> {
  data: HeatmapDatum<T>[];
  weeks?: number;
  title?: string;
  subtitle?: string;
  tone?: "primary" | "success" | "warning" | "danger" | "info";
  onCellClick?: (d: HeatmapDatum<T>) => void;
  onSelectPatient?: (patientId: string) => void;
  footerExtra?: React.ReactNode;
  disableDrawer?: boolean;
  unitLabel?: { singular: string; plural: string };
  emptyLabel?: string;
  hintText?: string;
  className?: string;
}

const TONE_SCALES: Record<NonNullable<ActivityHeatmapProps["tone"]>, string[]> = {
  primary: [
    "rgba(79, 70, 229, 0.08)",
    "rgba(99, 102, 241, 0.28)",
    "rgba(79, 70, 229, 0.55)",
    "rgba(67, 56, 202, 0.82)",
    "rgba(79, 70, 229, 1)",
  ],
  success: [
    "rgba(16, 185, 129, 0.08)",
    "rgba(52, 211, 153, 0.28)",
    "rgba(16, 185, 129, 0.55)",
    "rgba(5, 150, 105, 0.82)",
    "rgba(16, 185, 129, 1)",
  ],
  warning: [
    "rgba(245, 158, 11, 0.08)",
    "rgba(251, 191, 36, 0.28)",
    "rgba(245, 158, 11, 0.55)",
    "rgba(217, 119, 6, 0.82)",
    "rgba(245, 158, 11, 1)",
  ],
  danger: [
    "rgba(239, 68, 68, 0.08)",
    "rgba(248, 113, 113, 0.28)",
    "rgba(239, 68, 68, 0.55)",
    "rgba(220, 38, 38, 0.82)",
    "rgba(239, 68, 68, 1)",
  ],
  info: [
    "rgba(59, 130, 246, 0.08)",
    "rgba(96, 165, 250, 0.28)",
    "rgba(59, 130, 246, 0.55)",
    "rgba(37, 99, 235, 0.82)",
    "rgba(59, 130, 246, 1)",
  ],
};

const TONE_SOLID: Record<NonNullable<ActivityHeatmapProps["tone"]>, string> = {
  primary: "var(--primary-500, #4f46e5)",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  info: "#3b82f6",
};

const WEEKDAYS_FULL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function toIsoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function useGrid<T>(data: HeatmapDatum<T>[], weeks: number) {
  return useMemo(() => {
    const map = new Map<string, HeatmapDatum<T>>();
    for (const d of data) {
      const existing = map.get(d.date);
      if (existing) {
        existing.count += d.count || 0;
        if (d.appointments) {
          existing.appointments = [...(existing.appointments ?? []), ...d.appointments];
        }
      } else {
        map.set(d.date, { ...d });
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dow = today.getDay();
    const endSat = new Date(today);
    endSat.setDate(today.getDate() + (6 - dow));

    const cells: {
      date: string;
      count: number;
      inFuture: boolean;
      col: number;
      row: number;
      isToday: boolean;
      datum: HeatmapDatum<T>;
    }[] = [];
    let max = 0;

    for (let col = 0; col < weeks; col++) {
      for (let row = 0; row < 7; row++) {
        const d = new Date(endSat);
        d.setDate(endSat.getDate() - (weeks - 1 - col) * 7 - (6 - row));
        const iso = toIsoDay(d);
        const datum = map.get(iso) ?? { date: iso, count: 0 };
        const inFuture = d.getTime() > today.getTime();
        const isToday = iso === toIsoDay(today);
        const count = inFuture ? 0 : datum.count;

        cells.push({ date: iso, count, inFuture, col, row, isToday, datum });
        if (!inFuture && count > max) max = count;
      }
    }

    const monthTicks: { col: number; label: string }[] = [];
    let lastMonth = -1;
    for (let col = 0; col < weeks; col++) {
      const topCell = cells[col * 7 + 0];
      const m = new Date(topCell.date).getMonth();
      if (m !== lastMonth) {
        monthTicks.push({ col, label: MONTH_LABELS[m] });
        lastMonth = m;
      }
    }
    return { cells, max, monthTicks };
  }, [data, weeks]);
}

function useStreaks<T>(data: HeatmapDatum<T>[]) {
  return useMemo(() => {
    const sorted = [...data].filter((d) => d.count > 0).sort((a, b) => a.date.localeCompare(b.date));
    if (sorted.length === 0) return { current: 0, longest: 0 };

    let longest = 1;
    let streak = 1;
    const today = toIsoDay(new Date());

    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1].date);
      const curr = new Date(sorted[i].date);
      const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
      if (diff === 1) {
        streak++;
        if (streak > longest) longest = streak;
      } else {
        streak = 1;
      }
    }

    const lastActive = sorted[sorted.length - 1].date;
    const lastD = new Date(lastActive);
    const todayD = new Date(today);
    const daysDiff = (todayD.getTime() - lastD.getTime()) / (1000 * 60 * 60 * 24);
    const current = daysDiff <= 1 ? streak : 0;

    return { current, longest };
  }, [data]);
}

export function ActivityHeatmap<T = ClinicAppointmentRow>({
  data,
  weeks = 20,
  title,
  subtitle,
  tone = "primary",
  onCellClick,
  onSelectPatient,
  footerExtra,
  disableDrawer,
  unitLabel,
  emptyLabel,
  hintText,
  className,
}: ActivityHeatmapProps<T>) {
  const { cells, max, monthTicks } = useGrid<T>(data, weeks);
  const [hover, setHover] = useState<{
    cellX: number;
    cellY: number;
    d: HeatmapDatum<T>;
  } | null>(null);
  const [activeModalDatum, setActiveModalDatum] = useState<HeatmapDatum<T> | null>(null);

  const gridRef = useRef<HTMLDivElement>(null);
  const solidColor = TONE_SOLID[tone];
  const scale = TONE_SCALES[tone];
  const total = data.reduce((s, d) => s + (d.count || 0), 0);
  const active = data.filter((d) => (d.count || 0) > 0).length;
  const best = data.reduce((b, d) => ((d.count || 0) > (b?.count ?? 0) ? d : b), null as HeatmapDatum<T> | null);
  const streaks = useStreaks<T>(data);

  const cellSize = 18;
  const gap = 4;
  const dayLabelWidth = 32;
  const gridWidth = weeks * (cellSize + gap);
  const totalWidth = dayLabelWidth + gridWidth;

  const getLevel = useCallback(
    (count: number): number => {
      if (count === 0) return 0;
      if (max <= 0) return 1;
      const ratio = count / max;
      if (ratio <= 0.25) return 1;
      if (ratio <= 0.5) return 2;
      if (ratio <= 0.75) return 3;
      return 4;
    },
    [max],
  );

  const resolvedUnitLabel = unitLabel ?? { singular: "appointment", plural: "appointments" };

  const handleCellClick = (d: HeatmapDatum<T>) => {
    if (!disableDrawer) setActiveModalDatum(d);
    onCellClick?.(d);
  };

  return (
    <div className={cn("glass rounded-3xl p-5 border border-border/40 shadow-sm space-y-4", className)}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl shadow-xs"
            style={{
              background: `color-mix(in oklab, ${solidColor} 15%, transparent)`,
              color: solidColor,
            }}
          >
            <Flame className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight">{title ?? "Clinic Activity Heatmap"}</div>
            {subtitle && (
              <div className="text-[11px] text-muted-foreground font-medium">{subtitle}</div>
            )}
          </div>
        </div>

        {/* Summary Chips */}
        <div className="flex flex-wrap items-center gap-2">
          <StatChip icon={<CalendarIcon className="h-3 w-3" />} label="Total" value={total.toLocaleString()} color={solidColor} />
          <StatChip icon={<Zap className="h-3 w-3" />} label="Active" value={`${active} days`} color={solidColor} />
          {streaks.current > 0 && (
            <StatChip icon={<TrendingUp className="h-3 w-3" />} label="Streak" value={`${streaks.current}d`} color={solidColor} highlight />
          )}
          {best && best.count > 0 && (
            <StatChip
              icon={<Flame className="h-3 w-3" />}
              label="Peak"
              value={`${best.count} on ${new Date(best.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
              color={solidColor}
            />
          )}
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="relative" ref={gridRef}>
        <div className="overflow-x-auto pb-2 custom-scrollbar">
          <div style={{ width: totalWidth, minWidth: totalWidth }}>
            {/* Month labels */}
            <div
              className="mb-1.5 h-4 relative text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80"
              style={{ paddingLeft: dayLabelWidth }}
            >
              {monthTicks.map((m) => (
                <span
                  key={`${m.col}-${m.label}`}
                  className="absolute"
                  style={{ left: dayLabelWidth + m.col * (cellSize + gap) }}
                >
                  {m.label}
                </span>
              ))}
            </div>

            {/* Day labels + SVG grid */}
            <div className="flex items-center">
              <div
                className="flex flex-col text-[9px] font-semibold text-muted-foreground/70"
                style={{ width: dayLabelWidth, flexShrink: 0 }}
              >
                {WEEKDAYS_FULL.map((label, i) => (
                  <div
                    key={label}
                    className="flex items-center"
                    style={{ height: cellSize + gap }}
                  >
                    {i % 2 !== 0 ? label : ""}
                  </div>
                ))}
              </div>

              <svg
                width={gridWidth}
                height={7 * (cellSize + gap)}
                className="overflow-visible"
              >
                {cells.map((c) => {
                  const level = getLevel(c.count);
                  const fill = c.inFuture
                    ? "transparent"
                    : c.count === 0
                      ? "var(--muted)"
                      : scale[level];
                  const strokeColor = c.isToday ? solidColor : "transparent";

                  return (
                    <g key={c.date}>
                      <motion.rect
                        x={c.col * (cellSize + gap)}
                        y={c.row * (cellSize + gap)}
                        width={cellSize}
                        height={cellSize}
                        rx={5}
                        ry={5}
                        initial={{ opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        whileHover={{ scale: 1.15, zIndex: 30 }}
                        transition={{
                          delay: (c.col * 7 + c.row) * 0.0003,
                          duration: 0.15,
                          ease: "easeOut",
                        }}
                        style={{
                          fill,
                          fillOpacity: c.inFuture ? 0 : 1,
                          stroke: strokeColor,
                          strokeWidth: c.isToday ? 2 : 0,
                          cursor: !c.inFuture ? "pointer" : "default",
                        }}
                        onMouseEnter={() => {
                          if (c.inFuture) return;
                          setHover({
                            cellX: c.col * (cellSize + gap) + dayLabelWidth + cellSize / 2,
                            cellY: c.row * (cellSize + gap),
                            d: c.datum,
                          });
                        }}
                        onMouseLeave={() => setHover(null)}
                        onClick={() => !c.inFuture && handleCellClick(c.datum)}
                      />
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        </div>

        {/* Tooltip */}
        <AnimatePresence>
          {hover && (
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.95 }}
              transition={{ duration: 0.1 }}
              className="pointer-events-none absolute z-20 -translate-x-1/2"
              style={{ left: hover.cellX, top: hover.cellY - 6, transform: `translate(-50%, -100%)` }}
            >
              <div className="rounded-xl border border-border/80 bg-popover/95 backdrop-blur-md px-3 py-1.5 shadow-xl text-popover-foreground">
                <div className="font-bold text-xs tabular-nums" style={{ color: solidColor }}>
                  {hover.d.count === 0
                    ? (emptyLabel ?? "No bookings")
                    : `${hover.d.count.toLocaleString()} ${hover.d.count === 1 ? resolvedUnitLabel.singular : resolvedUnitLabel.plural}`}
                </div>
                <div className="text-[10px] text-muted-foreground font-medium">
                  {new Date(hover.d.date).toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/30 text-[11px] font-semibold text-muted-foreground">
        <div className="flex items-center gap-1.5 text-[10px]">
          <Info className="h-3 w-3 text-primary-500 shrink-0" />
          <span>{hintText ?? `Booking activity over the last ${weeks} weeks`}</span>
        </div>
        <div className="inline-flex items-center gap-1.5 text-[10px]">
          <span>Less</span>
          <span className="inline-block rounded-xs h-2.5 w-2.5 bg-muted" />
          {scale.map((bg, i) => (
            <span key={i} className="inline-block rounded-xs h-2.5 w-2.5" style={{ background: bg }} />
          ))}
          <span>More</span>
        </div>
      </div>

      {footerExtra && <div>{footerExtra}</div>}

      {/* Interactive Day Breakdown Drawer */}
      {!disableDrawer && (
        <DayBreakdownModal
          datum={activeModalDatum as HeatmapDatum<ClinicAppointmentRow> | null}
          onClose={() => setActiveModalDatum(null)}
          onSelectPatient={onSelectPatient}
        />
      )}
    </div>
  );
}

function DayBreakdownModal({
  datum,
  onClose,
  onSelectPatient,
}: {
  datum: HeatmapDatum<ClinicAppointmentRow> | null;
  onClose: () => void;
  onSelectPatient?: (patientId: string) => void;
}) {
  const formattedDate = datum
    ? new Date(datum.date).toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  const appts = datum?.appointments ?? [];
  const completed = appts.filter((a) => String(a.status).toUpperCase() === "COMPLETED").length;
  const cancelled = appts.filter((a) => String(a.status).toUpperCase() === "CANCELLED").length;
  const pending = appts.filter((a) => String(a.status).toUpperCase() === "PENDING").length;

  return (
    <Drawer open={!!datum} onClose={onClose} title="Day Appointment Breakdown" subtitle={formattedDate} id="heatmap-day-drawer">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <GlassCard className="p-3 text-center">
            <div className="text-xl font-bold text-foreground">{datum?.count ?? 0}</div>
            <div className="text-[10px] text-muted-foreground font-semibold">Total</div>
          </GlassCard>
          <GlassCard className="p-3 text-center">
            <div className="text-xl font-bold text-success">{completed}</div>
            <div className="text-[10px] text-muted-foreground font-semibold">Completed</div>
          </GlassCard>
          <GlassCard className="p-3 text-center">
            <div className="text-xl font-bold text-danger">{cancelled}</div>
            <div className="text-[10px] text-muted-foreground font-semibold">Cancelled</div>
          </GlassCard>
          <GlassCard className="p-3 text-center">
            <div className="text-xl font-bold text-warning">{pending}</div>
            <div className="text-[10px] text-muted-foreground font-semibold">Pending</div>
          </GlassCard>
        </div>

        <div>
          <div className="text-xs font-semibold text-muted-foreground mb-2">Appointments for this date</div>
          {appts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">
              No detailed appointment records for this date.
            </div>
          ) : (
            <div className="space-y-2">
              {appts.map((a) => {
                const pName = a.patient
                  ? `${a.patient.firstName || ""} ${a.patient.lastName || ""}`.trim()
                  : a.guestPatient
                    ? `${a.guestPatient.firstName} ${a.guestPatient.lastName}`.trim()
                    : "Patient";
                const pId = a.patient?.id || a.guestPatient?.id;
                const time = a.slot?.startTime?.slice(0, 5) ?? "--:--";

                return (
                  <div
                    key={a.id}
                    className="glass flex items-center justify-between gap-3 rounded-2xl p-3 border border-border/40 hover:bg-accent/40 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-500/10 text-primary-500 font-bold text-xs">
                        {time}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-foreground">{pName}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          Dr. {a.doctor?.firstNameFr || a.doctor?.firstName || ""} {a.doctor?.lastNameFr || a.doctor?.lastName || a.doctor?.name || "Doctor"}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge value={String(a.status ?? "")} />
                      {pId && onSelectPatient && (
                        <button
                          onClick={() => {
                            onClose();
                            onSelectPatient(pId);
                          }}
                          className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
                          title="View patient details"
                        >
                          <User className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
}

function StatChip({
  icon,
  label,
  value,
  color,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold tabular-nums transition-colors shadow-xs",
        highlight
          ? "border-current/30 bg-current/10"
          : "border-border/40 bg-background/70",
      )}
      style={highlight ? { color } : undefined}
    >
      <span className="opacity-70">{icon}</span>
      <span className="text-muted-foreground font-medium">{label}</span>
      <span className={highlight ? "" : "text-foreground"}>{value}</span>
    </div>
  );
}

export function aggregateByDate<T>(items: T[], getDate: (x: T) => string | undefined | null): HeatmapDatum<T>[] {
  const map = new Map<string, { count: number; appointments: T[] }>();
  for (const it of items) {
    const raw = getDate(it);
    if (!raw) continue;
    const iso = raw.slice(0, 10);
    const existing = map.get(iso) ?? { count: 0, appointments: [] };
    existing.count += 1;
    existing.appointments.push(it);
    map.set(iso, existing);
  }
  return Array.from(map.entries()).map(([date, val]) => ({
    date,
    count: val.count,
    appointments: val.appointments,
  }));
}
