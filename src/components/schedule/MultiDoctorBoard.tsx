import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueries } from "@/lib/queryClient";
import { AlertTriangle, DoorOpen, Search, Users, CheckCircle2, Ban } from "lucide-react";
import { GlassCard } from "@/components/glass/GlassCard";
import { RemoteImage } from "@/components/common/RemoteImage";
import { clinicAppointmentsApi, type DoctorSlot } from "@/api/clinicAppointmentsApi";
import { qk } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";
import { getDoctorColor } from "@/lib/doctorColor";
import { detectRoomConflicts, type SlotConflict } from "@/lib/scheduleConflicts";
import type { DoctorCardItem } from "@/components/doctors/DoctorSelectorModal";

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 08:00–20:00, matches DoctorScheduleHeatmap's PEAK range

function hourLabel(h: number) {
  return h === 12 ? "12p" : h > 12 ? `${h - 12}p` : `${h}a`;
}

interface MultiDoctorBoardProps {
  doctors: DoctorCardItem[];
  selectedDate: string;
  onSelectDoctor: (doctorId: string) => void;
}

export function MultiDoctorBoard({ doctors, selectedDate, onSelectDoctor }: MultiDoctorBoardProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [conflictsOnly, setConflictsOnly] = useState(false);

  // One query per doctor for the selected date — small N (a clinic's roster), cached per doctor+date.
  const slotQueries = useQueries({
    queries: doctors.map((d) => ({
      queryKey: qk.clinicSelf.doctorSlots(d.doctorId, { date: selectedDate }),
      queryFn: () => clinicAppointmentsApi.getDoctorSlots(d.doctorId, { date: selectedDate }),
      staleTime: 30_000,
    })),
  });

  const isLoading = slotQueries.some((q) => q.isLoading);

  const slotsByDoctor = useMemo(() => {
    const map = new Map<string, DoctorSlot[]>();
    doctors.forEach((d, i) => map.set(d.doctorId, (slotQueries[i]?.data as DoctorSlot[]) ?? []));
    return map;
  }, [doctors, slotQueries]);

  const allSlotsToday = useMemo(() => Array.from(slotsByDoctor.values()).flat(), [slotsByDoctor]);

  const conflicts = useMemo(() => detectRoomConflicts(allSlotsToday), [allSlotsToday]);

  const conflictedDoctorIds = useMemo(() => {
    const set = new Set<string>();
    conflicts.forEach((c) => {
      set.add(c.slotA.doctorId);
      set.add(c.slotB.doctorId);
    });
    return set;
  }, [conflicts]);

  const visibleDoctors = useMemo(() => {
    let list = doctors;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((d) => d.name.toLowerCase().includes(q) || (d.specialty || "").toLowerCase().includes(q));
    }
    if (conflictsOnly) {
      list = list.filter((d) => conflictedDoctorIds.has(d.doctorId));
    }
    return list;
  }, [doctors, search, conflictsOnly, conflictedDoctorIds]);

  const cellStatus = (slots: DoctorSlot[], hour: number) => {
    const inHour = slots.filter((s) => parseInt(s.startTime?.slice(0, 2) || "-1", 10) === hour);
    if (inHour.length === 0) return "EMPTY";
    const active = inHour.filter((s) => String(s.status || "").toLowerCase() !== "cancelled" && !s.isCancelled);
    if (active.length === 0) return "CANCELLED";
    const patients = active.reduce((a, s) => a + (s.currentPatients || 0), 0);
    const cap = active.reduce((a, s) => a + (s.maxPatients || 1), 0);
    if (patients >= cap) return "FULL";
    if (patients > 0) return "PARTIAL";
    return "AVAILABLE";
  };

  return (
    <div className="space-y-4">
      {/* Conflict banner — only rendered when something actually needs attention */}
      {conflicts.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-rose-500 mt-0.5" />
          <div className="flex-1 space-y-1.5">
            <p className="text-sm font-bold text-rose-600 dark:text-rose-400">
              {conflicts.length} {t("schedule.board.roomConflicts", { defaultValue: "room double-booking conflict(s) on this date" })}
            </p>
            <div className="space-y-1">
              {conflicts.slice(0, 4).map((c, i) => (
                <ConflictLine key={i} conflict={c} doctors={doctors} />
              ))}
              {conflicts.length > 4 && (
                <p className="text-xs text-rose-500/80">+{conflicts.length - 4} more</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setConflictsOnly((v) => !v)}
            className={cn(
              "shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer",
              conflictsOnly ? "bg-rose-500 text-white" : "border border-rose-500/40 text-rose-500 hover:bg-rose-500/10",
            )}
          >
            {conflictsOnly ? t("schedule.board.showAll", { defaultValue: "Show all doctors" }) : t("schedule.board.filterConflicted", { defaultValue: "Show only conflicted" })}
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:w-64">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("schedule.board.searchDoctor", { defaultValue: "Find a doctor…" })}
            className="glass w-full rounded-xl ps-8 pe-3 py-2 text-xs font-semibold outline-none border border-border/40 focus:border-primary-500"
          />
        </div>
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          <Users className="h-3.5 w-3.5" /> {visibleDoctors.length} / {doctors.length}
        </div>
      </div>

      {/* Board */}
      <GlassCard className="p-4 border border-border/40 overflow-x-auto custom-scrollbar">
        <div className="min-w-[880px]">
          {/* Hour ruler */}
          <div className="flex items-center pb-2 border-b border-border/30">
            <div className="w-56 shrink-0" />
            <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${HOURS.length}, minmax(0,1fr))` }}>
              {HOURS.map((h) => (
                <div key={h} className="text-center text-[9px] font-bold text-muted-foreground/70">
                  {hourLabel(h)}
                </div>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="py-10 text-center text-xs text-muted-foreground">
              {t("common.loading", { defaultValue: "Loading…" })}
            </div>
          ) : visibleDoctors.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground">
              {t("schedule.board.noMatch", { defaultValue: "No doctors match this filter." })}
            </div>
          ) : (
            <div className="mt-2 space-y-1.5">
              {visibleDoctors.map((doc) => {
                const color = getDoctorColor(doc.doctorId);
                const slots = slotsByDoctor.get(doc.doctorId) ?? [];
                const hasConflict = conflictedDoctorIds.has(doc.doctorId);
                return (
                  <div
                    key={doc.doctorId}
                    className={cn(
                      "flex items-center rounded-2xl border p-2 transition",
                      hasConflict ? "border-rose-500/50 bg-rose-500/5" : "border-border/30 bg-muted/10 hover:bg-muted/20",
                    )}
                  >
                    {/* Doctor identity — click to jump into single-doctor tabs */}
                    <button
                      type="button"
                      onClick={() => onSelectDoctor(doc.doctorId)}
                      className="w-56 shrink-0 flex items-center gap-2.5 text-start px-1.5 py-1 rounded-xl hover:bg-accent/40 transition cursor-pointer"
                    >
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color.hex }} />
                      <div className={cn("relative h-8 w-8 shrink-0 rounded-xl overflow-hidden border-2", color.border)}>
                        <RemoteImage src={doc.photoUrl} alt={doc.name} className="h-full w-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-foreground truncate">{doc.name}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{doc.specialty}</div>
                      </div>
                      {hasConflict && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-500" />}
                    </button>

                    {/* Hourly cells, tinted with this doctor's color */}
                    <div className="flex-1 grid gap-1" style={{ gridTemplateColumns: `repeat(${HOURS.length}, minmax(0,1fr))` }}>
                      {HOURS.map((h) => {
                        const status = cellStatus(slots, h);
                        if (status === "EMPTY") {
                          return <div key={h} className="h-6 rounded-md border border-dashed border-border/25 bg-muted/5" />;
                        }
                        const isCancelled = status === "CANCELLED";
                        return (
                          <div
                            key={h}
                            title={`${doc.name} · ${hourLabel(h)} · ${status}`}
                            className={cn(
                              "h-6 rounded-md border flex items-center justify-center",
                              isCancelled ? "border-rose-500/40 bg-rose-500/10" : color.border,
                            )}
                            style={!isCancelled ? { backgroundColor: `${color.hex}26` } : undefined}
                          >
                            {status === "FULL" && <CheckCircle2 className="h-3 w-3" style={{ color: color.hex }} />}
                            {isCancelled && <Ban className="h-3 w-3 text-rose-500" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </GlassCard>
    </div>
  );
}

function ConflictLine({ conflict, doctors }: { conflict: SlotConflict; doctors: DoctorCardItem[] }) {
  const nameOf = (id: string) => doctors.find((d) => d.doctorId === id)?.name ?? id;
  const room = conflict.slotA.room?.name ?? conflict.roomId;
  return (
    <p className="text-xs text-rose-600/90 dark:text-rose-300/90 flex items-center gap-1.5">
      <DoorOpen className="h-3 w-3" />
      <span className="font-bold">{room}</span> · {conflict.slotA.startTime?.slice(0, 5)}–{conflict.slotA.endTime?.slice(0, 5)} ·{" "}
      <span className="font-bold">{nameOf(conflict.slotA.doctorId)}</span> vs{" "}
      <span className="font-bold">{nameOf(conflict.slotB.doctorId)}</span>
    </p>
  );
}
