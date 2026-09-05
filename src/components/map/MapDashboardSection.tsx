import { useMemo } from "react";
import { Map, Building2, Stethoscope, CalendarCheck2 } from "lucide-react";
import { EntityMap, type MapPoint } from "@/components/map/EntityMap";
import { GlassCard } from "@/components/glass/GlassCard";
import type { ClinicRow } from "@/api/clinicsApi";
import type { DoctorRow } from "@/api/doctorsApi";
import type { AppointmentRow } from "@/api/appointmentsApi";
import { pickLocaleField } from "@/lib/pickLocale";
import { useUIStore } from "@/store/ui";

export interface MapDashboardSectionProps {
  clinics?: ClinicRow[];
  doctors?: DoctorRow[];
  appointments?: AppointmentRow[];
  loading?: boolean;
}

export function MapDashboardSection({
  clinics = [],
  doctors = [],
  appointments = [],
  loading = false,
}: MapDashboardSectionProps) {
  const { locale } = useUIStore();

  const mapPoints = useMemo(() => {
    const list: MapPoint[] = [];

    clinics.forEach((c) => {
      if (c.latitude != null && c.longitude != null) {
        list.push({
          id: c.id,
          latitude: c.latitude,
          longitude: c.longitude,
          title: pickLocaleField(c as unknown as Record<string, unknown>, "name", locale) || "—",
          subtitle: c.wilaya ? pickLocaleField(c.wilaya as unknown as Record<string, unknown>, "name", locale) : undefined,
          imageUrl: c.logoUrl || c.coverUrl || undefined,
          badgeLabel: c.isVerified ? "Verified" : "Pending",
          badgeTone: c.isVerified ? "success" : "warning",
          type: "clinic",
          meta: [
            { label: "Phone", value: c.phone || "—" },
            { label: "Rating", value: c.rating ? `${c.rating} ★` : "New" },
            { label: "Doctors", value: c.doctorsCount?.toString() || "0" },
          ],
        });
      }
    });

    doctors.forEach((d) => {
      if (d.latitude != null && d.longitude != null) {
        const first = locale === "ar" ? d.firstNameAr || d.firstNameFr : d.firstNameFr || d.firstNameAr;
        const last = locale === "ar" ? d.lastNameAr || d.lastNameFr : d.lastNameFr || d.lastNameAr;
        const name = `Dr. ${[first, last].filter(Boolean).join(" ")}`;
        list.push({
          id: d.id,
          latitude: d.latitude,
          longitude: d.longitude,
          title: name,
          subtitle: d.specialties?.[0]?.specialty
            ? pickLocaleField(d.specialties[0].specialty as unknown as Record<string, unknown>, "name", locale)
            : "Practitioner",
          imageUrl: d.photoUrl || undefined,
          badgeLabel: d.isVerified ? "Verified" : "Pending",
          badgeTone: d.isVerified ? "success" : "warning",
          type: "doctor",
          meta: [
            { label: "Experience", value: `${d.yearsOfExp || 0} years` },
            { label: "Practice", value: d.practiceType || "General" },
            { label: "Rating", value: d.rating ? `${d.rating} ★` : "—" },
          ],
        });
      }
    });

    // Appointment density
    const doctorApptCounts: Record<string, number> = {};
    appointments.forEach((appt) => {
      if (appt.doctorId) {
        doctorApptCounts[appt.doctorId] = (doctorApptCounts[appt.doctorId] || 0) + 1;
      }
    });

    doctors.forEach((d) => {
      const count = doctorApptCounts[d.id];
      if (count && d.latitude != null && d.longitude != null) {
        const first = locale === "ar" ? d.firstNameAr || d.firstNameFr : d.firstNameFr || d.firstNameAr;
        const last = locale === "ar" ? d.lastNameAr || d.lastNameFr : d.lastNameFr || d.lastNameAr;
        list.push({
          id: `appt-density-${d.id}`,
          latitude: d.latitude,
          longitude: d.longitude,
          title: `${count} bookings`,
          subtitle: `Dr. ${[first, last].filter(Boolean).join(" ")}`,
          type: "appointment",
          weight: count,
          badgeLabel: "Density",
          badgeTone: "danger",
          meta: [
            { label: "Total Bookings", value: count.toString() },
            { label: "Specialty", value: d.specialties?.[0]?.specialty?.nameFr || "—" },
          ],
        });
      }
    });

    return list;
  }, [clinics, doctors, appointments, locale]);

  // Geo coverage stats
  const geoStats = useMemo(() => {
    const clinicsWithGeo = clinics.filter((c) => c.latitude != null && c.longitude != null).length;
    const doctorsWithGeo = doctors.filter((d) => d.latitude != null && d.longitude != null).length;
    const uniqueWilayas = new Set(
      [...clinics, ...doctors]
        .map((e) => (e as any).wilayaId)
        .filter(Boolean),
    );
    return {
      clinicsWithGeo,
      doctorsWithGeo,
      clinicCoverage: clinics.length > 0 ? Math.round((clinicsWithGeo / clinics.length) * 100) : 0,
      doctorCoverage: doctors.length > 0 ? Math.round((doctorsWithGeo / doctors.length) * 100) : 0,
      wilayas: uniqueWilayas.size,
    };
  }, [clinics, doctors]);

  return (
    <GlassCard className="p-0 border border-border/40 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex flex-wrap items-start justify-between gap-4 border-b border-border/30">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary-500/10 text-primary-500">
              <Map className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight">Geographic Intelligence</div>
              <div className="text-[10px] text-muted-foreground font-medium mt-0.5">
                Spatial distribution of clinics, doctors, and appointment density across Algeria
              </div>
            </div>
          </div>
        </div>

        {/* Quick geo stats */}
        <div className="flex flex-wrap gap-2">
          <GeoChip
            icon={<Building2 className="h-3 w-3" />}
            label="Clinics mapped"
            value={`${geoStats.clinicsWithGeo}`}
            pct={geoStats.clinicCoverage}
            color="#14b8a6"
          />
          <GeoChip
            icon={<Stethoscope className="h-3 w-3" />}
            label="Doctors mapped"
            value={`${geoStats.doctorsWithGeo}`}
            pct={geoStats.doctorCoverage}
            color="#a78bfa"
          />
          <GeoChip
            icon={<CalendarCheck2 className="h-3 w-3" />}
            label="Wilayas"
            value={`${geoStats.wilayas}`}
            color="#3b82f6"
          />
        </div>
      </div>

      {/* Map */}
      <div className="relative">
        {loading ? (
          <div className="h-[520px] w-full bg-muted/10 animate-pulse" />
        ) : (
          <EntityMap points={mapPoints} height={520} />
        )}
      </div>
    </GlassCard>
  );
}

function GeoChip({
  icon,
  label,
  value,
  pct,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  pct?: number;
  color: string;
}) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-xl border border-border/40 bg-background/60 px-2.5 py-1.5 text-[10px] font-bold tabular-nums">
      <span style={{ color }}>{icon}</span>
      <span className="text-foreground">{value}</span>
      <span className="text-muted-foreground font-medium">{label}</span>
      {pct != null && (
        <span
          className="rounded-full px-1.5 py-0.5 text-[9px] font-bold"
          style={{
            background: `${color}15`,
            color,
          }}
        >
          {pct}%
        </span>
      )}
    </div>
  );
}
