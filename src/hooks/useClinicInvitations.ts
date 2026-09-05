import { useMemo } from "react";
import { useQuery } from "@/lib/queryClient";
import { doctorSelfApi, type ClinicInvitationRow } from "@/api/doctorSelfApi";
import { qk } from "@/lib/queryKeys";

export function isInvitationPending(status?: string) {
  return String(status ?? "PENDING").toUpperCase() === "PENDING";
}
export function isInvitationAccepted(status?: string) {
  return String(status ?? "").toUpperCase() === "ACCEPTED";
}
/** Backend returns `invitedBy: "clinic" | "doctor"` on DoctorClinicInvitationResponse. */
export function isSentByDoctor(inv: ClinicInvitationRow) {
  return String(inv.invitedBy ?? "").toLowerCase().includes("doctor");
}

/**
 * Single cached source of clinic invitations, shared by the sidebar/bottom-nav
 * badge, the dashboard card and the clinics page.
 */
export function useClinicInvitations() {
  const query = useQuery({
    queryKey: qk.doctorSelf.invitations(),
    queryFn: doctorSelfApi.clinicInvitations.list,
    staleTime: 60_000,
  });

  const buckets = useMemo(() => {
    const all = query.data ?? [];
    return {
      all,
      myClinics: all.filter((i) => isInvitationAccepted(i.status)),
      pendingIncoming: all.filter((i) => isInvitationPending(i.status) && !isSentByDoctor(i)),
      pendingOutgoing: all.filter((i) => isInvitationPending(i.status) && isSentByDoctor(i)),
    };
  }, [query.data]);

  return { ...query, ...buckets };
}
