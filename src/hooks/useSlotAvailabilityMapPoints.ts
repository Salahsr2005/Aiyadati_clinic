import { useMemo } from "react";
import { useQueries } from "@/lib/queryClient";
import type { MapPoint } from "@/components/map/EntityMap";
import { doctorAppointmentsApi, type SlotRow } from "@/api/doctorSelfApi";
import { useDoctorProfile, useDoctorName } from "@/hooks/useDoctorProfile";
import { useClinicInvitations } from "@/hooks/useClinicInvitations";
import { WILAYA_CENTROIDS } from "@/lib/wilayaCentroids";
import { qk } from "@/lib/queryKeys";

const WINDOW_DAYS = 42; // ~6 weeks

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysISO(iso: string, days: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Map points for the doctor's own slot/clinic footprint: one point per clinic
 * where the doctor has generated bookable slots (weighted by upcoming
 * available-slot count), plus the doctor's own practice location when known.
 * Mirrors useMyPatientsMapPoints but sourced from slots + clinic affiliations
 * instead of patient analytics.
 */
export function useSlotAvailabilityMapPoints() {
  const { data: profile } = useDoctorProfile();
  const name = useDoctorName();
  const { myClinics, isLoading: clinicsLoading } = useClinicInvitations();

  const dates = useMemo(() => {
    const start = todayISO();
    return Array.from({ length: WINDOW_DAYS }, (_, i) => addDaysISO(start, i));
  }, []);

  const slotQueries = useQueries({
    queries: dates.map((date) => ({
      queryKey: qk.doctorSelf.slots(date),
      queryFn: () => doctorAppointmentsApi.slots.listByDate(date),
      staleTime: 60_000,
    })),
  });

  const isLoading = clinicsLoading || slotQueries.some((q) => q.isLoading);

  const mapPoints: MapPoint[] = useMemo(() => {
    const countByClinic = new Map<string, number>();
    let noClinicCount = 0;

    slotQueries.forEach((q) => {
      const rows = (q.data ?? []) as SlotRow[];
      rows.forEach((s) => {
        if (String(s.status).toLowerCase() !== "available") return;
        if (s.clinicId) {
          countByClinic.set(s.clinicId, (countByClinic.get(s.clinicId) ?? 0) + 1);
        } else {
          noClinicCount += 1;
        }
      });
    });

    const points: MapPoint[] = [];

    myClinics.forEach((inv) => {
      const count = countByClinic.get(inv.clinicId) ?? 0;
      if (count <= 0) return;
      const clinic = inv.clinic;
      let lat = clinic?.latitude ?? null;
      let lng = clinic?.longitude ?? null;
      if (lat == null || lng == null) {
        const centroid = WILAYA_CENTROIDS[Number(clinic?.wilaya?.id)];
        if (centroid) {
          lng = centroid[0];
          lat = centroid[1];
        }
      }
      if (lat == null || lng == null) return;
      points.push({
        id: `clinic-${inv.clinicId}`,
        latitude: lat,
        longitude: lng,
        title: clinic?.nameFr || clinic?.nameAr || "Clinic",
        subtitle: `${count} available slot${count === 1 ? "" : "s"}`,
        type: "clinic",
        weight: count,
        meta: [{ label: "Available slots", value: String(count) }],
      });
    });

    if (profile?.latitude != null && profile?.longitude != null) {
      points.push({
        id: `me-${profile.id}`,
        latitude: profile.latitude,
        longitude: profile.longitude,
        title: `Dr. ${name}`,
        subtitle: noClinicCount > 0 ? `${noClinicCount} independent slot${noClinicCount === 1 ? "" : "s"}` : "Your practice",
        type: "doctor",
        badgeLabel: "You",
        badgeTone: "info",
        weight: noClinicCount || undefined,
      });
    }

    return points;
  }, [slotQueries, myClinics, profile, name]);

  return { mapPoints, isLoading };
}
