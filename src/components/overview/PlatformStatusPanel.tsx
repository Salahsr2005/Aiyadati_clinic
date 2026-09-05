import { motion } from "framer-motion";
import { ShieldCheck, Stethoscope, Building2, CalendarCheck, CheckCircle2, Clock } from "lucide-react";
import { GlassCard } from "@/components/glass/GlassCard";

export interface PlatformStatusPanelProps {
  loading?: boolean;
  onlineDoctors?: number;
  inProgressAppts?: number;
  pendingDoctorVerifications?: number;
  pendingClinicVerifications?: number;
  systemStatus?: "operational" | "degraded" | "maintenance";
  completionRate?: number;
  cancelledToday?: number;
}

export function PlatformStatusPanel({
  loading = false,
  onlineDoctors = 0,
  inProgressAppts = 0,
  pendingDoctorVerifications = 0,
  pendingClinicVerifications = 0,
  systemStatus = "operational",
  completionRate = 0,
  cancelledToday = 0,
}: PlatformStatusPanelProps) {
  const statusConfig = {
    operational: { label: "System Operational", color: "var(--success)" },
    degraded: { label: "Degraded Performance", color: "var(--warning)" },
    maintenance: { label: "Maintenance Mode", color: "var(--danger)" },
  };

  const currentStatus = statusConfig[systemStatus];

  if (loading) {
    return (
      <GlassCard className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6 p-4 animate-pulse">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-14 bg-muted/20 rounded-xl" />
        ))}
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-4 shadow-sm border border-border/40">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Status Cockpit Header */}
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-3 w-3">
            <span
              className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
              style={{ backgroundColor: currentStatus.color }}
            />
            <span
              className="relative inline-flex h-3 w-3 rounded-full"
              style={{ backgroundColor: currentStatus.color }}
            />
          </span>
          <div className="text-xs font-bold tracking-wide uppercase text-foreground">
            {currentStatus.label}
          </div>
        </div>

        {/* Live Grid Metrics */}
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-2xl bg-background/30 ring-1 ring-border/20">
            <Stethoscope className="h-4 w-4 text-info" />
            <div>
              <div className="text-[10px] text-muted-foreground font-semibold uppercase">Active Doctors</div>
              <div className="text-sm font-bold tabular-nums">{onlineDoctors}</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-2xl bg-background/30 ring-1 ring-border/20">
            <Clock className="h-4 w-4 text-warning" />
            <div>
              <div className="text-[10px] text-muted-foreground font-semibold uppercase">In-Progress</div>
              <div className="text-sm font-bold tabular-nums">{inProgressAppts}</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-2xl bg-background/30 ring-1 ring-border/20">
            <ShieldCheck className="h-4 w-4 text-primary-500" />
            <div>
              <div className="text-[10px] text-muted-foreground font-semibold uppercase">Dr Verifications</div>
              <div className="text-sm font-bold tabular-nums text-primary-500">
                {pendingDoctorVerifications}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-2xl bg-background/30 ring-1 ring-border/20">
            <Building2 className="h-4 w-4 text-success" />
            <div>
              <div className="text-[10px] text-muted-foreground font-semibold uppercase">Clinic Verifies</div>
              <div className="text-sm font-bold tabular-nums text-success">
                {pendingClinicVerifications}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-2xl bg-background/30 ring-1 ring-border/20 col-span-2 sm:col-span-1">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <div>
              <div className="text-[10px] text-muted-foreground font-semibold uppercase">Completion Rate</div>
              <div className="text-sm font-bold tabular-nums">{completionRate}%</div>
            </div>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
