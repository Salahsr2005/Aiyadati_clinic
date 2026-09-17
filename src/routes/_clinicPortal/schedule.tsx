import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueries, useQueryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Zap,
  Ban,
  Clock,
  Stethoscope,
  DoorOpen,
  Loader2,
  CalendarRange,
  CalendarPlus,
  AlertTriangle,
  Users,
  Sparkles,
  RefreshCw,
  LayoutGrid,
  UserCheck,
  Building2,
  CheckCircle2,
  AlertCircle,
  Layers,
  Sliders,
} from "lucide-react";
import { format, addDays } from "date-fns";
import { toast } from "sonner";
import {
  clinicAppointmentsApi,
  type ClinicAppointmentRow,
  type DoctorSlot,
} from "@/api/clinicAppointmentsApi";
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
import { DoctorSelectorModal, type DoctorCardItem } from "@/components/doctors/DoctorSelectorModal";
import { WalkInBookingModal } from "@/components/appointments/WalkInBookingModal";
import { MultiDoctorBoard } from "@/components/schedule/MultiDoctorBoard";
import { OptimalSlotsTab } from "@/components/schedule/OptimalSlotsTab";
import { DoctorScheduleSettingsCard } from "@/components/schedule/DoctorScheduleSettingsCard";
import {
  AvailabilityAwareGeneratorModal,
  type GeneratorFormData,
} from "@/components/schedule/AvailabilityAwareGeneratorModal";
import { getDoctorColor } from "@/lib/doctorColor";
import { detectRoomConflicts } from "@/lib/scheduleConflicts";

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

type QuickSlotFormData = z.infer<typeof quickSlotSchema>;
type CancelDateFormData = z.infer<typeof cancelDateSchema>;

type ScheduleMode = "doctor" | "board";

