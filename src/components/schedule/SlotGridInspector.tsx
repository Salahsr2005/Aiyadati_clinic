import { useMemo } from "react";
import { Clock, Sun, Sunset, Moon, Trash2, DoorOpen, User, CalendarPlus } from "lucide-react";
import { StatusBadge } from "@/components/data/StatusBadge";
import { useTranslation } from "react-i18next";
import type { DoctorSlot } from "@/api/clinicAppointmentsApi";
import { cn } from "@/lib/utils";

interface SlotGridInspectorProps {
  slots: DoctorSlot[];
  onSelectSlot?: (slot: DoctorSlot) => void;
  onBookSlot?: (slot: DoctorSlot) => void;
  onRemoveSlot?: (id: string) => void;
  isLoading?: boolean;
}

export function SlotGridInspector({
  slots,
  onSelectSlot,
  onBookSlot,
  onRemoveSlot,
  isLoading,
}: SlotGridInspectorProps) {
  const { t } = useTranslation();

  const grouped = useMemo(() => {
    const morning: DoctorSlot[] = [];
    const afternoon: DoctorSlot[] = [];
    const evening: DoctorSlot[] = [];

    for (const s of slots) {
      const hour = parseInt(s.startTime?.slice(0, 2) || "0", 10);
      if (hour < 12) morning.push(s);
      else if (hour < 17) afternoon.push(s);
      else evening.push(s);
    }

    return { morning, afternoon, evening };
  }, [slots]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted/30" />
        ))}
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-xs text-muted-foreground">
        {t("schedule.timeline.empty", { defaultValue: "No slots scheduled for this date" })}
      </div>
    );
  }

  const renderSection = (title: string, icon: React.ReactNode, periodSlots: DoctorSlot[]) => {
    if (periodSlots.length === 0) return null;
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
          {icon}
          {title} ({periodSlots.length})
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {periodSlots.map((s) => {
            const status = String(s.status || "available").toLowerCase();
            const isAvailable = status === "available";
            const isFull = status === "full" || status === "booked";

            return (
              <div
                key={s.id}
                onClick={() => onSelectSlot?.(s)}
                className={cn(
                  "group relative flex flex-col justify-between rounded-2xl p-4 border transition-all duration-200 shadow-xs cursor-pointer hover:shadow-md",
                  isAvailable
                    ? "border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/60 hover:bg-emerald-500/10"
                    : isFull
                      ? "border-amber-500/30 bg-amber-500/5 hover:border-amber-500/60 hover:bg-amber-500/10"
                      : "border-rose-500/30 bg-rose-500/5 hover:border-rose-500/60"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-primary-500" />
                    {s.startTime?.slice(0, 5)}–{s.endTime?.slice(0, 5)}
                  </span>
                  <StatusBadge value={s.status || "AVAILABLE"} />
                </div>

                {s.room?.name && (
                  <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <DoorOpen className="h-3 w-3 text-primary-500" />
                    <span className="truncate">{s.room.name}</span>
                  </div>
                )}

                <div className="mt-3 pt-2.5 border-t border-border/30 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 text-[11px] font-mono font-semibold text-muted-foreground">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span>
                      {s.currentPatients ?? 0}/{s.maxPatients ?? 1}
                    </span>
                  </div>

                  {isAvailable && onBookSlot && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onBookSlot(s);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-primary-500 text-white text-[10px] font-bold hover:opacity-90 transition cursor-pointer"
                    >
                      <CalendarPlus className="h-3 w-3" />
                      {t("schedule.timeline.bookPatient", { defaultValue: "Book" })}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {renderSection("Morning", <Sun className="h-4 w-4 text-amber-500" />, grouped.morning)}
      {renderSection("Afternoon", <Sunset className="h-4 w-4 text-orange-500" />, grouped.afternoon)}
      {renderSection("Evening", <Moon className="h-4 w-4 text-indigo-500" />, grouped.evening)}
    </div>
  );
}
