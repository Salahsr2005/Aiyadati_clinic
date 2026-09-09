import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
  Star,
  Sparkles,
  Camera,
  ShieldCheck,
  FileText,
  Layers,
  Activity,
  BadgeCheck,
  CheckCircle,
} from "lucide-react";
import { useClinicProfile } from "@/hooks/useClinicProfile";
import { useClinicDoctors } from "@/hooks/useClinicDoctors";
import { ensureArray } from "@/lib/utils";
import { clinicAppointmentsApi, type ClinicAppointmentRow } from "@/api/clinicAppointmentsApi";
import {
  clinicSelfApi,
  type ClinicDoctor,
  type ClinicRoom,
  type ClinicGalleryItem,
  type ClinicWorkingHour,
} from "@/api/clinicSelfApi";
import { clinicServicesApi, type ClinicService } from "@/api/clinicServicesApi";
import { reviewsApi, type ReviewRow, type ReviewStats } from "@/api/reviewsApi";

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
import { format } from "date-fns";

// Zod schemas for Quick Action Modals
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

type GenerateSlotsFormData = z.infer<typeof generateSlotsSchema>;
type RoomFormData = z.infer<typeof roomSchema>;

/** Extract doctor full name cleanly */
function formatDoctorName(doc: ClinicDoctor["doctor"] | undefined): string {
  if (!doc) return "Assigned Doctor";
  const docAny = doc as any;
  const firstName = docAny.firstNameFr || docAny.firstNameAr || doc.firstName || "";
  const lastName = docAny.lastNameFr || docAny.lastNameAr || doc.lastName || "";
  const full = `${firstName} ${lastName}`.trim();
  if (full) return `Dr. ${full}`;
  if (doc.name) return `Dr. ${doc.name}`;
  if (doc.email) return doc.email.split("@")[0];
  return "Doctor";
}

/** Extract specialty name */
function formatDoctorSpecialty(doc: ClinicDoctor["doctor"] | undefined): string {
  if (!doc) return "General Practice";
  const docAny = doc as any;
  if (Array.isArray(docAny.specialties) && docAny.specialties.length > 0) {
    return docAny.specialties[0].nameFr || docAny.specialties[0].nameAr || "Specialist";
  }
  return doc.specialtyName || doc.specialty?.nameFr || doc.specialty?.nameAr || "Specialist";
}

