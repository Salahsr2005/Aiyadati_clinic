import { motion } from "framer-motion";
import { formatDistanceToNow, parseISO } from "date-fns";
import {
  Calendar,
  CheckCircle,
  AlertTriangle,
  UserPlus,
  ShieldCheck,
  Building,
  CreditCard,
  MessageSquare,
  Activity,
  History,
} from "lucide-react";
import { useMemo } from "react";
import { useActivityStore } from "@/store/activity";
import type { AppointmentRow } from "@/api/appointmentsApi";
import { fullDoctorName, fullPatientName } from "@/api/appointmentsApi";
import { GlassCard } from "@/components/glass/GlassCard";

interface TimelineItem {
  id: string;
  timestamp: Date;
  title: string;
  description: string;
  type: "appointment" | "user" | "doctor" | "clinic" | "wallet" | "system" | "support";
  level: "info" | "success" | "warning" | "danger";
  meta?: string;
}

export interface ActivityTimelineProps {
  appointments?: AppointmentRow[];
  maxEntries?: number;
}

export function ActivityTimeline({ appointments = [], maxEntries = 50 }: ActivityTimelineProps) {
  const localEntries = useActivityStore((s) => s.entries);

  const timelineItems = useMemo(() => {
    const list: TimelineItem[] = [];

    // 1. Process recent appointments
    appointments.forEach((appt) => {
      const patient = fullPatientName(appt.patient);
      const doctor = fullDoctorName(appt.doctor);
      const type = appt.status === "CANCELLED" ? "danger" : appt.status === "COMPLETED" ? "success" : "info";

      list.push({
        id: `appt-${appt.id}`,
        timestamp: parseISO(appt.createdAt),
        title: appt.status === "CANCELLED" ? "Appointment Cancelled" : "Appointment Booked",
        description: `${patient || "A Patient"} scheduled ${appt.type || "an appointment"} with Dr. ${doctor || "Ahmed"}`,
        type: "appointment",
        level: type,
        meta: appt.clinic?.nameFr ? `@ ${appt.clinic.nameFr}` : undefined,
      });
    });

    // 2. Process local admin logs
    localEntries.forEach((entry) => {
      let iconType: TimelineItem["type"] = "system";
      if (entry.resource.toLowerCase().includes("doctor")) iconType = "doctor";
      else if (entry.resource.toLowerCase().includes("clinic")) iconType = "clinic";
      else if (entry.resource.toLowerCase().includes("user")) iconType = "user";
      else if (entry.resource.toLowerCase().includes("wallet")) iconType = "wallet";
      else if (entry.resource.toLowerCase().includes("support") || entry.resource.toLowerCase().includes("chat")) iconType = "support";

      list.push({
        id: `local-${entry.id}`,
        timestamp: new Date(entry.ts),
        title: entry.action,
        description: `${entry.actor || "Admin"} updated ${entry.resource} ${entry.target ? `"${entry.target}"` : ""}`,
        type: iconType,
        level: entry.level,
      });
    });

    // Sort descending by timestamp
    return list.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, maxEntries);
  }, [appointments, localEntries, maxEntries]);

  const iconsMap = {
    appointment: Calendar,
    user: UserPlus,
    doctor: ShieldCheck,
    clinic: Building,
    wallet: CreditCard,
    support: MessageSquare,
    system: Activity,
  };

  const levelColor = {
    info: "text-info bg-info/10 ring-info/20",
    success: "text-success bg-success/10 ring-success/20",
    warning: "text-warning bg-warning/10 ring-warning/20",
    danger: "text-danger bg-danger/10 ring-danger/20",
  };

  return (
    <GlassCard className="flex flex-col h-full overflow-hidden border border-border/40 shadow-sm">
      <div className="flex items-center justify-between border-b border-border/40 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-primary-500/10 text-primary-500">
            <History className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight">Live Activity Feed</div>
            <div className="text-[10px] text-muted-foreground font-semibold">Real-time system events</div>
          </div>
        </div>
        <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
          {timelineItems.length} events
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 space-y-4 max-h-[460px] custom-scrollbar">
        {timelineItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground gap-2">
            <Activity className="h-6 w-6 stroke-1.5 opacity-60" />
            <div className="text-xs">No recent activity detected.</div>
          </div>
        ) : (
          timelineItems.map((item, index) => {
            const IconComponent = iconsMap[item.type] || Activity;
            const colors = levelColor[item.level];

            return (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.03, duration: 0.2 }}
                key={item.id}
                className="group relative flex gap-3.5 items-start pl-2 transition-all duration-200"
              >
                {/* Timeline vertical rule line connector */}
                {index < timelineItems.length - 1 && (
                  <div className="absolute left-[21px] top-8 bottom-[-20px] w-px bg-border/40 group-hover:bg-border/60 transition-colors" />
                )}

                {/* Event Type Icon Bubble */}
                <div className={`relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full ring-1 ${colors}`}>
                  <IconComponent className="h-3.5 w-3.5" />
                </div>

                {/* Content Area */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="text-xs font-bold text-foreground truncate group-hover:text-primary-500 transition-colors">
                      {item.title}
                    </div>
                    <div className="text-[9px] font-semibold text-muted-foreground shrink-0 tabular-nums">
                      {formatDistanceToNow(item.timestamp, { addSuffix: true })}
                    </div>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed truncate">
                    {item.description}
                  </div>
                  {item.meta && (
                    <span className="inline-flex mt-1 items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-muted/60 text-muted-foreground ring-1 ring-border/20">
                      {item.meta}
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </GlassCard>
  );
}
