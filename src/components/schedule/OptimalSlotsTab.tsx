import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueries } from "@/lib/queryClient";
import { CalendarDays, CalendarRange, Clock, Sun, Sunset, Moon, Zap, Filter, Ban } from "lucide-react";
import { format, addDays } from "date-fns";
import { GlassCard } from "@/components/glass/GlassCard";
import { StatusBadge } from "@/components/data/StatusBadge";
import { EmptyState } from "@/components/data/EmptyState";
import { ModernDatePickerModal } from "@/components/ui/ModernDatePickerModal";
import { clinicAppointmentsApi, type DoctorSlot } from "@/api/clinicAppointmentsApi";
import { qk } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";
import { getDoctorColor } from "@/lib/doctorColor";

function todayISO() {
  return format(new Date(), "yyyy-MM-dd");
}

interface OptimalSlotsTabProps {
  doctorId: string;
  onGoToGenerate: () => void;
  onCancelDate: (date: string) => void;
}

export function OptimalSlotsTab({ doctorId, onGoToGenerate, onCancelDate }: OptimalSlotsTabProps) {
  const { t, i18n } = useTranslation();
  const color = getDoctorColor(doctorId);

  const [dateMode, setDateMode] = useState<"single" | "range">("range");
  const [singleDate, setSingleDate] = useState(todayISO());
  const [dateRange, setDateRange] = useState(() => ({ startDate: todayISO(), endDate: format(addDays(new Date(), 6), "yyyy-MM-dd") }));
  const [statusFilter, setStatusFilter] = useState<"all" | "available" | "full" | "cancelled">("all");

  const targetDates = useMemo(() => {
    if (dateMode === "single") return [singleDate];
    const out: string[] = [];
    const start = new Date(dateRange.startDate + "T00:00:00");
    const end = new Date(dateRange.endDate + "T00:00:00");
    for (let i = 0; i < 31; i++) {
      const d = addDays(start, i);
      if (d > end) break;
      out.push(format(d, "yyyy-MM-dd"));
    }
    return out;
  }, [dateMode, singleDate, dateRange]);

  const slotsQueries = useQueries({
    queries: targetDates.map((date) => ({
      queryKey: qk.clinicSelf.doctorSlots(doctorId, { date }),
      queryFn: () => clinicAppointmentsApi.getDoctorSlots(doctorId, { date }),
      enabled: !!doctorId,
      staleTime: 30_000,
    })),
  });

  const isLoading = slotsQueries.some((q) => q.isLoading);

  const slotsByDate = useMemo(() => {
    const map: Record<string, DoctorSlot[]> = {};
    targetDates.forEach((date, i) => {
      let items = (slotsQueries[i]?.data as DoctorSlot[]) ?? [];
      if (statusFilter !== "all") {
        items = items.filter((s) => String(s.status || "").toLowerCase() === statusFilter);
      }
      if (items.length > 0) map[date] = items;
    });
    return map;
  }, [targetDates, slotsQueries, statusFilter]);

  const { totalCount, availableCount, bookedCount, cancelledCount } = useMemo(() => {
    let tot = 0, avail = 0, book = 0, canc = 0;
    targetDates.forEach((_, i) => {
      const rows = (slotsQueries[i]?.data as DoctorSlot[]) ?? [];
      tot += rows.length;
      rows.forEach((r) => {
        const st = String(r.status || "").toLowerCase();
        if (st === "available") avail++;
        else if (st === "full" || st === "booked" || r.isBooked) book++;
        else if (st === "cancelled" || r.isCancelled) canc++;
      });
    });
    return { totalCount: tot, availableCount: avail, bookedCount: book, cancelledCount: canc };
  }, [targetDates, slotsQueries]);

  const sortedDates = useMemo(() => Object.keys(slotsByDate).sort(), [slotsByDate]);

  return (
    <div className="space-y-6">
      <GlassCard className="p-5 border border-border/40 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl" style={{ backgroundColor: `${color.hex}1f`, color: color.hex }}>
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                {t("schedule.mySlots.title", { defaultValue: "Bookable Slots Overview" })}
              </h2>
              <p className="text-xs text-muted-foreground">
                {dateMode === "single" ? singleDate : `${dateRange.startDate} → ${dateRange.endDate}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onGoToGenerate}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary-500 px-4 py-2 text-xs font-bold text-primary-foreground shadow-md hover:bg-primary-600 transition cursor-pointer"
          >
            <Zap className="h-3.5 w-3.5" /> {t("schedule.batchGenerateButton", { defaultValue: "Generate Slots" })}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-border/30">
          <Stat label={t("schedule.totalSlots", { defaultValue: "Total Slots" })} value={totalCount} />
          <Stat label={t("schedule.availableSlots", { defaultValue: "Available" })} value={availableCount} tone="success" />
          <Stat label={t("schedule.bookedSlots", { defaultValue: "Booked / Full" })} value={bookedCount} tone="primary" />
          <Stat label={t("schedule.cancelledSlots", { defaultValue: "Cancelled" })} value={cancelledCount} tone="danger" />
        </div>
      </GlassCard>

      <GlassCard className="p-4 border border-border/40 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="glass flex items-center gap-1 rounded-xl p-1 border border-border/40">
            <button
              type="button"
              onClick={() => setDateMode("single")}
              className={cn("rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer", dateMode === "single" ? "bg-primary-500 text-white" : "text-muted-foreground")}
            >
              {t("schedule.mySlots.singleDay", { defaultValue: "Single Day" })}
            </button>
            <button
              type="button"
              onClick={() => setDateMode("range")}
              className={cn("rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer", dateMode === "range" ? "bg-primary-500 text-white" : "text-muted-foreground")}
            >
              {t("schedule.mySlots.range", { defaultValue: "Date Range" })}
            </button>
          </div>
          {dateMode === "single" ? (
            <ModernDatePickerModal mode="single" value={singleDate} onSelect={setSingleDate} />
          ) : (
            <ModernDatePickerModal
              mode="range"
              startDate={dateRange.startDate}
              endDate={dateRange.endDate}
              onSelectRange={(start, end) => setDateRange({ startDate: start, endDate: end })}
            />
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {(["all", "available", "full", "cancelled"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setStatusFilter(f)}
              className={cn("rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer", statusFilter === f ? "bg-foreground text-background" : "glass text-muted-foreground")}
            >
              {t(`schedule.filters.${f}`, { defaultValue: f })}
            </button>
          ))}
        </div>
      </GlassCard>

      {isLoading ? (
        <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <GlassCard key={i} className="p-5 h-40 animate-pulse rounded-2xl" />)}</div>
      ) : sortedDates.length === 0 ? (
        <GlassCard className="p-8 border border-border/40">
          <EmptyState
            title={t("schedule.mySlots.empty", { defaultValue: "No slots generated for this period" })}
            description={t("schedule.mySlots.emptyDesc", { defaultValue: "Generate bookable slots for this doctor using the template generator." })}
            action={
              <button
                type="button"
                onClick={onGoToGenerate}
                className="mt-2 inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-xs font-bold text-primary-foreground cursor-pointer"
              >
                <Zap className="h-4 w-4" /> {t("schedule.mySlots.generateNow", { defaultValue: "Generate Slots Now" })}
              </button>
            }
          />
        </GlassCard>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((date) => {
            const dateSlots = slotsByDate[date] || [];
            const dateObj = new Date(date + "T00:00:00");
            const formattedDate = dateObj.toLocaleDateString(i18n.language, { weekday: "long", year: "numeric", month: "short", day: "numeric" });
            const morning = dateSlots.filter((s) => parseInt(s.startTime?.slice(0, 2) || "0", 10) < 12);
            const afternoon = dateSlots.filter((s) => { const h = parseInt(s.startTime?.slice(0, 2) || "0", 10); return h >= 12 && h < 17; });
            const evening = dateSlots.filter((s) => parseInt(s.startTime?.slice(0, 2) || "0", 10) >= 17);

            return (
              <GlassCard key={date} className="p-5 border border-border/40 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/30">
                  <div className="flex items-center gap-2.5">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl text-xs font-mono font-bold" style={{ backgroundColor: `${color.hex}1f`, color: color.hex }}>
                      {date.slice(8, 10)}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground capitalize">{formattedDate}</h3>
                      <p className="text-[11px] text-muted-foreground">{dateSlots.length} {t("schedule.mySlots.totalSlots", { defaultValue: "total slots" })}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onCancelDate(date)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-danger/30 bg-danger/10 px-3 py-1.5 text-xs font-bold text-danger hover:bg-danger/20 transition cursor-pointer"
                  >
                    <Ban className="h-3.5 w-3.5" /> {t("schedule.mySlots.cancelDate", { defaultValue: "Cancel Date Slots" })}
                  </button>
                </div>
                <div className="space-y-4">
                  {morning.length > 0 && <SlotGroup title={t("schedule.mySlots.morning", { defaultValue: "Morning" })} icon={<Sun className="h-4 w-4 text-amber-500" />} slots={morning} />}
                  {afternoon.length > 0 && <SlotGroup title={t("schedule.mySlots.afternoon", { defaultValue: "Afternoon" })} icon={<Sunset className="h-4 w-4 text-orange-500" />} slots={afternoon} />}
                  {evening.length > 0 && <SlotGroup title={t("schedule.mySlots.evening", { defaultValue: "Evening" })} icon={<Moon className="h-4 w-4 text-indigo-500" />} slots={evening} />}
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "success" | "primary" | "danger" }) {
  const toneClass = tone === "success" ? "bg-success/10 border-success/20 text-success" : tone === "primary" ? "bg-primary-500/10 border-primary-500/20 text-primary-500" : tone === "danger" ? "bg-danger/10 border-danger/20 text-danger" : "bg-card/60 border-border/40 text-foreground";
  return (
    <div className={cn("rounded-2xl p-3 border text-center", toneClass)}>
      <div className="text-xs font-semibold opacity-90">{label}</div>
      <div className="text-lg font-extrabold font-mono mt-0.5">{value}</div>
    </div>
  );
}

function SlotGroup({ title, icon, slots }: { title: string; icon: React.ReactNode; slots: DoctorSlot[] }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">{icon} {title} ({slots.length})</div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {slots.map((s) => {
          const status = String(s.status || "").toLowerCase();
          const isAvailable = status === "available";
          const isFull = status === "full" || status === "booked" || s.isBooked;
          return (
            <div
              key={s.id}
              className={cn(
                "flex flex-col justify-between rounded-2xl p-3.5 border transition",
                isAvailable ? "border-success/30 bg-success/5" : isFull ? "border-primary-500/30 bg-primary-500/5" : "border-danger/30 bg-danger/5",
              )}
            >
              <span className="font-mono text-xs font-bold text-foreground flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-primary-500" /> {s.startTime?.slice(0, 5)}–{s.endTime?.slice(0, 5)}
              </span>
              <div className="mt-2.5 flex items-center justify-between gap-2">
                <StatusBadge value={s.status || "AVAILABLE"} />
                {typeof s.maxPatients === "number" && (
                  <span className="text-[11px] font-mono font-bold text-muted-foreground">{s.currentPatients ?? 0}/{s.maxPatients}</span>
                )}
              </div>
              {s.room?.name && <div className="mt-1 text-[10px] text-muted-foreground truncate">{s.room.name}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
