import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  CalendarRange,
  CalendarCheck,
  DoorOpen,
  AlertTriangle,
  Loader2,
  Sparkles,
  Info,
  Calendar,
} from "lucide-react";
import { FormModal } from "@/components/data/FormModal";
import { RemoteImage } from "@/components/common/RemoteImage";
import { getDoctorColor } from "@/lib/doctorColor";
import type { DoctorCardItem } from "@/components/doctors/DoctorSelectorModal";
import type { ClinicRoom } from "@/api/clinicSelfApi";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
type Day = (typeof DAYS)[number];

const DAY_LABELS: Record<Day, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
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

// JavaScript Date.getDay(): 0 = Sun, 1 = Mon, ..., 6 = Sat
const JS_DAY_TO_KEY: Record<number, Day> = {
  0: "sun",
  1: "mon",
  2: "tue",
  3: "wed",
  4: "thu",
  5: "fri",
  6: "sat",
};

const schema = z.object({
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  roomId: z.string().optional(),
  force: z.boolean().optional(),
});

export type GeneratorFormData = z.infer<typeof schema>;

export interface AvailabilityAwareGeneratorModalProps {
  open: boolean;
  onClose: () => void;
  doctor: DoctorCardItem;
  availability: unknown;
  rooms: ClinicRoom[];
  initialStartDate?: string;
  initialEndDate?: string;
  onSubmit: (data: GeneratorFormData) => void;
  isPending?: boolean;
}

