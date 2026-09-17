import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  Zap,
  Ban,
  Clock,
  Stethoscope,
  DoorOpen,
  Loader2,
  Calendar as CalendarIcon,
  CalendarRange,
  CalendarPlus,
  Filter,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Users,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  User,
  Phone,
  LayoutGrid,
  CalendarDays,
  Table as TableIcon,
  Search,
  Check,
  Building,
  RefreshCw,
  Sliders,
  Grid,
} from "lucide-react";
import { format, addDays, subDays, startOfWeek } from "date-fns";
import { toast } from "sonner";
import { clinicAppointmentsApi, type ClinicAppointmentRow, type DoctorSlot } from "@/api/clinicAppointmentsApi";
import { clinicSelfApi, type ClinicRoom } from "@/api/clinicSelfApi";
import { doctorsApi } from "@/api/doctorsApi";
import { useClinicDoctors } from "@/hooks/useClinicDoctors";
import { qk } from "@/lib/queryKeys";
import { useEntityMutation } from "@/lib/mutations";
import { ensureArray, cn } from "@/lib/utils";
import { GlassCard } from "@/components/glass/GlassCard";
import { RemoteImage } from "@/components/common/RemoteImage";
import { FormModal } from "@/components/data/FormModal";
import { EmptyState } from "@/components/data/EmptyState";
import { Skeleton } from "@/components/glass/Skeleton";
import { StatusBadge } from "@/components/data/StatusBadge";
import { DoctorScheduleHeatmap } from "@/components/schedule/DoctorScheduleHeatmap";
import { ScheduleVisualizer } from "@/components/schedule/ScheduleVisualizer";
import { SlotGridInspector } from "@/components/schedule/SlotGridInspector";
import { DoctorSelectorModal, type DoctorCardItem } from "@/components/doctors/DoctorSelectorModal";
import { ModernDatePickerModal } from "@/components/ui/ModernDatePickerModal";
import { WalkInBookingModal } from "@/components/appointments/WalkInBookingModal";
import { MultiDoctorBoard } from "@/components/schedule/MultiDoctorBoard";
import { OptimalSlotsTab } from "@/components/schedule/OptimalSlotsTab";
import { DoctorLegendBar } from "@/components/schedule/DoctorLegendBar";
import { DoctorTemplateViewer } from "@/components/schedule/DoctorTemplateViewer";
import { getDoctorColor } from "@/lib/doctorColor";

const generateSchema = z.object({
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  roomId: z.string().optional(),
  force: z.boolean().optional(),
});

const quickSlotSchema = z.object({
  date: z.string().min(1, "Date is required"),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  roomId: z.string().optional(),
  maxPatients: z.coerce.number().min(1),
});

const cancelDateSchema = z.object({
  date: z.string().min(1, "Date is required"),
  reason: z.string().optional(),
});

type GenerateFormData = z.infer<typeof generateSchema>;
type QuickSlotFormData = z.infer<typeof quickSlotSchema>;
type CancelDateFormData = z.infer<typeof cancelDateSchema>;

type MainTab = "board" | "template" | "generate" | "myslots";
type ViewMode = "timeline" | "weeklyMatrix" | "slotsTable";

