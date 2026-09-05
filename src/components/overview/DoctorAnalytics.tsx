import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ResponsiveContainer, Treemap } from "recharts";
import { Stethoscope, Award, FileSpreadsheet, ShieldAlert } from "lucide-react";
import { GlassCard } from "@/components/glass/GlassCard";
import { Skeleton } from "@/components/glass/Skeleton";
import type { DoctorRow } from "@/api/doctorsApi";
import type { ClinicRow } from "@/api/clinicsApi";
import { pickLocaleField } from "@/lib/pickLocale";
import { useUIStore } from "@/store/ui";

const CHART_PALETTE = [
  "var(--primary-500)",
  "var(--info)",
  "var(--success)",
  "var(--warning)",
  "var(--danger)",
  "#a78bfa",
  "#f472b6",
  "#22d3ee",
  "#facc15",
  "#34d399",
];

interface LeaderRowProps {
  name: string;
  photo?: string;
  value: number;
  max: number;
  rank?: number;
  suffix?: string;
}

function LeaderRow({ name, photo, value, max, rank, suffix }: LeaderRowProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="glass flex items-center gap-3 rounded-2xl p-2.5 hover:bg-muted/10 transition-colors">
      {rank !== undefined && (
        <div className="grid h-6 w-6 place-items-center rounded-full bg-primary-500/10 text-[10px] font-bold text-primary-500 shrink-0">
          {rank}
        </div>
      )}
      {photo ? (
        <img src={photo} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
      ) : (
        <div className="grid h-8 w-8 place-items-center rounded-full bg-primary-500 text-[10px] font-bold text-white shrink-0">
          {(name || "?").trim().slice(0, 2).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-bold">{name.trim() || "—"}</div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted/40">
          <div className="h-full rounded-full bg-primary-500" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="text-xs font-bold tabular-nums ml-2">
        {typeof value === "number" ? value.toLocaleString() : value}
        {suffix ? <span className="ml-0.5 text-warning">{suffix}</span> : null}
      </div>
    </div>
  );
}

type TreemapProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  size?: number;
  fill?: string;
};

function TreemapContent(props: TreemapProps) {
  const { x = 0, y = 0, width = 0, height = 0, name, size, fill } = props;
  if (width < 2 || height < 2) return null;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={6} ry={6} fill={fill ?? "var(--primary-500)"} stroke="var(--background)" strokeWidth={1.5} />
      {width > 60 && height > 28 && (
        <>
          <text x={x + 6} y={y + 16} fill="white" fontSize={10} fontWeight={600}>
            {name}
          </text>
          <text x={x + 6} y={y + 28} fill="white" fontSize={9} opacity={0.8}>
            {size}
          </text>
        </>
      )}
    </g>
  );
}

export interface DoctorAnalyticsProps {
  doctorsList?: DoctorRow[];
  clinicsList?: ClinicRow[];
  topDoctors?: any[];
  topClinics?: any[];
  loading?: boolean;
}

