import { useMemo, useState } from "react";
import { CalendarRange, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/glass/GlassCard";
import { StatusBadge } from "@/components/data/StatusBadge";
import { EmptyState } from "@/components/data/EmptyState";
import { Skeleton } from "@/components/glass/Skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import type { DoctorSlot } from "@/api/clinicAppointmentsApi";

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export interface DateRangeInspectorProps {
  startDate: string;
  endDate: string;
  onRangeChange: (start: string, end: string) => void;
  slotsByDate: Record<string, DoctorSlot[]>;
  isLoading?: boolean;
  filter: "all" | "available" | "full" | "cancelled";
  onFilterChange: (f: "all" | "available" | "full" | "cancelled") => void;
  onCancelDate: (date: string) => void;
  onRemoveSlot?: (id: string) => void;
  cancellingDate?: string | null;
}

export function DateRangeInspector({
  startDate,
  endDate,
  onRangeChange,
  slotsByDate,
  isLoading,
  filter,
  onFilterChange,
  onCancelDate,
  onRemoveSlot,
  cancellingDate,
}: DateRangeInspectorProps) {
  const [open, setOpen] = useState(false);

  const applyPreset = (preset: "today" | "week" | "next7" | "month") => {
    const today = new Date();
    if (preset === "today") {
      onRangeChange(toISO(today), toISO(today));
    } else if (preset === "week") {
      const dow = (today.getDay() + 6) % 7; // 0 = Monday
      const monday = new Date(today);
      monday.setDate(today.getDate() - dow);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      onRangeChange(toISO(monday), toISO(sunday));
    } else if (preset === "next7") {
      const end = new Date(today);
      end.setDate(today.getDate() + 6);
      onRangeChange(toISO(today), toISO(end));
    } else if (preset === "month") {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      onRangeChange(toISO(first), toISO(last));
    }
    setOpen(false);
  };

  const sortedDates = useMemo(
    () => Object.keys(slotsByDate).filter((d) => (slotsByDate[d]?.length ?? 0) > 0).sort(),
    [slotsByDate],
  );

  const aggregate = useMemo(() => {
    let available = 0, full = 0, cancelled = 0;
    for (const rows of Object.values(slotsByDate)) {
      for (const r of rows) {
        const s = String(r.status || "").toLowerCase();
        if (s === "available") available++;
        else if (s === "full" || s === "booked" || r.isBooked) full++;
        else if (s === "cancelled" || r.isCancelled) cancelled++;
      }
    }
    return { available, full, cancelled, total: available + full + cancelled };
  }, [slotsByDate]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground">Inspect Range</span>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button className="glass inline-flex items-center gap-2 rounded-xl border border-border/40 px-3.5 py-2 text-xs font-bold hover:border-primary-500/40 transition cursor-pointer">
                <CalendarRange className="h-3.5 w-3.5 text-primary-500" />
                {startDate} – {endDate}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-4 border border-border/40 bg-popover/95 backdrop-blur-md shadow-2xl rounded-2xl">
              <div className="space-y-3">
                <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
                  {(
                    [
                      { id: "today", label: "Today" },
                      { id: "week", label: "This Week" },
                      { id: "next7", label: "Next 7 Days" },
                      { id: "month", label: "This Month" },
                    ] as const
                  ).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => applyPreset(p.id)}
                      className="rounded-full bg-primary-500/10 px-3 py-1 text-primary-500 hover:bg-primary-500 hover:text-primary-foreground transition cursor-pointer"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <Calendar
                  mode="range"
                  selected={{
                    from: new Date(startDate),
                    to: new Date(endDate),
                  }}
                  onSelect={(range) => {
                    if (range?.from && range?.to) {
                      onRangeChange(toISO(range.from), toISO(range.to));
                      setOpen(false);
                    } else if (range?.from) {
                      onRangeChange(toISO(range.from), toISO(range.from));
                    }
                  }}
                  className="rounded-xl border border-border/40"
                />
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex items-center gap-1 text-xs font-semibold">
          {(
            [
              { id: "all", label: "All" },
              { id: "available", label: "Available" },
              { id: "full", label: "Booked" },
              { id: "cancelled", label: "Cancelled" },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => onFilterChange(f.id)}
              className={cn(
                "rounded-full px-3 py-1 transition font-bold cursor-pointer",
                filter === f.id ? "bg-primary-500 text-primary-foreground shadow-xs" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Aggregate summary for the selected range */}
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-border/40 bg-muted/10 px-4 py-2.5 text-[11px] font-bold text-muted-foreground">
        <span>Total Range Slots: {aggregate.total}</span>
        <span className="inline-flex items-center gap-1.5 text-success"><span className="h-2 w-2 rounded-full bg-success" /> Available: {aggregate.available}</span>
        <span className="inline-flex items-center gap-1.5 text-danger"><span className="h-2 w-2 rounded-full bg-danger" /> Booked: {aggregate.full}</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-muted-foreground/40" /> Cancelled: {aggregate.cancelled}</span>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : sortedDates.length === 0 ? (
        <EmptyState
          title="No slots found for this date range"
          description="Adjust your date range or click Batch Generate to create slots."
        />
      ) : (
        <div className="space-y-4 max-h-[520px] overflow-y-auto custom-scrollbar pe-1">
          {sortedDates.map((date) => {
            const rows = (slotsByDate[date] ?? []).filter((s) => {
              if (filter === "all") return true;
              const st = String(s.status || "").toLowerCase();
              if (filter === "available") return st === "available" && !s.isBooked && !s.isCancelled;
              if (filter === "full") return st === "full" || st === "booked" || s.isBooked;
              if (filter === "cancelled") return st === "cancelled" || s.isCancelled;
              return true;
            });
            if (rows.length === 0) return null;
            return (
              <GlassCard key={date} className="p-4 border border-border/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-foreground">
                    {new Date(date + "T00:00:00").toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  <button
                    type="button"
                    onClick={() => onCancelDate(date)}
                    disabled={cancellingDate === date}
                    className="rounded-lg bg-danger/10 text-danger border border-danger/30 px-2.5 py-1 text-[10px] font-bold hover:bg-danger/20 transition disabled:opacity-50 cursor-pointer"
                  >
                    Cancel Day Slots
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                  {rows.map((s) => (
                    <div
                      key={s.id}
                      className="glass rounded-xl p-2.5 border border-border/40 hover:border-primary-500/40 transition space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold font-mono">{s.startTime?.slice(0, 5)}–{s.endTime?.slice(0, 5)}</span>
                        {onRemoveSlot && (
                          <button
                            type="button"
                            onClick={() => onRemoveSlot(s.id)}
                            className="text-muted-foreground hover:text-danger p-0.5 rounded hover:bg-danger/10 transition cursor-pointer"
                            title="Delete Slot"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <StatusBadge value={s.isCancelled ? "CANCELLED" : s.isBooked ? "BOOKED" : "AVAILABLE"} />
                    </div>
                  ))}
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