export default function SchedulePage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  const { acceptedDoctors, isLoading: isDoctorsLoading } = useClinicDoctors();
  const [activeTab, setActiveTab] = useState<MainTab>("board");
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [activeView, setActiveView] = useState<ViewMode>("timeline");

  // Modals state
  const [doctorSelectorOpen, setDoctorSelectorOpen] = useState(false);
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [quickSlotModalOpen, setQuickSlotModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [walkInModalOpen, setWalkInModalOpen] = useState(false);
  const [selectedSlotForDetail, setSelectedSlotForDetail] = useState<DoctorSlot | null>(null);

  // Table Filters & Search
  const [tableSearch, setTableSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "AVAILABLE" | "BOOKED" | "CANCELLED">("ALL");
  const [roomFilter, setRoomFilter] = useState<string>("ALL");

  // Rooms
  const { data: rawRooms } = useQuery({
    queryKey: qk.clinicSelf.rooms(),
    queryFn: clinicSelfApi.getRooms,
  });

  const rooms: ClinicRoom[] = ensureArray<ClinicRoom>(rawRooms);

  // Doctor Selector Card options
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
        name: `${t("doctors.doctorPrefix", { defaultValue: "Dr." })} ${name}`,
        specialty: spec,
        photoUrl: d?.avatarUrl || d?.photoUrl,
        email: d?.email,
        phone: d?.phone,
        yearsOfExp: d?.yearsOfExp,
        status: doc.status,
        raw: doc,
      };
    }), [acceptedDoctors, t]);

  // Effective active doctor ID
  const activeDoctorId = selectedDoctorId || acceptedDoctors[0]?.doctorId || "";
  const selectedDoctorCard = doctorCardItems.find((d) => d.doctorId === activeDoctorId);
  const activeDoctorColor = getDoctorColor(activeDoctorId);

  // 1. Slots query for selected doctor & selected date
  const { data: rawSlots, isLoading: isSlotsLoading, refetch: refetchSlots } = useQuery({
    queryKey: qk.clinicSelf.doctorSlots(activeDoctorId, { date: selectedDate }),
    queryFn: () =>
      activeDoctorId
        ? clinicAppointmentsApi.getDoctorSlots(activeDoctorId, { date: selectedDate })
        : Promise.resolve([]),
    enabled: !!activeDoctorId,
  });

  const slots: DoctorSlot[] = ensureArray<DoctorSlot>(rawSlots);

  // 2. Doctor Availability Template Query (Read-only)
  const { data: rawAvailability, isLoading: isAvailabilityLoading } = useQuery({
    queryKey: qk.doctors.availability(activeDoctorId),
    queryFn: () => (activeDoctorId ? doctorsApi.getAvailability(activeDoctorId) : Promise.resolve([])),
    enabled: activeTab === "template" && !!activeDoctorId,
  });

  // 3. Appointments query for context/booked details
  const { data: rawAppointments } = useQuery({
    queryKey: qk.clinicSelf.appointments({ date: selectedDate, doctorId: activeDoctorId, limit: 100 }),
    queryFn: () =>
      clinicAppointmentsApi.listAppointments({
        date: selectedDate,
        doctorId: activeDoctorId || undefined,
        limit: 100,
      }),
    enabled: !!activeDoctorId,
  });

  const appointments: ClinicAppointmentRow[] = ensureArray<ClinicAppointmentRow>(rawAppointments?.data);

  // Map appointment details by slotId
  const appointmentBySlotId = useMemo(() => {
    const map = new Map<string, ClinicAppointmentRow>();
    appointments.forEach((a) => {
      if (a.slotId) map.set(a.slotId, a);
    });
    return map;
  }, [appointments]);

  // Forms
  const generateForm = useForm<GenerateFormData>({
    resolver: zodResolver(generateSchema),
    defaultValues: {
      startDate: selectedDate,
      endDate: format(addDays(new Date(selectedDate), 6), "yyyy-MM-dd"),
      roomId: "",
      force: false,
    },
  });

  const quickSlotForm = useForm<QuickSlotFormData>({
    resolver: zodResolver(quickSlotSchema),
    defaultValues: {
      date: selectedDate,
      startTime: "09:00",
      endTime: "09:30",
      roomId: "",
      maxPatients: 1,
    },
  });

  const cancelDateForm = useForm<CancelDateFormData>({
    resolver: zodResolver(cancelDateSchema),
    defaultValues: {
      date: selectedDate,
      reason: "",
    },
  });

  // Mutations
  const generateSlotsMutation = useEntityMutation({
    mutationFn: (data: GenerateFormData) => {
      const payload = {
        startDate: data.startDate,
        endDate: data.endDate,
        roomId: data.roomId && data.roomId.trim() ? data.roomId.trim() : undefined,
        force: data.force,
      };
      return clinicAppointmentsApi.generateDoctorSlots(activeDoctorId, payload);
    },
    invalidate: [qk.clinicSelf.all()],
    successMessage: t("schedule.batchSuccess", { defaultValue: "Slots successfully generated!" }),
    onSuccess: () => {
      setGenerateModalOpen(false);
      generateForm.reset();
      queryClient.invalidateQueries({ queryKey: qk.clinicSelf.all() });
    },
  });

  const quickSlotMutation = useEntityMutation({
    mutationFn: (data: QuickSlotFormData) => {
      const payload = {
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime,
        roomId: data.roomId && data.roomId.trim() ? data.roomId.trim() : undefined,
        maxPatients: data.maxPatients,
      };
      return clinicAppointmentsApi.addQuickDoctorSlot(activeDoctorId, payload);
    },
    invalidate: [qk.clinicSelf.all()],
    successMessage: t("schedule.quickSuccess", { defaultValue: "Quick slot added successfully!" }),
    onSuccess: () => {
      setQuickSlotModalOpen(false);
      quickSlotForm.reset({
        date: selectedDate,
        startTime: "09:00",
        endTime: "09:30",
        maxPatients: 1,
      });
      queryClient.invalidateQueries({ queryKey: qk.clinicSelf.all() });
    },
  });

  const cancelDateMutation = useEntityMutation({
    mutationFn: (data: CancelDateFormData) => {
      const payload = {
        date: data.date,
        reason: data.reason && data.reason.trim() ? data.reason.trim() : undefined,
      };
      return clinicAppointmentsApi.cancelDoctorSlotsDate(activeDoctorId, payload);
    },
    invalidate: [qk.clinicSelf.all()],
    successMessage: t("schedule.cancelSuccess", { defaultValue: "Date slots cancelled successfully!" }),
    onSuccess: () => {
      setCancelModalOpen(false);
      cancelDateForm.reset();
      queryClient.invalidateQueries({ queryKey: qk.clinicSelf.all() });
    },
  });

  // Stats calculation
  const stats = useMemo(() => {
    const total = slots.length;
    const available = slots.filter((s) => String(s.status || "").toLowerCase() === "available").length;
    const booked = slots.filter((s) => {
      const st = String(s.status || "").toLowerCase();
      return st === "booked" || st === "full" || s.isBooked;
    }).length;
    const cancelled = slots.filter((s) => {
      const st = String(s.status || "").toLowerCase();
      return st === "cancelled" || s.isCancelled;
    }).length;
    const occupancyRate = total > 0 ? Math.round((booked / total) * 100) : 0;
    return { total, available, booked, cancelled, occupancyRate };
  }, [slots]);

  // Week Days strip for quick day selection
  const weekDays = useMemo(() => {
    const base = selectedDate ? new Date(selectedDate) : new Date();
    const start = startOfWeek(base, { weekStartsOn: 0 }); // Sunday
    return Array.from({ length: 7 }).map((_, i) => {
      const d = addDays(start, i);
      const dStr = format(d, "yyyy-MM-dd");
      return {
        dateStr: dStr,
        dayName: format(d, "EEE"),
        dayNum: format(d, "d"),
        isToday: format(new Date(), "yyyy-MM-dd") === dStr,
        isSelected: selectedDate === dStr,
      };
    });
  }, [selectedDate]);

  // Quick Date presets
  const handlePreset = (preset: "today" | "tomorrow" | "thisWeek" | "nextWeek") => {
    const today = new Date();
    if (preset === "today") {
      setSelectedDate(format(today, "yyyy-MM-dd"));
    } else if (preset === "tomorrow") {
      setSelectedDate(format(addDays(today, 1), "yyyy-MM-dd"));
    } else if (preset === "thisWeek") {
      setSelectedDate(format(today, "yyyy-MM-dd"));
    } else if (preset === "nextWeek") {
      setSelectedDate(format(addDays(today, 7), "yyyy-MM-dd"));
    }
  };

  // Filtered slots for table view
  const filteredTableSlots = useMemo(() => {
    return slots.filter((s) => {
      const status = String(s.status || "AVAILABLE").toUpperCase();
      if (statusFilter !== "ALL") {
        if (statusFilter === "AVAILABLE" && status !== "AVAILABLE") return false;
        if (statusFilter === "BOOKED" && status !== "BOOKED" && status !== "FULL" && !s.isBooked) return false;
        if (statusFilter === "CANCELLED" && status !== "CANCELLED" && !s.isCancelled) return false;
      }
      if (roomFilter !== "ALL") {
        if (s.roomId !== roomFilter) return false;
      }
      if (tableSearch.trim()) {
        const query = tableSearch.toLowerCase();
        const timeStr = `${s.startTime}-${s.endTime}`.toLowerCase();
        const roomName = (s.room?.name || "").toLowerCase();
        const app = appointmentBySlotId.get(s.id);
        const patientName = `${app?.patient?.name || app?.guestPatient?.firstName || ""}`.toLowerCase();
        if (!timeStr.includes(query) && !roomName.includes(query) && !patientName.includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [slots, statusFilter, roomFilter, tableSearch, appointmentBySlotId]);

  // Quick slot preset helper
  const applyDurationPreset = (minutes: number) => {
    const start = quickSlotForm.getValues("startTime") || "09:00";
    const [h, m] = start.split(":").map(Number);
    const totalM = (h || 0) * 60 + (m || 0) + minutes;
    const endH = String(Math.floor(totalM / 60) % 24).padStart(2, "0");
    const endM = String(totalM % 60).padStart(2, "0");
    quickSlotForm.setValue("endTime", `${endH}:${endM}`);
  };

  // Pre-generate conflict check in batch modal
  const selectedGenRoomId = generateForm.watch("roomId");
  const selectedGenRoom = rooms.find((r) => r.id === selectedGenRoomId);

  return (
    <div className="space-y-6">
      {/* 1. Master Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-foreground">
              {t("schedule.title", { defaultValue: "Doctor Schedules & Slots" })}
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-500/10 px-2.5 py-0.5 text-xs font-bold text-primary-500">
              <Sparkles className="h-3 w-3" />
              {stats.occupancyRate}% {t("schedule.occupancyRate", { defaultValue: "Occupancy" })}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {t("schedule.subtitle", {
              defaultValue: "Configure bookable time slots, weekly hours, and consultation availability",
            })}
          </p>
        </div>

        {/* Top Control Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              quickSlotForm.setValue("date", selectedDate);
              setQuickSlotModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary-500 px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-md hover:bg-primary-600 transition cursor-pointer"
          >
            <Zap className="h-3.5 w-3.5" />
            {t("schedule.quickSlotButton", { defaultValue: "Quick Slot" })}
          </button>

          <button
            type="button"
            onClick={() => {
              generateForm.setValue("startDate", selectedDate);
              generateForm.setValue("endDate", format(addDays(new Date(selectedDate), 6), "yyyy-MM-dd"));
              setGenerateModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl glass border border-border/60 px-4 py-2.5 text-xs font-bold text-foreground hover:bg-accent transition cursor-pointer"
          >
            <CalendarRange className="h-3.5 w-3.5 text-primary-500" />
            {t("schedule.batchGenerateButton", { defaultValue: "Batch Generate Slots" })}
          </button>

          <button
            type="button"
            onClick={() => {
              cancelDateForm.setValue("date", selectedDate);
              setCancelModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl glass border border-rose-500/30 px-3.5 py-2.5 text-xs font-bold text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
            title={t("schedule.cancelSlot", { defaultValue: "Cancel Day Slots" })}
          >
            <Ban className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t("schedule.cancelSlot", { defaultValue: "Cancel Day" })}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              refetchSlots();
              toast.success("Schedule refreshed");
            }}
            className="inline-flex items-center gap-1 rounded-xl glass border border-border/40 p-2.5 text-xs font-bold text-muted-foreground hover:text-foreground transition cursor-pointer"
            title="Refresh Schedule"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Practitioner Hero Card (Shown on single-doctor tabs: template, generate, myslots) */}
      {activeTab !== "board" && (
        <GlassCard className="p-4 sm:p-5 border border-border/40 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Active Doctor Details */}
            <div className="flex items-center gap-3.5">
              <div
                className="relative h-14 w-14 shrink-0 rounded-2xl overflow-hidden border-2 bg-muted/40 shadow-sm"
                style={{ borderColor: activeDoctorColor.hex }}
              >
                <RemoteImage
                  src={selectedDoctorCard?.photoUrl}
                  alt={selectedDoctorCard?.name || "Doctor"}
                  className="h-full w-full object-cover"
                  fallbackIcon={<Stethoscope className="h-7 w-7 text-primary-500 m-auto" />}
                />
                <span className="absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-background" />
              </div>

              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-black text-foreground">
                    {selectedDoctorCard?.name || t("doctors.selectorTitle", { defaultValue: "Select Practitioner Doctor" })}
                  </h2>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-extrabold"
                    style={{ backgroundColor: `${activeDoctorColor.hex}20`, color: activeDoctorColor.hex }}
                  >
                    {selectedDoctorCard?.specialty || "Specialist"}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  {selectedDoctorCard?.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3 text-muted-foreground/70" />
                      {selectedDoctorCard.phone}
                    </span>
                  )}
                  {selectedDoctorCard?.yearsOfExp && (
                    <span className="font-semibold">
                      {selectedDoctorCard.yearsOfExp} {t("doctors.yearsExp", { defaultValue: "yrs exp" })}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Switch Doctor */}
            <div className="flex items-center gap-2 self-start md:self-auto">
              <DoctorLegendBar
                doctors={doctorCardItems}
                activeDoctorId={activeDoctorId}
                onSelect={(id) => setSelectedDoctorId(id)}
              />

              <button
                type="button"
                onClick={() => setDoctorSelectorOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl glass border border-primary-500/30 bg-primary-500/5 px-3 py-1.5 text-xs font-bold text-primary-500 hover:bg-primary-500/10 transition cursor-pointer shrink-0"
              >
                <Stethoscope className="h-3.5 w-3.5" />
                <span>{t("doctors.selectorTitle", { defaultValue: "All Doctors" })}</span>
              </button>
            </div>
          </div>
        </GlassCard>
      )}

      {/* 3. Master 4-Tab Navigation Bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border/40 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("board")}
          className={cn(
            "inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition cursor-pointer",
            activeTab === "board"
              ? "bg-primary-500 text-white shadow-md shadow-primary-500/25"
              : "glass border border-border/40 text-muted-foreground hover:text-foreground hover:bg-accent/40"
          )}
        >
          <Grid className="h-4 w-4" />
          <span>{t("schedule.tabs.board", { defaultValue: "All Doctors Board" })}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("template")}
          className={cn(
            "inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition cursor-pointer",
            activeTab === "template"
              ? "bg-primary-500 text-white shadow-md shadow-primary-500/25"
              : "glass border border-border/40 text-muted-foreground hover:text-foreground hover:bg-accent/40"
          )}
        >
          <Clock className="h-4 w-4" />
          <span>{t("schedule.tabs.template", { defaultValue: "Weekly Template" })}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("generate")}
          className={cn(
            "inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition cursor-pointer",
            activeTab === "generate"
              ? "bg-primary-500 text-white shadow-md shadow-primary-500/25"
              : "glass border border-border/40 text-muted-foreground hover:text-foreground hover:bg-accent/40"
          )}
        >
          <Zap className="h-4 w-4" />
          <span>{t("schedule.tabs.generate", { defaultValue: "Generate Slots" })}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("myslots")}
          className={cn(
            "inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition cursor-pointer",
            activeTab === "myslots"
              ? "bg-primary-500 text-white shadow-md shadow-primary-500/25"
              : "glass border border-border/40 text-muted-foreground hover:text-foreground hover:bg-accent/40"
          )}
        >
          <CalendarDays className="h-4 w-4" />
          <span>{t("schedule.tabs.mySlots", { defaultValue: "My Slots" })}</span>
        </button>
      </div>

      {/* 4. Tab 1: All Doctors Board */}
      {activeTab === "board" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-black text-foreground">
                {t("schedule.board.title", { defaultValue: "Clinic Doctor Roster Board" })}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("schedule.board.subtitle", {
                  defaultValue: "Overview of every practitioner's schedule with real-time room conflict detection",
                })}
              </p>
            </div>
            <ModernDatePickerModal
              mode="single"
              value={selectedDate}
              onSelect={(d) => setSelectedDate(d)}
            />
          </div>

          <MultiDoctorBoard
            doctors={doctorCardItems}
            selectedDate={selectedDate}
            onSelectDoctor={(id) => {
              setSelectedDoctorId(id);
              setActiveTab("myslots");
            }}
          />
        </div>
      )}

      {/* 5. Tab 2: Weekly Template (Read-Only) */}
      {activeTab === "template" && (
        <div className="space-y-4">
          <DoctorTemplateViewer
            doctorId={activeDoctorId}
            doctorName={selectedDoctorCard?.name || "Doctor"}
            availability={rawAvailability}
            isLoading={isAvailabilityLoading}
          />
        </div>
      )}

      {/* 6. Tab 3: Generate Slots & Workspace */}
      {activeTab === "generate" && (
        <div className="space-y-6">
          {/* Date Navigation Strip */}
          <GlassCard className="p-4 border border-border/40 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => handlePreset("today")}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer",
                  selectedDate === format(new Date(), "yyyy-MM-dd")
                    ? "bg-primary-500 text-white shadow-xs"
                    : "glass border border-border/40 text-muted-foreground hover:text-foreground"
                )}
              >
                {t("schedule.inspector.presetToday", { defaultValue: "Today" })}
              </button>

              <button
                type="button"
                onClick={() => handlePreset("tomorrow")}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer",
                  selectedDate === format(addDays(new Date(), 1), "yyyy-MM-dd")
                    ? "bg-primary-500 text-white shadow-xs"
                    : "glass border border-border/40 text-muted-foreground hover:text-foreground"
                )}
              >
                {t("schedule.inspector.presetTomorrow", { defaultValue: "Tomorrow" })}
              </button>

              <div className="flex items-center gap-1 bg-accent/30 rounded-xl p-0.5 border border-border/30">
                <button
                  type="button"
                  onClick={() => setSelectedDate((prev) => format(subDays(new Date(prev), 1), "yyyy-MM-dd"))}
                  className="p-1 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition cursor-pointer"
                  title="Previous Day"
                >
                  <ChevronLeft className="h-3.5 w-3.5 rtl:rotate-180" />
                </button>

                <ModernDatePickerModal
                  mode="single"
                  value={selectedDate}
                  onSelect={(d) => setSelectedDate(d)}
                />

                <button
                  type="button"
                  onClick={() => setSelectedDate((prev) => format(addDays(new Date(prev), 1), "yyyy-MM-dd"))}
                  className="p-1 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition cursor-pointer"
                  title="Next Day"
                >
                  <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
                </button>
              </div>
            </div>

            {/* 7-Day Quick Strip */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
              {weekDays.map((d) => (
                <button
                  key={d.dateStr}
                  type="button"
                  onClick={() => setSelectedDate(d.dateStr)}
                  className={cn(
                    "flex flex-col items-center justify-center min-w-[48px] py-1.5 px-2 rounded-xl text-xs font-bold transition cursor-pointer border",
                    d.isSelected
                      ? "bg-primary-500 text-white border-primary-400 shadow-sm"
                      : "border-border/30 bg-muted/20 text-muted-foreground hover:border-primary-500/40 hover:text-foreground"
                  )}
                >
                  <span className="text-[10px] uppercase tracking-wider opacity-80">{d.dayName}</span>
                  <span className="text-sm font-black">{d.dayNum}</span>
                </button>
              ))}
            </div>
          </GlassCard>

          {/* Real-Time KPI Matrix */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <GlassCard className="p-4 border border-border/40 space-y-1">
              <div className="flex items-center justify-between text-muted-foreground text-xs font-bold">
                <span>{t("schedule.totalSlots", { defaultValue: "Total Slots" })}</span>
                <CalendarDays className="h-4 w-4 text-primary-500" />
              </div>
              <div className="text-2xl font-black text-foreground">{stats.total}</div>
              <p className="text-[11px] text-muted-foreground">{selectedDate}</p>
            </GlassCard>

            <GlassCard className="p-4 border border-emerald-500/20 bg-emerald-500/5 space-y-1">
              <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                <span>{t("schedule.availableSlots", { defaultValue: "Available Slots" })}</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{stats.available}</div>
              <p className="text-[11px] text-emerald-600/70 dark:text-emerald-400/70">
                {stats.total > 0 ? `${Math.round((stats.available / stats.total) * 100)}% available` : "0%"}
              </p>
            </GlassCard>

            <GlassCard className="p-4 border border-amber-500/20 bg-amber-500/5 space-y-1">
              <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 text-xs font-bold">
                <span>{t("schedule.bookedSlots", { defaultValue: "Booked Appointments" })}</span>
                <Users className="h-4 w-4 text-amber-500" />
              </div>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400">{stats.booked}</div>
              <p className="text-[11px] text-amber-600/70 dark:text-amber-400/70">
                {stats.total > 0 ? `${stats.occupancyRate}% utilization` : "0%"}
              </p>
            </GlassCard>

            <GlassCard className="p-4 border border-rose-500/20 bg-rose-500/5 space-y-1">
              <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 text-xs font-bold">
                <span>{t("schedule.cancelledSlots", { defaultValue: "Cancelled Slots" })}</span>
                <Ban className="h-4 w-4 text-rose-500" />
              </div>
              <div className="text-2xl font-black text-rose-600 dark:text-rose-400">{stats.cancelled}</div>
              <p className="text-[11px] text-rose-600/70 dark:text-rose-400/70">
                {stats.cancelled > 0 ? "Unavailable for booking" : "No cancelled slots"}
              </p>
            </GlassCard>
          </div>

          {/* View Mode Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-1.5 p-1 rounded-2xl glass border border-border/40 bg-accent/20">
              <button
                type="button"
                onClick={() => setActiveView("timeline")}
                className={cn(
                  "inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer",
                  activeView === "timeline" ? "bg-primary-500 text-white shadow-xs" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Clock className="h-3.5 w-3.5" />
                <span>{t("schedule.views.timeline", { defaultValue: "Day Timeline" })}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveView("weeklyMatrix")}
                className={cn(
                  "inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer",
                  activeView === "weeklyMatrix" ? "bg-primary-500 text-white shadow-xs" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>{t("schedule.views.weeklyMatrix", { defaultValue: "Weekly Grid" })}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveView("slotsTable")}
                className={cn(
                  "inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer",
                  activeView === "slotsTable" ? "bg-primary-500 text-white shadow-xs" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <TableIcon className="h-3.5 w-3.5" />
                <span>{t("schedule.views.slotsTable", { defaultValue: "Slots Roster" })}</span>
              </button>
            </div>
          </div>

          {/* Active View Rendering */}
          {isSlotsLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full rounded-3xl" />
              <Skeleton className="h-80 w-full rounded-3xl" />
            </div>
          ) : activeView === "timeline" ? (
            <div className="space-y-6">
              <GlassCard className="p-5 border border-border/40">
                <ScheduleVisualizer
                  slots={slots}
                  selectedDate={selectedDate}
                  doctorName={selectedDoctorCard?.name}
                  onSelectSlot={(slot) => setSelectedSlotForDetail(slot)}
                />
              </GlassCard>

              <GlassCard className="p-5 border border-border/40 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-foreground">
                      {t("schedule.timeline.title", { defaultValue: "Consultation Slots by Time Period" })}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t("schedule.timeline.subtitle", { defaultValue: "Hourly progression of consultation slots for" })}{" "}
                      <span className="font-semibold text-foreground">{selectedDate}</span>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      quickSlotForm.setValue("date", selectedDate);
                      setQuickSlotModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl glass border border-primary-500/30 px-3 py-1.5 text-xs font-bold text-primary-500 hover:bg-primary-500/10 transition cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t("schedule.quickSlotButton", { defaultValue: "Add Slot" })}
                  </button>
                </div>

                <SlotGridInspector
                  slots={slots}
                  isLoading={isSlotsLoading}
                  onSelectSlot={(slot) => setSelectedSlotForDetail(slot)}
                  onBookSlot={() => setWalkInModalOpen(true)}
                />
              </GlassCard>
            </div>
          ) : activeView === "weeklyMatrix" ? (
            <div className="space-y-4">
              <DoctorScheduleHeatmap
                slots={slots}
                selectedDate={selectedDate}
                onDateSelect={(d) => setSelectedDate(d)}
                isGenerating={generateSlotsMutation.isPending}
                onQuickAddSlot={({ date, hour }) => {
                  const pad = (n: number) => String(n).padStart(2, "0");
                  quickSlotForm.setValue("date", date);
                  quickSlotForm.setValue("startTime", `${pad(hour)}:00`);
                  quickSlotForm.setValue("endTime", `${pad(hour)}:30`);
                  setQuickSlotModalOpen(true);
                }}
                onGenerateSlots={({ date, startHour, endHour }) => {
                  const pad = (n: number) => String(n).padStart(2, "0");
                  if (activeDoctorId) {
                    clinicAppointmentsApi.addQuickDoctorSlot(activeDoctorId, {
                      date,
                      startTime: `${pad(startHour)}:00`,
                      endTime: `${pad(endHour)}:00`,
                      maxPatients: 1,
                    }).then(() => {
                      queryClient.invalidateQueries({ queryKey: qk.clinicSelf.all() });
                      toast.success(t("schedule.quickSuccess", { defaultValue: "Quick slot added successfully!" }));
                    }).catch((err) => {
                      const msg = err?.response?.data?.message || err?.message || "Failed to add slot";
                      toast.error(typeof msg === "string" ? msg : JSON.stringify(msg));
                    });
                  } else {
                    generateSlotsMutation.mutate({
                      startDate: date,
                      endDate: date,
                    });
                  }
                }}
              />
            </div>
          ) : (
            /* Slots Management Table View */
            <GlassCard className="p-5 border border-border/40 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-border/30">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    placeholder={t("schedule.table.searchPlaceholder", { defaultValue: "Search by time, patient or room..." })}
                    className="glass w-full rounded-xl pl-9 rtl:pl-3 rtl:pr-9 pr-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary-500/40"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 bg-accent/20 rounded-xl p-1 border border-border/30">
                    {(["ALL", "AVAILABLE", "BOOKED", "CANCELLED"] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setStatusFilter(st)}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer",
                          statusFilter === st ? "bg-primary-500 text-white shadow-xs" : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {t(`schedule.filters.${st.toLowerCase()}`, { defaultValue: st })}
                      </button>
                    ))}
                  </div>

                  <select
                    value={roomFilter}
                    onChange={(e) => setRoomFilter(e.target.value)}
                    className="glass rounded-xl px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-primary-500/40 bg-background text-foreground"
                  >
                    <option value="ALL">{t("schedule.table.allRooms", { defaultValue: "All Rooms" })}</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {filteredTableSlots.length === 0 ? (
                <EmptyState
                  title={t("schedule.table.empty", { defaultValue: "No slots match the selected criteria" })}
                  description={t("schedule.inspector.emptyDescription", {
                    defaultValue: "Pick another range or generate slots for these dates.",
                  })}
                />
              ) : (
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-xs text-start">
                    <thead>
                      <tr className="border-b border-border/30 text-muted-foreground font-extrabold uppercase text-[10px] tracking-wider">
                        <th className="py-3 px-3 text-start">{t("schedule.table.timeColumn", { defaultValue: "Time Slot" })}</th>
                        <th className="py-3 px-3 text-start">{t("schedule.table.dateColumn", { defaultValue: "Date" })}</th>
                        <th className="py-3 px-3 text-start">{t("schedule.table.roomColumn", { defaultValue: "Room" })}</th>
                        <th className="py-3 px-3 text-start">{t("schedule.table.statusColumn", { defaultValue: "Status" })}</th>
                        <th className="py-3 px-3 text-start">{t("schedule.table.patientColumn", { defaultValue: "Booked Patient" })}</th>
                        <th className="py-3 px-3 text-start">{t("schedule.table.capacityColumn", { defaultValue: "Capacity" })}</th>
                        <th className="py-3 px-3 text-end">{t("schedule.table.actionsColumn", { defaultValue: "Actions" })}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20 font-medium">
                      {filteredTableSlots.map((slot) => {
                        const app = appointmentBySlotId.get(slot.id);
                        const patientName = app?.patient?.name || (app?.guestPatient ? `${app.guestPatient.firstName} ${app.guestPatient.lastName}` : null);
                        const isAvailable = String(slot.status || "").toLowerCase() === "available";

                        return (
                          <tr
                            key={slot.id}
                            onClick={() => setSelectedSlotForDetail(slot)}
                            className="hover:bg-accent/30 transition cursor-pointer group"
                          >
                            <td className="py-3 px-3 font-mono font-bold text-foreground">
                              <span className="flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5 text-primary-500" />
                                {slot.startTime?.slice(0, 5)} – {slot.endTime?.slice(0, 5)}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-muted-foreground font-mono">
                              {slot.date?.slice(0, 10)}
                            </td>
                            <td className="py-3 px-3">
                              {slot.room?.name ? (
                                <span className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-0.5 text-[11px] font-bold text-foreground">
                                  <DoorOpen className="h-3 w-3 text-primary-500" />
                                  {slot.room.name}
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-[11px] italic">
                                  {t("schedule.timeline.unassignedRoom", { defaultValue: "General Room" })}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              <StatusBadge value={slot.status || "AVAILABLE"} />
                            </td>
                            <td className="py-3 px-3">
                              {patientName ? (
                                <div className="flex items-center gap-1.5">
                                  <User className="h-3.5 w-3.5 text-primary-500" />
                                  <span className="font-bold text-foreground">{patientName}</span>
                                  {app?.patientType === "GUEST" && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-warning/15 text-warning font-bold">
                                      Guest
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground/60 text-[11px]">—</span>
                              )}
                            </td>
                            <td className="py-3 px-3 font-mono text-[11px]">
                              {slot.currentPatients ?? 0} / {slot.maxPatients ?? 1}
                            </td>
                            <td className="py-3 px-3 text-end" onClick={(e) => e.stopPropagation()}>
                              {isAvailable ? (
                                <button
                                  type="button"
                                  onClick={() => setWalkInModalOpen(true)}
                                  className="inline-flex items-center gap-1 rounded-xl bg-primary-500 px-2.5 py-1 text-[11px] font-bold text-primary-foreground hover:opacity-90 transition cursor-pointer"
                                >
                                  <CalendarPlus className="h-3 w-3" />
                                  {t("schedule.timeline.bookPatient", { defaultValue: "Book" })}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setSelectedSlotForDetail(slot)}
                                  className="inline-flex items-center gap-1 rounded-xl glass border border-border/40 px-2.5 py-1 text-[11px] font-bold text-muted-foreground hover:text-foreground transition cursor-pointer"
                                >
                                  {t("schedule.timeline.viewBooking", { defaultValue: "Inspect" })}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </GlassCard>
          )}
        </div>
      )}

      {/* 7. Tab 4: My Slots Overview */}
      {activeTab === "myslots" && (
        <div className="space-y-4">
          <OptimalSlotsTab
            doctorId={activeDoctorId}
            onGoToGenerate={() => setActiveTab("generate")}
            onCancelDate={(date) => cancelDateMutation.mutate({ date })}
          />
        </div>
      )}

      {/* 8. Doctor Selector Modal */}
      <DoctorSelectorModal
        open={doctorSelectorOpen}
        onClose={() => setDoctorSelectorOpen(false)}
        onSelect={(docId) => {
          setSelectedDoctorId(docId);
          setDoctorSelectorOpen(false);
        }}
        doctors={doctorCardItems}
        selectedDoctorId={activeDoctorId}
      />

      {/* 9. Quick Slot Modal */}
      <FormModal
        id="quick-slot-modal"
        open={quickSlotModalOpen}
        onClose={() => setQuickSlotModalOpen(false)}
        title={t("schedule.quickSlotButton", { defaultValue: "Add Quick Slot" })}
        description={t("schedule.quickSlotDesc", { defaultValue: "Add an individual customized consultation slot for this practitioner." })}
      >
        <form onSubmit={quickSlotForm.handleSubmit((d) => quickSlotMutation.mutate(d))} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground">{t("filters.date", { defaultValue: "Date" })}*</label>
            <input
              type="date"
              {...quickSlotForm.register("date")}
              className="glass w-full rounded-xl px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500/40 font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">{t("schedule.startTime", { defaultValue: "Start Time" })}*</label>
              <input
                type="time"
                {...quickSlotForm.register("startTime")}
                className="glass w-full rounded-xl px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500/40 font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">{t("schedule.endTime", { defaultValue: "End Time" })}*</label>
              <input
                type="time"
                {...quickSlotForm.register("endTime")}
                className="glass w-full rounded-xl px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500/40 font-mono"
              />
            </div>
          </div>

          {/* Duration Presets */}
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-muted-foreground">Duration Presets:</span>
            <div className="flex flex-wrap gap-1.5">
              {[15, 20, 30, 45, 60].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => applyDurationPreset(mins)}
                  className="rounded-lg bg-accent/40 hover:bg-accent px-2.5 py-1 text-[11px] font-bold text-foreground transition cursor-pointer"
                >
                  +{mins}m
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">
                {t("rooms.title", { defaultValue: "Consultation Room" })}
              </label>
              <select
                {...quickSlotForm.register("roomId")}
                className="glass w-full rounded-xl px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500/40 bg-background text-foreground"
              >
                <option value="">{t("rooms.generalPurpose", { defaultValue: "General Purpose" })}</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">
                {t("schedule.timeline.slotCapacity", { defaultValue: "Max Patients" })}*
              </label>
              <input
                type="number"
                min={1}
                max={20}
                {...quickSlotForm.register("maxPatients")}
                className="glass w-full rounded-xl px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500/40 font-mono"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-border/40 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setQuickSlotModalOpen(false)}
              className="rounded-xl px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-accent cursor-pointer"
            >
              {t("common.cancel", { defaultValue: "Cancel" })}
            </button>
            <button
              type="submit"
              disabled={quickSlotMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50 cursor-pointer shadow-md"
            >
              {quickSlotMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {t("common.create", { defaultValue: "Create Slot" })}
            </button>
          </div>
        </form>
      </FormModal>

      {/* 10. Batch Generate Slots Modal */}
      <FormModal
        id="batch-generate-modal"
        open={generateModalOpen}
        onClose={() => setGenerateModalOpen(false)}
        title={t("schedule.batchModalTitle", { defaultValue: "Batch Generate Doctor Slots" })}
        description={t("schedule.batchDesc", {
          defaultValue: "Generate recurring consultation slots automatically based on practitioner working hours and room availability.",
        })}
      >
        <form onSubmit={generateForm.handleSubmit((d) => generateSlotsMutation.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">{t("schedule.startDate", { defaultValue: "Start Date" })}*</label>
              <input
                type="date"
                {...generateForm.register("startDate")}
                className="glass w-full rounded-xl px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500/40 font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">{t("schedule.endDate", { defaultValue: "End Date" })}*</label>
              <input
                type="date"
                {...generateForm.register("endDate")}
                className="glass w-full rounded-xl px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500/40 font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground">
              {t("rooms.title", { defaultValue: "Consultation Room" })} ({t("common.optional", { defaultValue: "Optional" })})
            </label>
            <select
              {...generateForm.register("roomId")}
              className="glass w-full rounded-xl px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500/40 bg-background text-foreground"
            >
              <option value="">{t("rooms.generalPurpose", { defaultValue: "General Purpose / All Specialties" })}</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          {selectedGenRoom && (
            <div className="p-3 rounded-xl bg-accent/20 border border-border/40 text-xs flex items-center gap-2">
              <DoorOpen className="h-4 w-4 text-primary-500" />
              <span>
                Assigning to: <strong className="text-foreground">{selectedGenRoom.name}</strong>
              </span>
            </div>
          )}

          <label className="flex items-center gap-2.5 cursor-pointer p-2.5 rounded-xl bg-accent/20 border border-border/30">
            <input
              type="checkbox"
              {...generateForm.register("force")}
              className="rounded text-primary-500 focus:ring-primary-500 h-4 w-4"
            />
            <div className="text-xs">
              <span className="font-bold text-foreground block">{t("schedule.overwriteSlots", { defaultValue: "Overwrite Unbooked Slots" })}</span>
              <span className="text-muted-foreground text-[10px]">Safely regenerates slots while preserving already booked appointments.</span>
            </div>
          </label>

          <div className="pt-4 border-t border-border/40 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setGenerateModalOpen(false)}
              className="rounded-xl px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-accent cursor-pointer"
            >
              {t("common.cancel", { defaultValue: "Cancel" })}
            </button>
            <button
              type="submit"
              disabled={generateSlotsMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50 cursor-pointer shadow-md"
            >
              {generateSlotsMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {t("schedule.batchGenerateButton", { defaultValue: "Batch Generate Slots" })}
            </button>
          </div>
        </form>
      </FormModal>

      {/* 11. Cancel Slots Date Modal */}
      <FormModal
        id="cancel-date-modal"
        open={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        title={t("schedule.cancelSlotsTitle", { defaultValue: "Cancel All Slots for Date" })}
        description={t("schedule.cancelSlotsDesc", {
          defaultValue: "Cancel all unbooked consultation slots for the selected doctor on this date.",
        })}
      >
        <form onSubmit={cancelDateForm.handleSubmit((d) => cancelDateMutation.mutate(d))} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground">{t("filters.date", { defaultValue: "Date" })}*</label>
            <input
              type="date"
              {...cancelDateForm.register("date")}
              className="glass w-full rounded-xl px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500/40 font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground">{t("schedule.cancelReason", { defaultValue: "Cancellation Reason" })}</label>
            <input
              type="text"
              {...cancelDateForm.register("reason")}
              placeholder={t("schedule.reasonPlaceholder", { defaultValue: "e.g. Doctor urgent leave / Room maintenance" })}
              className="glass w-full rounded-xl px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
            />
          </div>

          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>Unbooked slots for this date will be marked cancelled. Existing confirmed appointments must be managed separately.</span>
          </div>

          <div className="pt-4 border-t border-border/40 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCancelModalOpen(false)}
              className="rounded-xl px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-accent cursor-pointer"
            >
              {t("common.cancel", { defaultValue: "Cancel" })}
            </button>
            <button
              type="submit"
              disabled={cancelDateMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-500 px-4 py-2 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50 cursor-pointer shadow-md"
            >
              {cancelDateMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {t("schedule.cancelSlot", { defaultValue: "Confirm Date Cancellation" })}
            </button>
          </div>
        </form>
      </FormModal>

      {/* 12. Slot Detail Inspector Modal */}
      {selectedSlotForDetail && (
        <FormModal
          id="slot-detail-modal"
          open={!!selectedSlotForDetail}
          onClose={() => setSelectedSlotForDetail(null)}
          title={`${t("schedule.timeline.title", { defaultValue: "Consultation Slot" })}: ${selectedSlotForDetail.startTime?.slice(0, 5)}–${selectedSlotForDetail.endTime?.slice(0, 5)}`}
          description={`${selectedSlotForDetail.date?.slice(0, 10)} · ${selectedDoctorCard?.name || "Doctor"}`}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-accent/20 border border-border/40 text-xs">
              <div>
                <span className="text-muted-foreground text-[11px] font-bold block">{t("schedule.table.statusColumn", { defaultValue: "Status" })}:</span>
                <StatusBadge value={selectedSlotForDetail.status || "AVAILABLE"} />
              </div>
              <div>
                <span className="text-muted-foreground text-[11px] font-bold block">{t("schedule.table.roomColumn", { defaultValue: "Room" })}:</span>
                <span className="font-bold text-foreground">
                  {selectedSlotForDetail.room?.name || t("schedule.timeline.unassignedRoom", { defaultValue: "General Purpose" })}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground text-[11px] font-bold block">{t("schedule.table.capacityColumn", { defaultValue: "Capacity" })}:</span>
                <span className="font-mono font-bold text-foreground">
                  {selectedSlotForDetail.currentPatients ?? 0} / {selectedSlotForDetail.maxPatients ?? 1}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground text-[11px] font-bold block">{t("schedule.table.dateColumn", { defaultValue: "Date" })}:</span>
                <span className="font-mono font-bold text-foreground">{selectedSlotForDetail.date?.slice(0, 10)}</span>
              </div>
            </div>

            {/* Booked Appointment Info if any */}
            {appointmentBySlotId.has(selectedSlotForDetail.id) && (
              <div className="p-3.5 rounded-2xl border border-border/40 bg-muted/20 space-y-2">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <User className="h-4 w-4 text-primary-500" />
                  {t("schedule.table.patientColumn", { defaultValue: "Booked Patient Details" })}
                </span>
                {(() => {
                  const app = appointmentBySlotId.get(selectedSlotForDetail.id)!;
                  const name = app.patient?.name || (app.guestPatient ? `${app.guestPatient.firstName} ${app.guestPatient.lastName}` : "Patient");
                  const phone = app.patient?.phone || app.guestPatient?.phone;
                  return (
                    <div className="text-xs space-y-1">
                      <div className="font-bold text-foreground">{name}</div>
                      {phone && <div className="text-muted-foreground font-mono">{phone}</div>}
                      <div className="flex items-center gap-2 pt-1">
                        <StatusBadge value={app.status} />
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent text-foreground font-bold">
                          {app.patientType || "PATIENT"}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            <div className="pt-4 border-t border-border/40 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedSlotForDetail(null)}
                className="rounded-xl px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-accent cursor-pointer"
              >
                {t("common.close", { defaultValue: "Close" })}
              </button>
              {String(selectedSlotForDetail.status || "").toLowerCase() === "available" && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSlotForDetail(null);
                    setWalkInModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary-500 px-4 py-2 text-xs font-bold text-white hover:opacity-90 transition cursor-pointer shadow-md"
                >
                  <CalendarPlus className="h-3.5 w-3.5" />
                  {t("schedule.timeline.bookPatient", { defaultValue: "Book Walk-In" })}
                </button>
              )}
            </div>
          </div>
        </FormModal>
      )}

      {/* 13. WalkInBookingModal Integration */}
      {walkInModalOpen && (
        <WalkInBookingModal
          open={walkInModalOpen}
          onClose={() => {
            setWalkInModalOpen(false);
            queryClient.invalidateQueries({ queryKey: qk.clinicSelf.all() });
          }}
        />
      )}
    </div>
  );
}
