import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  RadialBarChart,
  RadialBar,
  Legend,
} from "recharts";
import { Users, MapPin, Shield } from "lucide-react";
import { GlassCard } from "@/components/glass/GlassCard";
import { Skeleton } from "@/components/glass/Skeleton";
import type { UserRow } from "@/api/usersApi";

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

function tooltipStyle() {
  return {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    fontSize: 12,
    color: "var(--popover-foreground)",
  } as const;
}

export interface PatientAnalyticsProps {
  usersList?: UserRow[];
  usersStats?: {
    byTrustLevel?: { level: string; count: number }[];
    byWilaya?: { wilayaId: string | number; wilayaName?: string; count: number }[];
  };
  loading?: boolean;
}

export function PatientAnalytics({
  usersList = [],
  usersStats,
  loading = false,
}: PatientAnalyticsProps) {
  const { t } = useTranslation();

  // 1. Compute Age Demographics Histogram from usersList
  const ageData = useMemo(() => {
    const todayYear = new Date().getFullYear();
    const brackets = {
      "0-18": 0,
      "19-30": 0,
      "31-45": 0,
      "46-60": 0,
      "60+": 0,
    };

    usersList.forEach((u) => {
      const birth = u.dateOfBirth;
      if (!birth) return;
      const birthYear = new Date(birth).getFullYear();
      if (!birthYear || Number.isNaN(birthYear)) return;
      const age = todayYear - birthYear;

      if (age <= 18) brackets["0-18"]++;
      else if (age <= 30) brackets["19-30"]++;
      else if (age <= 45) brackets["31-45"]++;
      else if (age <= 60) brackets["46-60"]++;
      else brackets["60+"]++;
    });

    return Object.entries(brackets).map(([range, count]) => ({
      range,
      count,
    }));
  }, [usersList]);

  // 2. Trust Level Split
  const trustData = useMemo(() => {
    const raw = usersStats?.byTrustLevel ?? [];
    return raw.map((item, i) => ({
      name: `Level ${item.level}`,
      count: item.count,
      fill: CHART_PALETTE[i % CHART_PALETTE.length],
    }));
  }, [usersStats]);

  // 3. Wilaya distribution (Top 8)
  const wilayaData = useMemo(() => {
    const raw = usersStats?.byWilaya ?? [];
    return raw.slice(0, 8).map((w) => ({
      name: w.wilayaName || `Wilaya ${w.wilayaId}`,
      count: w.count,
    }));
  }, [usersStats]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-[300px]" />
        <Skeleton className="h-[300px]" />
        <Skeleton className="h-[300px]" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Age Brackets histogram */}
      <GlassCard className="border border-border/40 shadow-sm flex flex-col justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm font-bold tracking-tight">
            <Users className="h-4 w-4 text-primary-500" />
            Demographics (Age Groups)
          </div>
          <div className="text-[10px] text-muted-foreground font-semibold">
            Patient age distribution brackets (active users)
          </div>
        </div>

        <div className="h-56 mt-4">
          {usersList.length === 0 ? (
            <div className="grid h-full w-full place-items-center text-xs text-muted-foreground border border-dashed border-border/40 rounded-3xl">
              No birthdate records found
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ageData} margin={{ left: -10, right: 10, top: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
                <XAxis dataKey="range" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={10} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle()} />
                <Bar dataKey="count" fill="var(--primary-500)" radius={[4, 4, 0, 0]}>
                  {ageData.map((_, i) => (
                    <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </GlassCard>

      {/* Trust levels radial chart */}
      <GlassCard className="border border-border/40 shadow-sm flex flex-col justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm font-bold tracking-tight">
            <Shield className="h-4 w-4 text-info" />
            Patient Trust Scores
          </div>
          <div className="text-[10px] text-muted-foreground font-semibold">
            Patient trust index rating levels
          </div>
        </div>

        <div className="h-56 flex items-center justify-center">
          {trustData.length === 0 ? (
            <div className="text-xs text-muted-foreground">No trust data</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart innerRadius="25%" outerRadius="90%" data={trustData} startAngle={90} endAngle={-270}>
                <RadialBar background dataKey="count" cornerRadius={6} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 9 }} />
                <Tooltip contentStyle={tooltipStyle()} />
              </RadialBarChart>
            </ResponsiveContainer>
          )}
        </div>
      </GlassCard>

      {/* Top locations Wilaya bar chart */}
      <GlassCard className="border border-border/40 shadow-sm flex flex-col justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm font-bold tracking-tight">
            <MapPin className="h-4 w-4 text-success" />
            Patient Geographic Spread
          </div>
          <div className="text-[10px] text-muted-foreground font-semibold">
            Top Algerian wilayas by patient count
          </div>
        </div>

        <div className="h-56 mt-4">
          {wilayaData.length === 0 ? (
            <div className="grid h-full w-full place-items-center text-xs text-muted-foreground border border-dashed border-border/40 rounded-3xl">
              No geographical data
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={wilayaData} layout="vertical" margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
                <XAxis type="number" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} />
                <YAxis type="category" dataKey="name" stroke="var(--muted-foreground)" width={70} fontSize={9} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle()} />
                <Bar dataKey="count" fill="var(--success)" radius={[0, 4, 4, 0]}>
                  {wilayaData.map((_, i) => (
                    <Cell key={i} fill={CHART_PALETTE[(i + 2) % CHART_PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </GlassCard>
    </div>
  );
}
