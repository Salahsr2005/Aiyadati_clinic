import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@/lib/queryClient";
import {
  Plus,
  Filter,
  Clock,
  Stethoscope,
  Phone,
  Loader2,
  Calendar as CalendarIcon,
  CalendarRange,
  User,
  UserPlus,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RotateCcw,
  Activity,
  X,
  Search,
  List,
  LayoutGrid,
  Columns3,
  UserX,
  Building2,
  RefreshCw,
  Zap,
  Sun,
  CalendarDays,
  DoorOpen,
} from "lucide-react";
import { format, addDays, startOfWeek, endOfWeek, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  clinicAppointmentsApi,
  type ClinicAppointmentRow,
  type AppointmentStatus,
  type GuestPatient,
} from "@/api/clinicAppointmentsApi";
import { useClinicDoctors } from "@/hooks/useClinicDoctors";
import { qk } from "@/lib/queryKeys";
import { useEntityMutation } from "@/lib/mutations";
import { GlassCard } from "@/components/glass/GlassCard";
import { Drawer } from "@/components/data/Drawer";
import { Pagination } from "@/components/data/Pagination";
import { EmptyState } from "@/components/data/EmptyState";
import { Skeleton } from "@/components/glass/Skeleton";
import { ModernDatePickerModal } from "@/components/ui/ModernDatePickerModal";
import { WalkInBookingModal } from "@/components/appointments/WalkInBookingModal";
import { DoctorSelectorModal, type DoctorCardItem } from "@/components/doctors/DoctorSelectorModal";
import { CopyReferenceButton } from "@/components/common/CopyReferenceButton";
import { RemoteImage } from "@/components/common/RemoteImage";
import { FormModal } from "@/components/data/FormModal";
import { ASSET_FALLBACKS } from "@/lib/assetFallbacks";
import { getDoctorColor } from "@/lib/doctorColor";
import { cn } from "@/lib/utils";

import findDoctorImg from "@/assets/home-quick-actions/find-doctor.png";

/* ──────────────────────────────────────────────────────────────
   APPOINTMENT LIFECYCLE — valid transitions
   ────────────────────────────────────────────────────────────── */
const VALID_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["IN_PROGRESS", "CANCELLED", "NO_SHOW"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

function canTransition(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return (VALID_TRANSITIONS[from] || []).includes(to);
}

/* ──────────────────────────────────────────────────────────────
   STATUS UI CONFIG
   ────────────────────────────────────────────────────────────── */
const STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; bg: string; text: string; ring: string; dot: string }
> = {
  PENDING: {
    label: "Pending",
    icon: Clock,
    bg: "bg-warning/15",
    text: "text-warning",
    ring: "ring-warning/30",
    dot: "bg-warning",
  },
  CONFIRMED: {
    label: "Confirmed",
    icon: CheckCircle2,
    bg: "bg-success/15",
    text: "text-success",
    ring: "ring-success/30",
    dot: "bg-success",
  },
  IN_PROGRESS: {
    label: "In Progress",
    icon: Activity,
    bg: "bg-blue-500/15",
    text: "text-blue-500",
    ring: "ring-blue-500/30",
    dot: "bg-blue-500",
  },
  COMPLETED: {
    label: "Completed",
    icon: CheckCircle2,
    bg: "bg-primary-500/15",
    text: "text-primary-500",
    ring: "ring-primary-500/30",
    dot: "bg-primary-500",
  },
  CANCELLED: {
    label: "Cancelled",
    icon: XCircle,
    bg: "bg-danger/15",
    text: "text-danger",
    ring: "ring-danger/30",
    dot: "bg-danger",
  },
  NO_SHOW: {
    label: "No Show",
    icon: AlertCircle,
    bg: "bg-muted/30",
    text: "text-muted-foreground",
    ring: "ring-border/30",
    dot: "bg-muted-foreground",
  },
};

const ALL_STATUSES: AppointmentStatus[] = [
  "PENDING",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
];

/* ──────────────────────────────────────────────────────────────
   PATIENT CREDENTIALS EXTRACTION
   ────────────────────────────────────────────────────────────── */
export interface ExtractedPatientInfo {
  isGuest: boolean;
  name: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  dateOfBirth?: string;
  notes?: string;
  avatarUrl: string;
  id?: string;
  needsFetch?: boolean;
}

function extractPatientDisplay(
  app: ClinicAppointmentRow,
  fetchedGuest?: GuestPatient,
): ExtractedPatientInfo {
  if (app.patientType === "REGISTERED" && !app.guestPatientId && !fetchedGuest) {
    const p = app.patient;
    const firstName = (p?.firstName || "").trim();
    const lastName = (p?.lastName || "").trim();
    const name = `${firstName} ${lastName}`.trim() || p?.name || "Registered Patient";
    return {
      id: p?.id || app.patientId,
      name,
      firstName,
      lastName,
      phone: p?.phone || "",
      email: p?.email,
      avatarUrl: p?.avatarUrl || findDoctorImg,
      isGuest: false,
    };
  }

  const g = fetchedGuest || app.guestPatient;
  const firstName = (g?.firstName || app.patient?.firstName || "").trim();
  const lastName = (g?.lastName || app.patient?.lastName || "").trim();
  const name = `${firstName} ${lastName}`.trim() || "Walk-In Guest";
  return {
    id: g?.id || app.guestPatientId,
    name,
    firstName,
    lastName,
    phone: g?.phone || app.patient?.phone || "",
    email: g?.email || app.patient?.email,
    dateOfBirth: g?.dateOfBirth,
    notes: g?.notes,
    avatarUrl: findDoctorImg,
    isGuest: true,
    needsFetch: !g && !!app.guestPatientId,
  };
}

function getDoctorName(app: ClinicAppointmentRow): string {
  const d = app.doctor;
  if (!d) return "Doctor";
  const first = d.firstNameFr || d.firstName || "";
  const last = d.lastNameFr || d.lastName || d.name || "";
  return `Dr. ${first} ${last}`.trim();
}

function getDoctorPhoto(app: ClinicAppointmentRow): string {
  return app.doctor?.photoUrl || app.doctor?.avatarUrl || findDoctorImg;
}

function getCancelledByLabel(app: ClinicAppointmentRow): string | null {
  if (app.status !== "CANCELLED" || !app.cancelledBy) return null;
  if (app.cancelledBy === app.patientId || app.cancelledBy === app.guestPatientId)
    return "Cancelled by Patient";
  if (app.cancelledBy === app.doctorId) return "Cancelled by Doctor";
  if (app.cancelledBy === app.clinicId) return "Cancelled by Clinic";
  return "Cancelled";
}

function getCancelledByIcon(app: ClinicAppointmentRow): React.ElementType {
  if (app.cancelledBy === app.patientId || app.cancelledBy === app.guestPatientId) return UserX;
  if (app.cancelledBy === app.doctorId) return Stethoscope;
  if (app.cancelledBy === app.clinicId) return Building2;
  return XCircle;
}

type ViewMode = "list" | "grid" | "kanban";
type DatePreset = "all" | "today" | "tomorrow" | "this_week" | "custom";

/* ══════════════════════════════════════════════════════════════
   PAGE COMPONENT
   ══════════════════════════════════════════════════════════════ */