/** Extract patient name */
function formatPatientName(app: ClinicAppointmentRow): string {
  if (app.patient) {
    const patAny = app.patient as any;
    const f = patAny.firstNameFr || app.patient.firstName || "";
    const l = patAny.lastNameFr || app.patient.lastName || "";
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

function getDayIndex(day: number | string): number {
  if (typeof day === "number") return day;
  const str = String(day).trim().toUpperCase();
  const enums = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
  const idx = enums.indexOf(str);
  if (idx !== -1) return idx;
  const parsed = parseInt(str, 10);
  return !isNaN(parsed) ? parsed : 0;
}

/** Helper: Calculate whether clinic is open right now based on working hours */
function checkIsOpenNow(workingHours: ClinicWorkingHour[]): { isOpen: boolean; todayHours?: ClinicWorkingHour } {
  if (!workingHours || workingHours.length === 0) return { isOpen: false };

  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday ... 6 = Saturday
  const todayHours = workingHours.find((h) => getDayIndex(h.dayOfWeek) === currentDay);

  if (!todayHours || !todayHours.isOpen || !todayHours.openTime || !todayHours.closeTime) {
    return { isOpen: false, todayHours };
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [openH, openM] = todayHours.openTime.split(":").map(Number);
  const [closeH, closeM] = todayHours.closeTime.split(":").map(Number);

  const openMinutes = openH * 60 + (openM || 0);
  const closeMinutes = closeH * 60 + (closeM || 0);

  const isOpen = currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
  return { isOpen, todayHours };
}

/** Helper: Calculate profile completeness score and missing required elements */
function calculateProfileCompleteness(profile: any, docsCount: number): { score: number; missing: string[] } {
  if (!profile) return { score: 0, missing: [] };
  const missing: string[] = [];
  let points = 0;
  const totalPoints = 6;

  if (profile.nameFr || profile.nameAr) points++;
  else missing.push("Name");
  if (profile.email) points++;
  else missing.push("Email");
  if (profile.phone) points++;
  else missing.push("Phone");
  if (profile.address || profile.wilayaId || profile.baladyaId) points++;
  else missing.push("Location");
  if (profile.logoUrl) points++;
  else missing.push("Logo");
  if (docsCount > 0) points++;
  else missing.push("Legal License");

  const score = Math.round((points / totalPoints) * 100);
  return { score, missing };
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function DashboardPage() {
  const { t } = useTranslation();
  const { data: profile, isLoading: isProfileLoading } = useClinicProfile();
  const { doctors, acceptedDoctors, pendingDoctors, pendingCount } = useClinicDoctors();

  // Queries for the 9 Real-Data Widgets
  const { data: rawRooms } = useQuery({
    queryKey: qk.clinicSelf.rooms(),
    queryFn: clinicSelfApi.getRooms,
  });

  const { data: rawWorkingHours } = useQuery({
    queryKey: qk.clinicSelf.workingHours(),
    queryFn: clinicSelfApi.getWorkingHours,
  });

  const { data: rawServices } = useQuery({
    queryKey: qk.clinicSelf.services(),
    queryFn: clinicServicesApi.list,
  });

  const { data: rawGallery } = useQuery({
    queryKey: qk.clinicSelf.gallery(),
    queryFn: clinicSelfApi.getGallery,
  });

  const { data: appointmentsData, isLoading: isAppointmentsLoading } = useQuery({
    queryKey: qk.clinicSelf.appointments({ limit: 100 }),
    queryFn: () => clinicAppointmentsApi.listAppointments({ limit: 100 }),
  });

  const { data: rawDocuments } = useQuery({
    queryKey: qk.clinicSelf.documents(),
    queryFn: clinicSelfApi.getDocuments,
  });

  const clinicId = profile?.id || "";
  const { data: reviewStats } = useQuery<ReviewStats>({
    queryKey: ["clinicReviewStats", clinicId],
    queryFn: () => reviewsApi.clinicStats(clinicId),
    enabled: !!clinicId,
  });

  const { data: rawClinicReviews } = useQuery<ReviewRow[]>({
    queryKey: ["clinicReviews", clinicId],
    queryFn: () => reviewsApi.clinic(clinicId),
    enabled: !!clinicId,
  });

  const rooms: ClinicRoom[] = ensureArray<ClinicRoom>(rawRooms);
  const workingHours: ClinicWorkingHour[] = ensureArray<ClinicWorkingHour>(rawWorkingHours);
  const services: ClinicService[] = ensureArray<ClinicService>(rawServices);
  const galleryItems: ClinicGalleryItem[] = ensureArray<ClinicGalleryItem>(rawGallery);
  const appointments: ClinicAppointmentRow[] = ensureArray<ClinicAppointmentRow>(appointmentsData?.data);
  const documents = ensureArray(rawDocuments);
  const reviews = ensureArray<ReviewRow>(rawClinicReviews);

  const totalAppointments = appointmentsData?.total ?? appointments.length;

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const todayAppointments = appointments.filter((a) => a.slot?.date === todayStr);

  // Widget 1: Profile Completeness & Open Now Status
  const { score: completenessScore, missing: missingFields } = calculateProfileCompleteness(profile, documents.length);
  const { isOpen: isOpenNow, todayHours } = checkIsOpenNow(workingHours);

  // Selected items for drawers
  const [selectedAppointment, setSelectedAppointment] = useState<ClinicAppointmentRow | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<ClinicDoctor | null>(null);

  // Quick Action Modals State
  const [walkInModalOpen, setWalkInModalOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [roomModalOpen, setRoomModalOpen] = useState(false);

  // Forms
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

  // Widget 7: Detailed Appointment Funnel & Registered vs Guest Breakdown
  const funnelCounts = useMemo(() => {
    let pending = 0;
    let confirmed = 0;
    let inProgress = 0;
    let completed = 0;
    let cancelled = 0;
    let noShow = 0;
    let registeredCount = 0;
    let guestCount = 0;

    appointments.forEach((a) => {
      const st = String(a.status || "").toUpperCase();
      if (st === "CONFIRMED") confirmed++;
      else if (st === "IN_PROGRESS") inProgress++;
      else if (st === "COMPLETED") completed++;
      else if (st === "CANCELLED") cancelled++;
      else if (st === "NO_SHOW") noShow++;
      else pending++;

      if (a.guestPatient) guestCount++;
      else registeredCount++;
    });

    return {
      pending,
      confirmed,
      inProgress,
      completed,
      cancelled,
      noShow,
      registeredCount,
      guestCount,
      total: appointments.length,
    };
  }, [appointments]);

  const completionRate =
    funnelCounts.completed + funnelCounts.cancelled > 0
      ? Math.round((funnelCounts.completed / (funnelCounts.completed + funnelCounts.cancelled)) * 100)
      : 100;

  // Widget 8: Rating Stats Calculation
  const avgRatingNum = Number(reviewStats?.avgRating || reviewStats?.average || 0);
  const totalReviewsCount = Number(reviewStats?.totalReviews || reviewStats?.count || reviews.length);

  // Export Analytics Data JSON
  const handleExportData = () => {
    const payload = {
      profile,
      completenessScore,
      isOpenNow,
      acceptedDoctorsCount: acceptedDoctors.length,
      pendingDoctorsCount: pendingCount,
      roomsCount: rooms.length,
      activeRoomsCount: rooms.filter((r) => r.isActive !== false).length,
      servicesCount: services.length,
      galleryItemsCount: galleryItems.length,
      appointmentsCount: totalAppointments,
      funnelCounts,
      reviewsStats: {
        avgRating: avgRatingNum,
        totalReviews: totalReviewsCount,
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `iyadati-clinic-dashboard-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ─── 1. LIVE COCKPIT HEADER BANNER ─── */}
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
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">
                  {isProfileLoading ? (
                    <Skeleton className="h-7 w-48" />
                  ) : (
                    profile?.nameFr || profile?.nameAr || t("dashboard.cockpitTitle", { defaultValue: "Clinic Operational Cockpit" })
                  )}
                </h1>

                {/* Widget 2: "Open Now" Working Hours Indicator Badge */}
                {isOpenNow ? (
                  <div className="glass inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold text-success border border-success/30">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                    </span>
                    {t("dashboard.openNow", { defaultValue: "Open Now" })}
                  </div>
                ) : (
                  <div className="glass inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold text-muted-foreground border border-border/50">
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/60" />
                    {t("dashboard.closedNow", { defaultValue: "Closed Now" })}
                  </div>
                )}

                {profile?.isVerified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary-500/15 px-2.5 py-0.5 text-[11px] font-bold text-primary-500">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    {t("status.VERIFIED", { defaultValue: "Verified Facility" })}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5 text-primary-500" />
                <span>{profile?.wilaya?.nameFr || "Algeria"}</span>
                {todayHours?.isOpen && (
                  <span>
                    · {t("profile.view.openHours", { defaultValue: "Today" })}: {todayHours.openTime.slice(0, 5)} - {todayHours.closeTime.slice(0, 5)}
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
              <Zap className="h-3.5 w-3.5" /> {t("patients.createGuestButton", { defaultValue: "Walk-in Booking" })}
            </button>

            <button
              onClick={() => setInviteModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl glass border border-border/60 px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-accent transition cursor-pointer"
            >
              <UserPlus className="h-3.5 w-3.5 text-primary-500" /> {t("doctors.inviteButton", { defaultValue: "Invite Doctor" })}
            </button>

            <button
              onClick={() => setGenerateModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl glass border border-border/60 px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-accent transition cursor-pointer"
            >
              <CalendarRange className="h-3.5 w-3.5 text-primary-500" /> {t("schedule.batchGenerateButton", { defaultValue: "Generate Slots" })}
            </button>

            <button
              onClick={() => setRoomModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl glass border border-border/60 px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-accent transition cursor-pointer"
            >
              <DoorOpen className="h-3.5 w-3.5 text-primary-500" /> {t("rooms.createButton", { defaultValue: "Add Room" })}
            </button>

            <button
              onClick={handleExportData}
              className="inline-flex items-center gap-1.5 rounded-xl glass border border-border/60 px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-accent transition cursor-pointer"
              title="Export Dashboard Analytics JSON"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </GlassCard>

      {/* ─── WIDGET 1: PROFILE COMPLETENESS & VERIFICATION STATUS BANNER ─── */}
      <GlassCard className="p-4 border border-primary-500/20 bg-primary-500/5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 rounded-2xl bg-primary-500/15 text-primary-500 grid place-items-center font-bold">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-primary-500">
                  {t("dashboard.profileCompleteness", { defaultValue: "Profile Completeness" })}: {completenessScore}%
                </span>
                {completenessScore === 100 ? (
                  <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" /> Ready
                  </span>
                ) : (
                  <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-semibold text-warning">
                    Action Needed
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-2 w-32 sm:w-48 overflow-hidden rounded-full bg-muted/60">
                  <div
                    className="h-full bg-primary-500 transition-all duration-500"
                    style={{ width: `${completenessScore}%` }}
                  />
                </div>
                {missingFields.length > 0 && (
                  <span className="text-[11px] text-muted-foreground">
                    Missing: {missingFields.join(", ")}
                  </span>
                )}
              </div>
            </div>
          </div>

          <Link
            to="/profile"
            className="inline-flex items-center gap-1 text-xs font-bold text-primary-500 hover:underline shrink-0"
          >
            {t("profile.title", { defaultValue: "Complete Profile & Legal Docs" })} <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
          </Link>
        </div>
      </GlassCard>

      {/* News Ticker Tape */}
      <NewsTicker
        pendingCount={funnelCounts.pending}
        todayCount={todayAppointments.length}
        completedCount={funnelCounts.completed}
      />

      {/* ─── 2. MAIN KPI CARDS GRID ─── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label={t("doctors.totalDoctors", { defaultValue: "Affiliated Doctors" })}
          value={acceptedDoctors.length}
          subLabel={`${doctors.length} total affiliations (${pendingCount} pending)`}
          delta={acceptedDoctors.length}
          tone="primary"
        />
        <KPICard
          label={t("rooms.totalRooms", { defaultValue: "Physical Rooms" })}
          value={rooms.length}
          subLabel={`${rooms.filter((r) => r.isActive !== false).length} Active Consultation Rooms`}
          delta={rooms.length}
          tone="success"
        />
        <KPICard
          label={t("overview.kpi.totalAppointments", { defaultValue: "Total Appointments" })}
          value={totalAppointments}
          subLabel="Appointments Across All Doctors"
          delta={totalAppointments}
          tone="info"
        />
        <KPICard
          label={t("dashboard.todaysSchedule", { defaultValue: "Today's Schedule" })}
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

      {/* ─── 3. SECONDARY KPI STRIP ─── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
        <GlassCard className="p-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-primary-500/15 text-primary-500 grid place-items-center font-bold">
              <Percent className="h-3.5 w-3.5" />
            </div>
            <div>
              <div className="text-[10px] font-semibold text-muted-foreground">{t("overview.kpi.completionRate", { defaultValue: "Completion Rate" })}</div>
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
              <div className="text-[10px] font-semibold text-muted-foreground">{t("patients.guestPatients", { defaultValue: "Guest Patients" })}</div>
              <div className="text-sm font-bold">{funnelCounts.guestCount}</div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-success/15 text-success grid place-items-center font-bold">
              <FileCheck className="h-3.5 w-3.5" />
            </div>
            <div>
              <div className="text-[10px] font-semibold text-muted-foreground">{t("profile.documentsInfo", { defaultValue: "Legal Docs" })}</div>
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
              <div className="text-[10px] font-semibold text-muted-foreground">{t("dashboard.activeToday", { defaultValue: "Active Today" })}</div>
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
              <div className="text-[10px] font-semibold text-muted-foreground">{t("dashboard.facilityType", { defaultValue: "Facility Type" })}</div>
              <div className="text-xs font-bold truncate">{profile?.facilityType || "CLINIC"}</div>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* ─── 4. REAL DATA WIDGETS GRID: ROW 1 (HOURS & ROOMS) ─── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* WIDGET 2: Working Hours Status Widget */}
        <GlassCard className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary-500" />
              <h3 className="text-sm font-bold">{t("profile.hoursInfo", { defaultValue: "Weekly Working Schedule" })}</h3>
            </div>
            <Link to="/profile" className="text-xs font-semibold text-primary-500 hover:underline">
              {t("common.edit", { defaultValue: "Manage" })}
            </Link>
          </div>

          {workingHours.length === 0 ? (
            <div className="text-xs text-muted-foreground py-4 text-center">
              {t("common.empty", { defaultValue: "No operating hours configured yet." })}
              <div className="mt-2">
                <Link to="/profile" className="text-primary-500 font-semibold hover:underline">
                  Configure working hours in profile
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {workingHours.map((wh) => {
                const dayIdx = getDayIndex(wh.dayOfWeek);
                const dayName = DAY_NAMES[dayIdx] || String(wh.dayOfWeek);
                const isToday = new Date().getDay() === dayIdx;

                return (
                  <div
                    key={wh.id || wh.dayOfWeek}
                    className={`rounded-xl p-2.5 border text-center transition ${
                      isToday
                        ? "bg-primary-500/10 border-primary-500/40 ring-1 ring-primary-500/20"
                        : "bg-accent/20 border-border/40"
                    }`}
                  >
                    <div className="text-[11px] font-bold text-foreground">
                      {dayName.slice(0, 3)} {isToday && "(Today)"}
                    </div>
                    {wh.isOpen ? (
                      <div className="text-[10px] font-semibold text-primary-500 mt-1">
                        {wh.openTime?.slice(0, 5)} - {wh.closeTime?.slice(0, 5)}
                      </div>
                    ) : (
                      <div className="text-[10px] font-medium text-muted-foreground mt-1">
                        {t("status.INACTIVE", { defaultValue: "Closed" })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>

        {/* WIDGET 3: Active Rooms Count & Utilization Status */}
        <GlassCard className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DoorOpen className="h-4 w-4 text-primary-500" />
              <h3 className="text-sm font-bold">{t("dashboard.roomsUtilization", { defaultValue: "Active Rooms & Utilization" })}</h3>
            </div>
            <Link to="/rooms" className="text-xs font-semibold text-primary-500 hover:underline">
              {t("rooms.createButton", { defaultValue: "+ Add Room" })}
            </Link>
          </div>

          {rooms.length === 0 ? (
            <div className="text-xs text-muted-foreground py-4 text-center">
              {t("common.empty", { defaultValue: "No physical rooms created." })}
              <div className="mt-2">
                <button
                  onClick={() => setRoomModalOpen(true)}
                  className="text-primary-500 font-semibold hover:underline cursor-pointer"
                >
                  Create a consultation room
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                <span>Total Registered: {rooms.length} Rooms</span>
                <span className="text-success font-bold">
                  {rooms.filter((r) => r.isActive !== false).length} Operational
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {rooms.map((room) => (
                  <div
                    key={room.id}
                    className="flex items-center justify-between rounded-xl bg-accent/30 p-2.5 border border-border/40"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate text-foreground">{room.name}</div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {room.specialty?.nameFr || room.specialty?.nameAr || "General"}
                      </div>
                    </div>
                    <span
                      className={`h-2 w-2 rounded-full shrink-0 ${
                        room.isActive !== false ? "bg-success" : "bg-muted-foreground/40"
                      }`}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </GlassCard>
      </div>

      {/* ─── 5. REAL DATA WIDGETS GRID: ROW 2 (SERVICES & GALLERY) ─── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* WIDGET 4: Care Services Preview Strip */}
        <GlassCard className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-primary-500" />
              <h3 className="text-sm font-bold">{t("dashboard.servicesPreview", { defaultValue: "Care Services & Offerings" })} ({services.length})</h3>
            </div>
            <Link to="/services" className="text-xs font-semibold text-primary-500 hover:underline">
              {t("common.view", { defaultValue: "View All" })}
            </Link>
          </div>

          {services.length === 0 ? (
            <div className="text-xs text-muted-foreground py-4 text-center">
              {t("services.emptyTitle", { defaultValue: "No care services configured." })}
              <div className="mt-2">
                <Link to="/services" className="text-primary-500 font-semibold hover:underline">
                  Add treatments & services
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {services.slice(0, 4).map((svc) => (
                <div key={svc.id} className="flex items-center gap-3 rounded-xl bg-accent/30 p-2.5 border border-border/40">
                  <div className="h-10 w-10 shrink-0 rounded-lg overflow-hidden bg-accent/60 border border-border/40">
                    <RemoteImage
                      src={svc.images?.[0]?.imageUrl}
                      alt={svc.nameFr}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-foreground truncate">{svc.nameFr || svc.nameAr}</div>
                    <div className="text-[10px] text-muted-foreground flex items-center justify-between mt-0.5">
                      <span>{svc.durationMinutes ? `${svc.durationMinutes} mins` : "Flexible"}</span>
                      {svc.price ? <span className="font-bold text-foreground">{svc.price} DZD</span> : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        {/* WIDGET 5: Clinic Gallery Photo Preview Strip */}
        <GlassCard className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="h-4 w-4 text-primary-500" />
              <h3 className="text-sm font-bold">{t("dashboard.galleryPreview", { defaultValue: "Facility Photo Gallery" })} ({galleryItems.length})</h3>
            </div>
            <Link to="/gallery" className="text-xs font-semibold text-primary-500 hover:underline">
              {t("common.view", { defaultValue: "View Gallery" })}
            </Link>
          </div>

          {galleryItems.length === 0 ? (
            <div className="text-xs text-muted-foreground py-4 text-center">
              {t("common.empty", { defaultValue: "No gallery photos uploaded." })}
              <div className="mt-2">
                <Link to="/gallery" className="text-primary-500 font-semibold hover:underline">
                  Upload facility photos
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {galleryItems.slice(0, 4).map((item) => (
                <div key={item.id} className="relative aspect-video rounded-xl overflow-hidden border border-border/40 group">
                  <RemoteImage
                    src={item.imageUrl}
                    alt={item.title || "Facility"}
                    className="h-full w-full object-cover group-hover:scale-105 transition duration-300"
                  />
                  {item.title && (
                    <div className="absolute inset-x-0 bottom-0 bg-black/60 p-1 text-[9px] text-white truncate text-center">
                      {item.title}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>

      {/* ─── 6. REAL DATA WIDGETS GRID: ROW 3 (DOCTORS & PENDING INVITES) ─── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* WIDGET 6: Doctor Team Roster Widget */}
        <GlassCard className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary-500" />
              <h3 className="text-sm font-bold">{t("dashboard.doctorRoster", { defaultValue: "Accepted Medical Staff" })} ({acceptedDoctors.length})</h3>
            </div>
            <Link to="/doctors" className="text-xs font-semibold text-primary-500 hover:underline">
              {t("common.edit", { defaultValue: "Manage Roster" })}
            </Link>
          </div>

          {acceptedDoctors.length === 0 ? (
            <div className="text-xs text-muted-foreground py-4 text-center">
              {t("doctors.noDoctors", { defaultValue: "No accepted doctors affiliated yet." })}
            </div>
          ) : (
            <div className="space-y-2">
              {acceptedDoctors.slice(0, 5).map((doc) => {
                const docName = formatDoctorName(doc.doctor);
                const specName = formatDoctorSpecialty(doc.doctor);

                return (
                  <div
                    key={doc.id}
                    onClick={() => setSelectedDoctor(doc)}
                    className="flex items-center justify-between rounded-xl bg-accent/30 p-2.5 border border-border/40 hover:bg-accent/60 transition cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <RemoteImage
                        src={doc.doctor?.avatarUrl || doc.doctor?.photoUrl}
                        alt={docName}
                        className="h-8 w-8 shrink-0 rounded-full object-cover border border-border/40"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-foreground truncate">{docName}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{specName}</div>
                      </div>
                    </div>
                    <StatusBadge value={doc.status} />
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>

        {/* WIDGET 9: Pending Doctor Invitations Widget */}
        <GlassCard className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-warning" />
              <h3 className="text-sm font-bold">{t("dashboard.pendingInvitesWidget", { defaultValue: "Pending Doctor Invitations" })} ({pendingCount})</h3>
            </div>
            <button
              onClick={() => setInviteModalOpen(true)}
              className="text-xs font-semibold text-primary-500 hover:underline cursor-pointer"
            >
              + Invite Doctor
            </button>
          </div>

          {pendingDoctors.length === 0 ? (
            <div className="text-xs text-muted-foreground py-6 text-center">
              No pending invitations outstanding.
              <div className="mt-2">
                <button
                  onClick={() => setInviteModalOpen(true)}
                  className="inline-flex items-center gap-1 text-xs text-primary-500 font-semibold hover:underline cursor-pointer"
                >
                  <UserPlus className="h-3 w-3" /> Invite specialists to your team
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {pendingDoctors.slice(0, 5).map((doc) => {
                const docName = formatDoctorName(doc.doctor);
                const specName = formatDoctorSpecialty(doc.doctor);

                return (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between rounded-xl bg-warning/5 p-2.5 border border-warning/20"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <RemoteImage
                        src={doc.doctor?.avatarUrl || doc.doctor?.photoUrl}
                        alt={docName}
                        className="h-8 w-8 shrink-0 rounded-full object-cover border border-warning/30"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-foreground truncate">{docName}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{specName}</div>
                      </div>
                    </div>
                    <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-semibold text-warning">
                      Awaiting Response
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>
      </div>

      {/* ─── 7. REAL DATA WIDGETS GRID: ROW 4 (FUNNEL & REVIEWS) ─── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* WIDGET 7: Appointment Funnel Breakdown & Patient Split */}
        <GlassCard className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold">{t("dashboard.appointmentFunnel", { defaultValue: "Appointment Funnel Breakdown" })}</h3>
            <span className="text-xs font-semibold text-muted-foreground">{funnelCounts.total} Total</span>
          </div>

          {/* Status Breakdown Progress Bars */}
          <div className="space-y-2 text-xs">
            <div className="flex justify-between font-semibold">
              <span className="text-info">Confirmed ({funnelCounts.confirmed})</span>
              <span className="text-success">Completed ({funnelCounts.completed})</span>
              <span className="text-warning">Pending ({funnelCounts.pending})</span>
              <span className="text-danger">Cancelled ({funnelCounts.cancelled})</span>
            </div>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted/50 gap-0.5">
              {funnelCounts.total > 0 ? (
                <>
                  <div
                    style={{ width: `${(funnelCounts.confirmed / funnelCounts.total) * 100}%` }}
                    className="bg-info"
                    title={`Confirmed: ${funnelCounts.confirmed}`}
                  />
                  <div
                    style={{ width: `${(funnelCounts.completed / funnelCounts.total) * 100}%` }}
                    className="bg-success"
                    title={`Completed: ${funnelCounts.completed}`}
                  />
                  <div
                    style={{ width: `${(funnelCounts.pending / funnelCounts.total) * 100}%` }}
                    className="bg-warning"
                    title={`Pending: ${funnelCounts.pending}`}
                  />
                  <div
                    style={{ width: `${(funnelCounts.cancelled / funnelCounts.total) * 100}%` }}
                    className="bg-danger"
                    title={`Cancelled: ${funnelCounts.cancelled}`}
                  />
                </>
              ) : (
                <div className="w-full bg-muted" />
              )}
            </div>
          </div>

          {/* Patient Split: Registered App vs Walk-in Guests */}
          <div className="pt-3 border-t border-border/40">
            <div className="text-xs font-bold text-muted-foreground mb-2">
              {t("dashboard.patientTypes", { defaultValue: "Patient Split (App vs Walk-in)" })}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-accent/30 p-2.5 border border-border/40 flex items-center justify-between">
                <div className="text-xs font-semibold">{t("patients.appRegistered", { defaultValue: "Registered App" })}</div>
                <div className="text-sm font-bold text-primary-500">{funnelCounts.registeredCount}</div>
              </div>
              <div className="rounded-xl bg-accent/30 p-2.5 border border-border/40 flex items-center justify-between">
                <div className="text-xs font-semibold">{t("patients.guestPatients", { defaultValue: "Walk-in Guests" })}</div>
                <div className="text-sm font-bold text-info">{funnelCounts.guestCount}</div>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* WIDGET 8: Clinic Reviews Snippet & Rating Stats */}
        <GlassCard className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 fill-warning text-warning" />
              <h3 className="text-sm font-bold">{t("dashboard.reviewsWidget", { defaultValue: "Patient Satisfaction & Reviews" })}</h3>
            </div>
            <Link to="/reviews" className="text-xs font-semibold text-primary-500 hover:underline">
              {t("common.view", { defaultValue: "View All Reviews" })}
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-center shrink-0">
              <div className="text-3xl font-extrabold tracking-tight">{avgRatingNum ? avgRatingNum.toFixed(1) : "N/A"}</div>
              <div className="flex items-center justify-center gap-0.5 text-warning my-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`h-3.5 w-3.5 ${
                      s <= Math.round(avgRatingNum) ? "fill-warning text-warning" : "text-muted-foreground/30"
                    }`}
                  />
                ))}
              </div>
              <div className="text-[10px] text-muted-foreground font-semibold">
                {totalReviewsCount} {t("reviews.totalReviews", { defaultValue: "Total Reviews" })}
              </div>
            </div>

            <div className="flex-1 min-w-0 border-s border-border/40 ps-4">
              {reviews.length === 0 ? (
                <div className="text-xs text-muted-foreground italic">
                  No public patient reviews submitted yet for this clinic facility.
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="text-xs font-bold text-foreground truncate">
                    "{reviews[0].comment || reviews[0].review || "Satisfied patient consultation"}"
                  </div>
                  <div className="text-[10px] text-muted-foreground flex items-center justify-between">
                    <span>
                      {reviews[0].user?.firstName || reviews[0].patient?.firstName || "Patient"}
                    </span>
                    <span>{reviews[0].createdAt?.slice(0, 10)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </GlassCard>
      </div>

      {/* ─── 8. VISUAL ACTIVITY HEATMAPS ─── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ActivityHeatmap
          data={heatmapData}
          weeks={24}
          title={t("dashboard.optimalBookingTitle", { defaultValue: "Facility Booking Density & Volume Matrix" })}
          subtitle={t("dashboard.optimalBookingSub", { defaultValue: "Visual representation of patient booking frequency across dates" })}
          tone="primary"
        />

        <DayHourHeatmap
          data={[]}
          rawData={appointments}
          getDate={(a) => a.slot?.date || a.createdAt}
          getTime={(a) => a.slot?.startTime}
          getStatus={(a) => a.status}
          hourBlocks={8}
          title={t("dashboard.cancellationMatrixTitle", { defaultValue: "Facility Day × Hour Matrix" })}
          subtitle={t("dashboard.cancellationMatrixSub", { defaultValue: "Peak hourly consultation distribution" })}
          tone="primary"
        />
      </div>

      {/* ─── 9. RECENT APPOINTMENTS TABLE / FEED ─── */}
      <GlassCard className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">{t("dashboard.recentTableTitle", { defaultValue: "Recent Facility Appointments" })}</h2>
            <p className="text-xs text-muted-foreground">{t("dashboard.recentTableSub", { defaultValue: "Click any appointment row to open details inspector" })}</p>
          </div>
          <Link
            to="/appointments"
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary-500 hover:underline"
          >
            {t("common.view", { defaultValue: "View All" })} <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
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
            <p className="text-sm font-semibold">{t("common.empty", { defaultValue: "No appointments yet" })}</p>
            <p className="text-xs text-muted-foreground max-w-xs mt-1">
              {t("patients.createGuestButton", { defaultValue: "Book a walk-in patient" })} or generate doctor slots to begin accepting appointments.
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
                        {doctorName} {(app as any).room ? `· ${(app as any).room.name}` : ""}
                      </div>
                    </div>
                  </div>

                  <div className="text-end flex items-center gap-3 shrink-0">
                    <StatusBadge value={app.status} />
                    <div className="text-[10px] text-muted-foreground font-semibold">
                      {app.slot?.date || app.createdAt?.slice(0, 10)} {app.slot?.startTime ? app.slot.startTime.slice(0, 5) : ""}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary-500 transition rtl:rotate-180" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

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
        title={t("schedule.batchModalTitle", { defaultValue: "Batch Generate Doctor Slots" })}
        description={t("schedule.subtitle", { defaultValue: "Generate standard consultation slots for date range" })}
      >
        <form onSubmit={generateForm.handleSubmit((d) => generateSlotsMutation.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("schedule.startDate", { defaultValue: "Start Date*" })}</label>
              <input
                type="date"
                {...generateForm.register("startDate")}
                className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("schedule.endDate", { defaultValue: "End Date*" })}</label>
              <input
                type="date"
                {...generateForm.register("endDate")}
                className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("rooms.title", { defaultValue: "Physical Room (Optional)" })}</label>
            <select
              {...generateForm.register("roomId")}
              className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40 bg-background text-foreground"
            >
              <option value="">{t("rooms.generalPurpose", { defaultValue: "No specific room" })}</option>
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
              {t("common.cancel", { defaultValue: "Cancel" })}
            </button>
            <button
              type="submit"
              disabled={generateSlotsMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              {generateSlotsMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {t("schedule.batchGenerateButton", { defaultValue: "Generate Slots" })}
            </button>
          </div>
        </form>
      </FormModal>

      {/* 4. Add Room Modal */}
      <FormModal
        id="quick-room-modal"
        open={roomModalOpen}
        onClose={() => setRoomModalOpen(false)}
        title={t("rooms.createTitle", { defaultValue: "Add Physical Consultation Room" })}
        description={t("rooms.subtitle", { defaultValue: "Enter room designation" })}
      >
        <form onSubmit={roomForm.handleSubmit((d) => createRoomMutation.mutate(d))} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("rooms.nameLabel", { defaultValue: "Room Designation / Name*" })}</label>
            <input
              type="text"
              placeholder={t("rooms.namePlaceholder", { defaultValue: "e.g. Suite 102" })}
              {...roomForm.register("name")}
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
              {t("common.cancel", { defaultValue: "Cancel" })}
            </button>
            <button
              type="submit"
              disabled={createRoomMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              {createRoomMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {t("rooms.createButton", { defaultValue: "Add Room" })}
            </button>
          </div>
        </form>
      </FormModal>
    </div>
  );
}
