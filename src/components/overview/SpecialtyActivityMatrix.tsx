import { useMemo, useState } from "react";
import { Stethoscope, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { GlassCard } from "@/components/glass/GlassCard";
import type { AppointmentRow } from "@/api/appointmentsApi";
import type { DoctorRow } from "@/api/doctorsApi";

export interface SpecialtyActivityMatrixProps {
  appointments?: AppointmentRow[];
  doctors?: DoctorRow[];
  loading?: boolean;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function SpecialtyActivityMatrix({
  appointments = [],
  doctors = [],
  loading = false,
}: SpecialtyActivityMatrixProps) {
  const [hoveredCell, setHoveredCell] = useState<{
    specialtyName: string;
    dayIdx: number;
    count: number;
    x: number;
    y: number;
  } | null>(null);

  // Compute specialty stats
  const { specialtyGrid, specialties, maxCount, totalCount } = useMemo(() => {
    // 1. Create doctor ID to specialty names map
    const docToSpecialties = new Map<string, string[]>();
    doctors.forEach((d) => {
      const names = (d.specialties ?? [])
        .map((spec) => spec.specialty?.nameFr || spec.specialty?.nameAr || "")
        .filter(Boolean);
      if (names.length > 0) {
        docToSpecialties.set(d.id, names);
      }
    });

    // 2. Count appointments per specialty and weekday
    const countsMap = new Map<string, number[]>();
    let total = 0;

    appointments.forEach((appt) => {
      const dateStr = appt.slot?.date;
      if (!dateStr || !appt.doctorId) return;

      const day = new Date(dateStr).getDay();
      const specNames = docToSpecialties.get(appt.doctorId) || ["General Medicine"];

      specNames.forEach((specName) => {
        if (!countsMap.has(specName)) {
          countsMap.set(specName, Array(7).fill(0));
        }
        countsMap.get(specName)![day]++;
        total++;
      });
    });

    // 3. Sort specialties by total appointments to get the top ones (limit to top 8)
    const sortedSpecialties = Array.from(countsMap.entries())
      .map(([name, days]) => ({
        name,
        days,
        total: days.reduce((sum, val) => sum + val, 0),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    // Find max value in grid
    let max = 0;
    sortedSpecialties.forEach((spec) => {
      spec.days.forEach((count) => {
        if (count > max) max = count;
      });
    });

    return {
      specialties: sortedSpecialties.map((s) => s.name),
      specialtyGrid: sortedSpecialties.reduce(
        (acc, spec) => {
          acc[spec.name] = spec.days;
          return acc;
        },
        {} as Record<string, number[]>,
      ),
      maxCount: max,
      totalCount: total,
    };
  }, [appointments, doctors]);

  if (loading) {
    return (
      <GlassCard className="p-5 border border-border/40 shadow-sm animate-pulse">
        <div className="h-[250px] w-full bg-muted/10 rounded-2xl" />
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-5 border border-border/40 shadow-sm relative overflow-hidden flex flex-col justify-between h-full">
      {/* Radial highlight */}
      <div className="absolute -left-20 -top-20 h-40 w-40 rounded-full bg-indigo-500/5 blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-indigo-500/10 text-indigo-500">
              <Stethoscope className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight">Specialty Booking Heatmap</div>
              <div className="text-[10px] text-muted-foreground font-medium mt-0.5">
                Weekdays scheduling distribution grouped by top clinical specialties
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid Container */}
      <div className="relative mt-2 flex-1 flex flex-col justify-center">
        {specialties.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Info className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <div className="text-xs font-bold text-muted-foreground">No specialty metrics available</div>
            <div className="text-[10px] text-muted-foreground/60 mt-0.5">
              Requires active appointments and doctor specialty assignments
            </div>
          </div>
        ) : (
          <div className="w-full overflow-x-auto pb-1 custom-scrollbar">
            <div className="min-w-[460px] pr-2">
              {/* Day Labels (X-Axis) */}
              <div className="flex pl-32 mb-2">
                {DAYS.map((day) => (
                  <div
                    key={day}
                    className="flex-1 text-center text-[10px] font-bold text-muted-foreground/80 tracking-wider uppercase select-none"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Rows */}
              <div className="space-y-1.5">
                {specialties.map((specName) => (
                  <div key={specName} className="flex items-center">
                    {/* Specialty Label (Y-Axis) */}
                    <div className="w-32 pr-3 text-[10px] font-semibold text-muted-foreground/80 truncate select-none" title={specName}>
                      {specName}
                    </div>

                    {/* Cells */}
                    <div className="flex-1 flex gap-1.5">
                      {specialtyGrid[specName].map((count, dayIdx) => {
                        const intensity = maxCount > 0 ? count / maxCount : 0;
                        const hasData = count > 0;
                        const opacity = hasData ? 0.15 + intensity * 0.85 : 0.04;
                        const bgStyle = hasData
                          ? `rgba(99, 102, 241, ${opacity})`
                          : "var(--muted)";
                        const borderStyle = hasData
                          ? `rgba(99, 102, 241, ${0.1 + intensity * 0.4})`
                          : "transparent";

                        return (
                          <div
                            key={dayIdx}
                            className="flex-1 h-8 rounded-md transition-all duration-200 cursor-pointer relative"
                            style={{
                              background: bgStyle,
                              border: `1px solid ${borderStyle}`,
                            }}
                            onMouseEnter={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              const parentRect = e.currentTarget.parentElement?.parentElement?.parentElement?.getBoundingClientRect();
                              setHoveredCell({
                                specialtyName: specName,
                                dayIdx,
                                count,
                                x: rect.left - (parentRect?.left ?? 0) + rect.width / 2,
                                y: rect.top - (parentRect?.top ?? 0),
                              });
                            }}
                            onMouseLeave={() => setHoveredCell(null)}
                          >
                            {hasData && intensity > 0.7 && (
                              <span className="absolute inset-0 m-auto h-1.5 w-1.5 rounded-full bg-indigo-600 opacity-60 animate-pulse" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tooltip Overlay */}
        <AnimatePresence>
          {hoveredCell && (
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.95 }}
              transition={{ duration: 0.1 }}
              className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-full"
              style={{ left: hoveredCell.x, top: hoveredCell.y - 6 }}
            >
              <div className="rounded-xl border border-border bg-popover/95 shadow-xl px-3 py-2 text-xs backdrop-blur-sm">
                <div className="font-bold text-indigo-600 dark:text-indigo-400">
                  {hoveredCell.count === 0 ? "No bookings" : `${hoveredCell.count} bookings`}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {hoveredCell.specialtyName} on {DAYS[hoveredCell.dayIdx]}s
                </div>
              </div>
              <div className="mx-auto h-0 w-0 border-x-[5px] border-x-transparent border-t-[5px] border-t-border" style={{ marginTop: -1 }} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Info */}
      <div className="mt-4 flex items-center justify-between text-[10px] text-muted-foreground font-medium pt-2 border-t border-border/30">
        <span className="flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5" />
          Showing top specialties by booking count
        </span>
        {specialties.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span>Quiet</span>
            <span className="h-2.5 w-2.5 rounded bg-muted opacity-40" />
            <span className="h-2.5 w-2.5 rounded bg-indigo-500/20" />
            <span className="h-2.5 w-2.5 rounded bg-indigo-500/50" />
            <span className="h-2.5 w-2.5 rounded bg-indigo-500/80" />
            <span className="h-2.5 w-2.5 rounded bg-indigo-500" />
            <span>Busy</span>
          </div>
        )}
      </div>
    </GlassCard>
  );
}
