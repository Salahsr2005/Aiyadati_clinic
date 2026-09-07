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
  Mail,
  Hash,
  CreditCard,
  FileText,
  MapPin,
  Activity,
  X,
  Search,
  List,
  LayoutGrid,
  Columns3,
  Eye,
  ArrowRight,
  ShieldCheck,
  UserX,
  Building2,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
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

import findDoctorImg from "@/assets/home-quick-actions/find-doctor.png";

/* ──────────────────────────────────────────────────────────────
   APPOINTMENT LIFECYCLE — valid transitions
   ────────────────────────────────────────────────────────────── */
const VALID_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  PENDING:     ["CONFIRMED", "CANCELLED"],
  CONFIRMED:   ["IN_PROGRESS", "CANCELLED", "NO_SHOW"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED:   [],
  CANCELLED:   [],
  NO_SHOW:     [],
};

function canTransition(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return (VALID_TRANSITIONS[from] || []).includes(to);
}

/* ──────────────────────────────────────────────────────────────
   STATUS UI CONFIG
   ────────────────────────────────────────────────────────────── */
const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; bg: string; text: string; ring: string }> = {
  PENDING:     { label: "Pending",     icon: Clock,        bg: "bg-warning/15",       text: "text-warning",           ring: "ring-warning/30" },
  CONFIRMED:   { label: "Confirmed",   icon: CheckCircle2, bg: "bg-success/15",       text: "text-success",           ring: "ring-success/30" },
  IN_PROGRESS: { label: "In Progress", icon: Activity,     bg: "bg-blue-500/15",      text: "text-blue-500",          ring: "ring-blue-500/30" },
  COMPLETED:   { label: "Completed",   icon: CheckCircle2, bg: "bg-primary-500/15",   text: "text-primary-500",       ring: "ring-primary-500/30" },
  CANCELLED:   { label: "Cancelled",   icon: XCircle,      bg: "bg-danger/15",        text: "text-danger",            ring: "ring-danger/30" },
  NO_SHOW:     { label: "No Show",     icon: AlertCircle,  bg: "bg-muted/30",         text: "text-muted-foreground",  ring: "ring-border/30" },
};

const ALL_STATUSES: AppointmentStatus[] = ["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"];

/* ──────────────────────────────────────────────────────────────
   HELPERS & PATIENT CREDENTIALS EXTRACTION
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

function extractPatientDisplay(app: ClinicAppointmentRow, fetchedGuest?: GuestPatient): ExtractedPatientInfo {
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

  // Branch on patientType === "GUEST" or guestPatient/guestPatientId/fetchedGuest
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
  if (app.cancelledBy === app.patientId || app.cancelledBy === app.guestPatientId) return "Cancelled by Patient";
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

/* ══════════════════════════════════════════════════════════════
   PAGE COMPONENT
   ══════════════════════════════════════════════════════════════ */
