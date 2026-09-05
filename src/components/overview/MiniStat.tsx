import { motion } from "framer-motion";
import type { ReactNode } from "react";

export interface MiniStatProps {
  icon: ReactNode;
  label: string;
  value: string;
  tone: "primary" | "info" | "success" | "warning";
}

export function MiniStat({ icon, label, value, tone }: MiniStatProps) {
  const toneColor: Record<string, string> = {
    primary: "var(--primary-500)",
    info: "var(--info)",
    success: "var(--success)",
    warning: "var(--warning)",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass flex items-center gap-3 rounded-2xl p-3"
    >
      <div
        className="grid h-9 w-9 place-items-center rounded-xl"
        style={{
          background: `color-mix(in oklab, ${toneColor[tone]} 15%, transparent)`,
          color: toneColor[tone],
        }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="text-lg font-semibold tabular-nums">{value}</div>
      </div>
    </motion.div>
  );
}
