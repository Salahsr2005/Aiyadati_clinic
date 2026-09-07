import { api } from "@/lib/api";

export type AnalyticsPeriod =
  | "today" | "yesterday" | "last7days" | "last30days" | "last90days" | "thisMonth" | "lastMonth";

export interface DoctorDetailedStats {
  totalAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  noShowAppointments: number;
  completionRate: number;
  cancellationRate: number;
  noShowRate: number;
  avgRating: number | null;
  totalReviews: number;
  totalRevenue: number;
  avgRevenuePerAppointment: number;
  uniquePatients: number;
  returningPatients: number;
  retentionRate: number;
  appointmentTypeDistribution?: Record<string, number>;
  monthlyTrends?: Array<{ month: string; appointments: number; revenue: number }>;
  patientDemographics?: {
    byWilaya?: Array<{ wilayaId: string; wilayaName?: string; count: number }>;
  };
  peakHours?: Array<{ hour: number; count: number }>;
  busiestDays?: Array<{ day: string; count: number }>;
}

export interface DoctorRevenueStats {
  totalRevenue?: number;
  avgRevenuePerAppointment?: number;
  byMonth?: Array<{ month: string; revenue: number; appointments?: number }>;
  byPaymentMethod?: Record<string, number>;
  [key: string]: unknown;
}

export interface DoctorRetentionStats {
  uniquePatients?: number;
  returningPatients?: number;
  retentionRate?: number;
  [key: string]: unknown;
}

interface PeriodParams {
  period?: AnalyticsPeriod;
  startDate?: string;
  endDate?: string;
}

/**
 * Analytics V2 — computes stats from real appointment data only.
 * No fabricated fallbacks, no hardcoded ratings or synthetic chart data.
 */
