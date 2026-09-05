import { useTranslation } from "react-i18next";
import { CalendarCheck2, CheckCircle2, Gauge, Users2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/glass/GlassCard";

export interface SlotAggregateSummaryProps {
  /** Total available (bookable, not-yet-full) slots across the loaded window. */
  available: number;
  /** Total booked/fully-booked slots across the loaded window. */
  booked: number;
  /** Optional cancelled slots count, shown if provided. */
  cancelled?: number;
  loading?: boolean;
  className?: string;
}

export function SlotAggregateSummary({
  available,
  booked,
  cancelled,
  loading,
  className,
}: SlotAggregateSummaryProps) {
  const { t } = useTranslation();
  const total = available + booked;
  const utilizationPct = total > 0 ? Math.round((booked / total) * 100) : 0;

  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-4", className)}>
      <StatCard
        icon={<CalendarCheck2 className="h-4 w-4" />}
        label={t("schedule.aggregate.available")}
        value={loading ? "…" : available.toLocaleString()}
        tone="success"
      />
      <StatCard
        icon={<Users2 className="h-4 w-4" />}
        label={t("schedule.aggregate.booked")}
        value={loading ? "…" : booked.toLocaleString()}
        tone="danger"
      />
      <StatCard
        icon={<CheckCircle2 className="h-4 w-4" />}
        label={t("schedule.aggregate.total")}
        value={loading ? "…" : total.toLocaleString()}
        tone="primary"
      />
      <StatCard
        icon={<Gauge className="h-4 w-4" />}
        label={t("schedule.aggregate.utilization")}
        value={loading ? "…" : `${utilizationPct}%`}
        tone="warning"
      />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "success" | "danger" | "primary" | "warning";
}) {
  const toneClass: Record<typeof tone, string> = {
    success: "bg-success/10 text-success",
    danger: "bg-danger/10 text-danger",
    primary: "bg-primary-500/10 text-primary-500",
    warning: "bg-warning/10 text-warning",
  } as const;

  return (
    <GlassCard className="p-3.5 border border-border/40 flex items-center gap-3">
      <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-2xl", toneClass[tone])}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-lg font-bold tabular-nums text-foreground leading-tight">{value}</div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate">
          {label}
        </div>
      </div>
    </GlassCard>
  );
}
