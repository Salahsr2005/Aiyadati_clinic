import { useMemo } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ScheduleSlot {
  day?: string | number;
  startTime?: string;
  endTime?: string;
  open?: string;
  close?: string;
  isAvailable?: boolean;
  closed?: boolean;
}

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const DAY_LABELS: Record<(typeof DAY_KEYS)[number], string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

function normalizeDay(d: string | number | undefined): (typeof DAY_KEYS)[number] | null {
  if (d === undefined || d === null) return null;
  if (typeof d === "number") {
    // 0=Sun..6=Sat OR 1=Mon..7=Sun; map both reasonably
    if (d >= 1 && d <= 7) return DAY_KEYS[(d - 1) % 7];
    return DAY_KEYS[(d + 6) % 7];
  }
  const s = d.toString().toLowerCase().slice(0, 3);
  if ((DAY_KEYS as readonly string[]).includes(s)) return s as (typeof DAY_KEYS)[number];
  const map: Record<string, (typeof DAY_KEYS)[number]> = {
    mon: "mon", tue: "tue", wed: "wed", thu: "thu", fri: "fri", sat: "sat", sun: "sun",
    lun: "mon", mar: "tue", mer: "wed", jeu: "thu", ven: "fri", sam: "sat", dim: "sun",
  };
  return map[s] ?? null;
}

function parseTime(t?: string): number | null {
  if (!t) return null;
  const m = /^(\d{1,2}):?(\d{2})?/.exec(t.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mn = Number(m[2] ?? 0);
  if (Number.isNaN(h)) return null;
  return h + mn / 60;
}

export function WeeklyScheduleGrid({ slots }: { slots: ScheduleSlot[] }) {
  const byDay = useMemo(() => {
    const out: Record<(typeof DAY_KEYS)[number], { from: number; to: number; closed: boolean }[]> = {
      mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [],
    };
    for (const s of slots) {
      const day = normalizeDay(s.day);
      if (!day) continue;
      const from = parseTime(s.startTime ?? s.open);
      const to = parseTime(s.endTime ?? s.close);
      const closed = s.closed === true || s.isAvailable === false;
      if (closed || from === null || to === null) {
        out[day].push({ from: 0, to: 0, closed: true });
      } else {
        out[day].push({ from, to, closed: false });
      }
    }
    return out;
  }, [slots]);

  const ticks = [0, 6, 12, 18, 24];

  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 p-3">
      <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" /> Weekly schedule
        </span>
        <span className="tabular-nums opacity-70">24h</span>
      </div>

      {/* Hour ruler */}
      <div className="ms-10 mb-1 flex justify-between text-[10px] tabular-nums text-muted-foreground">
        {ticks.map((h) => (
          <span key={h}>{h.toString().padStart(2, "0")}:00</span>
        ))}
      </div>

      <div className="space-y-1.5">
        {DAY_KEYS.map((day) => {
          const rows = byDay[day];
          const hasOpen = rows.some((r) => !r.closed);
          return (
            <div key={day} className="flex items-center gap-2">
              <div
                className={cn(
                  "w-8 shrink-0 text-[11px] font-semibold uppercase tracking-wide",
                  hasOpen ? "text-foreground" : "text-muted-foreground/60",
                )}
              >
                {DAY_LABELS[day]}
              </div>
              <div className="relative h-7 flex-1 overflow-hidden rounded-lg bg-muted/40">
                {/* subtle grid ticks */}
                <div className="pointer-events-none absolute inset-0 flex">
                  {Array.from({ length: 24 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex-1 border-e border-border/30 last:border-e-0"
                    />
                  ))}
                </div>
                {rows.map((r, i) =>
                  r.closed ? null : (
                    <div
                      key={i}
                      className="absolute top-0 h-full rounded-md bg-gradient-to-b from-primary-500/70 to-primary-500 shadow-[0_0_0_1px_var(--color-primary-500)/30]"
                      style={{
                        left: `${(r.from / 24) * 100}%`,
                        width: `${Math.max(1, ((r.to - r.from) / 24) * 100)}%`,
                      }}
                      title={`${r.from.toFixed(2)}h – ${r.to.toFixed(2)}h`}
                    />
                  ),
                )}
                {!hasOpen && (
                  <div className="absolute inset-0 grid place-items-center text-[10px] uppercase tracking-wider text-muted-foreground/70">
                    Closed
                  </div>
                )}
              </div>
              <div className="w-24 shrink-0 truncate text-end text-[11px] tabular-nums text-muted-foreground">
                {rows
                  .filter((r) => !r.closed)
                  .map((r) => `${fmt(r.from)}–${fmt(r.to)}`)
                  .join(", ") || "—"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function fmt(h: number) {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${hh.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}`;
}
