import { useState, useMemo } from "react";
import { CalendarCheck2, Users, Stethoscope, Building2 } from "lucide-react";
import { ActivityHeatmap, aggregateByDate } from "@/components/data/ActivityHeatmap";
import { GlassCard } from "@/components/glass/GlassCard";
import type { DoctorRow } from "@/api/doctorsApi";
import type { ClinicRow } from "@/api/clinicsApi";
import type { UserRow } from "@/api/usersApi";

export interface MultiHeatmapSectionProps {
  appointmentsStats?: { byDate?: { date: string; count: number }[] };
  doctorsList?: DoctorRow[];
  clinicsList?: ClinicRow[];
  usersList?: UserRow[];
}

type HeatmapTab = "appointments" | "registrations" | "providers";

const TABS: { key: HeatmapTab; label: string; icon: typeof CalendarCheck2; tone: "info" | "primary" | "success" }[] = [
  { key: "appointments", label: "Bookings", icon: CalendarCheck2, tone: "info" },
  { key: "registrations", label: "Patients", icon: Users, tone: "primary" },
  { key: "providers", label: "Providers", icon: Stethoscope, tone: "success" },
];

export function MultiHeatmapSection({
  appointmentsStats,
  doctorsList = [],
  clinicsList = [],
  usersList = [],
}: MultiHeatmapSectionProps) {
  const [activeTab, setActiveTab] = useState<HeatmapTab>("appointments");

  // 1. Appointments
  const appointmentsHeatmapData = useMemo(() => {
    return (appointmentsStats?.byDate ?? []).map((d) => ({
      date: (d.date ?? "").slice(0, 10),
      count: d.count,
    }));
  }, [appointmentsStats]);

  // 2. Patient Registrations
  const registrationsHeatmapData = useMemo(() => {
    return aggregateByDate(usersList, (u) => u.createdAt);
  }, [usersList]);

  // 3. Provider onboarding
  const providersHeatmapData = useMemo(() => {
    const doctorsAgg = aggregateByDate(doctorsList, (d) => d.createdAt);
    const clinicsAgg = aggregateByDate(clinicsList, (c) => c.createdAt);
    const mergedMap = new Map<string, number>();
    doctorsAgg.forEach((item) => mergedMap.set(item.date, item.count));
    clinicsAgg.forEach((item) => {
      mergedMap.set(item.date, (mergedMap.get(item.date) ?? 0) + item.count);
    });
    return Array.from(mergedMap.entries()).map(([date, count]) => ({
      date,
      count,
    }));
  }, [doctorsList, clinicsList]);

  // Quick stats for each tab
  const tabStats = useMemo(() => ({
    appointments: appointmentsHeatmapData.reduce((s, d) => s + d.count, 0),
    registrations: registrationsHeatmapData.reduce((s, d) => s + d.count, 0),
    providers: providersHeatmapData.reduce((s, d) => s + d.count, 0),
  }), [appointmentsHeatmapData, registrationsHeatmapData, providersHeatmapData]);

  const activeData = useMemo(() => {
    if (activeTab === "registrations") return registrationsHeatmapData;
    if (activeTab === "providers") return providersHeatmapData;
    return appointmentsHeatmapData;
  }, [activeTab, appointmentsHeatmapData, registrationsHeatmapData, providersHeatmapData]);

  const config = {
    appointments: {
      title: "Appointment Booking Activity",
      subtitle: "Daily booking volumes across the platform — identify peak days and seasonal trends",
    },
    registrations: {
      title: "Patient Registration Trend",
      subtitle: "Daily patient signups showing growth velocity and user acquisition patterns",
    },
    providers: {
      title: "Provider Onboarding Activity",
      subtitle: "Combined doctor and clinic registration activity over time",
    },
  };

  return (
    <GlassCard className="p-0 border border-border/40 shadow-sm overflow-hidden">
      {/* Tab bar header */}
      <div className="flex items-stretch border-b border-border/40">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`
                group relative flex-1 flex items-center justify-center gap-2 px-4 py-3.5 
                text-xs font-bold transition-all cursor-pointer
                ${isActive
                  ? "text-foreground bg-background/50"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                }
              `}
            >
              <Icon className={`h-3.5 w-3.5 shrink-0 transition-colors ${isActive ? "text-primary-500" : "text-muted-foreground/60 group-hover:text-muted-foreground"}`} />
              <span>{tab.label}</span>
              <span className={`
                ms-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums transition-colors
                ${isActive
                  ? "bg-primary-500/10 text-primary-500"
                  : "bg-muted/50 text-muted-foreground"
                }
              `}>
                {tabStats[tab.key].toLocaleString()}
              </span>

              {/* Active indicator line */}
              {isActive && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary-500 rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* Heatmap body */}
      <div className="p-5">
        <ActivityHeatmap
          data={activeData}
          weeks={52}
          tone={TABS.find((t) => t.key === activeTab)!.tone}
          title={config[activeTab].title}
          subtitle={config[activeTab].subtitle}
          className="border-0 p-0 bg-transparent backdrop-blur-none"
        />
      </div>
    </GlassCard>
  );
}
