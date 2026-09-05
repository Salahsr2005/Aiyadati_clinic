import { useMemo } from "react";
import { useQuery } from "@/lib/queryClient";
import type { MapPoint } from "@/components/map/EntityMap";
import { analyticsV2Api } from "@/api/analyticsV2Api";
import { useDoctorProfile, useDoctorName } from "@/hooks/useDoctorProfile";
import { WILAYA_CENTROIDS } from "@/lib/wilayaCentroids";
import { qk } from "@/lib/queryKeys";

export function useMyPatientsMapPoints() {
  const { data: profile } = useDoctorProfile();
  const name = useDoctorName();
  const doctorId = profile?.id;

  const analytics = useQuery({
    queryKey: qk.doctorSelf.analytics(doctorId ?? "", "last30days"),
    queryFn: () => analyticsV2Api.doctorDetails(doctorId!, { period: "last30days" }),
    enabled: !!doctorId,
  });

  const a = analytics.data;

  const mapPoints: MapPoint[] = useMemo(() => {
    const rows = a?.patientDemographics?.byWilaya ?? [];
    const points: MapPoint[] = [];
    rows.forEach((row) => {
      const coords = WILAYA_CENTROIDS[Number(row.wilayaId)];
      if (!coords) return;
      points.push({
        id: `wilaya-${row.wilayaId}`,
        longitude: coords[0],
        latitude: coords[1],
        title: row.wilayaName || `Wilaya ${row.wilayaId}`,
        subtitle: `${row.count} patient${row.count === 1 ? "" : "s"}`,
        type: "appointment",
        weight: row.count,
        meta: [{ label: "Patients", value: String(row.count) }],
      });
    });
    if (profile?.latitude != null && profile?.longitude != null) {
      points.push({
        id: `me-${profile.id}`,
        latitude: profile.latitude,
        longitude: profile.longitude,
        title: `Dr. ${name}`,
        subtitle: "Your practice",
        type: "doctor",
        badgeLabel: "You",
        badgeTone: "info",
      });
    }
    return points;
  }, [a, profile, name]);

  return { mapPoints, isLoading: analytics.isLoading };
}
