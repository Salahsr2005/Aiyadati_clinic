import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
  type TooltipProps,
} from "recharts";
import { Activity, TrendingUp } from "lucide-react";
import { GlassCard } from "@/components/glass/GlassCard";
import { Skeleton } from "@/components/glass/Skeleton";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "rgba(245, 158, 11, 0.85)", // amber
  CONFIRMED: "rgba(59, 130, 246, 0.85)", // blue
  IN_PROGRESS: "rgba(167, 139, 250, 0.85)", // purple
  COMPLETED: "rgba(16, 185, 129, 0.85)", // emerald
  CANCELLED: "rgba(239, 68, 68, 0.85)", // red
  NO_SHOW: "rgba(148, 163, 184, 0.85)", // slate
};

function fmtDZD(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M DZD`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k DZD`;
  return `${n.toLocaleString()} DZD`;
}

function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

function CustomChartTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-2xl border border-border bg-popover/90 p-3 shadow-xl backdrop-blur-md text-xs select-none">
      <div className="font-bold text-muted-foreground mb-1.5 uppercase tracking-wider text-[9px]">{label}</div>
      <div className="space-y-1">
        {payload.map((item, idx) => {
          const isRev = item.name?.toLowerCase().includes("rev") || item.name?.toLowerCase().includes("amount");
          const val = typeof item.value === "number"
            ? isRev
              ? fmtDZD(item.value)
              : item.value.toLocaleString()
            : item.value;

          return (
            <div key={idx} className="flex items-center justify-between gap-4 font-semibold text-foreground">
              <div className="flex items-center gap-1.5 font-medium text-muted-foreground">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                {item.name}
              </div>
              <div className="tabular-nums">{val}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export interface AppointmentAnalyticsProps {
  revenueStats?: { byMonth?: { month: string; amount: number; count?: number }[] };
  appointmentsStats?: { byStatus?: { status: string; count: number }[] };
  loading?: boolean;
}

export function AppointmentAnalytics({
  revenueStats,
  appointmentsStats,
  loading = false,
}: AppointmentAnalyticsProps) {
  const { t } = useTranslation();
  const [revRange, setRevRange] = useState<"3m" | "6m" | "12m">("12m");

  const allRevenue = useMemo(() => revenueStats?.byMonth ?? [], [revenueStats]);

  const revenueData = useMemo(() => {
    const n = revRange === "3m" ? 3 : revRange === "6m" ? 6 : 12;
    return allRevenue.slice(-n);
  }, [allRevenue, revRange]);

  const revenueSum = useMemo(() => revenueData.reduce((s, r) => s + (r.amount || 0), 0), [revenueData]);
  const revenueAvg = useMemo(() => (revenueData.length ? revenueSum / revenueData.length : 0), [revenueData, revenueSum]);

  const revenueDelta = useMemo(() => {
    const n = revRange === "3m" ? 3 : revRange === "6m" ? 6 : 12;
    const prevPeriod = allRevenue.slice(-n * 2, -n);
    const prevSum = prevPeriod.reduce((s, r) => s + (r.amount || 0), 0);
    return prevSum > 0 ? ((revenueSum - prevSum) / prevSum) * 100 : 0;
  }, [allRevenue, revenueSum, revRange]);

  const apStatus = useMemo(() => appointmentsStats?.byStatus ?? [], [appointmentsStats]);
  const apStatusTotal = useMemo(() => apStatus.reduce((s, r) => s + (r.count || 0), 0), [apStatus]);

  const composedRev = useMemo(() => {
    let running = 0;
    return revenueData.map((r) => {
      running += r.amount || 0;
      return {
        month: r.month,
        amount: r.amount || 0,
        count: r.count || 0,
        cumulative: running,
      };
    });
  }, [revenueData]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="lg:col-span-2 h-[340px]" />
        <Skeleton className="h-[340px]" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Composed Revenue & Booking chart */}
      <GlassCard className="lg:col-span-2 border border-border/40 shadow-sm p-5 flex flex-col justify-between">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5 text-sm font-bold tracking-tight">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary-500/10 text-primary-500">
                <TrendingUp className="h-4 w-4" />
              </div>
              <div>
                <div>Financial & Booking Efficiency</div>
                <div className="text-[10px] text-muted-foreground font-semibold mt-0.5">
                  Volume {fmtDZD(revenueSum)} · Avg {fmtDZD(Math.round(revenueAvg))} ·{" "}
                  <span className={revenueDelta >= 0 ? "text-emerald-500" : "text-rose-500"}>
                    {revenueDelta >= 0 ? "▲" : "▼"} {Math.abs(revenueDelta).toFixed(1)}% vs prev period
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="glass inline-flex rounded-full p-1 text-xs">
            {(["3m", "6m", "12m"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRevRange(r)}
                className={`rounded-full px-3 py-1 cursor-pointer transition-colors ${
                  revRange === r ? "bg-primary-500 text-white font-semibold" : "text-foreground/70 hover:text-foreground"
                }`}
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="h-72">
          {composedRev.length === 0 ? (
            <div className="grid h-full w-full place-items-center text-xs text-muted-foreground border border-dashed border-border/40 rounded-3xl">
              No revenue series data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={composedRev} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="composed-rev-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary-500)" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="var(--primary-500)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="var(--border)" opacity={0.3} vertical={false} />
                <XAxis
                  dataKey="month"
                  stroke="var(--muted-foreground)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  dy={10}
                />
                <YAxis
                  yAxisId="left"
                  stroke="var(--muted-foreground)"
                  fontSize={10}
                  tickFormatter={fmtNum}
                  tickLine={false}
                  axisLine={false}
                  dx={-10}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="var(--muted-foreground)"
                  fontSize={10}
                  tickFormatter={fmtNum}
                  tickLine={false}
                  axisLine={false}
                  dx={10}
                />
                <Tooltip content={<CustomChartTooltip />} cursor={{ fill: "var(--foreground)", opacity: 0.05 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10, paddingTop: 15 }} />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="amount"
                  name="Revenue (DZD)"
                  stroke="var(--primary-500)"
                  strokeWidth={2}
                  fill="url(#composed-rev-grad)"
                  activeDot={{ r: 5, strokeWidth: 0, fill: "var(--primary-500)" }}
                />
                <Bar
                  yAxisId="right"
                  dataKey="count"
                  name="Appointments"
                  fill="var(--info)"
                  radius={[4, 4, 0, 0]}
                  opacity={0.3}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="cumulative"
                  name="Cumulative Rev"
                  stroke="var(--warning)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0, fill: "var(--warning)" }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </GlassCard>

      {/* Appointment Status donut chart */}
      <GlassCard className="border border-border/40 shadow-sm flex flex-col justify-between p-5">
        <div>
          <div className="mb-1 flex items-center gap-2.5 text-sm font-bold tracking-tight">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-info/10 text-info">
              <Activity className="h-4 w-4" />
            </div>
            <div>
              <div>Appointments Split</div>
              <div className="text-[10px] text-muted-foreground font-semibold mt-0.5">
                Status breakdown of all platform appointments
              </div>
            </div>
          </div>
        </div>

        <div className="relative h-52 flex items-center justify-center my-2">
          {apStatus.length === 0 ? (
            <div className="text-xs text-muted-foreground">No bookings recorded</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={apStatus}
                    dataKey="count"
                    nameKey="status"
                    innerRadius={58}
                    outerRadius={78}
                    paddingAngle={4}
                    cornerRadius={5}
                    stroke="none"
                  >
                    {apStatus.map((s) => (
                      <Cell key={s.status} fill={STATUS_COLORS[s.status] || "var(--primary-500)"} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-2xl font-bold tracking-tight tabular-nums text-foreground">{apStatusTotal.toLocaleString()}</div>
                <div className="text-[8px] uppercase font-bold tracking-widest text-muted-foreground mt-0.5">Total Bookings</div>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-wrap gap-2 text-[9px] font-bold border-t border-border/40 pt-3">
          {apStatus.map((s) => (
            <span key={s.status} className="glass inline-flex items-center gap-1.5 rounded-full px-2 py-0.5">
              <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: STATUS_COLORS[s.status] || "var(--primary-500)" }} />
              <span className="text-muted-foreground uppercase">{s.status}:</span>
              <span className="text-foreground font-extrabold">{s.count}</span>
            </span>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
