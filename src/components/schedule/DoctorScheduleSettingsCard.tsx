import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Clock,
  Users,
  Zap,
  CalendarPlus,
  Ban,
  CalendarRange,
  CheckCircle2,
  Sparkles,
  Sliders,
  DoorOpen,
  CalendarDays,
} from "lucide-react";
import { GlassCard } from "@/components/glass/GlassCard";
import { cn } from "@/lib/utils";
import { getDoctorColor } from "@/lib/doctorColor";
import type { DoctorCardItem } from "@/components/doctors/DoctorSelectorModal";

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

function parseTimeToMinutes(t: unknown): number {
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

function formatMinutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export interface DoctorScheduleSettingsCardProps {
  doctor: DoctorCardItem;
  availability: unknown;
  slotDuration?: number;
  bufferTime?: number;
  maxPatients?: number;
  totalSlotsToday?: number;
  onOpenQuickSlot: () => void;
  onOpenBatchGenerate: () => void;
  onOpenCancelDate: () => void;
  onGenerateQuickWindow: (days: number) => void;
  isGenerating?: boolean;
}

export function DoctorScheduleSettingsCard({
  doctor,
  availability,
  slotDuration = 30,
  bufferTime = 5,
  maxPatients = 1,
  totalSlotsToday = 0,
  onOpenQuickSlot,
  onOpenBatchGenerate,
  onOpenCancelDate,
  onGenerateQuickWindow,
  isGenerating = false,
}: DoctorScheduleSettingsCardProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language.startsWith("ar");
  const color = getDoctorColor(doctor.doctorId);

  // Parse availability into day records
  const daySchedule = useMemo(() => {
    const map: Record<Day, { active: boolean; start: string; end: string; hours: number }> = {
      mon: { active: false, start: "—", end: "—", hours: 0 },
      tue: { active: false, start: "—", end: "—", hours: 0 },
      wed: { active: false, start: "—", end: "—", hours: 0 },
      thu: { active: false, start: "—", end: "—", hours: 0 },
      fri: { active: false, start: "—", end: "—", hours: 0 },
      sat: { active: false, start: "—", end: "—", hours: 0 },
      sun: { active: false, start: "—", end: "—", hours: 0 },
    };

    if (!availability) return map;

    // Case 1: Array of rows
    if (Array.isArray(availability)) {
      availability.forEach((row: unknown) => {
        const r = row as Record<string, unknown>;
        if (r.isActive === false) return;
        const dayKey = DAY_MAP[String(r.dayOfWeek || "").toLowerCase()];
        if (!dayKey) return;

        const startMin = parseTimeToMinutes(r.startTime);
        const endMin = parseTimeToMinutes(r.endTime);
        const diffHours = Math.max(0, (endMin - startMin) / 60);

        map[dayKey] = {
          active: true,
          start: formatMinutesToTime(startMin),
          end: formatMinutesToTime(endMin),
          hours: diffHours,
        };
      });
      return map;
    }

    // Case 2: Object map
    if (typeof availability === "object") {
      const availObj = availability as Record<
        string,
        { closed?: boolean; open?: string; close?: string } | undefined
      >;
      DAYS.forEach((d) => {
        const v = availObj[d];
        if (v && !v.closed && v.open && v.close) {
          const [oh, om] = String(v.open).split(":").map(Number);
          const [ch, cm] = String(v.close).split(":").map(Number);
          const startMin = (oh || 0) * 60 + (om || 0);
          const endMin = (ch || 0) * 60 + (cm || 0);
          map[d] = {
            active: true,
            start: v.open,
            end: v.close,
            hours: Math.max(0, (endMin - startMin) / 60),
          };
        }
      });
    }

    return map;
  }, [availability]);

  const activeDaysCount = useMemo(
    () => Object.values(daySchedule).filter((d) => d.active).length,
    [daySchedule],
  );

  const totalWeeklyHours = useMemo(
    () => Object.values(daySchedule).reduce((acc, d) => acc + d.hours, 0),
    [daySchedule],
  );

  return (
    <GlassCard className="p-5 border border-border/40 space-y-5 shadow-lg">
      {/* 1. Header: Doctor Consultation Profile & Quick Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/30">
        <div className="flex items-center gap-3">
          <div
            className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl shadow-sm"
            style={{ backgroundColor: `${color.hex}22`, color: color.hex }}
          >
            <Sliders className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-foreground flex items-center gap-2">
              {t("schedule.settings.title", {
                defaultValue: "Schedule Settings & Working Pattern",
              })}
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-extrabold"
                style={{ backgroundColor: `${color.hex}18`, color: color.hex }}
              >
                {doctor.name}
              </span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {activeDaysCount > 0
                ? t("schedule.settings.activeDaysDesc", {
                    defaultValue:
                      "{{days}} consulting days per week · {{hours}} hrs weekly capacity",
                    days: activeDaysCount,
                    hours: totalWeeklyHours.toFixed(1),
                  })
                : t("schedule.settings.noPatternDesc", {
                    defaultValue: "No recurring consultation days configured yet.",
                  })}
            </p>
          </div>
        </div>

        {/* Today's slots indicator */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="rounded-xl border border-border/40 bg-accent/20 px-3 py-1.5 text-center">
            <div className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider">
              {t("schedule.settings.todaySlots", { defaultValue: "Slots Today" })}
            </div>
            <div className="text-xs font-black font-mono text-foreground mt-0.5">
              {totalSlotsToday}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Consultation Parameters Grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-border/30 bg-card/60 p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] font-bold uppercase tracking-wider">
            <Clock className="h-3 w-3 text-primary-500" />
            <span>{t("schedule.settings.duration", { defaultValue: "Slot Duration" })}</span>
          </div>
          <div className="text-sm sm:text-base font-black text-foreground font-mono mt-1">
            {slotDuration} <span className="text-xs font-normal text-muted-foreground">min</span>
          </div>
        </div>

        <div className="rounded-2xl border border-border/30 bg-card/60 p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] font-bold uppercase tracking-wider">
            <Clock className="h-3 w-3 text-amber-500" />
            <span>{t("schedule.settings.bufferTime", { defaultValue: "Buffer" })}</span>
          </div>
          <div className="text-sm sm:text-base font-black text-foreground font-mono mt-1">
            {bufferTime} <span className="text-xs font-normal text-muted-foreground">min</span>
          </div>
        </div>

        <div className="rounded-2xl border border-border/30 bg-card/60 p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] font-bold uppercase tracking-wider">
            <Users className="h-3 w-3 text-emerald-500" />
            <span>{t("schedule.settings.maxPerSlot", { defaultValue: "Capacity" })}</span>
          </div>
          <div className="text-sm sm:text-base font-black text-foreground font-mono mt-1">
            {maxPatients}{" "}
            <span className="text-xs font-normal text-muted-foreground">
              {maxPatients === 1 ? "patient" : "patients"}
            </span>
          </div>
        </div>
      </div>

      {/* 3. 7-Day Working Pattern Strip */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CalendarRange className="h-3.5 w-3.5 text-primary-500" />
            {t("schedule.pattern.weeklyWorkingDays", {
              defaultValue: "Doctor Working Days & Hours",
            })}
          </span>
          <span className="text-[10px] text-muted-foreground/60 italic">
            {t("schedule.pattern.onlyAvailableDaysRule", {
              defaultValue: "Slots are generated on active days only",
            })}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
          {DAYS.map((d) => {
            const sched = daySchedule[d];
            return (
              <div
                key={d}
                className={cn(
                  "rounded-2xl border p-2 text-center transition",
                  sched.active
                    ? "border-emerald-500/40 bg-emerald-500/5 shadow-xs"
                    : "border-border/30 bg-muted/10 opacity-60",
                )}
                style={
                  sched.active
                    ? { borderColor: `${color.hex}60`, backgroundColor: `${color.hex}0d` }
                    : undefined
                }
              >
                <div className="text-[10px] font-black uppercase tracking-wider text-foreground">
                  {DAY_LABELS[d]}
                </div>
                {sched.active ? (
                  <>
                    <div className="text-[10px] font-mono font-bold text-foreground mt-0.5">
                      {sched.start}–{sched.end}
                    </div>
                    <div className="text-[9px] font-medium text-muted-foreground mt-0.5">
                      {sched.hours}h
                    </div>
                  </>
                ) : (
                  <div className="text-[10px] text-muted-foreground/60 italic mt-1">Off</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Smart Quick Actions Bar */}
      <div className="pt-3 border-t border-border/30 flex flex-wrap items-center justify-between gap-3">
        {/* Fast Generation Presets (Enforced Available Days Only) */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isGenerating || activeDaysCount === 0}
            onClick={() => onGenerateQuickWindow(7)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary-500 px-3.5 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary-600 transition disabled:opacity-50 cursor-pointer"
            title={t("schedule.quickActions.generate7Tooltip", {
              defaultValue:
                "Automatically generate slots for the next 7 days on active working days only",
            })}
          >
            <Zap className="h-3.5 w-3.5" />
            <span>
              {t("schedule.quickActions.generate7Days", { defaultValue: "Generate Next 7 Days" })}
            </span>
          </button>

          <button
            type="button"
            disabled={isGenerating || activeDaysCount === 0}
            onClick={() => onGenerateQuickWindow(30)}
            className="inline-flex items-center gap-1.5 rounded-xl glass border border-primary-500/30 px-3.5 py-2 text-xs font-bold text-primary-500 hover:bg-primary-500/10 transition disabled:opacity-50 cursor-pointer"
            title={t("schedule.quickActions.generate30Tooltip", {
              defaultValue:
                "Automatically generate slots for the next 30 days on active working days only",
            })}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            <span>
              {t("schedule.quickActions.generate30Days", { defaultValue: "Generate 30 Days" })}
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenBatchGenerate}
            className="inline-flex items-center gap-1.5 rounded-xl glass border border-border/40 px-3 py-2 text-xs font-bold text-foreground hover:bg-accent transition cursor-pointer"
          >
            <CalendarRange className="h-3.5 w-3.5 text-primary-500" />
            <span>{t("schedule.quickActions.customRange", { defaultValue: "Custom Range" })}</span>
          </button>
        </div>

        {/* Slot Add / Block Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenQuickSlot}
            className="inline-flex items-center gap-1.5 rounded-xl glass border border-border/40 px-3 py-2 text-xs font-bold text-foreground hover:bg-accent transition cursor-pointer"
          >
            <CalendarPlus className="h-3.5 w-3.5 text-emerald-500" />
            <span>{t("schedule.quickSlotButton", { defaultValue: "Add Quick Slot" })}</span>
          </button>

          <button
            type="button"
            onClick={onOpenCancelDate}
            className="inline-flex items-center gap-1.5 rounded-xl glass border border-rose-500/30 px-3 py-2 text-xs font-bold text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
          >
            <Ban className="h-3.5 w-3.5" />
            <span>{t("schedule.cancelDate", { defaultValue: "Cancel Day" })}</span>
          </button>
        </div>
      </div>
    </GlassCard>
  );
}