export default function AppointmentsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [doctorFilter, setDoctorFilter] = useState<string>("");
  const [dateStartFilter, setDateStartFilter] = useState<string>("");
  const [dateEndFilter, setDateEndFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const [bookModalOpen, setBookModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<ClinicAppointmentRow | null>(null);
  const [doctorSelectorOpen, setDoctorSelectorOpen] = useState(false);

  const { acceptedDoctors } = useClinicDoctors();

  const doctorCardItems: DoctorCardItem[] = useMemo(() =>
    acceptedDoctors.map((doc) => {
      const d = doc.doctor as any;
      const f = d?.firstNameFr || d?.firstNameAr || d?.firstName || "";
      const l = d?.lastNameFr || d?.lastNameAr || d?.lastName || "";
      const name = `${f} ${l}`.trim() || d?.name || "Doctor";
      const spec = Array.isArray(d?.specialties) && d.specialties.length > 0
        ? d.specialties[0].nameFr || d.specialties[0].nameAr
        : d?.specialtyName || d?.specialty?.nameFr || "Specialist";
      return {
        id: doc.id,
        doctorId: doc.doctorId,
        name: `Dr. ${name}`,
        specialty: spec,
        photoUrl: d?.avatarUrl || d?.photoUrl,
        email: d?.email,
        phone: d?.phone,
        yearsOfExp: d?.yearsOfExp,
        status: doc.status,
        raw: doc,
      };
    }), [acceptedDoctors]);

  const selectedDoctorCard = doctorCardItems.find((d) => d.doctorId === doctorFilter);

  const dateParam = dateStartFilter || undefined;

  const { data: appointmentsData, isLoading } = useQuery({
    queryKey: qk.clinicSelf.appointments({ page, status: statusFilter, doctorId: doctorFilter, date: dateParam, search: searchQuery }),
    queryFn: () =>
      clinicAppointmentsApi.listAppointments({
        page,
        limit: 20,
        status: statusFilter || undefined,
        doctorId: doctorFilter || undefined,
        date: dateParam,
        search: searchQuery || undefined,
      }),
  });

  const appointments = appointmentsData?.data ?? [];
  const totalPages = appointmentsData?.totalPages ?? 1;

  const updateStatusMutation = useEntityMutation({
    mutationFn: ({ id, status, cancelReason }: { id: string; status: string; cancelReason?: string }) =>
      clinicAppointmentsApi.updateStatus(id, { status, cancelReason }),
    invalidate: [qk.clinicSelf.appointments()],
    successMessage: "Appointment status updated",
    onSuccess: () => setSelectedAppointment(null),
  });

  const confirmMutation = useEntityMutation({
    mutationFn: (id: string) => clinicAppointmentsApi.confirmAppointment(id),
    invalidate: [qk.clinicSelf.appointments()],
    successMessage: "Appointment confirmed",
    onSuccess: () => setSelectedAppointment(null),
  });

  const hasFilters = !!(statusFilter || doctorFilter || dateStartFilter || searchQuery);

  const clearFilters = () => {
    setStatusFilter("");
    setDoctorFilter("");
    setDateStartFilter("");
    setDateEndFilter("");
    setSearchQuery("");
    setPage(1);
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
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("nav.appointments", { defaultValue: "Clinic Appointments" })}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {appointmentsData?.total ?? 0} {t("overview.kpi.totalAppointments", { defaultValue: "total appointments" })} · {t("doctors.title", { defaultValue: "Manage and book across all affiliated doctors" })}
          </p>
        </div>
        <button
          onClick={() => setBookModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-sm transition hover:opacity-90 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          {t("patients.createGuestButton", { defaultValue: "Book Appointment" })}
        </button>
      </div>

      {/* ─── Filter Bar ─── */}
      <GlassCard className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
            <Filter className="h-4 w-4 text-primary-500" />
            <span>{t("filters.open", { defaultValue: "Filters" })}</span>
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute start-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              placeholder={t("patients.searchPlaceholder", { defaultValue: "Search patient name or phone..." })}
              className="glass w-full rounded-xl ps-8 pe-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-primary-500/40"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute end-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Doctor Selector */}
          <button
            onClick={() => setDoctorSelectorOpen(true)}
            className={`inline-flex items-center gap-2 glass rounded-xl px-3.5 py-2 text-xs font-semibold transition cursor-pointer ${
              doctorFilter ? "ring-2 ring-primary-500/40 text-primary-500" : "text-foreground"
            }`}
          >
            <Stethoscope className="h-3.5 w-3.5" />
            {selectedDoctorCard ? selectedDoctorCard.name : t("doctors.allTab", { defaultValue: "All Doctors" })}
            <ChevronRight className="h-3 w-3 text-muted-foreground rtl:rotate-180" />
          </button>

          {/* Date Range */}
          <ModernDatePickerModal
            mode="range"
            startDate={dateStartFilter}
            endDate={dateEndFilter}
            onSelectRange={(start, end) => {
              setDateStartFilter(start);
              setDateEndFilter(end);
              setPage(1);
            }}
            placeholder={t("filters.date", { defaultValue: "Date Range" })}
          />

          {/* View Mode Toggle */}
          <div className="flex items-center rounded-xl bg-muted/30 border border-border/30 p-0.5 ms-auto">
            {([
              { mode: "list" as ViewMode, icon: List, label: t("views.table", { defaultValue: "List" }) },
              { mode: "grid" as ViewMode, icon: LayoutGrid, label: t("views.grid", { defaultValue: "Grid" }) },
              { mode: "kanban" as ViewMode, icon: Columns3, label: t("views.kanban", { defaultValue: "Kanban" }) },
            ]).map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                title={label}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  viewMode === mode
                    ? "bg-primary-500 text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 text-xs text-primary-500 font-bold hover:underline cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" /> {t("filters.reset", { defaultValue: "Reset" })}
            </button>
          )}
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => { setStatusFilter(""); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition cursor-pointer ${
              !statusFilter ? "bg-primary-500 text-primary-foreground shadow-sm" : "bg-muted/30 text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("common.all", { defaultValue: "All" })}
          </button>
          {ALL_STATUSES.map((status) => {
            const cfg = STATUS_CONFIG[status];
            const isActive = statusFilter === status;
            const Icon = cfg.icon;
            const statusLabel = t(`status.${status}`, { defaultValue: cfg.label });
            return (
              <button
                key={status}
                onClick={() => { setStatusFilter(isActive ? "" : status); setPage(1); }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition cursor-pointer ${
                  isActive ? `${cfg.bg} ${cfg.text} ring-1 ${cfg.ring}` : "bg-muted/20 text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                <Icon className="h-3 w-3" />
                {statusLabel}
              </button>
            );
          })}
        </div>
      </GlassCard>

      {/* ─── Content Area ─── */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : appointments.length === 0 ? (
        <EmptyState
          title={t("common.empty", { defaultValue: "No appointments found" })}
          description={hasFilters ? t("filters.reset", { defaultValue: "Try adjusting your filters" }) : t("common.empty", { defaultValue: "No appointments have been booked yet." })}
          action={
            <button
              onClick={() => setBookModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 cursor-pointer"
            >
              <Plus className="h-4 w-4" /> {t("patients.createGuestButton", { defaultValue: "Book Appointment" })}
            </button>
          }
        />
      ) : (
        <div className="space-y-4">
          {viewMode === "list" && (
            <ListView appointments={appointments} onSelect={setSelectedAppointment} />
          )}
          {viewMode === "grid" && (
            <GridView appointments={appointments} onSelect={setSelectedAppointment} />
          )}
          {viewMode === "kanban" && (
            <KanbanView groups={kanbanGroups} onSelect={setSelectedAppointment} />
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

      {/* ─── Walk-in Booking Drawer ─── */}
      <WalkInBookingModal open={bookModalOpen} onClose={() => setBookModalOpen(false)} />

      {/* ─── Doctor Selector (filter) ─── */}
      <DoctorSelectorModal
        open={doctorSelectorOpen}
        onClose={() => setDoctorSelectorOpen(false)}
        doctors={[
          { id: "all", doctorId: "", name: t("doctors.allTab", { defaultValue: "All Doctors" }), specialty: "Show all appointments", status: "active" },
          ...doctorCardItems,
        ]}
        selectedDoctorId={doctorFilter}
        onSelectDoctor={(doc) => { setDoctorFilter(doc.doctorId); setPage(1); }}
        title={t("doctors.selectorTitle", { defaultValue: "Filter by Doctor" })}
        subtitle={t("doctors.selectorSub", { defaultValue: "Select a doctor to filter appointments" })}
      />

      {/* ─── Detail Drawer ─── */}
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
              onTransition={(status) => updateStatusMutation.mutate({ id: selectedAppointment.id, status })}
              isUpdating={updateStatusMutation.isPending || confirmMutation.isPending}
            />
          )
        }
      >
        {selectedAppointment && (
          <AppointmentDetailContent
            appointment={selectedAppointment}
            onStatusChange={(status, reason) =>
              updateStatusMutation.mutate({ id: selectedAppointment.id, status, cancelReason: reason })
            }
            onConfirm={() => confirmMutation.mutate(selectedAppointment.id)}
            isUpdating={updateStatusMutation.isPending || confirmMutation.isPending}
          />
        )}
      </Drawer>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   LIST VIEW
   ══════════════════════════════════════════════════════════════ */
function ListView({ appointments, onSelect }: { appointments: ClinicAppointmentRow[]; onSelect: (a: ClinicAppointmentRow) => void }) {
  return (
    <div className="divide-y divide-border/40 rounded-2xl glass border border-border/40 overflow-hidden">
      {appointments.map((app) => (
        <AppointmentListRow key={app.id} app={app} onSelect={onSelect} />
      ))}
    </div>
  );
}

function AppointmentListRow({ app, onSelect }: { app: ClinicAppointmentRow; onSelect: (a: ClinicAppointmentRow) => void }) {
  const { t } = useTranslation();
  const patient = extractPatientDisplay(app);
  const doctorName = getDoctorName(app);
  const doctorPhoto = getDoctorPhoto(app);
  const statusCfg = STATUS_CONFIG[app.status] || STATUS_CONFIG.PENDING;
  const StatusIcon = statusCfg.icon;
  const cancelLabel = getCancelledByLabel(app);
  const createdAgo = app.createdAt ? formatDistanceToNow(new Date(app.createdAt), { addSuffix: true }) : null;

  return (
    <div
      onClick={() => onSelect(app)}
      className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 gap-3 hover:bg-accent/40 transition cursor-pointer group"
    >
      <div className="flex items-center gap-3.5 min-w-0">
        <div className="relative h-10 w-10 rounded-2xl overflow-hidden bg-primary-500/10 border border-border/40 shrink-0">
          <img
            src={patient.avatarUrl}
            alt={patient.name}
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = findDoctorImg; }}
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
            <h4 className="text-xs font-extrabold truncate group-hover:text-primary-500 transition">{patient.name}</h4>
            {patient.isGuest ? (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-bold text-amber-600 uppercase shrink-0">{t("patients.guestPatients", { defaultValue: "Walk-in Guest" })}</span>
            ) : (
              <span className="rounded-full bg-primary-500/15 px-2 py-0.5 text-[9px] font-bold text-primary-500 uppercase shrink-0">{t("patients.appRegistered", { defaultValue: "App Patient" })}</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <img
              src={doctorPhoto}
              alt=""
              className="h-3.5 w-3.5 rounded-full object-cover border border-border/40 shrink-0"
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = findDoctorImg; }}
            />
            <p className="text-[11px] text-muted-foreground truncate">{doctorName}</p>
          </div>
          {patient.phone && (
            <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5 font-mono">
              <Phone className="h-2.5 w-2.5 text-primary-500" /> {patient.phone}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3.5 text-xs shrink-0">
        <div className="text-end space-y-0.5">
          <div className="font-semibold text-xs flex items-center gap-1 justify-end">
            <CalendarIcon className="h-3 w-3 text-muted-foreground" />
            <span>{app.slot?.date || "TBD"}</span>
          </div>
          <div className="flex items-center gap-1 justify-end text-muted-foreground text-[11px]">
            <Clock className="h-3 w-3" />
            <span>{app.slot?.startTime?.slice(0, 5) || "—"}</span>
          </div>
          {createdAgo && <p className="text-[9px] text-muted-foreground/60">Booked {createdAgo}</p>}
        </div>

        <div className="flex flex-col items-end gap-1">
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${statusCfg.bg} ${statusCfg.text}`}>
            <StatusIcon className="h-3 w-3" />
            {t(`status.${app.status}`, { defaultValue: statusCfg.label })}
          </span>
          {cancelLabel && (
            <span className="text-[9px] font-semibold text-danger/70">{cancelLabel}</span>
          )}
        </div>

        <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary-500 transition rtl:rotate-180" />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   GRID VIEW — Modern Tight Cards
   ══════════════════════════════════════════════════════════════ */
function GridView({ appointments, onSelect }: { appointments: ClinicAppointmentRow[]; onSelect: (a: ClinicAppointmentRow) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {appointments.map((app) => (
        <AppointmentGridCard key={app.id} app={app} onSelect={onSelect} />
      ))}
    </div>
  );
}

function AppointmentGridCard({ app, onSelect }: { app: ClinicAppointmentRow; onSelect: (a: ClinicAppointmentRow) => void }) {
  const { t } = useTranslation();
  const patient = extractPatientDisplay(app);
  const doctorName = getDoctorName(app);
  const doctorPhoto = getDoctorPhoto(app);
  const statusCfg = STATUS_CONFIG[app.status] || STATUS_CONFIG.PENDING;
  const StatusIcon = statusCfg.icon;
  const cancelLabel = getCancelledByLabel(app);

  return (
    <div
      onClick={() => onSelect(app)}
      className="glass rounded-2xl border border-border/40 p-3.5 space-y-2.5 hover:border-primary-500/50 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
    >
      {/* Top row: Status Badge & Type */}
      <div className="flex items-center justify-between">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${statusCfg.bg} ${statusCfg.text}`}>
          <StatusIcon className="h-3 w-3" />
          {t(`status.${app.status}`, { defaultValue: statusCfg.label })}
        </span>
        <div className="flex items-center gap-1">
          {patient.isGuest ? (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-extrabold text-amber-600 uppercase">
              {t("patients.guestPatients", { defaultValue: "Guest" })}
            </span>
          ) : (
            <span className="rounded-full bg-primary-500/15 px-2 py-0.5 text-[9px] font-extrabold text-primary-500 uppercase">
              {t("patients.appRegistered", { defaultValue: "App" })}
            </span>
          )}
        </div>
      </div>

      {/* Patient Section */}
      <div className="flex items-center gap-3">
        <div className="relative h-10 w-10 rounded-2xl overflow-hidden bg-primary-500/10 border border-border/40 shrink-0">
          <img
            src={patient.avatarUrl}
            alt={patient.name}
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = findDoctorImg; }}
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
            <p className="text-[10px] text-muted-foreground/60 italic">{t("common.empty", { defaultValue: "No phone provided" })}</p>
          )}
        </div>
      </div>

      {/* Attending Doctor */}
      <div className="flex items-center gap-2 pt-2 border-t border-border/30">
        <img
          src={doctorPhoto}
          alt={doctorName}
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = findDoctorImg; }}
          className="h-5 w-5 rounded-full object-cover border border-border/40 shrink-0"
        />
        <span className="text-[11px] font-bold text-foreground truncate">{doctorName}</span>
      </div>

      {/* Date & Time Footer */}
      <div className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground bg-muted/20 p-2 rounded-xl border border-border/20">
        <div className="flex items-center gap-1">
          <CalendarIcon className="h-3 w-3 text-primary-500" />
          <span className="text-foreground font-mono">{app.slot?.date || "TBD"}</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3 text-primary-500" />
          <span className="text-foreground font-mono">{app.slot?.startTime?.slice(0, 5) || "—"}</span>
        </div>
      </div>

      {/* Cancel attribution banner if cancelled */}
      {cancelLabel && (
        <div className="text-[9px] font-bold text-danger/80 bg-danger/10 rounded-xl px-2 py-1 text-center border border-danger/20">
          {cancelLabel}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   KANBAN VIEW
   ══════════════════════════════════════════════════════════════ */
function KanbanView({ groups, onSelect }: { groups: Record<string, ClinicAppointmentRow[]>; onSelect: (a: ClinicAppointmentRow) => void }) {
  const { t } = useTranslation();
  const activeStatuses = ALL_STATUSES.filter((s) => groups[s]?.length > 0 || ["PENDING", "CONFIRMED", "IN_PROGRESS"].includes(s));
  return (
    <div className="flex gap-3 overflow-x-auto pb-4 custom-scrollbar">
      {activeStatuses.map((status) => {
        const cfg = STATUS_CONFIG[status];
        const Icon = cfg.icon;
        const items = groups[status] || [];
        const statusLabel = t(`status.${status}`, { defaultValue: cfg.label });
        return (
          <div key={status} className="flex-shrink-0 w-72">
            {/* Column header */}
            <div className={`flex items-center justify-between p-3 rounded-t-2xl ${cfg.bg} border border-b-0 border-border/30`}>
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${cfg.text}`} />
                <span className={`text-xs font-extrabold ${cfg.text}`}>{statusLabel}</span>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cfg.bg} ${cfg.text}`}>
                {items.length}
              </span>
            </div>

            {/* Column body */}
            <div className="glass border border-t-0 border-border/30 rounded-b-2xl min-h-[200px] max-h-[600px] overflow-y-auto custom-scrollbar space-y-2 p-2">
              {items.length === 0 ? (
                <div className="flex items-center justify-center py-10 text-[11px] text-muted-foreground/50">
                  {t("common.empty", { defaultValue: "No appointments" })}
                </div>
              ) : (
                items.map((app) => (
                  <KanbanCard key={app.id} app={app} onSelect={onSelect} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KanbanCard({ app, onSelect }: { app: ClinicAppointmentRow; onSelect: (a: ClinicAppointmentRow) => void }) {
  const { t } = useTranslation();
  const patient = extractPatientDisplay(app);
  const doctorName = getDoctorName(app);
  const doctorPhoto = getDoctorPhoto(app);
  const cancelLabel = getCancelledByLabel(app);

  return (
    <div
      onClick={() => onSelect(app)}
      className="p-3 rounded-xl bg-background/80 border border-border/30 hover:border-primary-500/40 transition cursor-pointer space-y-2"
    >
      <div className="flex items-center gap-2">
        <div className="relative h-8 w-8 rounded-xl overflow-hidden bg-primary-500/10 border border-border/40 shrink-0">
          <img
            src={patient.avatarUrl}
            alt={patient.name}
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = findDoctorImg; }}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 justify-between">
            <h4 className="text-[11px] font-extrabold truncate">{patient.name}</h4>
            {patient.isGuest && (
              <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[8px] font-extrabold text-amber-600 uppercase">{t("patients.guestPatients", { defaultValue: "Guest" })}</span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground font-mono truncate">{patient.phone || "No phone"}</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 pt-1 border-t border-border/20">
        <img
          src={doctorPhoto}
          alt=""
          className="h-3.5 w-3.5 rounded-full object-cover border border-border/40"
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = findDoctorImg; }}
        />
        <span className="text-[10px] font-semibold text-muted-foreground truncate">{doctorName}</span>
      </div>

      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="font-mono">{app.slot?.date || "TBD"}</span>
        <span className="font-mono">{app.slot?.startTime?.slice(0, 5) || "—"}</span>
      </div>

      {cancelLabel && (
        <span className="text-[9px] font-bold text-danger/80 block">{cancelLabel}</span>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   DRAWER FOOTER ACTIONS
   ══════════════════════════════════════════════════════════════ */
function DrawerFooterActions({ app, onConfirm, onTransition, isUpdating }: {
  app: ClinicAppointmentRow;
  onConfirm: () => void;
  onTransition: (status: string) => void;
  isUpdating: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-muted-foreground">
        {app.createdAt && `Created ${formatDistanceToNow(new Date(app.createdAt), { addSuffix: true })}`}
      </span>
      <div className="flex items-center gap-2">
        {canTransition(app.status, "CONFIRMED") && (
          <button
            onClick={onConfirm}
            disabled={isUpdating}
            className="inline-flex items-center gap-1.5 rounded-xl bg-success px-4 py-2 text-xs font-bold text-white hover:opacity-90 transition disabled:opacity-50 cursor-pointer"
          >
            {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {t("status.CONFIRMED", { defaultValue: "Confirm" })}
          </button>
        )}
        {canTransition(app.status, "IN_PROGRESS") && (
          <button
            onClick={() => onTransition("IN_PROGRESS")}
            disabled={isUpdating}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-500 px-4 py-2 text-xs font-bold text-white hover:opacity-90 transition disabled:opacity-50 cursor-pointer"
          >
            <Activity className="h-3.5 w-3.5" /> {t("status.IN_PROGRESS", { defaultValue: "Start" })}
          </button>
        )}
        {canTransition(app.status, "COMPLETED") && (
          <button
            onClick={() => onTransition("COMPLETED")}
            disabled={isUpdating}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary-500 px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 transition disabled:opacity-50 cursor-pointer"
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> {t("status.COMPLETED", { defaultValue: "Complete" })}
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
  isUpdating,
}: {
  appointment: ClinicAppointmentRow;
  onStatusChange: (status: string, reason?: string) => void;
  onConfirm: () => void;
  isUpdating: boolean;
}) {
  const { t } = useTranslation();
  const [cancelReason, setCancelReason] = useState("");
  const [showCancelInput, setShowCancelInput] = useState(false);

  // Fetch guest patient details if guestPatientId exists but guestPatient object is incomplete
  const guestQuery = useQuery({
    queryKey: qk.clinicSelf.guestPatientDetail(app.guestPatientId || ""),
    queryFn: () => clinicAppointmentsApi.getGuestPatient(app.guestPatientId || ""),
    enabled: !!app.guestPatientId && (!app.guestPatient || !app.guestPatient.firstName),
  });

  const patient = extractPatientDisplay(app, guestQuery.data);
  const doctorName = getDoctorName(app);
  const doctorPhoto = getDoctorPhoto(app);
  const statusCfg = STATUS_CONFIG[app.status] || STATUS_CONFIG.PENDING;
  const StatusIcon = statusCfg.icon;
  const cancelLabel = getCancelledByLabel(app);
  const CancelIcon = getCancelledByIcon(app);
  const isTerminal = VALID_TRANSITIONS[app.status]?.length === 0;

  return (
    <div className="space-y-5">
      {/* Status Banner */}
      <div className={`flex items-center justify-between p-4 rounded-2xl ${statusCfg.bg} border border-border/30`}>
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-xl grid place-items-center ${statusCfg.bg} ${statusCfg.text}`}>
            <StatusIcon className="h-5 w-5" />
          </div>
          <div>
            <span className={`text-sm font-extrabold ${statusCfg.text}`}>{t(`status.${app.status}`, { defaultValue: statusCfg.label })}</span>
            {isTerminal && <p className="text-[10px] text-muted-foreground">Terminal status — no further transitions</p>}
          </div>
        </div>
        {app.type && (
          <span className="rounded-xl bg-background/60 px-2.5 py-1 text-[10px] font-bold text-foreground uppercase">
            {t(`type.${app.type}`, { defaultValue: app.type.replace("_", " ") })}
          </span>
        )}
      </div>

      {/* Cancel info banner */}
      {cancelLabel && (
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-danger/10 border border-danger/20">
          <CancelIcon className="h-4 w-4 text-danger shrink-0" />
          <div>
            <span className="text-xs font-bold text-danger">{cancelLabel}</span>
            {app.cancelledAt && (
              <p className="text-[10px] text-danger/70">
                {format(new Date(app.cancelledAt), "PPP 'at' p")}
              </p>
            )}
            {app.cancelReason && <p className="text-[11px] text-foreground mt-1">Reason: {app.cancelReason}</p>}
          </div>
        </div>
      )}

      {/* Patient Credentials Card */}
      <div className="rounded-2xl border border-border/40 bg-accent/30 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-primary-500" />
            {t("patients.patientDetails", { defaultValue: "Patient Credentials" })}
          </h4>
          {patient.id && <CopyReferenceButton value={patient.id} label={t("common.copyRef", { defaultValue: "Copy Patient Ref" })} />}
        </div>
        <div className="flex items-center gap-3.5">
          <div className="relative h-12 w-12 rounded-2xl overflow-hidden bg-primary-500/10 border border-border/40 shrink-0">
            <img
              src={patient.avatarUrl}
              alt={patient.name}
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = findDoctorImg; }}
              className="h-full w-full object-cover"
            />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-foreground">{patient.name}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase inline-block ${
                patient.isGuest ? "bg-amber-500/15 text-amber-600" : "bg-primary-500/15 text-primary-500"
              }`}>
                {patient.isGuest ? t("patients.guestPatients", { defaultValue: "Walk-In Guest Patient" }) : t("patients.appRegistered", { defaultValue: "Registered App Patient" })}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/30">
          <div className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5 text-primary-500 shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground">{t("common.phone", { defaultValue: "Phone Number" })}</p>
              <p className="text-xs font-bold font-mono">{patient.phone || "N/A"}</p>
            </div>
          </div>
          {patient.email && (
            <div className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 text-primary-500 shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground">{t("common.email", { defaultValue: "Email" })}</p>
                <p className="text-xs font-bold truncate">{patient.email}</p>
              </div>
            </div>
          )}
          {patient.dateOfBirth && (
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-3.5 w-3.5 text-primary-500 shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground">{t("filters.date", { defaultValue: "Date of Birth" })}</p>
                <p className="text-xs font-bold">{patient.dateOfBirth}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Doctor Card */}
      <div className="rounded-2xl border border-border/40 bg-accent/30 p-4 space-y-3">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Stethoscope className="h-3.5 w-3.5 text-primary-500" />
          {t("doctors.selectorTitle", { defaultValue: "Attending Doctor" })}
        </h4>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <img
              src={doctorPhoto}
              alt={doctorName}
              className="h-11 w-11 rounded-2xl object-cover border border-border/40"
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = findDoctorImg; }}
            />
            <div>
              <h3 className="text-sm font-extrabold text-foreground">{doctorName}</h3>
              {app.doctor?.specialtyName && (
                <p className="text-[11px] font-semibold text-primary-500">{app.doctor.specialtyName}</p>
              )}
            </div>
          </div>
          {app.doctorId && <CopyReferenceButton value={app.doctorId} label={t("common.copyRef", { defaultValue: "Copy Doctor Ref" })} />}
        </div>
      </div>

      {/* Schedule Details */}
      <div className="rounded-2xl border border-border/40 bg-accent/30 p-4 space-y-3">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <CalendarRange className="h-3.5 w-3.5 text-primary-500" />
          {t("schedule.title", { defaultValue: "Schedule Details" })}
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-3.5 w-3.5 text-primary-500 shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground">{t("filters.date", { defaultValue: "Date" })}</p>
              <p className="text-xs font-bold">{app.slot?.date || "TBD"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-primary-500 shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground">{t("common.duration", { defaultValue: "Time" })}</p>
              <p className="text-xs font-bold">{app.slot?.startTime?.slice(0, 5) || "—"} — {app.slot?.endTime?.slice(0, 5) || "—"}</p>
            </div>
          </div>
          {app.paymentMethod && (
            <div className="flex items-center gap-2">
              <CreditCard className="h-3.5 w-3.5 text-primary-500 shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground">{t("filters.paymentMethod", { defaultValue: "Payment" })}</p>
                <p className="text-xs font-bold">{t(`payment.${app.paymentMethod}`, { defaultValue: app.paymentMethod === "ON_SITE" ? "On Site" : "Platform Credit" })}</p>
              </div>
            </div>
          )}
          {app.slot?.maxPatients && (
            <div className="flex items-center gap-2">
              <User className="h-3.5 w-3.5 text-primary-500 shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground">{t("schedule.totalSlots", { defaultValue: "Slot Capacity" })}</p>
                <p className="text-xs font-bold">{app.slot.currentPatients ?? 0}/{app.slot.maxPatients}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Notes */}
      {app.notes && (
        <div className="rounded-2xl border border-border/40 bg-accent/30 p-4 space-y-2">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-primary-500" />
            {t("patients.medicalNotes", { defaultValue: "Notes" })}
          </h4>
          <p className="text-xs text-foreground">{app.notes}</p>
        </div>
      )}

      {/* Audit Trail */}
      <div className="rounded-2xl border border-border/40 bg-accent/30 p-4 space-y-3">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Hash className="h-3.5 w-3.5 text-primary-500" />
          Audit Trail
        </h4>
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between border-b border-border/20 pb-2">
            <div>
              <p className="text-[10px] text-muted-foreground">Appointment Reference</p>
            </div>
            <CopyReferenceButton value={app.id} label={t("common.copyRef", { defaultValue: "Copy Appt Ref" })} />
          </div>
          {app.createdAt && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-[10px]">Created</span>
              <span className="font-bold text-foreground">{format(new Date(app.createdAt), "PPP p")}</span>
            </div>
          )}
          {app.createdByType && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-[10px]">Created by</span>
              <span className="font-bold text-foreground capitalize">{app.createdByType}</span>
            </div>
          )}
          {app.confirmedAt && (
            <div className="flex items-center gap-2 p-2 rounded-xl bg-success/5 border border-success/20">
              <ShieldCheck className="h-3.5 w-3.5 text-success shrink-0" />
              <div>
                <p className="text-[10px] font-bold text-success">{t("status.CONFIRMED", { defaultValue: "Confirmed" })}</p>
                <p className="text-[10px] text-muted-foreground">{format(new Date(app.confirmedAt), "PPP p")}</p>
              </div>
            </div>
          )}
          {app.updatedAt && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-[10px]">Last updated</span>
              <span className="font-bold text-foreground">{format(new Date(app.updatedAt), "PPP p")}</span>
            </div>
          )}
        </div>
      </div>

      {/* ─── Lifecycle Actions ─── */}
      {!isTerminal && (
        <div className="space-y-3 pt-2 border-t border-border/30">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t("common.actions", { defaultValue: "Quick Actions" })}</h4>

          <div className="grid grid-cols-2 gap-2">
            {canTransition(app.status, "CONFIRMED") && (
              <button
                onClick={onConfirm}
                disabled={isUpdating}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl p-2.5 text-xs font-bold bg-success/15 text-success hover:bg-success/25 transition disabled:opacity-40 cursor-pointer"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> {t("status.CONFIRMED", { defaultValue: "Confirm" })}
              </button>
            )}
            {canTransition(app.status, "IN_PROGRESS") && (
              <button
                onClick={() => onStatusChange("IN_PROGRESS")}
                disabled={isUpdating}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl p-2.5 text-xs font-bold bg-blue-500/15 text-blue-500 hover:bg-blue-500/25 transition disabled:opacity-40 cursor-pointer"
              >
                <Activity className="h-3.5 w-3.5" /> {t("status.IN_PROGRESS", { defaultValue: "Start Session" })}
              </button>
            )}
            {canTransition(app.status, "COMPLETED") && (
              <button
                onClick={() => onStatusChange("COMPLETED")}
                disabled={isUpdating}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl p-2.5 text-xs font-bold bg-primary-500/15 text-primary-500 hover:bg-primary-500/25 transition disabled:opacity-40 cursor-pointer"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> {t("status.COMPLETED", { defaultValue: "Complete" })}
              </button>
            )}
            {canTransition(app.status, "NO_SHOW") && (
              <button
                onClick={() => onStatusChange("NO_SHOW")}
                disabled={isUpdating}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl p-2.5 text-xs font-bold bg-muted/30 text-muted-foreground hover:bg-muted/50 transition disabled:opacity-40 cursor-pointer"
              >
                <AlertCircle className="h-3.5 w-3.5" /> {t("status.NO_SHOW", { defaultValue: "No Show" })}
              </button>
            )}
          </div>

          {/* Cancel with reason */}
          {canTransition(app.status, "CANCELLED") && (
            <div className="space-y-2">
              {showCancelInput ? (
                <div className="space-y-2 p-3 rounded-2xl bg-danger/5 border border-danger/20">
                  <input
                    type="text"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Reason for cancellation (optional)..."
                    className="w-full rounded-xl border border-danger/30 bg-background px-3 py-2 text-xs font-semibold outline-none focus:border-danger"
                  />
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={() => { setShowCancelInput(false); setCancelReason(""); }}
                      className="text-xs font-bold text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      {t("common.cancel", { defaultValue: "Back" })}
                    </button>
                    <button
                      onClick={() => onStatusChange("CANCELLED", cancelReason || undefined)}
                      disabled={isUpdating}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-danger px-4 py-2 text-xs font-bold text-white hover:opacity-90 transition disabled:opacity-50 cursor-pointer"
                    >
                      {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                      {t("status.CANCELLED", { defaultValue: "Cancel Appointment" })}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowCancelInput(true)}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl p-2.5 text-xs font-bold border border-danger/30 text-danger hover:bg-danger/10 transition cursor-pointer"
                >
                  <XCircle className="h-3.5 w-3.5" /> {t("status.CANCELLED", { defaultValue: "Cancel Appointment" })}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
