import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueries } from "@/lib/queryClient";
import {
  CalendarDays,
  CalendarRange,
  Clock,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Sun,
  Sunset,
  Moon,
  Zap,
  Filter,
  Sparkles,
  Ban,
  Layers,
  ArrowRight,
} from "lucide-react";
import { GlassCard } from "@/components/glass/GlassCard";
import { StatusBadge } from "@/components/data/StatusBadge";
import { EmptyState } from "@/components/data/EmptyState";
import { ModernDatePickerModal } from "@/components/ui/ModernDatePickerModal";
import { doctorAppointmentsApi, type SlotRow } from "@/api/doctorSelfApi";
import { qk } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";
import { translateEnum } from "@/lib/enumLabel";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface OptimalSlotsTabProps {
  onGoToGenerate: () => void;
  onRemoveSlot: (id: string) => void;
  onCancelDate: (date: string) => void;
}

export function OptimalSlotsTab({
  onGoToGenerate,
  onRemoveSlot,
  onCancelDate,
}: OptimalSlotsTabProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language.startsWith("ar");

  // Selection mode: single date or date range
  const [dateMode, setDateMode] = useState<"single" | "range">("range");
  const [singleDate, setSingleDate] = useState(todayISO());

  const [dateRange, setDateRange] = useState(() => {
    const start = todayISO();
    const end = new Date();
    end.setDate(end.getDate() + 6);
    return { startDate: start, endDate: toISO(end) };
  });

  const [statusFilter, setStatusFilter] = useState<"all" | "available" | "full" | "cancelled">("all");

  // Compute dates array to query
  const targetDates = useMemo(() => {
    if (dateMode === "single") return [singleDate];

    const out: string[] = [];
    const start = new Date(dateRange.startDate + "T00:00:00");
    const end = new Date(dateRange.endDate + "T00:00:00");
    const maxDays = 31; // max 31 days range

    for (let i = 0; i < maxDays; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      if (d > end) break;
      out.push(toISO(d));
    }
    return out;
  }, [dateMode, singleDate, dateRange]);

  // Fetch slots for each date in targetDates
  const slotsQueries = useQueries({
    queries: targetDates.map((date) => ({
      queryKey: qk.doctorSelf.slots(date),
      queryFn: () => doctorAppointmentsApi.slots.listByDate(date),
      staleTime: 30_000,
    })),
  });

  const isLoading = slotsQueries.some((q) => q.isLoading);

  // Group slots by date
  const slotsByDate = useMemo(() => {
    const map: Record<string, SlotRow[]> = {};
    targetDates.forEach((date, i) => {
      let items = (slotsQueries[i]?.data ?? []) as SlotRow[];
      if (statusFilter !== "all") {
        items = items.filter((s) => String(s.status).toLowerCase() === statusFilter);
      }
      if (items.length > 0) {
        map[date] = items;
      }
    });
    return map;
  }, [targetDates, slotsQueries, statusFilter]);

  // Total metrics across queried dates
  const { totalCount, availableCount, bookedCount, cancelledCount } = useMemo(() => {
    let tot = 0;
    let avail = 0;
    let book = 0;
    let canc = 0;

    targetDates.forEach((_, i) => {
      const rows = (slotsQueries[i]?.data ?? []) as SlotRow[];
      tot += rows.length;
      rows.forEach((r) => {
        const st = String(r.status).toLowerCase();
        if (st === "available") avail++;
        else if (st === "full") book++;
        else if (st === "cancelled") canc++;
      });
    });

    return { totalCount: tot, availableCount: avail, bookedCount: book, cancelledCount: canc };
  }, [targetDates, slotsQueries]);

  const sortedDates = useMemo(() => Object.keys(slotsByDate).sort(), [slotsByDate]);

  return (
    <div className="space-y-6">
      {/* Top KPI Metrics Header Bar */}
      <GlassCard className="p-5 border border-border/40 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary-500/10 text-primary-500">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                {isRtl ? "نظرة عامة على Appointments المنشأة" : "Bookable Slots Overview"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {dateMode === "single"
                  ? `${isRtl ? "يوم" : "Single Date"}: ${singleDate}`
                  : `${isRtl ? "الفترة" : "Range"}: ${dateRange.startDate} → ${dateRange.endDate}`}
              </p>
            </div>
          </div>

          <button
            onClick={onGoToGenerate}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary-500 px-4 py-2 text-xs font-bold text-primary-foreground shadow-md hover:bg-primary-600 transition"
          >
            <Zap className="h-3.5 w-3.5" /> {isRtl ? "إنشاء Appointments جديدة" : "Generate Slots"}
          </button>
        </div>

        {/* 4 Summary Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-border/30">
          <div className="rounded-2xl bg-card/60 p-3 border border-border/40 text-center">
            <div className="text-xs text-muted-foreground font-semibold">{isRtl ? "إجمالي Appointments" : "Total Slots"}</div>
            <div className="text-lg font-extrabold text-foreground font-mono mt-0.5">{totalCount}</div>
          </div>
          <div className="rounded-2xl bg-success/10 p-3 border border-success/20 text-center">
            <div className="text-xs text-success font-semibold">{isRtl ? "شواغر متاحة" : "Available"}</div>
            <div className="text-lg font-extrabold text-success font-mono mt-0.5">{availableCount}</div>
          </div>
          <div className="rounded-2xl bg-primary-500/10 p-3 border border-primary-500/20 text-center">
            <div className="text-xs text-primary-500 font-semibold">{isRtl ? "محجوزة بالكامل" : "Booked / Full"}</div>
            <div className="text-lg font-extrabold text-primary-500 font-mono mt-0.5">{bookedCount}</div>
          </div>
          <div className="rounded-2xl bg-danger/10 p-3 border border-danger/20 text-center">
            <div className="text-xs text-danger font-semibold">{isRtl ? "ملغاة" : "Cancelled"}</div>
            <div className="text-lg font-extrabold text-danger font-mono mt-0.5">{cancelledCount}</div>
          </div>
        </div>
      </GlassCard>

      {/* Unified Filter & Date Selection Bar */}
      <GlassCard className="p-4 border border-border/40 shadow-md flex flex-wrap items-center justify-between gap-3">
        {/* Date Mode Switcher & Presets */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Mode Switcher Pills */}
          <div className="glass flex items-center gap-1 rounded-xl p-1 border border-border/40">
            <button
              onClick={() => setDateMode("single")}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-bold transition",
                dateMode === "single"
                  ? "bg-primary-500 text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {isRtl ? "يوم محدد" : "Single Day"}
            </button>
            <button
              onClick={() => setDateMode("range")}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-bold transition",
                dateMode === "range"
                  ? "bg-primary-500 text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {isRtl ? "نطاق زمني" : "Date Range"}
            </button>
          </div>

          {/* Date Picker Modal Trigger */}
          {dateMode === "single" ? (
            <ModernDatePickerModal
              mode="single"
              value={singleDate}
              onSelect={(d) => setSingleDate(d)}
            />
          ) : (
            <ModernDatePickerModal
              mode="range"
              startDate={dateRange.startDate}
              endDate={dateRange.endDate}
              onSelectRange={(start, end) => setDateRange({ startDate: start, endDate: end })}
            />
          )}
        </div>

        {/* Status Filter Buttons */}
        <div className="flex items-center gap-1.5">
          <Filter className="h-4 w-4 text-muted-foreground ms-1" />
          {(
            [
              { id: "all", label: isRtl ? "الكل" : "All" },
              { id: "available", label: isRtl ? "متاح" : "Available" },
              { id: "full", label: isRtl ? "محجوز" : "Booked" },
              { id: "cancelled", label: isRtl ? "ملغى" : "Cancelled" },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={cn(
                "rounded-xl px-3 py-1.5 text-xs font-bold transition",
                statusFilter === f.id
                  ? "bg-foreground text-background shadow-xs"
                  : "glass text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </GlassCard>

      {/* Slot Grouped List / Grid View */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <GlassCard key={i} className="p-5 h-40 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : sortedDates.length === 0 ? (
        <GlassCard className="p-8 border border-border/40 shadow-md">
          <EmptyState
            icon={CalendarRange}
            title={isRtl ? "لا توجد Appointments منشأة لهذه الفترة" : "No slots generated for this period"}
            description={
              isRtl
                ? "يمكنك استخدام زر 'إنشاء Appointments جديدة' لإنشاء Appointments محجوزة للعيادة بنقرة واحدة."
                : "Generate bookable slots for your clinic using the template generator."
            }
            action={
              <button
                onClick={onGoToGenerate}
                className="mt-2 inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-xs font-bold text-primary-foreground shadow-md hover:bg-primary-600 transition"
              >
                <Zap className="h-4 w-4" /> {isRtl ? "إنشاء Appointments الآن" : "Generate Slots Now"}
              </button>
            }
          />
        </GlassCard>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((date) => {
            const dateSlots = slotsByDate[date] || [];
            const dateObj = new Date(date + "T00:00:00");
            const formattedDate = dateObj.toLocaleDateString(i18n.language, {
              weekday: "long",
              year: "numeric",
              month: "short",
              day: "numeric",
            });

            const morning = dateSlots.filter((s) => parseInt(s.startTime?.slice(0, 2) || "0", 10) < 12);
            const afternoon = dateSlots.filter((s) => {
              const h = parseInt(s.startTime?.slice(0, 2) || "0", 10);
              return h >= 12 && h < 17;
            });
            const evening = dateSlots.filter((s) => parseInt(s.startTime?.slice(0, 2) || "0", 10) >= 17);

            return (
              <GlassCard key={date} className="p-5 border border-border/40 shadow-md space-y-4">
                {/* Date Header Strip */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/30">
                  <div className="flex items-center gap-2.5">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-primary-500/10 text-primary-500 text-xs font-mono font-bold">
                      {date.slice(8, 10)}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground capitalize">{formattedDate}</h3>
                      <p className="text-[11px] text-muted-foreground">
                        {dateSlots.length} {isRtl ? "Appointments إجمالية" : "total slots"}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => onCancelDate(date)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-danger/30 bg-danger/10 px-3 py-1.5 text-xs font-bold text-danger hover:bg-danger/20 transition"
                  >
                    <Ban className="h-3.5 w-3.5" />
                    {isRtl ? "Cancel جميع Appointments اليوم" : "Cancel Date Slots"}
                  </button>
                </div>

                {/* Subsections: Morning, Afternoon, Evening */}
                <div className="space-y-4">
                  {morning.length > 0 && (
                    <SlotSectionGroup
                      title={isRtl ? "الصباح" : "Morning"}
                      icon={<Sun className="h-4 w-4 text-amber-500" />}
                      slots={morning}
                      onRemoveSlot={onRemoveSlot}
                    />
                  )}
                  {afternoon.length > 0 && (
                    <SlotSectionGroup
                      title={isRtl ? "بعد الظهيرة" : "Afternoon"}
                      icon={<Sunset className="h-4 w-4 text-orange-500" />}
                      slots={afternoon}
                      onRemoveSlot={onRemoveSlot}
                    />
                  )}
                  {evening.length > 0 && (
                    <SlotSectionGroup
                      title={isRtl ? "المساء" : "Evening"}
                      icon={<Moon className="h-4 w-4 text-indigo-500" />}
                      slots={evening}
                      onRemoveSlot={onRemoveSlot}
                    />
                  )}
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SlotSectionGroup({
  title,
  icon,
  slots,
  onRemoveSlot,
}: {
  title: string;
  icon: React.ReactNode;
  slots: SlotRow[];
  onRemoveSlot: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
        {icon} {title} ({slots.length})
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {slots.map((s) => {
          const status = String(s.status).toLowerCase();
          const isAvailable = status === "available";
          const isFull = status === "full";

          return (
            <div
              key={s.id}
              className={cn(
                "group relative flex flex-col justify-between rounded-2xl p-3.5 border transition shadow-xs",
                isAvailable
                  ? "border-success/30 bg-success/5 hover:border-success/60"
                  : isFull
                    ? "border-primary-500/30 bg-primary-500/5 hover:border-primary-500/60"
                    : "border-danger/30 bg-danger/5 hover:border-danger/60"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-foreground flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-primary-500" />
                  {s.startTime?.slice(0, 5)}–{s.endTime?.slice(0, 5)}
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveSlot(s.id)}
                  className="text-muted-foreground hover:text-danger p-1 rounded-lg hover:bg-danger/10 transition opacity-80 group-hover:opacity-100"
                  title="Remove slot"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="mt-2.5 flex items-center justify-between gap-2">
                <StatusBadge value={s.status} />
                {typeof s.maxPatients === "number" && (
                  <span className="text-[11px] font-mono font-bold text-muted-foreground">
                    {s.currentPatients ?? 0}/{s.maxPatients}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
