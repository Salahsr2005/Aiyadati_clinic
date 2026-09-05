import { useMemo } from "react";
import { AlertCircle, AlertTriangle, Lightbulb, TrendingUp } from "lucide-react";
import { GlassCard } from "@/components/glass/GlassCard";
import type { AppointmentRow } from "@/api/appointmentsApi";
import type { DoctorRow } from "@/api/doctorsApi";
import type { ClinicRow } from "@/api/clinicsApi";
import type { UserRow } from "@/api/usersApi";
import { fullDoctorName } from "@/api/appointmentsApi";

export interface OperationalInsight {
  id: string;
  type: "growth" | "warning" | "alert" | "info";
  title: string;
  description: string;
}

export interface InsightCardsProps {
  appointments?: AppointmentRow[];
  doctors?: DoctorRow[];
  clinics?: ClinicRow[];
  users?: UserRow[];
}

export function InsightCards({
  appointments = [],
  doctors = [],
  clinics = [],
  users = [],
}: InsightCardsProps) {
  const insights = useMemo(() => {
    const list: OperationalInsight[] = [];

    // 1. Compute High Demand Specialty Insight
    const specialtyMap: Record<string, number> = {};
    let totalAppointments = appointments.length;

    appointments.forEach((appt) => {
      const specs = (appt.doctor as any)?.specialties ?? [];
      specs.forEach((s: any) => {
        const name = s.specialty?.nameFr || "General";
        specialtyMap[name] = (specialtyMap[name] || 0) + 1;
      });
    });

    const sortedSpecs = Object.entries(specialtyMap).sort((a, b) => b[1] - a[1]);
    if (sortedSpecs.length > 0 && totalAppointments > 0) {
      const [topSpec, count] = sortedSpecs[0];
      const pct = Math.round((count / totalAppointments) * 100);
      list.push({
        id: "insight-specialty-demand",
        type: "growth",
        title: "High Demand Specialty Area",
        description: `${topSpec} represents ${pct}% of all appointments this period, signaling an area for clinic acquisition.`,
      });
    }

    // 2. High Cancellation Rate warning
    const cancelledCount = appointments.filter((a) => a.status === "CANCELLED").length;
    if (totalAppointments > 0) {
      const cancelPct = Math.round((cancelledCount / totalAppointments) * 100);
      if (cancelPct > 15) {
        list.push({
          id: "insight-cancellations",
          type: "warning",
          title: "Elevated Cancellation Rate",
          description: `Platform cancellations are at ${cancelPct}%. Consider reviewing slot confirmation timing or enabling SMS reminders.`,
        });
      }
    }

    // 3. Verification backlogs
    const unverifiedClinics = clinics.filter((c) => !c.isVerified).length;
    const unverifiedDoctors = doctors.filter((d) => !d.isVerified).length;
    if (unverifiedClinics > 0 || unverifiedDoctors > 0) {
      list.push({
        id: "insight-verifications",
        type: "alert",
        title: "Registration Backlog Detected",
        description: `There are ${unverifiedDoctors} doctors and ${unverifiedClinics} clinics awaiting administrative verification.`,
      });
    }

    // 4. Patients Trust Anomalies
    const noShowPatients = users.filter((u) => (u.noShowCount ?? 0) >= 3);
    if (noShowPatients.length > 0) {
      list.push({
        id: "insight-trust",
        type: "warning",
        title: "Suspicious No-Show Patterns",
        description: `${noShowPatients.length} patients have accumulated 3+ no-shows. Trust tiers should be audited or accounts suspended.`,
      });
    }

    // Fallback default insight
    if (list.length === 0) {
      list.push({
        id: "insight-default",
        type: "info",
        title: "System Performance Optimized",
        description: "Platform operations running within normal baseline bounds. No anomalies or operational bottlenecks detected.",
      });
    }

    return list;
  }, [appointments, doctors, clinics, users]);

  const typeConfig = {
    growth: { icon: TrendingUp, color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
    warning: { icon: AlertTriangle, color: "text-warning bg-warning/10 border-warning/20" },
    alert: { icon: AlertCircle, color: "text-danger bg-danger/10 border-danger/20" },
    info: { icon: Lightbulb, color: "text-info bg-info/10 border-info/20" },
  };

  return (
    <GlassCard className="flex flex-col h-full border border-border/40 shadow-sm">
      <div className="flex items-center gap-2 border-b border-border/40 pb-3 mb-4">
        <div className="grid h-7 w-7 place-items-center rounded-lg bg-primary-500/10 text-primary-500">
          <Lightbulb className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-bold tracking-tight">Operational Insights</div>
          <div className="text-[10px] text-muted-foreground font-semibold">AI-derived platform recommendation engine</div>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto max-h-[460px] pr-1 custom-scrollbar">
        {insights.map((insight) => {
          const config = typeConfig[insight.type];
          const Icon = config.icon;

          return (
            <div
              key={insight.id}
              className={`flex gap-3 p-3 rounded-2xl border ${config.color} transition-all duration-200 hover:scale-[1.01]`}
            >
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-background/50">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-foreground">
                  {insight.title}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                  {insight.description}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