export default function AppointmentsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Filters state
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [doctorFilter, setDoctorFilter] = useState<string>("");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [customDateStart, setCustomDateStart] = useState<string>("");
  const [customDateEnd, setCustomDateEnd] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  // Modals state
  const [bookModalOpen, setBookModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<ClinicAppointmentRow | null>(null);
  const [doctorSelectorOpen, setDoctorSelectorOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancellingApptId, setCancellingApptId] = useState<string>("");
  const [cancelReason, setCancelReason] = useState<string>("");

  const { acceptedDoctors } = useClinicDoctors();

  const doctorCardItems: DoctorCardItem[] = useMemo(
    () =>
      acceptedDoctors.map((doc) => {
        const d = doc.doctor as Record<string, unknown> | null | undefined;
        const f =
          (d?.firstNameFr as string) ||
          (d?.firstNameAr as string) ||
          (d?.firstName as string) ||
          "";
        const l =
          (d?.lastNameFr as string) || (d?.lastNameAr as string) || (d?.lastName as string) || "";
        const name = `${f} ${l}`.trim() || (d?.name as string) || "Doctor";
        const spec =
          Array.isArray(d?.specialties) && d.specialties.length > 0
            ? (d.specialties[0] as { nameFr?: string; nameAr?: string }).nameFr ||
              (d.specialties[0] as { nameFr?: string; nameAr?: string }).nameAr
            : (d?.specialtyName as string) ||
              ((d?.specialty as { nameFr?: string })?.nameFr as string) ||
              "Specialist";
        return {
          id: doc.id,
          doctorId: doc.doctorId,
          name: `Dr. ${name}`,
          specialty: spec,
          photoUrl: (d?.avatarUrl as string) || (d?.photoUrl as string),
          email: d?.email as string,
          phone: d?.phone as string,
          yearsOfExp: d?.yearsOfExp as number,
          status: doc.status,
          raw: doc,
        };
      }),
    [acceptedDoctors],
  );

  // Compute effective date query parameter
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const tomorrowStr = format(addDays(new Date(), 1), "yyyy-MM-dd");

  const effectiveDate = useMemo(() => {
    if (datePreset === "today") return todayStr;
    if (datePreset === "tomorrow") return tomorrowStr;
    if (datePreset === "custom" && customDateStart) return customDateStart;
    return undefined;
  }, [datePreset, todayStr, tomorrowStr, customDateStart]);

  // Overall & Today Statistics
  const { data: rawStats } = useQuery({
    queryKey: qk.clinicSelf.appointmentStats(),
    queryFn: () => clinicAppointmentsApi.getStats(),
  });

  const { data: todayStats } = useQuery({
    queryKey: qk.clinicSelf.appointmentStats(todayStr),
    queryFn: () => clinicAppointmentsApi.getStats({ date: todayStr }),
  });

  const stats = rawStats || {
    pending: 0,
    confirmed: 0,
    in_progress: 0,
    completed: 0,
    cancelled: 0,
    no_show: 0,
    total: 0,
  };

  // Appointments Query
  const {
    data: appointmentsData,
    isLoading,
    refetch: refetchAppointments,
  } = useQuery({
    queryKey: qk.clinicSelf.appointments({
      page,
      status: statusFilter,
      doctorId: doctorFilter,
      date: effectiveDate,
      search: searchQuery,
    }),
    queryFn: () =>
      clinicAppointmentsApi.listAppointments({
        page,
        limit: 20,
        status: statusFilter || undefined,
        doctorId: doctorFilter || undefined,
        date: effectiveDate,
        search: searchQuery || undefined,
      }),
  });

  const appointments = useMemo(() => appointmentsData?.data ?? [], [appointmentsData]);
  const totalPages = appointmentsData?.totalPages ?? 1;

  // Mutations
  const updateStatusMutation = useEntityMutation({
    mutationFn: ({
      id,
      status,
      cancelReason: reason,
    }: {
      id: string;
      status: string;
      cancelReason?: string;
    }) => clinicAppointmentsApi.updateStatus(id, { status, cancelReason: reason }),
    invalidate: [qk.clinicSelf.appointments(), qk.clinicSelf.appointmentStats()],
    successMessage: t("appointments.statusUpdated", { defaultValue: "Appointment status updated" }),
    onSuccess: () => {
      setSelectedAppointment(null);
      setCancelModalOpen(false);
      setCancellingApptId("");
      setCancelReason("");
      void queryClient.invalidateQueries({ queryKey: qk.clinicSelf.all() });
    },
  });

  const confirmMutation = useEntityMutation({
    mutationFn: (id: string) => clinicAppointmentsApi.confirmAppointment(id),
    invalidate: [qk.clinicSelf.appointments(), qk.clinicSelf.appointmentStats()],
    successMessage: t("appointments.confirmedSuccess", { defaultValue: "Appointment confirmed!" }),
    onSuccess: () => {
      setSelectedAppointment(null);
      void queryClient.invalidateQueries({ queryKey: qk.clinicSelf.all() });
    },
  });

  const hasFilters = !!(statusFilter || doctorFilter || datePreset !== "all" || searchQuery);

  const clearFilters = () => {
    setStatusFilter("");
    setDoctorFilter("");
    setDatePreset("all");
    setCustomDateStart("");
    setCustomDateEnd("");
    setSearchQuery("");
    setPage(1);
  };

  const handleOpenCancelModal = (apptId: string) => {
    setCancellingApptId(apptId);
    setCancelReason("");
    setCancelModalOpen(true);
  };

  const handleConfirmCancel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingApptId) return;
    updateStatusMutation.mutate({
      id: cancellingApptId,
      status: "CANCELLED",
      cancelReason: cancelReason.trim() || undefined,
    });
  };

  /* Kanban grouping */
  const kanbanGroups = useMemo(() => {
    const groups: Record<string, ClinicAppointmentRow[]> = {};
    for (const s of ALL_STATUSES) groups[s] = [];
    for (const app of appointments) {
      if (groups[app.status]) groups[app.status].push(app);
    }
    return groups;
  }, [appointments]);

  return (
    <div className="space-y-6 pb-24 md:pb-8">
      {/* ─── 1. Header Bar ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-foreground">
              {t("nav.appointments", { defaultValue: "Clinic Appointments" })}
            </h1>
            {stats.pending > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 border border-warning/30 px-2.5 py-0.5 text-xs font-bold text-warning animate-pulse">
                <Clock className="h-3 w-3" />
                {stats.pending} {t("status.PENDING", { defaultValue: "pending review" })}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("appointments.subtitle", {
              defaultValue:
                "Manage patient queues, confirm bookings, and process consultations across all doctors",
            })}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => {
              void queryClient.invalidateQueries({ queryKey: qk.clinicSelf.all() });
              toast.success(t("common.refreshed", { defaultValue: "Appointments refreshed" }));
            }}
            className="grid h-9 w-9 place-items-center rounded-2xl glass border border-border/40 text-muted-foreground hover:text-foreground transition cursor-pointer"
            title={t("common.refresh", { defaultValue: "Refresh" })}
          >
            <RefreshCw className="h-4 w-4" />
          </button>

          {/* Book Appointment CTA */}
          <button
            type="button"
            onClick={() => setBookModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-xs font-bold text-primary-foreground shadow-md hover:opacity-90 transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>{t("patients.createGuestButton", { defaultValue: "Book Appointment" })}</span>
          </button>
        </div>
      </div>

      {/* ─── 2. Top KPI Status Ribbon (Clickable!) ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {/* KPI 1: Today's Appointments */}
        <button
          type="button"
          onClick={() => {
            setDatePreset(datePreset === "today" ? "all" : "today");
            setPage(1);
          }}
          className={cn(
            "p-3 rounded-2xl border text-start transition cursor-pointer flex flex-col justify-between group",
            datePreset === "today"
              ? "border-primary-500 bg-primary-500/10 ring-2 ring-primary-500/20"
              : "border-border/40 glass hover:border-border hover:bg-card/70",
          )}
        >
          <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground">
            <span className="flex items-center gap-1">
              <Sun className="h-3 w-3 text-amber-500" />
              {t("appointments.kpi.today", { defaultValue: "Today's Agenda" })}
            </span>
          </div>
          <div className="mt-2 text-xl font-mono font-black text-foreground">
            {todayStats?.total ?? 0}
          </div>
        </button>

        {/* KPI 2: Pending Confirmation */}
        <button
          type="button"
          onClick={() => {
            setStatusFilter(statusFilter === "PENDING" ? "" : "PENDING");
            setPage(1);
          }}
          className={cn(
            "p-3 rounded-2xl border text-start transition cursor-pointer flex flex-col justify-between group",
            statusFilter === "PENDING"
              ? "border-warning bg-warning/15 ring-2 ring-warning/30"
              : "border-border/40 glass hover:border-border hover:bg-card/70",
          )}
        >
          <div className="flex items-center justify-between text-[11px] font-bold text-warning">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {t("status.PENDING", { defaultValue: "Pending" })}
            </span>
            {stats.pending > 0 && <span className="h-2 w-2 rounded-full bg-warning animate-ping" />}
          </div>
          <div className="mt-2 text-xl font-mono font-black text-warning">{stats.pending}</div>
        </button>

        {/* KPI 3: Confirmed */}
        <button
          type="button"
          onClick={() => {
            setStatusFilter(statusFilter === "CONFIRMED" ? "" : "CONFIRMED");
            setPage(1);
          }}
          className={cn(
            "p-3 rounded-2xl border text-start transition cursor-pointer flex flex-col justify-between group",
            statusFilter === "CONFIRMED"
              ? "border-success bg-success/15 ring-2 ring-success/30"
              : "border-border/40 glass hover:border-border hover:bg-card/70",
          )}
        >
          <div className="flex items-center justify-between text-[11px] font-bold text-success">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              {t("status.CONFIRMED", { defaultValue: "Confirmed" })}
            </span>
          </div>
          <div className="mt-2 text-xl font-mono font-black text-success">{stats.confirmed}</div>
        </button>

        {/* KPI 4: In Progress */}
        <button
          type="button"
          onClick={() => {
            setStatusFilter(statusFilter === "IN_PROGRESS" ? "" : "IN_PROGRESS");
            setPage(1);
          }}
          className={cn(
            "p-3 rounded-2xl border text-start transition cursor-pointer flex flex-col justify-between group",
            statusFilter === "IN_PROGRESS"
              ? "border-blue-500 bg-blue-500/15 ring-2 ring-blue-500/30"
              : "border-border/40 glass hover:border-border hover:bg-card/70",
          )}
        >
          <div className="flex items-center justify-between text-[11px] font-bold text-blue-500">
            <span className="flex items-center gap-1">
              <Activity className="h-3 w-3" />
              {t("status.IN_PROGRESS", { defaultValue: "In Clinic" })}
            </span>
          </div>
          <div className="mt-2 text-xl font-mono font-black text-blue-500">{stats.in_progress}</div>
        </button>

        {/* KPI 5: Completed */}
        <button
          type="button"
          onClick={() => {
            setStatusFilter(statusFilter === "COMPLETED" ? "" : "COMPLETED");
            setPage(1);
          }}
          className={cn(
            "p-3 rounded-2xl border text-start transition cursor-pointer flex flex-col justify-between group",
            statusFilter === "COMPLETED"
              ? "border-primary-500 bg-primary-500/15 ring-2 ring-primary-500/30"
              : "border-border/40 glass hover:border-border hover:bg-card/70",
          )}
        >
          <div className="flex items-center justify-between text-[11px] font-bold text-primary-500">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              {t("status.COMPLETED", { defaultValue: "Completed" })}
            </span>
          </div>
          <div className="mt-2 text-xl font-mono font-black text-primary-500">
            {stats.completed}
          </div>
        </button>

        {/* KPI 6: Cancelled */}
        <button
          type="button"
          onClick={() => {
            setStatusFilter(statusFilter === "CANCELLED" ? "" : "CANCELLED");
            setPage(1);
          }}
          className={cn(
            "p-3 rounded-2xl border text-start transition cursor-pointer flex flex-col justify-between group",
            statusFilter === "CANCELLED"
              ? "border-danger bg-danger/15 ring-2 ring-danger/30"
              : "border-border/40 glass hover:border-border hover:bg-card/70",
          )}
        >
          <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground">
            <span className="flex items-center gap-1">
              <XCircle className="h-3 w-3 text-danger" />
              {t("status.CANCELLED", { defaultValue: "Cancelled" })}
            </span>
          </div>
          <div className="mt-2 text-xl font-mono font-black text-danger">
            {stats.cancelled + stats.no_show}
          </div>
        </button>
      </div>

      {/* ─── 3. Filter & Control Center ─── */}
      <GlassCard className="p-4 space-y-3.5 border border-border/40">
        {/* Row 1: Search + Date Presets + View Toggles */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder={t("patients.searchPlaceholder", {
                defaultValue: "Search patient name, phone, or appointment ID...",
              })}
              className="glass w-full rounded-xl ps-9 pe-8 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-primary-500/40"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Quick Date Presets */}
          <div className="flex items-center p-1 rounded-xl bg-muted/30 border border-border/30 overflow-x-auto custom-scrollbar">
            {(
              [
                { id: "all", label: t("common.allDates", { defaultValue: "All Dates" }) },
                { id: "today", label: t("common.today", { defaultValue: "Today" }) },
                { id: "tomorrow", label: t("common.tomorrow", { defaultValue: "Tomorrow" }) },
              ] as const
            ).map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  setDatePreset(preset.id);
                  setPage(1);
                }}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer whitespace-nowrap",
                  datePreset === preset.id
                    ? "bg-primary-500 text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {preset.label}
              </button>
            ))}

            {/* Custom Date Picker */}
            <div className="ms-1">
              <ModernDatePickerModal
                mode="single"
                value={customDateStart}
                onSelect={(d) => {
                  setCustomDateStart(d);
                  setDatePreset("custom");
                  setPage(1);
                }}
                placeholder={t("filters.customDate", { defaultValue: "Custom Date..." })}
              />
            </div>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center rounded-xl bg-muted/30 border border-border/30 p-0.5 ms-auto">
            {(
              [
                {
                  mode: "list" as ViewMode,
                  icon: List,
                  label: t("views.table", { defaultValue: "List" }),
                },
                {
                  mode: "grid" as ViewMode,
                  icon: LayoutGrid,
                  label: t("views.grid", { defaultValue: "Grid" }),
                },
                {
                  mode: "kanban" as ViewMode,
                  icon: Columns3,
                  label: t("views.kanban", { defaultValue: "Board" }),
                },
              ] as const
            ).map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                title={label}
                className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer",
                  viewMode === mode
                    ? "bg-primary-500 text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 text-xs text-primary-500 font-bold hover:underline cursor-pointer px-1"
            >
              <RotateCcw className="h-3 w-3" />
              <span>{t("filters.reset", { defaultValue: "Reset" })}</span>
            </button>
          )}
        </div>

        {/* Row 2: Doctor Switcher Strip (Horizontal Carousel) */}
        {doctorCardItems.length > 0 && (
          <div className="pt-2 border-t border-border/20 flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
            <button
              type="button"
              onClick={() => {
                setDoctorFilter("");
                setPage(1);
              }}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 border",
                !doctorFilter
                  ? "bg-primary-500 text-primary-foreground border-primary-500 shadow-xs"
                  : "border-border/40 text-muted-foreground hover:text-foreground bg-card/40",
              )}
            >
              <Stethoscope className="h-3.5 w-3.5" />
              <span>{t("doctors.allTab", { defaultValue: "All Practitioners" })}</span>
            </button>

            {doctorCardItems.map((doc) => {
              const isSelected = doctorFilter === doc.doctorId;
              const dColor = getDoctorColor(doc.doctorId);
              return (
                <button
                  key={doc.doctorId}
                  type="button"
                  onClick={() => {
                    setDoctorFilter(isSelected ? "" : doc.doctorId);
                    setPage(1);
                  }}
                  className={cn(
                    "flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer shrink-0",
                    isSelected
                      ? "border-primary-500 shadow-xs ring-2 ring-primary-500/20"
                      : "border-border/40 bg-card/40 text-muted-foreground hover:text-foreground",
                  )}
                  style={{
                    backgroundColor: isSelected ? `${dColor.hex}15` : undefined,
                    borderColor: isSelected ? dColor.hex : undefined,
                  }}
                >
                  <div
                    className="h-5 w-5 rounded-full overflow-hidden border shrink-0"
                    style={{ borderColor: dColor.hex }}
                  >
                    <RemoteImage
                      src={doc.photoUrl}
                      alt={doc.name}
                      fallback={ASSET_FALLBACKS.doctorPhoto}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <span className="text-foreground truncate max-w-[130px]">{doc.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </GlassCard>

      {/* ─── 4. Main Appointments Content ─── */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : appointments.length === 0 ? (
        <GlassCard className="p-8 border border-border/40">
          <EmptyState
            title={t("common.empty", { defaultValue: "No appointments found" })}
            description={
              hasFilters
                ? t("filters.tryReset", {
                    defaultValue: "Try adjusting your filters or search query",
                  })
                : t("appointments.noBookingsYet", {
                    defaultValue:
                      "No appointments have been booked yet. Click 'Book Appointment' to add one.",
                  })
            }
            action={
              <button
                type="button"
                onClick={() => setBookModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 cursor-pointer shadow-sm"
              >
                <Plus className="h-4 w-4" />
                <span>{t("patients.createGuestButton", { defaultValue: "Book Appointment" })}</span>
              </button>
            }
          />
        </GlassCard>
      ) : (
        <div className="space-y-4">
          {viewMode === "list" && (
            <ListView
              appointments={appointments}
              onSelect={setSelectedAppointment}
              onConfirm={(id) => confirmMutation.mutate(id)}
              onTransition={(id, status) => updateStatusMutation.mutate({ id, status })}
              onCancel={(id) => handleOpenCancelModal(id)}
              isActionPending={confirmMutation.isPending || updateStatusMutation.isPending}
            />
          )}

          {viewMode === "grid" && (
            <GridView
              appointments={appointments}
              onSelect={setSelectedAppointment}
              onConfirm={(id) => confirmMutation.mutate(id)}
              onTransition={(id, status) => updateStatusMutation.mutate({ id, status })}
              onCancel={(id) => handleOpenCancelModal(id)}
              isActionPending={confirmMutation.isPending || updateStatusMutation.isPending}
            />
          )}

          {viewMode === "kanban" && (
            <KanbanView
              groups={kanbanGroups}
              onSelect={setSelectedAppointment}
              onConfirm={(id) => confirmMutation.mutate(id)}
              onTransition={(id, status) => updateStatusMutation.mutate({ id, status })}
              onCancel={(id) => handleOpenCancelModal(id)}
              isActionPending={confirmMutation.isPending || updateStatusMutation.isPending}
            />
          )}

          {viewMode !== "kanban" && (
            <Pagination
              page={page}
              totalPages={totalPages}
              total={appointmentsData?.total ?? appointments.length}
              limit={20}
              onPage={(p: number) => setPage(p)}
            />
          )}
        </div>
      )}

      {/* ─── 5. Walk-in Booking Drawer ─── */}
      <WalkInBookingModal
        open={bookModalOpen}
        onClose={() => setBookModalOpen(false)}
        onSuccess={() => {
          void refetchAppointments();
        }}
      />

      {/* ─── 6. Doctor Selector (Search Modal) ─── */}
      <DoctorSelectorModal
        open={doctorSelectorOpen}
        onClose={() => setDoctorSelectorOpen(false)}
        doctors={[
          {
            id: "all",
            doctorId: "",
            name: t("doctors.allTab", { defaultValue: "All Doctors" }),
            specialty: "Show all appointments",
            status: "active",
          },
          ...doctorCardItems,
        ]}
        selectedDoctorId={doctorFilter}
        onSelectDoctor={(doc) => {
          setDoctorFilter(doc.doctorId);
          setPage(1);
        }}
        title={t("doctors.selectorTitle", { defaultValue: "Filter by Doctor" })}
        subtitle={t("doctors.selectorSub", {
          defaultValue: "Select a doctor to filter appointments",
        })}
      />

      {/* ─── 7. Appointment Detail Drawer ─── */}
      <Drawer
        id="appointment-detail-drawer"
        open={!!selectedAppointment}
        onClose={() => setSelectedAppointment(null)}
        title={t("common.details", { defaultValue: "Appointment Details" })}
        subtitle={selectedAppointment ? `Ref ID: ${selectedAppointment.id}` : undefined}
        width="max-w-xl"
        footer={
          selectedAppointment && (
            <DrawerFooterActions
              app={selectedAppointment}
              onConfirm={() => confirmMutation.mutate(selectedAppointment.id)}
              onTransition={(status) =>
                updateStatusMutation.mutate({ id: selectedAppointment.id, status })
              }
              onCancel={() => handleOpenCancelModal(selectedAppointment.id)}
              isUpdating={updateStatusMutation.isPending || confirmMutation.isPending}
            />
          )
        }
      >
        {selectedAppointment && (
          <AppointmentDetailContent
            appointment={selectedAppointment}
            onStatusChange={(status, reason) =>
              updateStatusMutation.mutate({
                id: selectedAppointment.id,
                status,
                cancelReason: reason,
              })
            }
            onConfirm={() => confirmMutation.mutate(selectedAppointment.id)}
            onCancel={() => handleOpenCancelModal(selectedAppointment.id)}
            isUpdating={updateStatusMutation.isPending || confirmMutation.isPending}
          />
        )}
      </Drawer>

      {/* ─── 8. Cancel Reason Modal ─── */}
      <FormModal
        id="cancel-appointment-modal"
        open={cancelModalOpen}
        onClose={() => {
          setCancelModalOpen(false);
          setCancellingApptId("");
        }}
        title={t("appointments.cancelTitle", { defaultValue: "Cancel Appointment" })}
        description={t("appointments.cancelDesc", {
          defaultValue: "Provide an optional cancellation reason for patient records.",
        })}
      >
        <form onSubmit={handleConfirmCancel} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground">
              {t("schedule.cancelReason", { defaultValue: "Cancellation Reason" })}
            </label>
            <input
              type="text"
              placeholder={t("schedule.reasonPlaceholder", {
                defaultValue: "e.g. Patient requested cancellation / Rescheduled",
              })}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="glass w-full rounded-xl px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
            />
          </div>

          <div className="p-3 rounded-2xl bg-danger/10 border border-danger/20 text-xs text-danger flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              {t("appointments.cancelWarning", {
                defaultValue:
                  "This appointment will be marked as Cancelled. Patient records will be preserved.",
              })}
            </span>
          </div>

          <div className="pt-4 border-t border-border/40 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setCancelModalOpen(false);
                setCancellingApptId("");
              }}
              className="rounded-xl px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-accent cursor-pointer"
            >
              {t("common.cancel", { defaultValue: "Close" })}
            </button>
            <button
              type="submit"
              disabled={updateStatusMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-danger px-4 py-2 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50 cursor-pointer shadow-md"
            >
              {updateStatusMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {t("appointments.confirmCancelBtn", { defaultValue: "Confirm Cancellation" })}
            </button>
          </div>
        </form>
      </FormModal>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   LIST VIEW (Tight & Productive for Receptionists)
   ══════════════════════════════════════════════════════════════ */
function ListView({
  appointments,
  onSelect,
  onConfirm,
  onTransition,
  onCancel,
  isActionPending,
}: {
  appointments: ClinicAppointmentRow[];
  onSelect: (a: ClinicAppointmentRow) => void;
  onConfirm: (id: string) => void;
  onTransition: (id: string, status: string) => void;
  onCancel: (id: string) => void;
  isActionPending: boolean;
}) {
  return (
    <div className="divide-y divide-border/40 rounded-2xl glass border border-border/40 overflow-hidden shadow-sm">
      {appointments.map((app) => (
        <AppointmentListRow
          key={app.id}
          app={app}
          onSelect={onSelect}
          onConfirm={onConfirm}
          onTransition={onTransition}
          onCancel={onCancel}
          isActionPending={isActionPending}
        />
      ))}
    </div>
  );
}

function AppointmentListRow({
  app,
  onSelect,
  onConfirm,
  onTransition,
  onCancel,
  isActionPending,
}: {
  app: ClinicAppointmentRow;
  onSelect: (a: ClinicAppointmentRow) => void;
  onConfirm: (id: string) => void;
  onTransition: (id: string, status: string) => void;
  onCancel: (id: string) => void;
  isActionPending: boolean;
}) {
  const { t } = useTranslation();
  const patient = extractPatientDisplay(app);
  const doctorName = getDoctorName(app);
  const doctorPhoto = getDoctorPhoto(app);
  const doctorColor = app.doctorId ? getDoctorColor(app.doctorId) : null;
  const statusCfg = STATUS_CONFIG[app.status] || STATUS_CONFIG.PENDING;
  const StatusIcon = statusCfg.icon;
  const cancelLabel = getCancelledByLabel(app);
  const createdAgo = app.createdAt
    ? formatDistanceToNow(new Date(app.createdAt), { addSuffix: true })
    : null;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 gap-3 hover:bg-accent/40 transition group">
      {/* Patient & Doctor details (Click opens drawer) */}
      <div
        onClick={() => onSelect(app)}
        className="flex items-center gap-3.5 min-w-0 cursor-pointer flex-1"
      >
        <div className="relative h-10 w-10 rounded-2xl overflow-hidden bg-primary-500/10 border border-border/40 shrink-0">
          <RemoteImage
            src={patient.avatarUrl}
            alt={patient.name}
            fallback={ASSET_FALLBACKS.userAvatar}
            className="h-full w-full object-cover"
          />
          {patient.isGuest && (
            <span className="absolute -top-0.5 -end-0.5 h-4 w-4 rounded-full bg-amber-500 text-white grid place-items-center text-[9px] font-bold shadow-xs">
              G
            </span>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-extrabold text-foreground truncate group-hover:text-primary-500 transition">
              {patient.name}
            </h4>
            {patient.isGuest ? (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-bold text-amber-600 uppercase shrink-0">
                {t("patients.guestPatients", { defaultValue: "Guest" })}
              </span>
            ) : (
              <span className="rounded-full bg-primary-500/15 px-2 py-0.5 text-[9px] font-bold text-primary-500 uppercase shrink-0">
                {t("patients.appRegistered", { defaultValue: "App" })}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-0.5">
            <div
              className="h-4 w-4 rounded-full overflow-hidden border shrink-0"
              style={{ borderColor: doctorColor?.hex }}
            >
              <RemoteImage
                src={doctorPhoto}
                alt=""
                fallback={ASSET_FALLBACKS.doctorPhoto}
                className="h-full w-full object-cover"
              />
            </div>
            <p className="text-[11px] font-semibold text-muted-foreground truncate">{doctorName}</p>
          </div>

          {patient.phone && (
            <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5 font-mono">
              <Phone className="h-2.5 w-2.5 text-primary-500" /> {patient.phone}
            </p>
          )}
        </div>
      </div>

      {/* Date & Time Slot */}
      <div
        onClick={() => onSelect(app)}
        className="flex items-center gap-4 text-xs shrink-0 cursor-pointer sm:border-s sm:border-border/30 sm:ps-4"
      >
        <div className="text-start sm:text-end space-y-0.5 min-w-[90px]">
          <div className="font-semibold text-xs flex items-center gap-1 sm:justify-end">
            <CalendarIcon className="h-3 w-3 text-muted-foreground" />
            <span className="font-mono">{app.slot?.date || "TBD"}</span>
          </div>
          <div className="flex items-center gap-1 sm:justify-end text-muted-foreground text-[11px]">
            <Clock className="h-3 w-3 text-primary-500" />
            <span className="font-mono font-bold text-foreground">
              {app.slot?.startTime?.slice(0, 5) || "—"}
            </span>
          </div>
          {createdAgo && <p className="text-[9px] text-muted-foreground/60">{createdAgo}</p>}
        </div>

        {/* Status Badge */}
        <div className="flex flex-col items-end gap-1 min-w-[85px]">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold",
              statusCfg.bg,
              statusCfg.text,
            )}
          >
            <StatusIcon className="h-3 w-3" />
            {t(`status.${app.status}`, { defaultValue: statusCfg.label })}
          </span>
          {cancelLabel && (
            <span className="text-[9px] font-semibold text-danger/80">{cancelLabel}</span>
          )}
        </div>
      </div>

      {/* ─── Fast Inline Actions ─── */}
      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center pt-2 sm:pt-0 border-t sm:border-t-0 border-border/20">
        {/* PENDING: 1-click Confirm */}
        {app.status === "PENDING" && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onConfirm(app.id);
            }}
            disabled={isActionPending}
            className="inline-flex items-center gap-1 rounded-xl bg-success px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:opacity-90 transition cursor-pointer disabled:opacity-50"
            title="Confirm Appointment"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>{t("status.CONFIRMED", { defaultValue: "Confirm" })}</span>
          </button>
        )}

        {/* CONFIRMED: 1-click Start / In-Progress */}
        {app.status === "CONFIRMED" && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTransition(app.id, "IN_PROGRESS");
            }}
            disabled={isActionPending}
            className="inline-flex items-center gap-1 rounded-xl bg-blue-500 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:opacity-90 transition cursor-pointer disabled:opacity-50"
            title="Start Consultation"
          >
            <Activity className="h-3.5 w-3.5" />
            <span>{t("status.IN_PROGRESS", { defaultValue: "Start" })}</span>
          </button>
        )}

        {/* IN_PROGRESS: 1-click Complete */}
        {app.status === "IN_PROGRESS" && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTransition(app.id, "COMPLETED");
            }}
            disabled={isActionPending}
            className="inline-flex items-center gap-1 rounded-xl bg-primary-500 px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-xs hover:opacity-90 transition cursor-pointer disabled:opacity-50"
            title="Complete Consultation"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>{t("status.COMPLETED", { defaultValue: "Complete" })}</span>
          </button>
        )}

        {/* Cancel button if active */}
        {["PENDING", "CONFIRMED"].includes(app.status) && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCancel(app.id);
            }}
            disabled={isActionPending}
            className="grid h-8 w-8 place-items-center rounded-xl border border-border/40 text-muted-foreground hover:text-danger hover:border-danger/30 transition cursor-pointer disabled:opacity-50"
            title="Cancel Appointment"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}

        {/* View Details arrow */}
        <button
          type="button"
          onClick={() => onSelect(app)}
          className="grid h-8 w-8 place-items-center rounded-xl glass border border-border/40 text-muted-foreground hover:text-primary-500 transition cursor-pointer"
          title="View Details"
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   GRID VIEW (Visual Cards with Inline Quick Actions)
   ══════════════════════════════════════════════════════════════ */
