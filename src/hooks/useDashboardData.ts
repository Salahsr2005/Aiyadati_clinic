import { useQueries, useQuery } from "@/lib/queryClient";
import { subDays, format, parseISO, isAfter, isBefore } from "date-fns";
import { useMemo } from "react";
import { analyticsApi } from "@/api/analyticsApi";
import { appointmentsApi } from "@/api/appointmentsApi";
import { clinicsApi } from "@/api/clinicsApi";
import { doctorsApi } from "@/api/doctorsApi";
import { usersApi } from "@/api/usersApi";
import { useDashboardFiltersStore } from "@/store/dashboardFilters";

export function useDashboardData() {
  const filters = useDashboardFiltersStore();
  const today = useMemo(() => new Date(), []);

  // 1. Fetch baseline analytics queries
  const results = useQueries({
    queries: [
      { queryKey: ["analytics", "overview"], queryFn: analyticsApi.overview, staleTime: 5 * 60 * 1000 },
      { queryKey: ["analytics", "appointments"], queryFn: analyticsApi.appointments, staleTime: 5 * 60 * 1000 },
      { queryKey: ["analytics", "revenue"], queryFn: analyticsApi.revenue, staleTime: 5 * 60 * 1000 },
      { queryKey: ["analytics", "users"], queryFn: analyticsApi.users, staleTime: 5 * 60 * 1000 },
      { queryKey: ["analytics", "doctors"], queryFn: analyticsApi.doctors, staleTime: 5 * 60 * 1000 },
      { queryKey: ["analytics", "clinics"], queryFn: analyticsApi.clinics, staleTime: 5 * 60 * 1000 },
    ],
  });

  const [ov, ap, rv, us, dc, cl] = results;
  const loading = results.some((r) => r.isLoading);

  // 2. Fetch sample listings for advanced widgets
  const listParams = useMemo(() => {
    // Generate list params based on filters
    const params: Record<string, string | number | boolean | undefined> = {
      page: 1,
      limit: 100,
    };
    if (filters.doctorId) params.doctorId = filters.doctorId;
    if (filters.clinicId) params.clinicId = filters.clinicId;
    if (filters.wilayaId) params.wilayaId = filters.wilayaId;
    
    // Date ranges
    let fromDate: Date | null = null;
    let toDate: Date = today;

    if (filters.datePreset === "today") {
      fromDate = today;
    } else if (filters.datePreset === "yesterday") {
      fromDate = subDays(today, 1);
      toDate = subDays(today, 1);
    } else if (filters.datePreset === "7d") {
      fromDate = subDays(today, 7);
    } else if (filters.datePreset === "30d") {
      fromDate = subDays(today, 30);
    } else if (filters.datePreset === "90d") {
      fromDate = subDays(today, 90);
    } else if (filters.datePreset === "all" && filters.customFrom) {
      fromDate = parseISO(filters.customFrom);
      if (filters.customTo) toDate = parseISO(filters.customTo);
    }

    if (fromDate) {
      params.from = format(fromDate, "yyyy-MM-dd");
      params.to = format(toDate, "yyyy-MM-dd");
    }

    return params;
  }, [filters.doctorId, filters.clinicId, filters.wilayaId, filters.datePreset, filters.customFrom, filters.customTo, today]);

  const appointmentsSample = useQuery({
    queryKey: ["dashboard", "appointments-sample", listParams],
    queryFn: () => appointmentsApi.list(listParams),
    staleTime: 2 * 60 * 1000,
  });

  const clinicsSample = useQuery({
    queryKey: ["dashboard", "clinics-sample", listParams],
    queryFn: () => clinicsApi.list({ ...listParams, limit: 50 }),
    staleTime: 5 * 60 * 1000,
  });

  const doctorsSample = useQuery({
    queryKey: ["dashboard", "doctors-sample", listParams],
    queryFn: () => doctorsApi.list({ ...listParams, page: 1, limit: 50 }),
    staleTime: 5 * 60 * 1000,
  });

  const usersSample = useQuery({
    queryKey: ["dashboard", "users-sample", listParams],
    queryFn: () => usersApi.list({ ...listParams, page: 1, limit: 50 }),
    staleTime: 5 * 60 * 1000,
  });

  const pendingDoctorsQuery = useQuery({
    queryKey: ["dashboard", "pending-doctors-count"],
    queryFn: () => doctorsApi.list({ isVerified: false, page: 1, limit: 1 }),
    staleTime: 2 * 60 * 1000,
  });

  const pendingClinicsQuery = useQuery({
    queryKey: ["dashboard", "pending-clinics-count"],
    queryFn: () => clinicsApi.list({ isVerified: false, page: 1, limit: 1 }),
    staleTime: 2 * 60 * 1000,
  });

  // 3. Compute stats and Period-over-Period deltas
  const stats = useMemo(() => {
    if (!ap.data || !rv.data || !ov.data || !us.data) return null;

    const byDate = ap.data.byDate ?? [];
    const byMonth = rv.data.byMonth ?? [];

    // Filter byDate series according to selected presets if possible
    const getDeltaAndSum = (daysCount: number) => {
      const currentPeriod = byDate.slice(-daysCount);
      const prevPeriod = byDate.slice(-daysCount * 2, -daysCount);
      
      const currentSum = currentPeriod.reduce((acc, curr) => acc + (curr.count || 0), 0);
      const prevSum = prevPeriod.reduce((acc, curr) => acc + (curr.count || 0), 0);

      const delta = prevSum > 0 ? ((currentSum - prevSum) / prevSum) * 100 : 0;
      return { sum: currentSum, delta };
    };

    // Calculate today's volume vs yesterday
    const todayStr = format(today, "yyyy-MM-dd");
    const yesterdayStr = format(subDays(today, 1), "yyyy-MM-dd");

    const todayCount = byDate.find((d) => d.date?.startsWith(todayStr))?.count ?? 0;
    const yesterdayCount = byDate.find((d) => d.date?.startsWith(yesterdayStr))?.count ?? 0;
    const todayDelta = yesterdayCount > 0 ? ((todayCount - yesterdayCount) / yesterdayCount) * 100 : 0;

    // Default periods based on selected filter
    let activeDays = 30;
    if (filters.datePreset === "7d") activeDays = 7;
    else if (filters.datePreset === "90d") activeDays = 90;
    else if (filters.datePreset === "today" || filters.datePreset === "yesterday") activeDays = 1;

    const apptMetrics = getDeltaAndSum(activeDays);

    // Calculate revenue metrics
    const revN = filters.datePreset === "7d" ? 1 : filters.datePreset === "90d" ? 3 : 1;
    const currentRevMonth = byMonth.slice(-revN);
    const prevRevMonth = byMonth.slice(-revN * 2, -revN);

    const currentRevSum = currentRevMonth.reduce((acc, curr) => acc + (curr.amount || 0), 0);
    const prevRevSum = prevRevMonth.reduce((acc, curr) => acc + (curr.amount || 0), 0);
    const revDelta = prevRevSum > 0 ? ((currentRevSum - prevRevSum) / prevRevSum) * 100 : 0;

    // Filter verification pipeline
    const pendingClinics = pendingClinicsQuery.data?.total ?? 0;
    const pendingDoctors = pendingDoctorsQuery.data?.total ?? 0;

    return {
      appointments: {
        total: apptMetrics.sum,
        delta: apptMetrics.delta,
        today: todayCount,
        todayDelta,
      },
      revenue: {
        total: currentRevSum || ov.data.totalRevenue,
        delta: revDelta || 0,
      },
      verification: {
        pendingClinics,
        pendingDoctors,
      },
    };
  }, [
    ap.data,
    rv.data,
    ov.data,
    us.data,
    filters.datePreset,
    today,
    pendingClinicsQuery.data,
    pendingDoctorsQuery.data,
  ]);

  return {
    loading:
      loading ||
      appointmentsSample.isLoading ||
      clinicsSample.isLoading ||
      doctorsSample.isLoading ||
      usersSample.isLoading ||
      pendingDoctorsQuery.isLoading ||
      pendingClinicsQuery.isLoading,
    filters,
    overview: ov.data,
    appointmentsStats: ap.data,
    revenueStats: rv.data,
    usersStats: us.data,
    doctorsStats: dc.data,
    clinicsStats: cl.data,
    appointmentsList: appointmentsSample.data?.items ?? [],
    clinicsList: clinicsSample.data?.items ?? [],
    doctorsList: doctorsSample.data?.items ?? [],
    usersList: usersSample.data?.items ?? [],
    computed: stats,
  };
}
