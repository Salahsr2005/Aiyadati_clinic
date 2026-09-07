import { useQuery } from "@/lib/queryClient";
import { FilterX, Calendar } from "lucide-react";
import { useDashboardFiltersStore, DatePreset } from "@/store/dashboardFilters";
import { useWilayas } from "@/hooks/useWilayas";
import { specialtyApi } from "@/api/specialtyApi";
import { clinicSelfApi } from "@/api/clinicSelfApi";
import { SelectMenu } from "@/components/data/SelectMenu";
import { GlassCard } from "@/components/glass/GlassCard";
import { useTranslation } from "react-i18next";
import { pickLocaleField } from "@/lib/pickLocale";
import { useUIStore } from "@/store/ui";

export function DashboardFilterBar() {
  const { t } = useTranslation();
  const { locale } = useUIStore();
  const filters = useDashboardFiltersStore();

  // Queries to load dropdown list options
  const wilayasQ = useWilayas();
  
  const specialtiesQ = useQuery({
    queryKey: ["filter-specialties"],
    queryFn: () => specialtyApi.list({ page: 1, limit: 100 }),
    staleTime: 10 * 60 * 1000,
  });

  const doctorsQ = useQuery({
    queryKey: ["filter-clinic-doctors"],
    queryFn: clinicSelfApi.getDoctors,
    staleTime: 5 * 60 * 1000,
  });

  // Map option conversions
  const dateOptions = [
    { value: "today", label: "Today" },
    { value: "yesterday", label: "Yesterday" },
    { value: "7d", label: "Last 7 Days" },
    { value: "30d", label: "Last 30 Days" },
    { value: "90d", label: "Last 90 Days" },
    { value: "12m", label: "Last 12 Months" },
    { value: "all", label: "Custom / All Time" },
  ];

  const wilayaOptions = (wilayasQ.data ?? []).map((w) => ({
    value: w.id,
    label: pickLocaleField(w as unknown as Record<string, unknown>, "name", locale) || `Wilaya ${w.id}`,
  }));

  const specialtyOptions = (specialtiesQ.data?.items ?? []).map((s) => ({
    value: s.id,
    label: pickLocaleField(s as unknown as Record<string, unknown>, "name", locale) || `Specialty ${s.id}`,
  }));

  const doctorOptions = (Array.isArray(doctorsQ.data) ? doctorsQ.data : []).filter((d: any) => d.status === "ACCEPTED").map((d: any) => {
    const doc = d.doctor;
    if (!doc) return null;
    const first = locale === "ar" ? doc.firstNameAr || doc.firstNameFr || doc.firstName : doc.firstNameFr || doc.firstNameAr || doc.firstName;
    const last = locale === "ar" ? doc.lastNameAr || doc.lastNameFr || doc.lastName : doc.lastNameFr || doc.lastNameAr || doc.lastName;
    return {
      value: doc.id || d.doctorId,
      label: `Dr. ${[first, last].filter(Boolean).join(" ")}`,
    };
  }).filter(Boolean) as Array<{ value: string; label: string }>;

  const hasActiveFilters = 
    filters.doctorId || 
    filters.clinicId || 
    filters.specialtyId || 
    filters.wilayaId || 
    filters.datePreset !== "30d";

  return (
    <GlassCard className="flex flex-wrap items-center justify-between gap-3 p-3 border border-border/40 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        {/* Date presets */}
        <div className="flex items-center gap-1.5 me-2">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          <SelectMenu
            value={filters.datePreset}
            onChange={(v) => filters.setDatePreset((v as DatePreset) || "30d")}
            options={dateOptions}
            placeholder="Select date period"
            className="min-w-[7rem]"
          />
        </div>

        {/* Doctor filter */}
        <SelectMenu
          value={filters.doctorId}
          onChange={(v) => filters.setDoctorId(v)}
          options={doctorOptions}
          placeholder="Filter by Doctor"
          searchable
          searchPlaceholder="Search doctors..."
          className="min-w-[9rem]"
        />



        {/* Specialty filter */}
        <SelectMenu
          value={filters.specialtyId}
          onChange={(v) => filters.setSpecialtyId(v)}
          options={specialtyOptions}
          placeholder="Specialty Area"
          searchable
          searchPlaceholder="Search specialties..."
          className="min-w-[8.5rem]"
        />

        {/* Wilaya filter */}
        <SelectMenu
          value={filters.wilayaId}
          onChange={(v) => filters.setWilayaId(v)}
          options={wilayaOptions}
          placeholder="Location (Wilaya)"
          searchable
          searchPlaceholder="Search wilayas..."
          className="min-w-[8.5rem]"
        />
      </div>

      {hasActiveFilters && (
        <button
          onClick={() => filters.resetFilters()}
          className="glass flex items-center gap-1 rounded-full px-3 py-1.5 text-xs text-rose-500 hover:bg-rose-500/10 hover:border-rose-500/20 cursor-pointer transition-colors"
        >
          <FilterX className="h-3.5 w-3.5" />
          Clear filters
        </button>
      )}
    </GlassCard>
  );
}
