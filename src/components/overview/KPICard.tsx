import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { GlassCard } from "@/components/glass/GlassCard";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { useEffect, useState } from "react";

function useCountUp(target: number, duration = 900) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setN(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return n;
}

export interface KPICardProps {
  label: string;
  value: number;
  delta?: number;
  spark?: number[];
  tone?: "primary" | "success" | "warning" | "danger" | "info";
  format?: (n: number) => string;
  subLabel?: string;
  comparisonLabel?: string;
  actionText?: string;
  onActionClick?: () => void;
}

export function KPICard({
  label,
  value,
  delta,
  spark,
  tone = "primary",
  format,
  subLabel,
  comparisonLabel = "vs last period",
  actionText,
  onActionClick,
}: KPICardProps) {
  const n = useCountUp(value);
  const data = (spark ?? []).map((v, i) => ({ i, v }));
  const toneColor: Record<string, string> = {
    primary: "var(--primary-500)",
    success: "var(--success)",
    warning: "var(--warning)",
    danger: "var(--danger)",
    info: "var(--info)",
  };
  const color = toneColor[tone];
  const up = (delta ?? 0) >= 0;

  return (
    <GlassCard className="group relative flex flex-col justify-between overflow-hidden transition-all duration-300 hover:border-primary-500/30 hover:shadow-lg">
      <div>
        <div className="flex items-start justify-between">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          {delta !== undefined && (
            <div
              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold transition-all duration-300"
              style={{
                background: `color-mix(in oklab, ${up ? "var(--success)" : "var(--danger)"} 12%, transparent)`,
                color: up ? "var(--success)" : "var(--danger)",
              }}
              title={`${delta.toFixed(2)}% ${comparisonLabel}`}
            >
              {up ? <ArrowUpRight className="h-3 w-3 animate-bounce" /> : <ArrowDownRight className="h-3 w-3 animate-bounce" />}
              {Math.abs(delta).toFixed(1)}%
            </div>
          )}
        </div>

        <div className="mt-2 flex items-baseline gap-2">
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-bold tracking-tight tabular-nums"
          >
            {format ? format(n) : n.toLocaleString()}
          </motion.div>
        </div>

        {subLabel && (
          <div className="mt-1 text-[11px] text-muted-foreground/90 font-medium">
            {subLabel}
          </div>
        )}
      </div>

      <div className="mt-4">
        {data.length > 0 && (
          <div className="h-10 opacity-70 group-hover:opacity-100 transition-opacity duration-300">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={`spark-${label}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={color}
                  strokeWidth={2}
                  fill={`url(#spark-${label})`}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="mt-2 flex items-center justify-between border-t border-border/40 pt-2 text-[10px] text-muted-foreground">
          <span>{delta !== undefined ? comparisonLabel : ""}</span>
          {actionText && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onActionClick?.();
              }}
              className="font-semibold text-primary-500 hover:text-primary-600 hover:underline transition-colors flex items-center gap-0.5 cursor-pointer"
            >
              {actionText}
              <ArrowUpRight className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </GlassCard>
  );
}