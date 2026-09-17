import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Clock, Info, Lock } from "lucide-react";
import { GlassCard } from "@/components/glass/GlassCard";
import { cn } from "@/lib/utils";
import { getDoctorColor } from "@/lib/doctorColor";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
type Day = (typeof DAYS)[number];

const DAY_LABELS: Record<Day, string> = {
  mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun",
};

const DAY_MAP: Record<string, Day> = {
  monday: "mon", tuesday: "tue", wednesday: "wed", thursday: "thu",
  friday: "fri", saturday: "sat", sunday: "sun",
  mon: "mon", tue: "tue", wed: "wed", thu: "thu", fri: "fri", sat: "sat", sun: "sun",
};

const SLOTS_PER_DAY = 48; // 30-min slots
const pad = (n: number) => String(n).padStart(2, "0");
const slotToLabel = (i: number) => `${pad(Math.floor(i / 2))}:${i % 2 ? "30" : "00"}`;

function parseTimeToMinutes(t: any): number {
  if (!t) return 0;
  if (typeof t === "string") {
    const parts = t.split("T").pop()?.split("Z")[0]?.split(":") || [];
    const [h, m] = parts.map(Number);
    return (h || 0) * 60 + (m || 0);
  }
  if (t instanceof Date) {
    return t.getUTCHours() * 60 + t.getUTCMinutes();
  }
  return 0;
}

function totalHours(slots: boolean[]) {
  return slots.filter(Boolean).length / 2;
}

function availabilityToGrid(raw: any): Record<Day, boolean[]> {
  const grid = {} as Record<Day, boolean[]>;
  DAYS.forEach((d) => {
    grid[d] = Array(SLOTS_PER_DAY).fill(false);
  });

  if (!raw) return grid;

  // Case 1: Array of availability rows
  if (Array.isArray(raw)) {
    raw.forEach((row: any) => {
      if (row.isActive === false) return;
      const dayKey = DAY_MAP[String(row.dayOfWeek || "").toLowerCase()];
      if (!dayKey) return;

      const startMin = parseTimeToMinutes(row.startTime);
      const endMin = parseTimeToMinutes(row.endTime);
      const startSlot = Math.floor(startMin / 30);
      const endSlot = Math.ceil(endMin / 30);

      for (let i = startSlot; i < endSlot && i < SLOTS_PER_DAY; i++) {
        grid[dayKey][i] = true;
      }
    });
    return grid;
  }

  // Case 2: Record<string, { open, close, closed }>
  if (typeof raw === "object") {
    DAYS.forEach((d) => {
      const v = raw[d];
      if (v && !v.closed && v.open && v.close) {
        const [oh, om] = String(v.open).split(":").map(Number);
        const [ch, cm] = String(v.close).split(":").map(Number);
        const start = (oh || 0) * 2 + (om >= 30 ? 1 : 0);
        const end = (ch || 0) * 2 + (cm >= 30 ? 1 : 0);
        for (let i = start; i < end && i < SLOTS_PER_DAY; i++) {
          grid[d][i] = true;
        }
      }
    });
  }

  return grid;
}

function heatIntensity(grid: Record<Day, boolean[]>, dayIdx: number, slot: number): number {
  const day = DAYS[dayIdx];
  if (!grid[day][slot]) return 0;
  let n = 1;
  if (grid[day][slot - 1]) n++;
  if (grid[day][slot + 1]) n++;
  if (dayIdx > 0 && grid[DAYS[dayIdx - 1]][slot]) n++;
  if (dayIdx < DAYS.length - 1 && grid[DAYS[dayIdx + 1]][slot]) n++;
  return n; // 1..5
}

