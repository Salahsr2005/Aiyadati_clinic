import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const TONES = [
  "bg-muted/40 text-muted-foreground border-border",
  "bg-info/15 text-info border-info/30",
  "bg-primary-500/15 text-primary-500 border-primary-500/30",
  "bg-warning/15 text-warning border-warning/30",
  "bg-success/15 text-success border-success/30",
  "bg-success/25 text-success border-success/40",
];

export function TrustLevelBadge({ level, points }: { level?: number; points?: number }) {
  const l = Math.max(0, Math.min(5, level ?? 0));
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium",
        TONES[l] ?? TONES[0],
      )}
    >
      <ShieldCheck className="h-3 w-3" />
      L{l}
      {typeof points === "number" && <span className="opacity-70">· {points}</span>}
    </span>
  );
}