export default function SchedulePage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  const { acceptedDoctors, isLoading: isDoctorsLoading } = useClinicDoctors();
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>("doctor");
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));

  // Modals state
  const [doctorSelectorOpen, setDoctorSelectorOpen] = useState(false);
  const [batchGeneratorOpen, setBatchGeneratorOpen] = useState(false);
  const [quickSlotModalOpen, setQuickSlotModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [walkInModalOpen, setWalkInModalOpen] = useState(false);

  // Clinic Rooms
  const { data: rawRooms } = useQuery({
    queryKey: qk.clinicSelf.rooms(),
    queryFn: clinicSelfApi.getRooms,
  });
  const rooms: ClinicRoom[] = ensureArray<ClinicRoom>(rawRooms);

  // Doctor Card Items
  const doctorCardItems: DoctorCardItem[] = useMemo(
    () =>
      acceptedDoctors.map((doc) => {
        const d = doc.doctor as
          | {
              firstNameFr?: string;
              firstNameAr?: string;
              firstName?: string;
              lastNameFr?: string;
              lastNameAr?: string;
              lastName?: string;
              name?: string;
              specialties?: Array<{ nameFr?: string; nameAr?: string }>;
              specialtyName?: string;
              specialty?: { nameFr?: string };
              avatarUrl?: string;
              photoUrl?: string;
              email?: string;
              phone?: string;
              yearsOfExp?: number;
            }
          | null
          | undefined;
        const f = d?.firstNameFr || d?.firstNameAr || d?.firstName || "";
        const l = d?.lastNameFr || d?.lastNameAr || d?.lastName || "";
        const name = `${f} ${l}`.trim() || d?.name || "Doctor";
        const spec =
          Array.isArray(d?.specialties) && d.specialties.length > 0
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
      }),
    [acceptedDoctors, t],
  );

  // Active Doctor Resolution
  const activeDoctorId = selectedDoctorId || acceptedDoctors[0]?.doctorId || "";
  const selectedDoctorCard =
    doctorCardItems.find((d) => d.doctorId === activeDoctorId) || doctorCardItems[0];
  const activeDoctorColor = getDoctorColor(activeDoctorId);

  // Fetch all doctor slots for selected date (for doctor switcher badge + room conflict detection)
  const allDoctorSlotQueries = useQueries({
    queries: doctorCardItems.map((d) => ({
      queryKey: qk.clinicSelf.doctorSlots(d.doctorId, { date: selectedDate }),
      queryFn: () => clinicAppointmentsApi.getDoctorSlots(d.doctorId, { date: selectedDate }),
      staleTime: 30_000,
    })),
  });

  const slotsByDoctor = useMemo(() => {
    const map = new Map<string, DoctorSlot[]>();
    doctorCardItems.forEach((d, i) =>
      map.set(d.doctorId, (allDoctorSlotQueries[i]?.data as DoctorSlot[]) ?? []),
    );
    return map;
  }, [doctorCardItems, allDoctorSlotQueries]);

  const allSlotsToday = useMemo(() => Array.from(slotsByDoctor.values()).flat(), [slotsByDoctor]);
  const allConflicts = useMemo(() => detectRoomConflicts(allSlotsToday), [allSlotsToday]);

  const conflictedDoctorIds = useMemo(() => {
    const set = new Set<string>();
    allConflicts.forEach((c) => {
      set.add(c.slotA.doctorId);
      set.add(c.slotB.doctorId);
    });
    return set;
  }, [allConflicts]);

  const activeDoctorConflicts = useMemo(() => {
    return allConflicts.filter(
      (c) => c.slotA.doctorId === activeDoctorId || c.slotB.doctorId === activeDoctorId,
    );
  }, [allConflicts, activeDoctorId]);

  // Active doctor weekly availability pattern (for availability-enforced generation)
  const { data: rawAvailability, isLoading: isAvailabilityLoading } = useQuery({
    queryKey: qk.doctors.availability(activeDoctorId),
    queryFn: () =>
      activeDoctorId ? doctorsApi.getAvailability(activeDoctorId) : Promise.resolve([]),
    enabled: !!activeDoctorId,
  });

  // Active doctor slots for selected date
  const activeDoctorSlotsToday = slotsByDoctor.get(activeDoctorId) ?? [];

  // Forms
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
    mutationFn: (data: GeneratorFormData) => {
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
      setBatchGeneratorOpen(false);
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
    successMessage: t("schedule.cancelSuccess", {
      defaultValue: "Date slots cancelled successfully!",
    }),
    onSuccess: () => {
      setCancelModalOpen(false);
      cancelDateForm.reset({ date: selectedDate, reason: "" });
      queryClient.invalidateQueries({ queryKey: qk.clinicSelf.all() });
    },
  });

  // Fast 1-Click Generation Windows (7 or 30 days on available days)
  const handleQuickGenerateWindow = (days: number) => {
    if (!activeDoctorId) return;
    const start = format(new Date(), "yyyy-MM-dd");
    const end = format(addDays(new Date(), days - 1), "yyyy-MM-dd");
    generateSlotsMutation.mutate({
      startDate: start,
      endDate: end,
      force: false,
    });
  };

  const getDoctorNameById = (id: string) =>
    doctorCardItems.find((d) => d.doctorId === id)?.name ?? "Doctor";

  return (
    <div className="space-y-6 pb-24 md:pb-8">
      {/* 1. Header Bar with Mode Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-foreground">
              {t("schedule.title", { defaultValue: "Doctor Schedules & Slots" })}
            </h1>
            {allConflicts.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 border border-rose-500/30 px-2.5 py-0.5 text-xs font-bold text-rose-500 animate-pulse">
                <AlertTriangle className="h-3 w-3" />
                {allConflicts.length}{" "}
                {t("schedule.board.conflictsBadge", { defaultValue: "conflict(s)" })}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {t("schedule.subtitle", {
              defaultValue:
                "Manage consultation hours, bookable slots, and room assignments for each doctor",
            })}
          </p>
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Mode Switcher Pill */}
          <div className="glass flex items-center p-1 rounded-2xl border border-border/40">
            <button
              type="button"
              onClick={() => setScheduleMode("doctor")}
              className={cn(
                "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer",
                scheduleMode === "doctor"
                  ? "bg-primary-500 text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <UserCheck className="h-3.5 w-3.5" />
              <span>{t("schedule.mode.doctor", { defaultValue: "Doctor Workspace" })}</span>
            </button>

            <button
              type="button"
              onClick={() => setScheduleMode("board")}
              className={cn(
                "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer",
                scheduleMode === "board"
                  ? "bg-primary-500 text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Building2 className="h-3.5 w-3.5" />
              <span>{t("schedule.mode.board", { defaultValue: "All-Doctors Board" })}</span>
            </button>
          </div>

          {/* Refresh button */}
          <button
            type="button"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: qk.clinicSelf.all() });
              toast.success("Schedule refreshed");
            }}
            className="grid h-9 w-9 place-items-center rounded-2xl glass border border-border/40 text-muted-foreground hover:text-foreground transition cursor-pointer"
            title={t("schedule.refresh", { defaultValue: "Refresh" })}
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isDoctorsLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-3xl" />
        </div>
      ) : doctorCardItems.length === 0 ? (
        <GlassCard className="p-8 border border-border/40">
          <EmptyState
            title={t("schedule.noDoctors", { defaultValue: "No accepted practitioners yet" })}
            description={t("schedule.noDoctorsDesc", {
              defaultValue:
                "Invite and accept doctors into your clinic to manage their schedules and slots.",
            })}
          />
        </GlassCard>
      ) : (
        <>
          {/* 2. Creative Doctor Switcher Strip (Always Visible) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground px-1">
              <span className="flex items-center gap-1.5">
                <Stethoscope className="h-3.5 w-3.5 text-primary-500" />
                {t("schedule.selectDoctorToManage", {
                  defaultValue: "Select Practitioner to View & Manage",
                })}
              </span>
              <button
                type="button"
                onClick={() => setDoctorSelectorOpen(true)}
                className="text-primary-500 hover:underline cursor-pointer"
              >
                {t("schedule.viewAllDoctors", { defaultValue: "Search directory" })} (
                {doctorCardItems.length})
              </button>
            </div>

            {/* Horizontal Doctor Carousel */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1.5 custom-scrollbar">
              {doctorCardItems.map((doc) => {
                const docColor = getDoctorColor(doc.doctorId);
                const isSelected = doc.doctorId === activeDoctorId;
                const docSlots = slotsByDoctor.get(doc.doctorId) ?? [];
                const hasConflict = conflictedDoctorIds.has(doc.doctorId);

                return (
                  <button
                    key={doc.doctorId}
                    type="button"
                    onClick={() => {
                      setSelectedDoctorId(doc.doctorId);
                      if (scheduleMode === "board") setScheduleMode("doctor");
                    }}
                    className={cn(
                      "group flex items-center gap-3 rounded-2xl border p-2.5 transition shrink-0 cursor-pointer text-start",
                      isSelected
                        ? "border-primary-500 shadow-md ring-2 ring-primary-500/20"
                        : "border-border/40 bg-card/60 hover:bg-accent/40 hover:border-border",
                    )}
                    style={{
                      backgroundColor: isSelected ? `${docColor.hex}15` : undefined,
                      borderColor: isSelected ? docColor.hex : undefined,
                    }}
                  >
                    <div
                      className="relative h-10 w-10 rounded-xl overflow-hidden border-2 shrink-0 bg-muted/40"
                      style={{ borderColor: docColor.hex }}
                    >
                      <RemoteImage
                        src={doc.photoUrl}
                        alt={doc.name}
                        className="h-full w-full object-cover"
                      />
                      {hasConflict && (
                        <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-rose-500 text-white flex items-center justify-center text-[9px] font-bold ring-2 ring-background">
                          !
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 pr-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-foreground truncate max-w-[130px]">
                          {doc.name}
                        </span>
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: docColor.hex }}
                        />
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate max-w-[130px]">
                        {doc.specialty}
                      </div>
                    </div>

                    {/* Slots summary count */}
                    <div className="shrink-0 text-center pl-2 border-l border-border/30">
                      <div className="text-[8px] font-bold text-muted-foreground uppercase">
                        Today
                      </div>
                      <div className="text-xs font-mono font-black text-foreground">
                        {docSlots.length}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. MODE: DOCTOR WORKSPACE */}
          {scheduleMode === "doctor" && selectedDoctorCard && (
            <div className="space-y-6">
              {/* Doctor Schedule Settings Card (Inspired by Doctor Portal) */}
              <DoctorScheduleSettingsCard
                doctor={selectedDoctorCard}
                availability={rawAvailability}
                slotDuration={30}
                bufferTime={5}
                maxPatients={1}
                totalSlotsToday={activeDoctorSlotsToday.length}
                onOpenQuickSlot={() => {
                  quickSlotForm.setValue("date", selectedDate);
                  setQuickSlotModalOpen(true);
                }}
                onOpenBatchGenerate={() => setBatchGeneratorOpen(true)}
                onOpenCancelDate={() => {
                  cancelDateForm.setValue("date", selectedDate);
                  setCancelModalOpen(true);
                }}
                onGenerateQuickWindow={handleQuickGenerateWindow}
                isGenerating={generateSlotsMutation.isPending}
              />

              {/* Active Doctor Room Double-Booking Warning Banner */}
              {activeDoctorConflicts.length > 0 && (
                <div className="flex items-start gap-3 rounded-2xl border border-rose-500/50 bg-rose-500/10 p-4 animate-in fade-in duration-200">
                  <AlertTriangle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-1">
                    <h4 className="text-xs font-bold text-rose-600 dark:text-rose-400">
                      {t("schedule.conflicts.roomAlertTitle", {
                        defaultValue: "Room Double-Booking Alert for this Practitioner",
                      })}{" "}
                      ({activeDoctorConflicts.length})
                    </h4>
                    <div className="space-y-1 text-xs text-rose-600/90 dark:text-rose-300/90">
                      {activeDoctorConflicts.map((c, i) => {
                        const otherDoctorId =
                          c.slotA.doctorId === activeDoctorId ? c.slotB.doctorId : c.slotA.doctorId;
                        return (
                          <div key={i} className="flex items-center gap-1.5">
                            <DoorOpen className="h-3.5 w-3.5 text-rose-500" />
                            <span className="font-bold">
                              Room {c.slotA.room?.name || c.roomId}:
                            </span>
                            <span>
                              {c.slotA.startTime?.slice(0, 5)}–{c.slotA.endTime?.slice(0, 5)}
                            </span>
                            <span>overlaps with</span>
                            <span className="font-bold">{getDoctorNameById(otherDoctorId)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Doctor Slots Management (OptimalSlotsTab) */}
              <OptimalSlotsTab
                doctorId={activeDoctorId}
                onGoToGenerate={() => setBatchGeneratorOpen(true)}
                onCancelDate={(date) => {
                  cancelDateForm.setValue("date", date);
                  setCancelModalOpen(true);
                }}
              />
            </div>
          )}

          {/* 4. MODE: ALL-DOCTORS CLINIC BOARD */}
          {scheduleMode === "board" && (
            <div className="space-y-4">
              <MultiDoctorBoard
                doctors={doctorCardItems}
                selectedDate={selectedDate}
                onSelectDoctor={(id) => {
                  setSelectedDoctorId(id);
                  setScheduleMode("doctor");
                }}
              />
            </div>
          )}
        </>
      )}

      {/* 5. Modals */}

      {/* Availability-Aware Batch Generator Modal */}
      {selectedDoctorCard && (
        <AvailabilityAwareGeneratorModal
          open={batchGeneratorOpen}
          onClose={() => setBatchGeneratorOpen(false)}
          doctor={selectedDoctorCard}
          availability={rawAvailability}
          rooms={rooms}
          initialStartDate={selectedDate}
          initialEndDate={format(addDays(new Date(selectedDate), 6), "yyyy-MM-dd")}
          onSubmit={(data) => generateSlotsMutation.mutate(data)}
          isPending={generateSlotsMutation.isPending}
        />
      )}

      {/* Quick Slot Modal */}
      <FormModal
        id="quick-slot-modal"
        open={quickSlotModalOpen}
        onClose={() => setQuickSlotModalOpen(false)}
        title={t("schedule.quickSlotButton", { defaultValue: "Add Quick Slot" })}
        description={t("schedule.quickSlotDesc", {
          defaultValue: "Add an individual consultation slot for the selected practitioner.",
        })}
      >
        <form
          onSubmit={quickSlotForm.handleSubmit((d) => quickSlotMutation.mutate(d))}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground">
              {t("filters.date", { defaultValue: "Date" })}*
            </label>
            <input
              type="date"
              {...quickSlotForm.register("date")}
              className="glass w-full rounded-xl px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500/40 font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">
                {t("schedule.startTime", { defaultValue: "Start Time" })}*
              </label>
              <input
                type="time"
                {...quickSlotForm.register("startTime")}
                className="glass w-full rounded-xl px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500/40 font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">
                {t("schedule.endTime", { defaultValue: "End Time" })}*
              </label>
              <input
                type="time"
                {...quickSlotForm.register("endTime")}
                className="glass w-full rounded-xl px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500/40 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">
                {t("rooms.title", { defaultValue: "Room" })} (
                {t("common.optional", { defaultValue: "Optional" })})
              </label>
              <select
                {...quickSlotForm.register("roomId")}
                className="glass w-full rounded-xl px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500/40 bg-background text-foreground"
              >
                <option value="">
                  {t("rooms.generalPurpose", { defaultValue: "General Purpose" })}
                </option>
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

      {/* Cancel Date Modal */}
      <FormModal
        id="cancel-date-modal"
        open={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        title={t("schedule.cancelSlotsTitle", { defaultValue: "Cancel All Slots for Date" })}
        description={t("schedule.cancelSlotsDesc", {
          defaultValue:
            "Cancel all unbooked consultation slots for the selected doctor on this date.",
        })}
      >
        <form
          onSubmit={cancelDateForm.handleSubmit((d) => cancelDateMutation.mutate(d))}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground">
              {t("filters.date", { defaultValue: "Date" })}*
            </label>
            <input
              type="date"
              {...cancelDateForm.register("date")}
              className="glass w-full rounded-xl px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500/40 font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground">
              {t("schedule.cancelReason", { defaultValue: "Cancellation Reason" })}
            </label>
            <input
              type="text"
              {...cancelDateForm.register("reason")}
              placeholder={t("schedule.reasonPlaceholder", {
                defaultValue: "e.g. Urgent leave / Doctor unavailable",
              })}
              className="glass w-full rounded-xl px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
            />
          </div>

          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Unbooked slots for this date will be cancelled. Booked appointments are preserved.
            </span>
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

      {/* Doctor Selector Modal */}
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

      {/* Walk-in Booking Modal */}
      <WalkInBookingModal
        open={walkInModalOpen}
        onClose={() => setWalkInModalOpen(false)}
        defaultDoctorId={activeDoctorId}
        defaultDate={selectedDate}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: qk.clinicSelf.all() });
          setWalkInModalOpen(false);
        }}
      />
    </div>
  );
}
