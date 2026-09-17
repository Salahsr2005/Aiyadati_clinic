import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueries } from "@/lib/queryClient";
import { AlertTriangle, DoorOpen, Search, Users, CheckCircle2, Ban, Clock, CalendarDays, Sparkles, ChevronRight } from "lucide-react";
import { GlassCard } from "@/components/glass/GlassCard";
import { RemoteImage } from "@/components/common/RemoteImage";
import { Skeleton } from "@/components/glass/Skeleton";
import { clinicAppointmentsApi, type DoctorSlot } from "@/api/clinicAppointmentsApi";
import { qk } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";
import { getDoctorColor } from "@/lib/doctorColor";
import { detectRoomConflicts, type SlotConflict } from "@/lib/scheduleConflicts";
import type { DoctorCardItem } from "@/components/doctors/DoctorSelectorModal";

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 08:00–20:00

function hourLabel(h: number) {
  const suffix = h >= 12 ? "p" : "a";
  const display = h === 12 ? 12 : h > 12 ? h - 12 : h;
  return `${display}${suffix}`;
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
  const [hoveredCell, setHoveredCell] = useState<{ doctorId: string; hour: number; x: number; y: number } | null>(null);

  // One query per doctor for the selected date
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

  // Compute per-doctor stats
  const doctorStats = useMemo(() => {
    const stats = new Map<string, { available: number; booked: number; cancelled: number; total: number }>();
    doctors.forEach((d) => {
      const slots = slotsByDoctor.get(d.doctorId) ?? [];
      let available = 0, booked = 0, cancelled = 0;
      slots.forEach((s) => {
        const st = String(s.status || "").toLowerCase();
        if (st === "cancelled" || s.isCancelled) cancelled++;
        else if (st === "full" || st === "booked" || s.isBooked) booked++;
        else available++;
      });
      stats.set(d.doctorId, { available, booked, cancelled, total: slots.length });
    });
    return stats;
  }, [doctors, slotsByDoctor]);

  // Global totals
  const globalStats = useMemo(() => {
    let available = 0, booked = 0, cancelled = 0, total = 0;
    doctorStats.forEach((s) => {
      available += s.available;
      booked += s.booked;
      cancelled += s.cancelled;
      total += s.total;
    });
    return { available, booked, cancelled, total };
  }, [doctorStats]);

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

  const getCellSlots = (doctorId: string, hour: number) => {
    const slots = slotsByDoctor.get(doctorId) ?? [];
    return slots.filter((s) => parseInt(s.startTime?.slice(0, 2) || "-1", 10) === hour);
  };

  return (
    <div className="space-y-4">
      {/* Clinic Summary Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-border/40 bg-card/60 p-3 text-center">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{t("schedule.totalSlots", { defaultValue: "Total Slots" })}</div>
          <div className="text-xl font-black text-foreground font-mono mt-0.5">{globalStats.total}</div>
        </div>
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">{t("schedule.availableSlots", { defaultValue: "Available" })}</div>
          <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">{globalStats.available}</div>
        </div>
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3 text-center">
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">{t("schedule.bookedSlots", { defaultValue: "Booked" })}</div>
          <div className="text-xl font-black text-amber-600 dark:text-amber-400 font-mono mt-0.5">{globalStats.booked}</div>
        </div>
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-3 text-center">
          <div className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">{t("schedule.cancelledSlots", { defaultValue: "Cancelled" })}</div>
          <div className="text-xl font-black text-rose-600 dark:text-rose-400 font-mono mt-0.5">{globalStats.cancelled}</div>
        </div>
      </div>

      {/* Conflict banner */}
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
        <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> {visibleDoctors.length} / {doctors.length} {t("doctors.title", { defaultValue: "Doctors" })}</span>
          <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> {selectedDate}</span>
        </div>
      </div>

      {/* Board Grid */}
      <GlassCard className="p-4 border border-border/40 overflow-x-auto custom-scrollbar">
        <div className="min-w-[880px]">
          {/* Hour ruler */}
          <div className="flex items-center pb-2 border-b border-border/30">
            <div className="w-64 shrink-0 text-[10px] font-bold text-muted-foreground uppercase tracking-wider ps-2">
              {t("schedule.board.practitioner", { defaultValue: "Practitioner" })}
            </div>
            <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${HOURS.length}, minmax(0,1fr))` }}>
              {HOURS.map((h) => (
                <div key={h} className="text-center text-[9px] font-bold text-muted-foreground/70">
                  {hourLabel(h)}
                </div>
              ))}
            </div>
            <div className="w-28 shrink-0 text-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              {t("schedule.board.summary", { defaultValue: "Today" })}
            </div>
          </div>

          {isLoading ? (
            <div className="py-6 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-2xl" />
              ))}
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
                const stats = doctorStats.get(doc.doctorId) ?? { available: 0, booked: 0, cancelled: 0, total: 0 };
                const hasConflict = conflictedDoctorIds.has(doc.doctorId);
                return (
                  <div
                    key={doc.doctorId}
                    className={cn(
                      "flex items-center rounded-2xl border p-2 transition group",
                      hasConflict ? "border-rose-500/50 bg-rose-500/5" : "border-border/30 bg-muted/10 hover:bg-muted/20",
                    )}
                  >
                    {/* Doctor identity */}
                    <button
                      type="button"
                      onClick={() => onSelectDoctor(doc.doctorId)}
                      className="w-64 shrink-0 flex items-center gap-2.5 text-start px-1.5 py-1 rounded-xl hover:bg-accent/40 transition cursor-pointer"
                    >
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color.hex }} />
                      <div className={cn("relative h-9 w-9 shrink-0 rounded-xl overflow-hidden border-2", color.border)}>
                        <RemoteImage src={doc.photoUrl} alt={doc.name} className="h-full w-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-foreground truncate">{doc.name}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{doc.specialty}</div>
                      </div>
                      {hasConflict && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-500" />}
                      <ChevronRight className="h-3 w-3 text-muted-foreground/50 group-hover:text-foreground rtl:rotate-180 transition" />
                    </button>

                    {/* Hourly cells */}
                    <div className="flex-1 grid gap-1" style={{ gridTemplateColumns: `repeat(${HOURS.length}, minmax(0,1fr))` }}>
                      {HOURS.map((h) => {
                        const status = cellStatus(slots, h);
                        if (status === "EMPTY") {
                          return <div key={h} className="h-8 rounded-lg border border-dashed border-border/25 bg-muted/5" />;
                        }
                        const isCancelled = status === "CANCELLED";
                        return (
                          <div
                            key={h}
                            title={`${doc.name} · ${hourLabel(h)} · ${status}`}
                            className={cn(
                              "h-8 rounded-lg border flex items-center justify-center transition cursor-default",
                              isCancelled ? "border-rose-500/40 bg-rose-500/10" : color.border,
                            )}
                            style={!isCancelled ? { backgroundColor: `${color.hex}26` } : undefined}
                            onMouseEnter={(e) => setHoveredCell({ doctorId: doc.doctorId, hour: h, x: e.clientX, y: e.clientY })}
                            onMouseMove={(e) => setHoveredCell((prev) => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)}
                            onMouseLeave={() => setHoveredCell(null)}
                          >
                            {status === "FULL" && <CheckCircle2 className="h-3 w-3" style={{ color: color.hex }} />}
                            {status === "PARTIAL" && <Clock className="h-3 w-3" style={{ color: color.hex }} />}
                            {isCancelled && <Ban className="h-3 w-3 text-rose-500" />}
                            {status === "AVAILABLE" && <Sparkles className="h-2.5 w-2.5 opacity-60" style={{ color: color.hex }} />}
                          </div>
                        );
                      })}
                    </div>

                    {/* Per-doctor summary chips */}
                    <div className="w-28 shrink-0 flex items-center justify-center gap-1.5 ps-2">
                      {stats.total === 0 ? (
                        <span className="text-[10px] text-muted-foreground/50 italic">No slots</span>
                      ) : (
                        <>
                          {stats.available > 0 && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                              {stats.available}
                            </span>
                          )}
                          {stats.booked > 0 && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-400">
                              {stats.booked}
                            </span>
                          )}
                          {stats.cancelled > 0 && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[9px] font-bold text-rose-600 dark:text-rose-400">
                              {stats.cancelled}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </GlassCard>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Available</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Booked</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Cancelled</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-muted/60 border border-dashed border-border/50" /> Empty</span>
        </div>
        <span className="normal-case text-muted-foreground/60">
          {t("schedule.board.clickToView", { defaultValue: "Click a doctor to view their full schedule" })}
        </span>
      </div>

      {/* Tooltip */}
      {hoveredCell && (() => {
        const cellSlots = getCellSlots(hoveredCell.doctorId, hoveredCell.hour);
        const doc = doctors.find((d) => d.doctorId === hoveredCell.doctorId);
        if (cellSlots.length === 0) return null;
        return (
          <div
            className="pointer-events-none fixed z-50 rounded-2xl border border-border/60 bg-popover/95 p-3 shadow-2xl backdrop-blur-md min-w-[200px] space-y-2"
            style={{ left: Math.min(window.innerWidth - 230, hoveredCell.x + 12), top: hoveredCell.y + 12 }}
          >
            <div className="text-xs font-bold text-foreground">{doc?.name} · {hourLabel(hoveredCell.hour)}</div>
            {cellSlots.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 text-[11px]">
                <span className="font-mono font-bold text-primary-500 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {s.startTime?.slice(0, 5)}–{s.endTime?.slice(0, 5)}
                </span>
                <span className={cn(
                  "capitalize text-[10px] px-1.5 py-0.5 rounded-full font-bold",
                  String(s.status || "").toLowerCase() === "available" ? "bg-emerald-500/15 text-emerald-600" :
                  String(s.status || "").toLowerCase() === "cancelled" ? "bg-rose-500/15 text-rose-500" :
                  "bg-amber-500/15 text-amber-600"
                )}>
                  {s.status || "available"}
                </span>
              </div>
            ))}
            {cellSlots[0]?.room?.name && (
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground border-t border-border/30 pt-1.5">
                <DoorOpen className="h-3 w-3 text-primary-500" /> {cellSlots[0].room.name}
              </div>
            )}
          </div>
        );
      })()}
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
