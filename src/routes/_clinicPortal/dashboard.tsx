import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  CalendarClock,
  Building2,
  ArrowRight,
  UserPlus,
  CalendarRange,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Plus,
  Zap,
  DoorOpen,
  Download,
  Users,
  FileCheck,
  Percent,
  Loader2,
  Stethoscope,
  ChevronRight,
} from "lucide-react";
import { useClinicProfile } from "@/hooks/useClinicProfile";
import { useClinicDoctors } from "@/hooks/useClinicDoctors";
import { ensureArray } from "@/lib/utils";
import { clinicAppointmentsApi, type ClinicAppointmentRow } from "@/api/clinicAppointmentsApi";
import { clinicSelfApi, type ClinicDoctor, type ClinicRoom } from "@/api/clinicSelfApi";
import { doctorsApi, type DoctorRow } from "@/api/doctorsApi";
import { qk } from "@/lib/queryKeys";
import { useEntityMutation } from "@/lib/mutations";
import { KPICard } from "@/components/overview/KPICard";
import { GlassCard } from "@/components/glass/GlassCard";
import { Skeleton } from "@/components/glass/Skeleton";
import { RemoteImage } from "@/components/common/RemoteImage";
import { StatusBadge } from "@/components/data/StatusBadge";
import { ActivityHeatmap, aggregateByDate } from "@/components/data/ActivityHeatmap";
import { DayHourHeatmap } from "@/components/data/DayHourHeatmap";
import { NewsTicker } from "@/components/content/NewsTicker";
import { AdvertisementBanner } from "@/components/content/AdvertisementBanner";
import { FormModal } from "@/components/data/FormModal";
import { AppointmentDrawer } from "@/components/appointments/AppointmentDrawer";
import { DoctorDetailDrawer } from "@/components/doctors/DoctorDetailDrawer";
import { WalkInBookingModal } from "@/components/appointments/WalkInBookingModal";
import { DoctorInviteModal } from "@/components/doctors/DoctorInviteModal";
import { TimePillPicker } from "@/components/data/TimePillPicker";
import { format } from "date-fns";

// Zod schemas for Quick Action Modals
const walkInSchema = z.object({
  doctorId: z.string().min(1, "Doctor selection is required"),
  slotId: z.string().optional(),
  date: z.string().min(1, "Date is required"),
  time: z.string().min(1, "Time is required"),
  firstName: z.string().min(2, "First name is required"),
  lastName: z.string().min(2, "Last name is required"),
  phone: z.string().regex(/^\d{10,15}$/, "Phone number must be 10-15 digits"),
  notes: z.string().optional(),
});

const generateSlotsSchema = z.object({
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  roomId: z.string().optional(),
  force: z.boolean().optional(),
});

const roomSchema = z.object({
  name: z.string().min(2, "Room name is required"),
  specialtyId: z.string().optional(),
});

type WalkInFormData = z.infer<typeof walkInSchema>;
type GenerateSlotsFormData = z.infer<typeof generateSlotsSchema>;
type RoomFormData = z.infer<typeof roomSchema>;

/** Extract doctor full name cleanly */
function formatDoctorName(doc: ClinicDoctor["doctor"] | undefined): string {
  if (!doc) return "Assigned Doctor";
  const firstName = doc.firstNameFr || doc.firstNameAr || doc.firstName || "";
  const lastName = doc.lastNameFr || doc.lastNameAr || doc.lastName || "";
  const full = `${firstName} ${lastName}`.trim();
  if (full) return `Dr. ${full}`;
  if (doc.name) return `Dr. ${doc.name}`;
  if (doc.email) return doc.email.split("@")[0];
  return "Doctor";
}

/** Extract specialty name */
function formatDoctorSpecialty(doc: ClinicDoctor["doctor"] | undefined): string {
  if (!doc) return "General Practice";
  if (Array.isArray(doc.specialties) && doc.specialties.length > 0) {
    return doc.specialties[0].nameFr || doc.specialties[0].nameAr || "Specialist";
  }
  return doc.specialtyName || doc.specialty?.nameFr || doc.specialty?.nameAr || "Specialist";
}

/** Extract patient name */
function formatPatientName(app: ClinicAppointmentRow): string {
  if (app.patient) {
    const f = app.patient.firstNameFr || app.patient.firstName || "";
    const l = app.patient.lastNameFr || app.patient.lastName || "";
    const full = `${f} ${l}`.trim();
    if (full) return full;
    if (app.patient.email) return app.patient.email.split("@")[0];
  }
  if (app.guestPatient) {
    const f = app.guestPatient.firstName || "";
    const l = app.guestPatient.lastName || "";
    const full = `${f} ${l}`.trim();
    if (full) return full;
  }
  return "Patient";
}