export function AvailabilityAwareGeneratorModal({
  open,
  onClose,
  doctor,
  availability,
  rooms,
  initialStartDate,
  initialEndDate,
  onSubmit,
  isPending = false,
}: AvailabilityAwareGeneratorModalProps) {
  const { t } = useTranslation();
  const color = getDoctorColor(doctor.doctorId);

  const form = useForm<GeneratorFormData>({
    resolver: zodResolver(schema),
    values: {
      startDate: initialStartDate || new Date().toISOString().slice(0, 10),
      endDate: initialEndDate || new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10),
      roomId: "",
      force: false,
    },
  });

  const startDate = form.watch("startDate");
  const endDate = form.watch("endDate");
  const selectedRoomId = form.watch("roomId");
  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);

  // Parse doctor's active consultation days
  const activeDaysSet = useMemo(() => {
    const set = new Set<Day>();
    if (!availability) return set;

    if (Array.isArray(availability)) {
      availability.forEach((row: unknown) => {
        const r = row as Record<string, unknown>;
        if (r.isActive === false) return;
        const dayKey = DAY_MAP[String(r.dayOfWeek || "").toLowerCase()];
        if (dayKey) set.add(dayKey);
      });
      return set;
    }

    if (typeof availability === "object") {
      const availObj = availability as Record<
        string,
        { closed?: boolean; open?: string; close?: string } | undefined
      >;
      DAYS.forEach((d) => {
        const v = availObj[d];
        if (v && !v.closed && v.open && v.close) set.add(d);
      });
    }

    return set;
  }, [availability]);

  // Calculate matching consultation days vs skipped off-days
  const rangeStats = useMemo(() => {
    if (!startDate || !endDate) return { totalDays: 0, matchingDays: 0, offDays: 0 };
    const start = new Date(startDate + "T00:00:00");
    const end = new Date(endDate + "T00:00:00");
    if (start > end) return { totalDays: 0, matchingDays: 0, offDays: 0 };

    let total = 0;
    let matching = 0;
    const curr = new Date(start);

    while (curr <= end && total < 90) {
      total++;
      const dayKey = JS_DAY_TO_KEY[curr.getDay()];
      if (activeDaysSet.has(dayKey)) {
        matching++;
      }
      curr.setDate(curr.getDate() + 1);
    }

    return {
      totalDays: total,
      matchingDays: matching,
      offDays: Math.max(0, total - matching),
    };
  }, [startDate, endDate, activeDaysSet]);

  const hasActivePattern = activeDaysSet.size > 0;

  return (
    <FormModal
      id="availability-aware-generator-modal"
      open={open}
      onClose={onClose}
      title={t("schedule.generator.title", { defaultValue: "Availability-Aware Slot Generator" })}
      description={t("schedule.generator.desc", {
        defaultValue:
          "Generate recurring consultation slots aligned with the doctor's weekly consultation hours.",
      })}
    >
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* Doctor Summary Header */}
        <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-accent/20 border border-border/40">
          <div
            className="h-10 w-10 rounded-2xl overflow-hidden border-2 shrink-0"
            style={{ borderColor: color.hex }}
          >
            <RemoteImage
              src={doctor.photoUrl}
              alt={doctor.name}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-black text-foreground flex items-center gap-2">
              <span className="truncate">{doctor.name}</span>
              <span
                className="rounded-full px-2 py-0.5 text-[9px] font-extrabold shrink-0"
                style={{ backgroundColor: `${color.hex}18`, color: color.hex }}
              >
                {doctor.specialty}
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
              {hasActivePattern
                ? t("schedule.generator.activePattern", {
                    defaultValue: "Consults on {{count}} days: {{days}}",
                    count: activeDaysSet.size,
                    days: Array.from(activeDaysSet)
                      .map((d) => DAY_LABELS[d])
                      .join(", "),
                  })
                : t("schedule.generator.noActivePattern", {
                    defaultValue: "⚠️ No recurring weekly schedule found for this practitioner.",
                  })}
            </div>
          </div>
        </div>

        {/* Warning if doctor has no availability */}
        {!hasActivePattern && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Doctor has no recurring weekly hours.</p>
              <p className="text-[11px] opacity-90 mt-0.5">
                The doctor has not yet configured their consultation hours in the Doctor Portal.
                Generating slots now may result in 0 created slots.
              </p>
            </div>
          </div>
        )}

        {/* Date Range Inputs */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground">
              {t("schedule.startDate", { defaultValue: "Start Date" })}*
            </label>
            <input
              type="date"
              {...form.register("startDate")}
              className="glass w-full rounded-xl px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500/40 font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground">
              {t("schedule.endDate", { defaultValue: "End Date" })}*
            </label>
            <input
              type="date"
              {...form.register("endDate")}
              className="glass w-full rounded-xl px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500/40 font-mono"
            />
          </div>
        </div>

        {/* Range Preview / Availability Enforcer Pill */}
        {hasActivePattern && rangeStats.totalDays > 0 && (
          <div className="flex items-center justify-between rounded-2xl border border-border/40 bg-accent/15 p-3 text-xs">
            <div className="flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-emerald-500" />
              <div>
                <span className="font-bold text-foreground">
                  {rangeStats.matchingDays} consultation days
                </span>{" "}
                <span className="text-muted-foreground">
                  ({rangeStats.offDays} off-days skipped)
                </span>
              </div>
            </div>
            <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase">
              {rangeStats.totalDays} days total
            </span>
          </div>
        )}

        {/* Room Selection */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-muted-foreground flex items-center justify-between">
            <span>{t("rooms.title", { defaultValue: "Consultation Room" })}</span>
            <span className="text-[10px] text-muted-foreground/60 font-normal">Optional</span>
          </label>
          <select
            {...form.register("roomId")}
            className="glass w-full rounded-xl px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500/40 bg-background text-foreground"
          >
            <option value="">
              {t("rooms.generalPurpose", { defaultValue: "General Purpose / Unassigned" })}
            </option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        {selectedRoom && (
          <div className="p-2.5 rounded-xl bg-accent/20 border border-border/40 text-xs flex items-center gap-2 text-muted-foreground">
            <DoorOpen className="h-4 w-4 text-primary-500 shrink-0" />
            <span>
              Assigning all generated slots to:{" "}
              <strong className="text-foreground">{selectedRoom.name}</strong>
            </span>
          </div>
        )}

        {/* Overwrite Protection Toggle */}
        <label className="flex items-center gap-2.5 cursor-pointer p-2.5 rounded-xl bg-accent/20 border border-border/30">
          <input
            type="checkbox"
            {...form.register("force")}
            className="rounded text-primary-500 focus:ring-primary-500 h-4 w-4 cursor-pointer"
          />
          <div className="text-xs">
            <span className="font-bold text-foreground block">
              {t("schedule.overwriteSlots", { defaultValue: "Overwrite Unbooked Slots" })}
            </span>
            <span className="text-muted-foreground text-[10px]">
              Preserves all existing booked appointments while updating open availability.
            </span>
          </div>
        </label>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-border/40 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-accent cursor-pointer"
          >
            {t("common.cancel", { defaultValue: "Cancel" })}
          </button>

          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50 cursor-pointer shadow-md"
          >
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t("schedule.batchGenerateButton", { defaultValue: "Generate Slots" })}
          </button>
        </div>
      </form>
    </FormModal>
  );
}