function GridView({
  appointments,
  onSelect,
  onConfirm,
  onTransition,
  onCancel,
  isActionPending,
}: {
  appointments: ClinicAppointmentRow[];
  onSelect: (a: ClinicAppointmentRow) => void;
  onConfirm: (id: string) => void;
  onTransition: (id: string, status: string) => void;
  onCancel: (id: string) => void;
  isActionPending: boolean;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {appointments.map((app) => (
        <AppointmentGridCard
          key={app.id}
          app={app}
          onSelect={onSelect}
          onConfirm={onConfirm}
          onTransition={onTransition}
          onCancel={onCancel}
          isActionPending={isActionPending}
        />
      ))}
    </div>
  );
}

function AppointmentGridCard({
  app,
  onSelect,
  onConfirm,
  onTransition,
  onCancel,
  isActionPending,
}: {
  app: ClinicAppointmentRow;
  onSelect: (a: ClinicAppointmentRow) => void;
  onConfirm: (id: string) => void;
  onTransition: (id: string, status: string) => void;
  onCancel: (id: string) => void;
  isActionPending: boolean;
}) {
  const { t } = useTranslation();
  const patient = extractPatientDisplay(app);
  const doctorName = getDoctorName(app);
  const doctorPhoto = getDoctorPhoto(app);
  const doctorColor = app.doctorId ? getDoctorColor(app.doctorId) : null;
  const statusCfg = STATUS_CONFIG[app.status] || STATUS_CONFIG.PENDING;
  const StatusIcon = statusCfg.icon;
  const cancelLabel = getCancelledByLabel(app);

  return (
    <div className="glass rounded-2xl border border-border/40 p-4 space-y-3 hover:border-primary-500/50 hover:shadow-md transition-all flex flex-col justify-between group">
      {/* Top Header: Status Badge & Type */}
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold",
            statusCfg.bg,
            statusCfg.text,
          )}
        >
          <StatusIcon className="h-3 w-3" />
          {t(`status.${app.status}`, { defaultValue: statusCfg.label })}
        </span>

        <div className="flex items-center gap-1">
          {patient.isGuest ? (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-extrabold text-amber-600 uppercase">
              Guest
            </span>
          ) : (
            <span className="rounded-full bg-primary-500/15 px-2 py-0.5 text-[9px] font-extrabold text-primary-500 uppercase">
              App
            </span>
          )}
        </div>
      </div>

      {/* Patient Section */}
      <div onClick={() => onSelect(app)} className="flex items-center gap-3 cursor-pointer">
        <div className="relative h-10 w-10 rounded-2xl overflow-hidden bg-primary-500/10 border border-border/40 shrink-0">
          <RemoteImage
            src={patient.avatarUrl}
            alt={patient.name}
            fallback={ASSET_FALLBACKS.userAvatar}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-xs font-extrabold text-foreground truncate group-hover:text-primary-500 transition">
            {patient.name}
          </h4>
          {patient.phone ? (
            <p className="text-[10px] text-muted-foreground font-mono flex items-center gap-1 mt-0.5">
              <Phone className="h-2.5 w-2.5 text-primary-500 shrink-0" />
              <span className="truncate">{patient.phone}</span>
            </p>
          ) : (
            <p className="text-[10px] text-muted-foreground/60 italic">No phone</p>
          )}
        </div>
      </div>

      {/* Practitioner Tag */}
      <div className="flex items-center gap-2 pt-2 border-t border-border/20">
        <div
          className="h-5 w-5 rounded-full overflow-hidden border shrink-0"
          style={{ borderColor: doctorColor?.hex }}
        >
          <RemoteImage
            src={doctorPhoto}
            alt={doctorName}
            fallback={ASSET_FALLBACKS.doctorPhoto}
            className="h-full w-full object-cover"
          />
        </div>
        <span className="text-[11px] font-bold text-foreground truncate">{doctorName}</span>
      </div>

      {/* Date & Time Footer */}
      <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground bg-muted/20 p-2 rounded-xl border border-border/20">
        <div className="flex items-center gap-1">
          <CalendarIcon className="h-3 w-3 text-primary-500" />
          <span className="text-foreground font-mono">{app.slot?.date || "TBD"}</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3 text-primary-500" />
          <span className="text-foreground font-mono font-bold">
            {app.slot?.startTime?.slice(0, 5) || "—"}
          </span>
        </div>
      </div>

      {/* Cancel notice if cancelled */}
      {cancelLabel && (
        <div className="text-[9px] font-bold text-danger/80 bg-danger/10 rounded-xl px-2 py-1 text-center border border-danger/20">
          {cancelLabel}
        </div>
      )}

      {/* Card Action Footer */}
      <div className="pt-2 border-t border-border/20 flex items-center justify-between gap-1.5">
        <button
          type="button"
          onClick={() => onSelect(app)}
          className="text-[11px] font-bold text-muted-foreground hover:text-foreground cursor-pointer"
        >
          {t("common.details", { defaultValue: "Details" })}
        </button>

        <div className="flex items-center gap-1">
          {app.status === "PENDING" && (
            <button
              type="button"
              onClick={() => onConfirm(app.id)}
              disabled={isActionPending}
              className="inline-flex items-center gap-1 rounded-xl bg-success px-2.5 py-1 text-[11px] font-bold text-white hover:opacity-90 disabled:opacity-50 cursor-pointer shadow-xs"
            >
              <CheckCircle2 className="h-3 w-3" /> Confirm
            </button>
          )}

          {app.status === "CONFIRMED" && (
            <button
              type="button"
              onClick={() => onTransition(app.id, "IN_PROGRESS")}
              disabled={isActionPending}
              className="inline-flex items-center gap-1 rounded-xl bg-blue-500 px-2.5 py-1 text-[11px] font-bold text-white hover:opacity-90 disabled:opacity-50 cursor-pointer shadow-xs"
            >
              <Activity className="h-3 w-3" /> Start
            </button>
          )}

          {app.status === "IN_PROGRESS" && (
            <button
              type="button"
              onClick={() => onTransition(app.id, "COMPLETED")}
              disabled={isActionPending}
              className="inline-flex items-center gap-1 rounded-xl bg-primary-500 px-2.5 py-1 text-[11px] font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50 cursor-pointer shadow-xs"
            >
              <CheckCircle2 className="h-3 w-3" /> Complete
            </button>
          )}

          {["PENDING", "CONFIRMED"].includes(app.status) && (
            <button
              type="button"
              onClick={() => onCancel(app.id)}
              disabled={isActionPending}
              className="grid h-7 w-7 place-items-center rounded-xl border border-border/40 text-muted-foreground hover:text-danger hover:border-danger/30 transition cursor-pointer"
              title="Cancel"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   KANBAN BOARD VIEW
   ══════════════════════════════════════════════════════════════ */
function KanbanView({
  groups,
  onSelect,
  onConfirm,
  onTransition,
  onCancel,
  isActionPending,
}: {
  groups: Record<string, ClinicAppointmentRow[]>;
  onSelect: (a: ClinicAppointmentRow) => void;
  onConfirm: (id: string) => void;
  onTransition: (id: string, status: string) => void;
  onCancel: (id: string) => void;
  isActionPending: boolean;
}) {
  const { t } = useTranslation();
  const activeStatuses = ALL_STATUSES.filter(
    (s) => groups[s]?.length > 0 || ["PENDING", "CONFIRMED", "IN_PROGRESS"].includes(s),
  );

  return (
    <div className="flex gap-3.5 overflow-x-auto pb-4 custom-scrollbar">
      {activeStatuses.map((status) => {
        const cfg = STATUS_CONFIG[status];
        const Icon = cfg.icon;
        const items = groups[status] || [];
        const statusLabel = t(`status.${status}`, { defaultValue: cfg.label });

        return (
          <div key={status} className="flex-shrink-0 w-80 space-y-2">
            {/* Column header */}
            <div
              className={cn(
                "flex items-center justify-between p-3 rounded-2xl border border-border/30",
                cfg.bg,
              )}
            >
              <div className="flex items-center gap-2">
                <Icon className={cn("h-4 w-4", cfg.text)} />
                <span className={cn("text-xs font-extrabold", cfg.text)}>{statusLabel}</span>
              </div>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-mono font-bold",
                  cfg.bg,
                  cfg.text,
                )}
              >
                {items.length}
              </span>
            </div>

            {/* Column cards container */}
            <div className="glass border border-border/30 rounded-2xl min-h-[220px] max-h-[640px] overflow-y-auto custom-scrollbar space-y-2.5 p-2.5">
              {items.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-[11px] text-muted-foreground/50">
                  {t("common.empty", { defaultValue: "No appointments" })}
                </div>
              ) : (
                items.map((app) => (
                  <KanbanCard
                    key={app.id}
                    app={app}
                    onSelect={onSelect}
                    onConfirm={onConfirm}
                    onTransition={onTransition}
                    onCancel={onCancel}
                    isActionPending={isActionPending}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KanbanCard({
  app,
  onSelect,
  onConfirm,
  onTransition,
  onCancel,
  isActionPending,
}: {
  app: ClinicAppointmentRow;
  onSelect: (a: ClinicAppointmentRow) => void;
  onConfirm: (id: string) => void;
  onTransition: (id: string, status: string) => void;
  onCancel: (id: string) => void;
  isActionPending: boolean;
}) {
  const { t } = useTranslation();
  const patient = extractPatientDisplay(app);
  const doctorName = getDoctorName(app);
  const doctorPhoto = getDoctorPhoto(app);
  const doctorColor = app.doctorId ? getDoctorColor(app.doctorId) : null;
  const cancelLabel = getCancelledByLabel(app);

  return (
    <div className="p-3.5 rounded-xl bg-card border border-border/30 hover:border-primary-500/40 transition cursor-pointer space-y-2.5 shadow-xs">
      <div onClick={() => onSelect(app)} className="flex items-center gap-2.5">
        <div className="relative h-8 w-8 rounded-xl overflow-hidden bg-primary-500/10 border border-border/40 shrink-0">
          <RemoteImage
            src={patient.avatarUrl}
            alt={patient.name}
            fallback={ASSET_FALLBACKS.userAvatar}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 justify-between">
            <h4 className="text-[11px] font-extrabold truncate">{patient.name}</h4>
            {patient.isGuest && (
              <span className="rounded-full bg-amber-500/15 px-1.5 py-0.2 text-[8px] font-extrabold text-amber-600 uppercase">
                Guest
              </span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground font-mono truncate">
            {patient.phone || "No phone"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 pt-1.5 border-t border-border/20">
        <div
          className="h-4 w-4 rounded-full overflow-hidden border shrink-0"
          style={{ borderColor: doctorColor?.hex }}
        >
          <RemoteImage
            src={doctorPhoto}
            alt=""
            fallback={ASSET_FALLBACKS.doctorPhoto}
            className="h-full w-full object-cover"
          />
        </div>
        <span className="text-[10px] font-semibold text-muted-foreground truncate">
          {doctorName}
        </span>
      </div>

      <div className="flex items-center justify-between text-[10px] text-muted-foreground bg-muted/20 px-2 py-1 rounded-lg font-mono">
        <span>{app.slot?.date || "TBD"}</span>
        <span className="font-bold text-foreground">{app.slot?.startTime?.slice(0, 5) || "—"}</span>
      </div>

      {cancelLabel && (
        <span className="text-[9px] font-bold text-danger/80 block">{cancelLabel}</span>
      )}

      {/* Inline Quick Action Footer */}
      <div className="pt-2 border-t border-border/20 flex items-center justify-end gap-1">
        {app.status === "PENDING" && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onConfirm(app.id);
            }}
            disabled={isActionPending}
            className="rounded-lg bg-success px-2 py-0.5 text-[10px] font-bold text-white hover:opacity-90 disabled:opacity-50"
          >
            Confirm
          </button>
        )}

        {app.status === "CONFIRMED" && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTransition(app.id, "IN_PROGRESS");
            }}
            disabled={isActionPending}
            className="rounded-lg bg-blue-500 px-2 py-0.5 text-[10px] font-bold text-white hover:opacity-90 disabled:opacity-50"
          >
            Start
          </button>
        )}

        {app.status === "IN_PROGRESS" && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTransition(app.id, "COMPLETED");
            }}
            disabled={isActionPending}
            className="rounded-lg bg-primary-500 px-2 py-0.5 text-[10px] font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            Complete
          </button>
        )}

        {["PENDING", "CONFIRMED"].includes(app.status) && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCancel(app.id);
            }}
            disabled={isActionPending}
            className="rounded-lg border border-border/40 px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground hover:text-danger"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   DRAWER FOOTER ACTIONS
   ══════════════════════════════════════════════════════════════ */
function DrawerFooterActions({
  app,
  onConfirm,
  onTransition,
  onCancel,
  isUpdating,
}: {
  app: ClinicAppointmentRow;
  onConfirm: () => void;
  onTransition: (status: string) => void;
  onCancel: () => void;
  isUpdating: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-2 pt-2">
      <span className="text-[11px] text-muted-foreground">
        {app.createdAt &&
          `Created ${formatDistanceToNow(new Date(app.createdAt), { addSuffix: true })}`}
      </span>
      <div className="flex items-center gap-2">
        {["PENDING", "CONFIRMED"].includes(app.status) && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isUpdating}
            className="rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2 text-xs font-bold text-danger hover:bg-danger/20 transition disabled:opacity-50 cursor-pointer"
          >
            {t("common.cancel", { defaultValue: "Cancel Appointment" })}
          </button>
        )}

        {canTransition(app.status, "CONFIRMED") && (
          <button
            type="button"
            onClick={onConfirm}
            disabled={isUpdating}
            className="inline-flex items-center gap-1.5 rounded-xl bg-success px-4 py-2 text-xs font-bold text-white hover:opacity-90 transition disabled:opacity-50 cursor-pointer shadow-sm"
          >
            {isUpdating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            {t("status.CONFIRMED", { defaultValue: "Confirm" })}
          </button>
        )}

        {canTransition(app.status, "IN_PROGRESS") && (
          <button
            type="button"
            onClick={() => onTransition("IN_PROGRESS")}
            disabled={isUpdating}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-500 px-4 py-2 text-xs font-bold text-white hover:opacity-90 transition disabled:opacity-50 cursor-pointer shadow-sm"
          >
            <Activity className="h-3.5 w-3.5" />
            {t("status.IN_PROGRESS", { defaultValue: "Start Consultation" })}
          </button>
        )}

        {canTransition(app.status, "COMPLETED") && (
          <button
            type="button"
            onClick={() => onTransition("COMPLETED")}
            disabled={isUpdating}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary-500 px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 transition disabled:opacity-50 cursor-pointer shadow-sm"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {t("status.COMPLETED", { defaultValue: "Complete" })}
          </button>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   APPOINTMENT DETAIL DRAWER CONTENT
   ══════════════════════════════════════════════════════════════ */
function AppointmentDetailContent({
  appointment: app,
  onStatusChange,
  onConfirm,
  onCancel,
  isUpdating,
}: {
  appointment: ClinicAppointmentRow;
  onStatusChange: (status: string, reason?: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isUpdating: boolean;
}) {
  const { t } = useTranslation();

  const guestQuery = useQuery({
    queryKey: qk.clinicSelf.guestPatientDetail(app.guestPatientId || ""),
    queryFn: () => clinicAppointmentsApi.getGuestPatient(app.guestPatientId || ""),
    enabled: !!app.guestPatientId && (!app.guestPatient || !app.guestPatient.firstName),
  });

  const patient = extractPatientDisplay(app, guestQuery.data);
  const doctorName = getDoctorName(app);
  const doctorPhoto = getDoctorPhoto(app);
  const doctorColor = app.doctorId ? getDoctorColor(app.doctorId) : null;
  const statusCfg = STATUS_CONFIG[app.status] || STATUS_CONFIG.PENDING;
  const StatusIcon = statusCfg.icon;
  const cancelLabel = getCancelledByLabel(app);
  const CancelIcon = getCancelledByIcon(app);
  const isTerminal = VALID_TRANSITIONS[app.status]?.length === 0;

  return (
    <div className="space-y-5">
      {/* Status Banner */}
      <div
        className={cn(
          "flex items-center justify-between p-4 rounded-2xl border border-border/30",
          statusCfg.bg,
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "h-10 w-10 rounded-xl grid place-items-center",
              statusCfg.bg,
              statusCfg.text,
            )}
          >
            <StatusIcon className="h-5 w-5" />
          </div>
          <div>
            <span className={cn("text-sm font-extrabold", statusCfg.text)}>
              {t(`status.${app.status}`, { defaultValue: statusCfg.label })}
            </span>
            {isTerminal && (
              <p className="text-[10px] text-muted-foreground">Terminal status — closed</p>
            )}
          </div>
        </div>
        {app.type && (
          <span className="rounded-xl bg-background/60 px-2.5 py-1 text-[10px] font-bold text-foreground uppercase">
            {t(`type.${app.type}`, { defaultValue: app.type.replace("_", " ") })}
          </span>
        )}
      </div>

      {/* Cancel info banner if cancelled */}
      {cancelLabel && (
        <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-danger/10 border border-danger/20">
          <CancelIcon className="h-4 w-4 text-danger shrink-0" />
          <div>
            <span className="text-xs font-bold text-danger">{cancelLabel}</span>
            {app.cancelledAt && (
              <p className="text-[10px] text-danger/70">
                {format(new Date(app.cancelledAt), "PPP 'at' p")}
              </p>
            )}
            {app.cancelReason && (
              <p className="text-[11px] text-foreground mt-1">Reason: {app.cancelReason}</p>
            )}
          </div>
        </div>
      )}

      {/* Patient Card */}
      <div className="rounded-2xl border border-border/40 bg-accent/30 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-primary-500" />
            {t("patients.patientDetails", { defaultValue: "Patient Information" })}
          </h4>
          {patient.id && (
            <CopyReferenceButton
              value={patient.id}
              label={t("common.copyRef", { defaultValue: "Copy Ref" })}
            />
          )}
        </div>

        <div className="flex items-center gap-3.5">
          <div className="relative h-12 w-12 rounded-2xl overflow-hidden bg-primary-500/10 border border-border/40 shrink-0">
            <RemoteImage
              src={patient.avatarUrl}
              alt={patient.name}
              fallback={ASSET_FALLBACKS.userAvatar}
              className="h-full w-full object-cover"
            />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-foreground">{patient.name}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[9px] font-bold uppercase inline-block",
                  patient.isGuest
                    ? "bg-amber-500/15 text-amber-600"
                    : "bg-primary-500/15 text-primary-500",
                )}
              >
                {patient.isGuest
                  ? t("patients.guestPatients", { defaultValue: "Walk-In Guest Patient" })
                  : t("patients.appRegistered", { defaultValue: "Registered Patient" })}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/20 text-xs">
          {patient.phone && (
            <div>
              <span className="text-[10px] text-muted-foreground block">Phone</span>
              <span className="font-mono font-bold text-foreground">{patient.phone}</span>
            </div>
          )}
          {patient.email && (
            <div>
              <span className="text-[10px] text-muted-foreground block">Email</span>
              <span className="truncate block font-medium text-foreground">{patient.email}</span>
            </div>
          )}
          {patient.dateOfBirth && (
            <div>
              <span className="text-[10px] text-muted-foreground block">Date of Birth</span>
              <span className="font-mono text-foreground">{patient.dateOfBirth}</span>
            </div>
          )}
        </div>
      </div>

      {/* Doctor Card */}
      <div className="rounded-2xl border border-border/40 bg-card p-4 space-y-3">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Stethoscope className="h-3.5 w-3.5 text-primary-500" />
          {t("appointments.providerDoctor", { defaultValue: "Attending Practitioner" })}
        </h4>

        <div className="flex items-center gap-3">
          <div
            className="h-11 w-11 rounded-2xl overflow-hidden border-2 shrink-0"
            style={{ borderColor: doctorColor?.hex }}
          >
            <RemoteImage
              src={doctorPhoto}
              alt={doctorName}
              fallback={ASSET_FALLBACKS.doctorPhoto}
              className="h-full w-full object-cover"
            />
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-foreground">{doctorName}</h4>
            <p className="text-[11px] font-semibold text-primary-500">
              {app.doctor?.specialtyName ||
                (app.doctor as { specialties?: Array<{ nameFr?: string }> })?.specialties?.[0]
                  ?.nameFr ||
                "Specialist"}
            </p>
          </div>
        </div>
      </div>

      {/* Appointment Schedule Details */}
      <div className="rounded-2xl border border-border/40 bg-card p-4 space-y-3">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <CalendarRange className="h-3.5 w-3.5 text-primary-500" />
          {t("appointments.scheduleDetails", { defaultValue: "Schedule & Location" })}
        </h4>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-muted/20 border border-border/20">
            <span className="text-[10px] text-muted-foreground block">Date</span>
            <span className="font-mono font-bold text-foreground text-sm">
              {app.slot?.date || "TBD"}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-muted/20 border border-border/20">
            <span className="text-[10px] text-muted-foreground block">Time Slot</span>
            <span className="font-mono font-bold text-foreground text-sm">
              {app.slot?.startTime?.slice(0, 5)}–{app.slot?.endTime?.slice(0, 5)}
            </span>
          </div>

          {app.slot?.room && (
            <div className="col-span-2 p-3 rounded-xl bg-muted/20 border border-border/20 flex items-center gap-2">
              <DoorOpen className="h-4 w-4 text-primary-500" />
              <div>
                <span className="text-[10px] text-muted-foreground block">Assigned Room</span>
                <span className="font-bold text-foreground">{app.slot.room.name}</span>
              </div>
            </div>
          )}

          {app.notes && (
            <div className="col-span-2 p-3 rounded-xl bg-muted/10 border border-border/20">
              <span className="text-[10px] text-muted-foreground block">Appointment Notes</span>
              <p className="text-xs text-foreground mt-0.5">{app.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