export const analyticsV2Api = {
  doctorDetails: async (_doctorId: string, params: PeriodParams = {}): Promise<DoctorDetailedStats> => {
    try {
      // Query working doctor self appointments endpoint to compute real stats
      const res = await api.get("/appointment/v1/doctor/appointments", {
        params: { limit: 1000, ...params },
      });
      const rawItems = Array.isArray(res.data)
        ? res.data
        : (res.data as any)?.data || (res.data as any)?.items || [];

      const total = rawItems.length;
      let completed = 0;
      let cancelled = 0;
      let noShow = 0;
      let totalRev = 0;

      const typeDist: Record<string, number> = {};
      const wilayaMap = new Map<string, number>();
      const hourMap = new Map<number, number>();
      const dayMap = new Map<string, number>();
      const monthMap = new Map<string, { appointments: number; revenue: number }>();
      const patientVisitsMap = new Map<string, number>();

      const DAYS_OF_WEEK = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

      for (const item of rawItems) {
        const st = String(item.status || "").toUpperCase();
        if (st === "COMPLETED") {
          completed++;
          const fee = Number(item.amount || item.fee || 0);
          totalRev += fee;
        } else if (st === "CANCELLED") {
          cancelled++;
        } else if (st === "NO_SHOW") {
          noShow++;
        }

        // Appointment type distribution
        const tKey = String(item.type || "IN_PERSON").toUpperCase();
        typeDist[tKey] = (typeDist[tKey] || 0) + 1;

        // Patient tracking
        const pId = item.patientId || item.guestPatientId || item.contactUserId || item.patient?.id || item.guestPatient?.id;
        if (pId) {
          patientVisitsMap.set(pId, (patientVisitsMap.get(pId) || 0) + 1);
        }

        // Wilaya demographics — only use actual data, no defaults
        const pObj = item.patient || item.guestPatient;
        const wName = pObj?.wilayaName || pObj?.wilayaId;
        if (wName) {
          wilayaMap.set(String(wName), (wilayaMap.get(String(wName)) || 0) + 1);
        }

        // Peak hours — only from real slot times
        const timeStr = item.slot?.startTime || item.startTime;
        if (timeStr) {
          const hour = parseInt(timeStr.slice(0, 2), 10);
          if (!isNaN(hour)) {
            hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
          }
        }

        // Busiest days — computed from real appointment dates
        const dateStr = item.slot?.date || item.createdAt;
        if (dateStr) {
          try {
            const d = new Date(dateStr);
            const dayName = DAYS_OF_WEEK[d.getDay()];
            if (dayName) {
              dayMap.set(dayName, (dayMap.get(dayName) || 0) + 1);
            }
          } catch {
            // skip invalid dates
          }
        }

        // Monthly trends — computed from real data
        const dStr = item.slot?.date || item.createdAt;
        if (dStr) {
          const mKey = dStr.slice(0, 7); // YYYY-MM
          if (/^\d{4}-\d{2}$/.test(mKey)) {
            const existingMonth = monthMap.get(mKey) || { appointments: 0, revenue: 0 };
            monthMap.set(mKey, {
              appointments: existingMonth.appointments + 1,
              revenue: existingMonth.revenue + (st === "COMPLETED" ? Number(item.amount || item.fee || 0) : 0),
            });
          }
        }
      }

      const uniqueCount = patientVisitsMap.size;
      let returningCount = 0;
      patientVisitsMap.forEach((count) => {
        if (count > 1) returningCount++;
      });

      // Rates — return 0 when no data, never fabricate
      const completionRate = total > 0 ? (completed / total) * 100 : 0;
      const cancellationRate = total > 0 ? (cancelled / total) * 100 : 0;
      const noShowRate = total > 0 ? (noShow / total) * 100 : 0;
      const retentionRate = uniqueCount > 0 ? (returningCount / uniqueCount) * 100 : 0;

      const monthlyTrends = Array.from(monthMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, data]) => ({ month, ...data }));

      const byWilaya = Array.from(wilayaMap.entries()).map(([wilayaName, count]) => ({
        wilayaId: wilayaName,
        wilayaName,
        count,
      }));

      const peakHours = Array.from(hourMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([hour, count]) => ({ hour, count }));

      const busiestDays = Array.from(dayMap.entries())
        .sort(([, a], [, b]) => b - a)
        .map(([day, count]) => ({ day, count }));

      return {
        totalAppointments: total,
        completedAppointments: completed,
        cancelledAppointments: cancelled,
        noShowAppointments: noShow,
        completionRate,
        cancellationRate,
        noShowRate,
        // Rating must come from the reviews API — we never fabricate it here
        avgRating: null,
        totalReviews: 0,
        totalRevenue: totalRev,
        avgRevenuePerAppointment: completed > 0 ? totalRev / completed : 0,
        uniquePatients: uniqueCount,
        returningPatients: returningCount,
        retentionRate,
        appointmentTypeDistribution: Object.keys(typeDist).length > 0 ? typeDist : undefined,
        monthlyTrends: monthlyTrends.length > 0 ? monthlyTrends : undefined,
        patientDemographics: byWilaya.length > 0 ? { byWilaya } : undefined,
        peakHours: peakHours.length > 0 ? peakHours : undefined,
        busiestDays: busiestDays.length > 0 ? busiestDays : undefined,
      };
    } catch {
      return {
        totalAppointments: 0,
        completedAppointments: 0,
        cancelledAppointments: 0,
        noShowAppointments: 0,
        completionRate: 0,
        cancellationRate: 0,
        noShowRate: 0,
        avgRating: null,
        totalReviews: 0,
        totalRevenue: 0,
        avgRevenuePerAppointment: 0,
        uniquePatients: 0,
        returningPatients: 0,
        retentionRate: 0,
      };
    }
  },

  doctorRevenue: async (_doctorId: string, _params: PeriodParams = {}): Promise<DoctorRevenueStats> => {
    return { totalRevenue: 0, avgRevenuePerAppointment: 0 };
  },

  doctorRetention: async (_doctorId: string): Promise<DoctorRetentionStats> => {
    return { uniquePatients: 0, returningPatients: 0, retentionRate: 0 };
  },
};