export function DoctorTemplateViewer({
  doctorId,
  doctorName,
  availability,
  isLoading,
}: {
  doctorId: string;
  doctorName: string;
  availability: any;
  isLoading?: boolean;
}) {
  const { t } = useTranslation();
  const color = getDoctorColor(doctorId);

  const grid = useMemo(() => availabilityToGrid(availability), [availability]);

  const totalWeeklyHours = useMemo(() => {
    let activeSlots = 0;
    DAYS.forEach((d) => {
      activeSlots += grid[d].filter(Boolean).length;
    });
    return activeSlots / 2;
  }, [grid]);

  return (
    <div className="space-y-4">
      {/* Informative Read-Only Banner */}
      <div className="flex items-start gap-3 rounded-2xl border border-primary-500/30 bg-primary-500/10 p-4">
        <Lock className="h-5 w-5 shrink-0 text-primary-500 mt-0.5" />
        <div className="flex-1 space-y-1">
          <h4 className="text-xs font-bold text-foreground">
            {t("schedule.template.readOnlyTitle", { defaultValue: "Practitioner Weekly Working Pattern (Read-Only)" })}
          </h4>
          <p className="text-xs text-muted-foreground">
            {t("schedule.template.readOnlyDesc", {
              defaultValue: "This weekly availability template is set by {{name}}. To modify recurring consultation hours, the doctor updates it in their own Doctor Portal.",
              name: doctorName || "the doctor",
            })}
          </p>
        </div>
      </div>

      <GlassCard className="p-5 border border-border/40 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/30">
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary-500" />
              {t("schedule.visualizer.title", { defaultValue: "Weekly Working Hours" })}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("schedule.template.summaryHours", {
                defaultValue: "{{hours}} hours per week scheduled",
                hours: totalWeeklyHours,
              })}
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
            <span className="h-3 w-3 rounded-md" style={{ backgroundColor: color.hex }} />
            <span>{doctorName}</span>
          </div>
        </div>

        {/* Instructions */}
        <div className="flex items-center gap-2 rounded-xl border border-border/30 bg-accent/20 px-3 py-1.5 text-[11px] text-muted-foreground">
          <Info className="h-3.5 w-3.5 shrink-0" />
          {t("schedule.template.hintReadOnly", { defaultValue: "Colored cells indicate the doctor's available consultation hours. This view is read-only." })}
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-xs text-muted-foreground animate-pulse">
            {t("common.loading", { defaultValue: "Loading weekly schedule template…" })}
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar pb-2">
            <div className="min-w-[720px]">
              {/* Hour ruler — matches the doctor portal ScheduleHeatmap exactly */}
              <div className="flex pl-14">
                {Array.from({ length: 24 }).map((_, h) => (
                  <div key={h} className="flex-1 text-center text-[9px] font-semibold text-muted-foreground/70">
                    {h % 2 === 0 ? (h === 0 ? "12a" : h === 12 ? "12p" : h > 12 ? `${h - 12}p` : `${h}a`) : ""}
                  </div>
                ))}
              </div>

              {/* Day rows — GitHub commit-style heatmap */}
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

                      {/* Row cells — 48 half-hour slots with intensity gradient */}
                      <div className="flex flex-1 gap-[2px]">
                        {slots.map((active, si) => {
                          const intensity = heatIntensity(grid, di, si);
                          return (
                            <div
                              key={si}
                              className={cn(
                                "h-7 flex-1 rounded-[3px] transition-all",
                                !active && "bg-muted/30",
                              )}
                              style={{
                                backgroundColor: active
                                  ? `hsla(${color.name === "violet" ? "263" : color.name === "cyan" ? "188" : color.name === "amber" ? "38" : color.name === "rose" ? "350" : color.name === "emerald" ? "160" : color.name === "blue" ? "217" : color.name === "fuchsia" ? "292" : color.name === "orange" ? "25" : color.name === "teal" ? "173" : "239"}, 84%, ${Math.max(28, 55 - intensity * 5)}%, ${0.55 + intensity * 0.08})`
                                  : undefined,
                              }}
                              title={`${DAY_LABELS[day]} · ${slotToLabel(si)} — ${active ? "Available" : "Off"}`}
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
        )}

        {/* Legend — GitHub-style intensity scale */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/30">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Less
            {[1, 2, 3, 4, 5].map((n) => (
              <span
                key={n}
                className="h-3 w-3 rounded-[3px]"
                style={{
                  backgroundColor: `${color.hex}${Math.round((0.3 + n * 0.14) * 255).toString(16).padStart(2, "0")}`,
                }}
              />
            ))}
            More
          </div>
          <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">
            {totalWeeklyHours.toFixed(1)}h / week
          </span>
        </div>
      </GlassCard>

      {/* Day summary chips — matches doctor portal day cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7">
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
                  ? "bg-card/60"
                  : "border-border/40 bg-muted/10 text-muted-foreground/60",
              )}
              style={has ? { borderColor: `${color.hex}40`, backgroundColor: `${color.hex}08` } : undefined}
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
