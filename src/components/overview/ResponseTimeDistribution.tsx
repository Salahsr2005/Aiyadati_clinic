import { useMemo } from "react";
import { Clock, Info } from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { GlassCard } from "@/components/glass/GlassCard";
import type { AppointmentRow } from "@/api/appointmentsApi";

export interface ResponseTimeDistributionProps {
  appointments?: AppointmentRow[];
  loading?: boolean;
}

const BRACKETS = [
  { name: "< 5 mins", color: "#10b981", range: [0, 5] },
  { name: "5-15 mins", color: "#3b82f6", range: [5, 15] },
  { name: "15-60 mins", color: "#6366f1", range: [15, 60] },
  { name: "1-4 hours", color: "#f59e0b", range: [60, 240] },
  { name: "4-24 hours", color: "#ef4444", range: [240, 1440] },
  { name: "> 24 hours", color: "#78716c", range: [1440, Infinity] },
];

export function ResponseTimeDistribution({
  appointments = [],
  loading = false,
}: ResponseTimeDistributionProps) {
  const { chartData, averageText, totalWithResponse } = useMemo(() => {
    const counts = Array(BRACKETS.length).fill(0);
    let totalMs = 0;
    let validCount = 0;

    appointments.forEach((appt) => {
      if (appt.confirmedAt && appt.createdAt) {
        const created = new Date(appt.createdAt).getTime();
        const confirmed = new Date(appt.confirmedAt).getTime();
        if (confirmed > created) {
          const diffMin = (confirmed - created) / 60000;
          totalMs += confirmed - created;
          validCount++;

          const bracketIdx = BRACKETS.findIndex(
            (b) => diffMin >= b.range[0] && diffMin < b.range[1],
          );
          if (bracketIdx !== -1) {
            counts[bracketIdx]++;
          }
        }
      }
    });

    const data = BRACKETS.map((b, idx) => ({
      name: b.name,
      value: counts[idx],
      color: b.color,
    })).filter((item) => item.value > 0);

    let avgStr = "N/A";
    if (validCount > 0) {
      const avgMin = totalMs / validCount / 60000;
      if (avgMin < 60) {
        avgStr = `${Math.round(avgMin)}m`;
      } else if (avgMin < 1440) {
        avgStr = `${(avgMin / 60).toFixed(1)}h`;
      } else {
        avgStr = `${(avgMin / 1440).toFixed(1)}d`;
      }
    }

    return {
      chartData: data,
      averageText: avgStr,
      totalWithResponse: validCount,
    };
  }, [appointments]);

  if (loading) {
    return (
      <GlassCard className="p-5 border border-border/40 shadow-sm animate-pulse">
        <div className="h-[250px] w-full bg-muted/10 rounded-2xl" />
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-5 border border-border/40 shadow-sm relative overflow-hidden flex flex-col justify-between h-full">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-indigo-500/10 text-indigo-500">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight">Response Time Distribution</div>
              <div className="text-[10px] text-muted-foreground font-medium mt-0.5">
                Time difference between appointment creation and confirmation
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative flex-1 flex flex-col md:flex-row items-center justify-center gap-6 py-2">
        {chartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Info className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <div className="text-xs font-bold text-muted-foreground">No response metrics available</div>
            <div className="text-[10px] text-muted-foreground/60 mt-0.5">
              Requires appointments with valid confirmed timestamps
            </div>
          </div>
        ) : (
          <>
            {/* Chart Area */}
            <div className="relative w-40 h-40 shrink-0">
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/70">
                  Avg Time
                </div>
                <div className="text-2xl font-black text-foreground tabular-nums">
                  {averageText}
                </div>
                <div className="text-[9px] text-muted-foreground mt-0.5">
                  n={totalWithResponse}
                </div>
              </div>

              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const item = payload[0].payload;
                        const pct = ((item.value / totalWithResponse) * 100).toFixed(1);
                        return (
                          <div className="rounded-xl border border-border bg-popover/95 shadow-xl px-2.5 py-1.5 text-[11px] backdrop-blur-sm">
                            <span className="font-bold" style={{ color: item.color }}>
                              {item.name}
                            </span>
                            <span className="text-muted-foreground ms-1.5 font-medium">
                              {item.value} ({pct}%)
                            </span>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legend Area */}
            <div className="flex-1 space-y-1.5 w-full">
              {chartData.map((item, idx) => {
                const pct = ((item.value / totalWithResponse) * 100).toFixed(1);
                return (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="font-medium text-muted-foreground">{item.name}</span>
                    </div>
                    <div className="font-bold tabular-nums">
                      {item.value} <span className="text-[10px] text-muted-foreground font-medium">({pct}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between text-[10px] text-muted-foreground font-medium pt-2 border-t border-border/30">
        <span className="flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5" />
          Measures operational booking responsiveness
        </span>
      </div>
    </GlassCard>
  );
}
