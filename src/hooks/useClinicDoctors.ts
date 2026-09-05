import { useQuery } from '@/lib/queryClient';
import { clinicSelfApi, type ClinicDoctor } from '@/api/clinicSelfApi';
import { qk } from '@/lib/queryKeys';
import { useAuthStore } from '@/store/auth';

export function useClinicDoctors() {
  const token = useAuthStore((s) => s.token);
  const query = useQuery<ClinicDoctor[]>({
    queryKey: qk.clinicSelf.doctors(),
    queryFn: clinicSelfApi.getDoctors,
    enabled: !!token,
    staleTime: 30_000,
  });

  const rawData = query.data as any;
  const doctors: ClinicDoctor[] = Array.isArray(rawData)
    ? rawData
    : Array.isArray(rawData?.items)
    ? rawData.items
    : Array.isArray(rawData?.doctors)
    ? rawData.doctors
    : Array.isArray(rawData?.data)
    ? rawData.data
    : [];

  const acceptedDoctors = doctors.filter((d) => d.status === 'ACCEPTED');
  const pendingDoctors = doctors.filter((d) => d.status === 'PENDING');
  const rejectedDoctors = doctors.filter((d) => d.status === 'REJECTED');

  return {
    ...query,
    doctors,
    acceptedDoctors,
    pendingDoctors,
    rejectedDoctors,
    pendingCount: pendingDoctors.length,
  };
}