export default function DashboardPage() {
  const { data: profile, isLoading: isProfileLoading } = useClinicProfile();
  const { doctors, acceptedDoctors, pendingCount } = useClinicDoctors();

  const { data: rawRooms } = useQuery({
    queryKey: qk.clinicSelf.rooms(),
    queryFn: clinicSelfApi.getRooms,
  });

  const { data: appointmentsData, isLoading: isAppointmentsLoading } = useQuery({
    queryKey: qk.clinicSelf.appointments({ limit: 50 }),
    queryFn: () => clinicAppointmentsApi.listAppointments({ limit: 50 }),
  });

  const { data: rawDocuments } = useQuery({
    queryKey: qk.clinicSelf.documents(),
    queryFn: clinicSelfApi.getDocuments,
  });

  const rooms: ClinicRoom[] = ensureArray<ClinicRoom>(rawRooms);
  const appointments: ClinicAppointmentRow[] = ensureArray<ClinicAppointmentRow>(appointmentsData?.data);
  const documents = ensureArray(rawDocuments);
  const totalAppointments = appointmentsData?.total ?? appointments.length;

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const todayAppointments = appointments.filter((a) => a.slot?.date === todayStr);

  // Selected items for drawers
  const [selectedAppointment, setSelectedAppointment] = useState<ClinicAppointmentRow | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<ClinicDoctor | null>(null);

  // Quick Action Modals State
  const [walkInModalOpen, setWalkInModalOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [roomModalOpen, setRoomModalOpen] = useState(false);

  // Doctor search for invitation modal
  const [searchDoctorQuery, setSearchDoctorQuery] = useState("");
  const { data: platformDoctorsData } = useQuery({
    queryKey: ["platformDoctorsSearch", searchDoctorQuery],
    queryFn: () => doctorsApi.list({ search: searchDoctorQuery, limit: 10 }),
    enabled: searchDoctorQuery.length >= 2,
  });
  const platformDoctors: DoctorRow[] = ensureArray<DoctorRow>(platformDoctorsData?.data);

  // Forms
  const walkInForm = useForm<WalkInFormData>({
    resolver: zodResolver(walkInSchema),
    defaultValues: {
      date: todayStr,
      time: "09:00",
    },
  });

  const generateForm = useForm<GenerateSlotsFormData>({
    resolver: zodResolver(generateSlotsSchema),
    defaultValues: {
      startDate: todayStr,
      endDate: todayStr,
      force: false,
    },
  });

  const roomForm = useForm<RoomFormData>({
    resolver: zodResolver(roomSchema),
  });

  // Quick Action Mutations
  const walkInMutation = useEntityMutation({
    mutationFn: (data: WalkInFormData) =>
      clinicAppointmentsApi.bookAppointment({
        slotId: data.slotId || "",
        guestPatient: {
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          notes: data.notes,
        },
        notes: data.notes,
      }),
    invalidate: [qk.clinicSelf.all()],
    successMessage: "Walk-in patient booking confirmed",
    onSuccess: () => {
      setWalkInModalOpen(false);
      walkInForm.reset();
    },
  });

  const inviteDoctorMutation = useEntityMutation({
    mutationFn: (doctorId: string) => clinicSelfApi.inviteDoctor({ doctorId }),
    invalidate: [qk.clinicSelf.doctors()],
    successMessage: "Doctor affiliation invitation sent",
    onSuccess: () => setInviteModalOpen(false),
  });

  const generateSlotsMutation = useEntityMutation({
    mutationFn: (data: GenerateSlotsFormData) => {
      const activeDocId = acceptedDoctors[0]?.doctorId;
      if (!activeDocId) throw new Error("No active affiliated doctor found to generate slots");
      return clinicAppointmentsApi.generateDoctorSlots(activeDocId, data);
    },
    invalidate: [qk.clinicSelf.all()],
    successMessage: "Slots batch generated for active doctor",
    onSuccess: () => {
      setGenerateModalOpen(false);
      generateForm.reset();
    },
  });

  const createRoomMutation = useEntityMutation({
    mutationFn: (data: RoomFormData) =>
      clinicSelfApi.createRoom({
        name: data.name.trim(),
        specialtyId: data.specialtyId?.trim() ? data.specialtyId.trim() : undefined,
      }),
    invalidate: [qk.clinicSelf.rooms()],
    successMessage: "Physical room added",
    onSuccess: () => {
      setRoomModalOpen(false);
      roomForm.reset();
    },
  });

  // Heatmap aggregation
  const heatmapData = useMemo(() => {
    return aggregateByDate(appointments, (a) => a.slot?.date || a.createdAt);
  }, [appointments]);

  // Status Counts
  const statusCounts = useMemo(() => {
    let confirmed = 0;
    let completed = 0;
    let pending = 0;
    let cancelled = 0;
    appointments.forEach((a) => {
      const st = String(a.status || "").toUpperCase();
      if (st === "CONFIRMED") confirmed++;
      else if (st === "COMPLETED") completed++;
      else if (st === "CANCELLED") cancelled++;
      else pending++;
    });
    return { confirmed, completed, pending, cancelled };
  }, [appointments]);

  const completionRate =
    statusCounts.completed + statusCounts.cancelled > 0
      ? Math.round((statusCounts.completed / (statusCounts.completed + statusCounts.cancelled)) * 100)
      : 100;

  // Export Data JSON
  const handleExportData = () => {
    const payload = {
      profile,
      acceptedDoctorsCount: acceptedDoctors.length,
      roomsCount: rooms.length,
      appointmentsCount: totalAppointments,
      statusCounts,
      appointments: appointments.map((a) => ({
        id: a.id,
        patient: formatPatientName(a),
        doctor: formatDoctorName(a.doctor),
        status: a.status,
        date: a.slot?.date,
        time: a.slot?.startTime,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `iyadati-clinic-analytics-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* 1. Live Cockpit Header Banner & Quick Actions */}
      <GlassCard className="relative overflow-hidden p-6 md:p-8 border border-border/40">
        <div className="pointer-events-none absolute -end-16 -top-16 h-64 w-64 rounded-full bg-primary-500/10 blur-3xl" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-border/50 bg-accent/40 shadow-xs">
              {isProfileLoading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <RemoteImage
                  src={profile?.logoUrl}
                  alt={profile?.nameFr || "Clinic"}
                  className="h-full w-full object-cover"
                />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">
                  {isProfileLoading ? (
                    <Skeleton className="h-7 w-48" />
                  ) : (
                    profile?.nameFr || profile?.nameAr || "Clinic Operational Cockpit"
                  )}
                </h1>
                <div className="glass inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold text-success border border-success/30">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                  </span>
                  Live Cockpit
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5 text-primary-500" />
                <span>{profile?.wilaya?.nameFr || "Algeria"}</span>
                {profile?.isVerified && (
                  <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
                    Verified Facility
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setWalkInModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary-500 px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:opacity-90 transition cursor-pointer"
            >
              <Zap className="h-3.5 w-3.5" /> Walk-in Booking
            </button>

            <button
              onClick={() => setInviteModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl glass border border-border/60 px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-accent transition cursor-pointer"
            >
              <UserPlus className="h-3.5 w-3.5 text-primary-500" /> Invite Doctor
            </button>

            <button
              onClick={() => setGenerateModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl glass border border-border/60 px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-accent transition cursor-pointer"
            >
              <CalendarRange className="h-3.5 w-3.5 text-primary-500" /> Generate Slots
            </button>

            <button
              onClick={() => setRoomModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl glass border border-border/60 px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-accent transition cursor-pointer"
            >
              <DoorOpen className="h-3.5 w-3.5 text-primary-500" /> Add Room
            </button>

            <button
              onClick={handleExportData}
              className="inline-flex items-center gap-1.5 rounded-xl glass border border-border/60 px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-accent transition cursor-pointer"
              title="Export Analytics JSON"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </GlassCard>

      {/* News Ticker Tape */}
      <NewsTicker
        pendingCount={statusCounts.pending}
        todayCount={todayAppointments.length}
        completedCount={statusCounts.completed}
      />

      {/* 2. Main KPI Cards Grid & Sponsored Announcement Banner */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label="Affiliated Doctors"
          value={acceptedDoctors.length}
          subLabel={`${doctors.length} total affiliations (${pendingCount} pending)`}
          delta={acceptedDoctors.length}
          tone="primary"
        />
        <KPICard
          label="Physical Rooms"
          value={rooms.length}
          subLabel="Available Consultation Rooms"
          delta={rooms.length}
          tone="success"
        />
        <KPICard
          label="Total Appointments"
          value={totalAppointments}
          subLabel="Appointments Across All Doctors"
          delta={totalAppointments}
          tone="info"
        />
        <KPICard
          label="Today's Schedule"
          value={todayAppointments.length}
          subLabel={`Appointments on ${format(new Date(), "MMM d, yyyy")}`}
          delta={todayAppointments.length}
          tone="warning"
        />
      </div>

      {/* Sponsored Announcement Banner */}
      <AdvertisementBanner
        title="Aiyadati Enterprise Healthcare Network"
        description="Streamline patient consultations, automated scheduling, and doctor affiliations seamlessly across Algeria."
        link="https://iyadati.com"
      />

      {/* 3. Mini Statistics Secondary Strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
        <GlassCard className="p-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-primary-500/15 text-primary-500 grid place-items-center font-bold">
              <Percent className="h-3.5 w-3.5" />
            </div>
            <div>
              <div className="text-[10px] font-semibold text-muted-foreground">Completion Rate</div>
              <div className="text-sm font-bold">{completionRate}%</div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-info/15 text-info grid place-items-center font-bold">
              <Users className="h-3.5 w-3.5" />
            </div>
            <div>
              <div className="text-[10px] font-semibold text-muted-foreground">Guest Patients</div>
              <div className="text-sm font-bold">{appointments.filter((a) => a.guestPatient).length}</div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-success/15 text-success grid place-items-center font-bold">
              <FileCheck className="h-3.5 w-3.5" />
            </div>
            <div>
              <div className="text-[10px] font-semibold text-muted-foreground">Legal Docs</div>
              <div className="text-sm font-bold">{documents.length} Uploaded</div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-warning/15 text-warning grid place-items-center font-bold">
              <Clock className="h-3.5 w-3.5" />
            </div>
            <div>
              <div className="text-[10px] font-semibold text-muted-foreground">Active Today</div>
              <div className="text-sm font-bold">{todayAppointments.length} Appts</div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-3 flex items-center justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-primary-500/15 text-primary-500 grid place-items-center font-bold">
              <Building2 className="h-3.5 w-3.5" />
            </div>
            <div>
              <div className="text-[10px] font-semibold text-muted-foreground">Facility Type</div>
              <div className="text-xs font-bold truncate">{profile?.facilityType || "CLINIC"}</div>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* 4. Status Breakdown Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <GlassCard className="p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-info/15 text-info grid place-items-center font-bold">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-muted-foreground">Confirmed</div>
              <div className="text-base font-bold">{statusCounts.confirmed}</div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-success/15 text-success grid place-items-center font-bold">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-muted-foreground">Completed</div>
              <div className="text-base font-bold">{statusCounts.completed}</div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-warning/15 text-warning grid place-items-center font-bold">
              <AlertCircle className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-muted-foreground">Pending</div>
              <div className="text-base font-bold">{statusCounts.pending}</div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-danger/15 text-danger grid place-items-center font-bold">
              <XCircle className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-muted-foreground">Cancelled</div>
              <div className="text-base font-bold">{statusCounts.cancelled}</div>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* 5. 24-Week Interactive Activity Heatmap Visualization */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ActivityHeatmap
          data={heatmapData}
          weeks={24}
          title="Facility Booking Density & Volume Matrix"
          subtitle="Visual representation of patient booking frequency across dates"
          tone="primary"
        />

        <DayHourHeatmap
          data={[]}
          rawData={appointments}
          getDate={(a) => a.slot?.date || a.createdAt}
          getTime={(a) => a.slot?.startTime}
          getStatus={(a) => a.status}
          hourBlocks={8}
          title="Facility Day × Hour Matrix"
          subtitle="Peak hourly consultation distribution"
          tone="primary"
        />
      </div>

      {/* 6. Main Content Grid (Appointments Feed + Doctors Sidebar) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Appointments Feed with Drawer Trigger */}
        <GlassCard className="p-6 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Recent Facility Appointments</h2>
              <p className="text-xs text-muted-foreground">Click any appointment row to open details inspector</p>
            </div>
            <Link
              to="/appointments"
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary-500 hover:underline"
            >
              View All <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {isAppointmentsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-2xl" />
              ))}
            </div>
          ) : appointments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CalendarClock className="h-10 w-10 text-muted-foreground/50 mb-2" />
              <p className="text-sm font-semibold">No appointments yet</p>
              <p className="text-xs text-muted-foreground max-w-xs mt-1">
                Book a walk-in patient or generate doctor slots to begin accepting appointments.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {appointments.slice(0, 7).map((app) => {
                const patientName = formatPatientName(app);
                const doctorName = formatDoctorName(app.doctor);

                return (
                  <div
                    key={app.id}
                    onClick={() => setSelectedAppointment(app)}
                    className="flex items-center justify-between py-3 px-2 rounded-xl hover:bg-accent/40 transition cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 shrink-0 rounded-full bg-primary-500/15 text-primary-500 grid place-items-center font-bold text-xs">
                        {patientName[0] || "P"}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-foreground truncate group-hover:text-primary-500 transition">
                          {patientName}
                        </div>
                        <div className="text-[11px] text-muted-foreground font-medium truncate">
                          {doctorName} {app.room ? `· ${app.room.name}` : ""}
                        </div>
                      </div>
                    </div>

                    <div className="text-end flex items-center gap-3 shrink-0">
                      <StatusBadge value={app.status} />
                      <div className="text-[10px] text-muted-foreground font-semibold">
                        {app.slot?.date || app.createdAt?.slice(0, 10)} {app.slot?.startTime ? app.slot.startTime.slice(0, 5) : ""}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary-500 transition" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>

        {/* Affiliated Doctors Summary Sidebar */}
        <GlassCard className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Affiliated Doctors</h2>
            <Link to="/doctors" className="text-xs font-semibold text-primary-500 hover:underline">
              Manage
            </Link>
          </div>

          {doctors.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground">
              No doctors affiliated with this clinic yet.
              <div className="mt-3">
                <button
                  onClick={() => setInviteModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary-500/10 px-3 py-1.5 text-xs font-semibold text-primary-500 hover:bg-primary-500/20 cursor-pointer"
                >
                  <UserPlus className="h-3.5 w-3.5" /> Invite Doctors
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {doctors.slice(0, 7).map((doc) => {
                const docName = formatDoctorName(doc.doctor);
                const specName = formatDoctorSpecialty(doc.doctor);

                return (
                  <div
                    key={doc.id}
                    onClick={() => setSelectedDoctor(doc)}
                    className="flex items-center justify-between rounded-2xl bg-accent/30 p-3 border border-border/40 hover:bg-accent/60 transition cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <RemoteImage
                        src={doc.doctor?.avatarUrl || doc.doctor?.photoUrl}
                        alt={docName}
                        className="h-9 w-9 shrink-0 rounded-full object-cover border border-border/40"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-foreground truncate group-hover:text-primary-500 transition">
                          {docName}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-medium truncate">
                          {specName}
                        </div>
                      </div>
                    </div>
                    <StatusBadge value={doc.status} />
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>
      </div>

      {/* ─── DRAWERS ─── */}
      {/* 1. Appointment Details Inspector Drawer */}
      <AppointmentDrawer
        appointment={selectedAppointment}
        onClose={() => setSelectedAppointment(null)}
      />

      {/* 2. Doctor Details Inspector Drawer */}
      <DoctorDetailDrawer
        doctorAffiliation={selectedDoctor}
        onClose={() => setSelectedDoctor(null)}
      />

      {/* ─── QUICK ACTION MODALS ─── */}
      {/* 1. Walk-in Booking Modal */}
      <WalkInBookingModal
        open={walkInModalOpen}
        onClose={() => setWalkInModalOpen(false)}
      />

      {/* 2. Invite Doctor Modal */}
      <DoctorInviteModal
        open={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
      />

      {/* 3. Batch Generate Slots Modal */}
      <FormModal
        id="quick-generate-modal"
        open={generateModalOpen}
        onClose={() => setGenerateModalOpen(false)}
        title="Batch Generate Doctor Slots"
        description="Generate standard consultation slots for date range"
      >
        <form onSubmit={generateForm.handleSubmit((d) => generateSlotsMutation.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Start Date*</label>
              <input
                type="date"
                {...generateForm.register("startDate")}
                className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">End Date*</label>
              <input
                type="date"
                {...generateForm.register("endDate")}
                className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Physical Room (Optional)</label>
            <select
              {...generateForm.register("roomId")}
              className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40 bg-background text-foreground"
            >
              <option value="">No specific room</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-4 border-t border-border/40 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setGenerateModalOpen(false)}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={generateSlotsMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              {generateSlotsMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Generate Slots
            </button>
          </div>
        </form>
      </FormModal>

      {/* 4. Add Room Modal */}
      <FormModal
        id="quick-room-modal"
        open={roomModalOpen}
        onClose={() => setRoomModalOpen(false)}
        title="Add Physical Consultation Room"
        description="Enter room designation"
      >
        <form onSubmit={roomForm.handleSubmit((d) => createRoomMutation.mutate(d))} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Room Designation / Name*</label>
            <input
              {...roomForm.register("name")}
              placeholder="e.g. Consultation Room 102"
              className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
            />
            {roomForm.formState.errors.name && (
              <p className="text-xs text-danger">{roomForm.formState.errors.name.message}</p>
            )}
          </div>

          <div className="pt-4 border-t border-border/40 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setRoomModalOpen(false)}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createRoomMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              {createRoomMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Create Room
            </button>
          </div>
        </form>
      </FormModal>
    </div>
  );
}
