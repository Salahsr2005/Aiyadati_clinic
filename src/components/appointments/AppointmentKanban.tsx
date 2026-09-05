import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { AppointmentCard } from "./AppointmentCard";
import type { AppointmentRow, AppointmentStatus } from "@/api/appointmentsApi";
import confirmedArt from "@/assets/appointments/confirmed.png";
import pendingArt from "@/assets/appointments/pending.png";
import cancelledArt from "@/assets/appointments/cancelled.png";
import upcomingArt from "@/assets/appointments/upcoming.png";
import timelineArt from "@/assets/appointments/timeline.png";
import noApptArt from "@/assets/appointments/no-appointment.png";

const COLUMNS: { key: AppointmentStatus; art: string; tone: string }[] = [
  { key: "PENDING", art: pendingArt, tone: "border-warning/30 bg-warning/5" },
  { key: "CONFIRMED", art: confirmedArt, tone: "border-info/30 bg-info/5" },
  { key: "IN_PROGRESS", art: upcomingArt, tone: "border-warning/30 bg-warning/5" },
  { key: "COMPLETED", art: timelineArt, tone: "border-success/30 bg-success/5" },
  { key: "CANCELLED", art: cancelledArt, tone: "border-danger/30 bg-danger/5" },
  { key: "NO_SHOW", art: noApptArt, tone: "border-border bg-muted/20" },
];

export function AppointmentKanban({
  rows,
  onOpen,
  hideDoctor,
}: {
  rows: AppointmentRow[];
  onOpen: (a: AppointmentRow) => void;
  hideDoctor?: boolean;
}) {
  const { t } = useTranslation();
  const groups = useMemo(() => {
    const map: Record<string, AppointmentRow[]> = {};
    for (const c of COLUMNS) map[c.key] = [];
    for (const r of rows) {
      const k = String(r.status || "PENDING").toUpperCase();
      if (!map[k]) map[k] = [];
      map[k].push(r);
    }
    return map;
  }, [rows]);

  return (
    <div className="flex gap-4 overflow-x-auto pb-3">
      {COLUMNS.map((c) => {
        const items = groups[c.key] ?? [];
        return (
          <div key={c.key} className={`min-w-[300px] max-w-[320px] flex-1 rounded-3xl border ${c.tone} p-3`}>
            <div className="mb-3 flex items-center gap-3">
              <img src={c.art} alt="" className="h-10 w-10 object-contain" />
              <div className="flex-1">
                <div className="text-sm font-semibold">{t(`status.${c.key}`)}</div>
                <div className="text-[11px] text-muted-foreground">{items.length} {items.length === 1 ? "appt" : "appts"}</div>
              </div>
            </div>
            <div className="space-y-3">
              {items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/60 p-6 text-center text-[11px] text-muted-foreground">
                  {t("appt.kanban.empty")}
                </div>
              ) : (
                items.map((a) => <AppointmentCard key={a.id} appt={a} onClick={() => onOpen(a)} hideDoctor={hideDoctor} />)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}