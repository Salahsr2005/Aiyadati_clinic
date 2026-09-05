import { useMemo } from "react";
import { Clock, Sun, Sunset, Moon, Trash2 } from "lucide-react";
import { GlassCard } from "@/components/glass/GlassCard";
import { StatusBadge } from "@/components/data/StatusBadge";
import { translateEnum } from "@/lib/enumLabel";
import { useTranslation } from "react-i18next";
import type { SlotRow } from "@/api/doctorSelfApi";

interface SlotGridInspectorProps {
  slots: SlotRow[];
  onRemoveSlot: (id: string) => void;
  isLoading?: boolean;
}

export function SlotGridInspector({ slots, onRemoveSlot, isLoading }: SlotGridInspectorProps) {
  const { t, i18n } = useTranslation();

  const grouped = useMemo(() => {
    const morning: SlotRow[] = [];
    const afternoon: SlotRow[] = [];
    const evening: SlotRow[] = [];

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
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted/30" />
        ))}
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-xs text-muted-foreground">
        No slots generated for this date.
      </div>
    );
  }

  const renderSection = (title: string, icon: React.ReactNode, periodSlots: SlotRow[]) => {
    if (periodSlots.length === 0) return null;
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
          {icon}
          {title} ({periodSlots.length})
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {periodSlots.map((s) => {
            const status = String(s.status).toLowerCase();
            const isAvailable = status === "available";
            const isFull = status === "full";

            return (
              <div
                key={s.id}
                className={`group relative flex flex-col justify-between rounded-2xl p-3.5 border transition shadow-xs ${
                  isAvailable
                    ? "border-success/30 bg-success/5 hover:border-success/60"
                    : isFull
                      ? "border-danger/30 bg-danger/5 hover:border-danger/60"
                      : "border-border/40 bg-muted/10 hover:border-border"
                }`}
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
  };

  return (
    <div className="space-y-6">
      {renderSection("Morning", <Sun className="h-4 w-4 text-amber-500" />, grouped.morning)}
      {renderSection("Afternoon", <Sunset className="h-4 w-4 text-orange-500" />, grouped.afternoon)}
      {renderSection("Evening", <Moon className="h-4 w-4 text-indigo-500" />, grouped.evening)}
    </div>
  );
}