export function DoctorAnalytics({
  doctorsList = [],
  clinicsList = [],
  topDoctors = [],
  topClinics = [],
  loading = false,
}: DoctorAnalyticsProps) {
  const { t } = useTranslation();
  const { locale } = useUIStore();
  const [topTab, setTopTab] = useState<"appointments" | "rating">("appointments");

  // 1. Calculate Verification pipeline pipeline
  const verifiedDoctors = useMemo(() => doctorsList.filter((d) => d.isVerified).length, [doctorsList]);
  const unverifiedDoctors = useMemo(() => doctorsList.filter((d) => !d.isVerified).length, [doctorsList]);
  const verifyRatio = useMemo(() => {
    const total = verifiedDoctors + unverifiedDoctors;
    return total > 0 ? Math.round((verifiedDoctors / total) * 100) : 100;
  }, [verifiedDoctors, unverifiedDoctors]);

  // 2. Doctor specialties treemap mix
  const specialtyTree = useMemo(() => {
    const map: Record<string, number> = {};
    doctorsList.forEach((d) => {
      const specs = d.specialties ?? [];
      specs.forEach((s) => {
        const name = pickLocaleField(s.specialty as unknown as Record<string, unknown>, "name", locale) || "General";
        map[name] = (map[name] || 0) + 1;
      });
    });

    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, size], i) => ({
        name,
        size,
        fill: CHART_PALETTE[i % CHART_PALETTE.length],
      }));
  }, [doctorsList, locale]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-[320px]" />
        <Skeleton className="lg:col-span-2 h-[320px]" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* 1. Specialties Treemap card */}
      <GlassCard className="border border-border/40 shadow-sm flex flex-col justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm font-bold tracking-tight">
            <Stethoscope className="h-4 w-4 text-primary-500" />
            Specialties Mix
          </div>
          <div className="text-[10px] text-muted-foreground font-semibold">
            Primary specialization breakdown (active list)
          </div>
        </div>

        <div className="h-48 my-3">
          {specialtyTree.length === 0 ? (
            <div className="grid h-full w-full place-items-center text-xs text-muted-foreground border border-dashed border-border/40 rounded-3xl">
              No specialty data found
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <Treemap
                data={specialtyTree}
                dataKey="size"
                stroke="var(--background)"
                content={<TreemapContent />}
              />
            </ResponsiveContainer>
          )}
        </div>

        {/* 2. Verification status pipeline */}
        <div className="border-t border-border/40 pt-3">
          <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground mb-1">
            <span>VERIFICATION STATUS</span>
            <span>{verifyRatio}% VERIFIED</span>
          </div>
          <div className="h-2 w-full bg-muted/40 rounded-full overflow-hidden flex">
            <div className="bg-success h-full" style={{ width: `${verifyRatio}%` }} />
            <div className="bg-warning h-full" style={{ width: `${100 - verifyRatio}%` }} />
          </div>
          <div className="flex justify-between text-[9px] font-bold mt-1 text-muted-foreground">
            <span className="text-success">{verifiedDoctors} Verified</span>
            <span className="text-warning">{unverifiedDoctors} Pending</span>
          </div>
        </div>
      </GlassCard>

      {/* 3. Leaders Leaderboard */}
      <GlassCard className="lg:col-span-2 border border-border/40 shadow-sm flex flex-col justify-between">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-3">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-info" />
            <div>
              <div className="text-sm font-bold tracking-tight">Top Performers Leaderboard</div>
              <div className="text-[10px] text-muted-foreground font-semibold">Rankings of doctors & clinics</div>
            </div>
          </div>

          <div className="glass inline-flex rounded-full p-1 text-xs">
            <button
              onClick={() => setTopTab("appointments")}
              className={`rounded-full px-3 py-1 cursor-pointer transition-colors ${
                topTab === "appointments" ? "bg-primary-500 text-white font-semibold" : "text-foreground/70 hover:text-foreground"
              }`}
            >
              Bookings
            </button>
            <button
              onClick={() => setTopTab("rating")}
              className={`rounded-full px-3 py-1 cursor-pointer transition-colors ${
                topTab === "rating" ? "bg-primary-500 text-white font-semibold" : "text-foreground/70 hover:text-foreground"
              }`}
            >
              Ratings
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Doctors Leaderboard Column */}
          {(() => {
            const isRating = topTab === "rating";
            return (
              <div>
                <div className="mb-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Top Doctors</div>
                <div className="space-y-2">
                  {topDoctors.slice(0, 4).map((d, i) => (
                    <LeaderRow
                      key={d.doctorId || i}
                      rank={i + 1}
                      name={d.doctorName || "Doctor"}
                      value={isRating ? d.avgRating ?? 0 : d.count ?? 0}
                      max={isRating ? 5 : Math.max(1, ...topDoctors.map((x) => x.count ?? 0))}
                      suffix={isRating ? "★" : ""}
                    />
                  ))}
                  {topDoctors.length === 0 && (
                    <div className="text-xs text-muted-foreground py-6 text-center">No doctor statistics</div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Clinics Leaderboard Column */}
          {(() => {
            const isRating = topTab === "rating";
            return (
              <div>
                <div className="mb-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Top Clinics</div>
                <div className="space-y-2">
                  {topClinics.slice(0, 4).map((c, i) => (
                    <LeaderRow
                      key={c.clinicId || i}
                      rank={i + 1}
                      name={c.clinicName || "Clinic"}
                      value={isRating ? c.avgRating ?? 0 : c.count ?? 0}
                      max={isRating ? 5 : Math.max(1, ...topClinics.map((x) => x.count ?? 0))}
                      suffix={isRating ? "★" : ""}
                    />
                  ))}
                  {topClinics.length === 0 && (
                    <div className="text-xs text-muted-foreground py-6 text-center">No clinic statistics</div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </GlassCard>
    </div>
  );
}
