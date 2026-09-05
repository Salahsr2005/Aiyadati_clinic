import { useQuery } from "@/lib/queryClient";
import { doctorSelfApi } from "@/api/doctorSelfApi";
import { qk } from "@/lib/queryKeys";
import { useAuthStore } from "@/store/auth";
import { useUIStore } from "@/store/ui";

/** Authenticated doctor's own profile — the single source of truth for their ID. */
export function useDoctorProfile() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: qk.doctorSelf.profile(),
    queryFn: doctorSelfApi.profile,
    enabled: !!token,
    staleTime: 60_000,
  });
}

export function useDoctorName() {
  const { data } = useDoctorProfile();
  const locale = useUIStore((s) => s.locale);
  if (!data) return "";
  const first = locale === "ar" ? data.firstNameAr || data.firstNameFr : data.firstNameFr || data.firstNameAr;
  const last = locale === "ar" ? data.lastNameAr || data.lastNameFr : data.lastNameFr || data.lastNameAr;
  return [first, last].filter(Boolean).join(" ");
}
