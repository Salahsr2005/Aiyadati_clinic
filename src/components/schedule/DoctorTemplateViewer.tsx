import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Clock, Info, Lock, AlertCircle } from "lucide-react";
import { GlassCard } from "@/components/glass/GlassCard";
import { cn } from "@/lib/utils";
import { getDoctorColor } from "@/lib/doctorColor";

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

const DAY_MAP: Record<string, Day> = {
  monday: "mon",
  tuesday: "tue",
  wednesday: "wed",
  thursday: "thu",
  friday: "fri",
  saturday: "sat",
  sunday: "sun",
  mon: "mon",
  tue: "tue",
  wed: "wed",
  thu: "thu",
  fri: "fri",
  sat: "sat",
  sun: "sun",
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

        {isLoading ? (
          <div className="py-12 text-center text-xs text-muted-foreground animate-pulse">
            {t("common.loading", { defaultValue: "Loading weekly schedule template…" })}
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar pb-2">
            <div className="min-w-[700px] space-y-2">
              {/* Hour Labels on Top */}
              <div className="flex items-center text-[9px] font-bold text-muted-foreground/70">
                <div className="w-14 shrink-0" />
                <div className="flex-1 grid grid-cols-24 gap-0.5 text-center">
                  {Array.from({ length: 24 }).map((_, h) => (
                    <div key={h} className="truncate">
                      {h % 2 === 0 ? `${h}h` : ""}
                    </div>
                  ))}
                </div>
              </div>

              {/* Day Rows */}
              <div className="space-y-1.5">
                {DAYS.map((d) => {
                  const slots = grid[d];
                  const hours = slots.filter(Boolean).length / 2;

                  return (
                    <div key={d} className="flex items-center gap-2">
                      <div className="w-14 shrink-0 text-start">
                        <span className="text-xs font-bold text-foreground">{DAY_LABELS[d]}</span>
                        <div className="text-[10px] text-muted-foreground font-mono">{hours}h</div>
                      </div>

                      <div className="flex-1 grid grid-cols-48 gap-0.5 h-6 rounded-lg overflow-hidden bg-muted/10 p-0.5 border border-border/20">
                        {slots.map((isActive, i) => (
                          <div
                            key={i}
                            title={`${DAY_LABELS[d]} @ ${slotToLabel(i)} — ${isActive ? "Available" : "Off"}`}
                            className={cn(
                              "h-full rounded-xs transition-colors",
                              isActive ? "opacity-95" : "bg-muted/20 hover:bg-muted/40",
                            )}
                            style={isActive ? { backgroundColor: color.hex } : undefined}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
