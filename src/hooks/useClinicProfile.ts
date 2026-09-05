import { useQuery } from '@/lib/queryClient';
import { clinicSelfApi, type ClinicProfile } from '@/api/clinicSelfApi';
import { qk } from '@/lib/queryKeys';
import { useAuthStore } from '@/store/auth';
import { useUIStore } from '@/store/ui';

export function useClinicProfile() {
  const token = useAuthStore((s) => s.token);
  return useQuery<ClinicProfile>({
    queryKey: qk.clinicSelf.profile(),
    queryFn: clinicSelfApi.getProfile,
    enabled: !!token,
    staleTime: 60_000,
  });
}

export function useClinicName() {
  const { data } = useClinicProfile();
  const locale = useUIStore((s) => s.locale);
  if (!data) return '';
  if (locale === 'ar') return data.nameAr || data.nameFr;
  return data.nameFr || data.nameAr || '';
}
