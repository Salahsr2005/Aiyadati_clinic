import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@/lib/queryClient";
import {
  UserCheck,
  Clock,
  User,
  Plus,
  Loader2,
  Stethoscope,
  Sparkles,
  UserPlus,
  Search,
  AlertCircle,
  CalendarRange,
  Sun,
  Moon,
  Zap,
} from "lucide-react";
import { format, addDays } from "date-fns";
import { toast } from "sonner";
import {
  clinicAppointmentsApi,
  type DoctorSlot,
  type GuestPatient,
} from "@/api/clinicAppointmentsApi";
import { type UserRow } from "@/api/usersApi";
import { useClinicDoctors } from "@/hooks/useClinicDoctors";
import { qk } from "@/lib/queryKeys";
import { ModernDatePickerModal } from "@/components/ui/ModernDatePickerModal";
import { ModernTimePickerModal } from "@/components/ui/ModernTimePickerModal";
import { DoctorSelectorModal, type DoctorCardItem } from "@/components/doctors/DoctorSelectorModal";
import { Drawer } from "@/components/data/Drawer";
import { ensureArray, cn } from "@/lib/utils";
import { RemoteImage } from "@/components/common/RemoteImage";
import { ASSET_FALLBACKS } from "@/lib/assetFallbacks";
import { getDoctorColor } from "@/lib/doctorColor";

interface WalkInBookingModalProps {
  open: boolean;
  onClose: () => void;
  defaultDoctorId?: string;
  defaultDate?: string;
  onSuccess?: () => void;
}

function todayISO() {
  return format(new Date(), "yyyy-MM-dd");
}

type PatientSource = "guest" | "app";

export function WalkInBookingModal({
  open,
  onClose,
  defaultDoctorId,
  defaultDate,
  onSuccess,
}: WalkInBookingModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { acceptedDoctors } = useClinicDoctors();

  /* Doctor state */
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorCardItem | null>(null);
  const [doctorModalOpen, setDoctorModalOpen] = useState(false);

  /* Patient source */
  const [patientSource, setPatientSource] = useState<PatientSource>("guest");

  /* Guest Patient Search / Form State */
  const [guestSearchQuery, setGuestSearchQuery] = useState("");
  const [selectedGuestPatient, setSelectedGuestPatient] = useState<GuestPatient | null>(null);
  const [guestSearchResults, setGuestSearchResults] = useState<GuestPatient[]>([]);
  const [isSearchingGuest, setIsSearchingGuest] = useState(false);

  const [guestFirstName, setGuestFirstName] = useState("");
  const [guestLastName, setGuestLastName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestDob, setGuestDob] = useState("");

  /* App Patient State */
  const [appSearchQuery, setAppSearchQuery] = useState("");
  const [selectedAppPatient, setSelectedAppPatient] = useState<UserRow | null>(null);
  const [appSearchResults, setAppSearchResults] = useState<UserRow[]>([]);
  const [isSearchingApp, setIsSearchingApp] = useState(false);

  /* Slot & Booking State */
  const [date, setDate] = useState(defaultDate || todayISO());
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [type, setType] = useState<"IN_PERSON" | "VIDEO" | "HOME_VISIT">("IN_PERSON");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* Quick Slot state */
  const [showQuickSlot, setShowQuickSlot] = useState(false);
  const [quickStartTime, setQuickStartTime] = useState("09:00");
  const [quickEndTime, setQuickEndTime] = useState("09:30");
  const [isCreatingQuickSlot, setIsCreatingQuickSlot] = useState(false);

  /* Map accepted doctors to DoctorCardItem format */
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

  /* Auto-select default or first doctor */
  useEffect(() => {
    if (doctorCardItems.length > 0) {
      if (defaultDoctorId) {
        const match = doctorCardItems.find((d) => d.doctorId === defaultDoctorId);
        if (match) {
          setSelectedDoctor(match);
          return;
        }
      }
      setSelectedDoctor((prev) => prev || doctorCardItems[0]);
    }
  }, [defaultDoctorId, doctorCardItems]);

  useEffect(() => {
    if (defaultDate) {
      setDate(defaultDate);
    }
  }, [defaultDate]);

  const activeDoctorId = selectedDoctor?.doctorId || "";

  /* Fetch slots for selected doctor and date */
  const {
    data: rawSlots,
    isLoading: isSlotsLoading,
    refetch: refetchSlots,
  } = useQuery({
    queryKey: qk.clinicSelf.doctorSlots(activeDoctorId, { date }),
    queryFn: () =>
      activeDoctorId
        ? clinicAppointmentsApi.getDoctorSlots(activeDoctorId, { date })
        : Promise.resolve([]),
    enabled: open && !!activeDoctorId,
  });

  const slots: DoctorSlot[] = ensureArray<DoctorSlot>(rawSlots);
  const isSlotAvailable = (s: DoctorSlot) => {
    if (s.status) return String(s.status).toLowerCase() === "available";
    return !s.isBooked && !s.isCancelled;
  };
  const isSlotBooked = (s: DoctorSlot) => {
    if (s.status) return String(s.status).toLowerCase() === "booked";
    return !!s.isBooked;
  };

  const availableSlots = slots.filter(isSlotAvailable);

  // Split available slots by morning / afternoon
  const morningSlots = availableSlots.filter((s) => {
    const hour = parseInt(s.startTime?.split(":")[0] || "0", 10);
    return hour < 12;
  });

  const afternoonSlots = availableSlots.filter((s) => {
    const hour = parseInt(s.startTime?.split(":")[0] || "0", 10);
    return hour >= 12;
  });

  /* Debounced Guest Patient Search */
  useEffect(() => {
    if (patientSource !== "guest" || guestSearchQuery.trim().length < 2) {
      setGuestSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingGuest(true);
      try {
        const results = await clinicAppointmentsApi.searchGuestPatients(guestSearchQuery.trim());
        setGuestSearchResults(results);
      } catch {
        setGuestSearchResults([]);
      } finally {
        setIsSearchingGuest(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [guestSearchQuery, patientSource]);

  /* Debounced App Patient Search */
  useEffect(() => {
    if (patientSource !== "app" || appSearchQuery.trim().length < 2) {
      setAppSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingApp(true);
      try {
        const results = await clinicAppointmentsApi.searchAppPatients(appSearchQuery.trim());
        setAppSearchResults(results);
      } catch {
        setAppSearchResults([]);
      } finally {
        setIsSearchingApp(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [appSearchQuery, patientSource]);

  /* Quick slot creation */
  const handleCreateQuickSlot = async () => {
    if (!activeDoctorId || !date || !quickStartTime || !quickEndTime) return;
    setIsCreatingQuickSlot(true);
    try {
      const createdSlot = await clinicAppointmentsApi.addQuickDoctorSlot(activeDoctorId, {
        date,
        startTime: quickStartTime,
        endTime: quickEndTime,
      });
      toast.success(
        t("schedule.quickSuccess", {
          defaultValue: `Quick slot created for ${quickStartTime}–${quickEndTime}`,
        }),
      );
      void queryClient.invalidateQueries({ queryKey: qk.clinicSelf.all() });
      const refetched = await refetchSlots();
      if (createdSlot && createdSlot.id) {
        setSelectedSlotId(createdSlot.id);
      } else if (refetched.data && refetched.data.length > 0) {
        const matching = refetched.data.find((s) => s.startTime === quickStartTime);
        if (matching) setSelectedSlotId(matching.id);
      }
      setShowQuickSlot(false);
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error(e?.message || "Failed to create quick slot");
    } finally {
      setIsCreatingQuickSlot(false);
    }
  };

  /* Unified booking submit */
  const handleBookingSubmit = async (confirmImmediately: boolean) => {
    if (!selectedDoctor) {
      toast.error(
        t("appointments.selectDoctorErr", { defaultValue: "Please select a provider doctor" }),
      );
      return;
    }
    if (!selectedSlotId) {
      toast.error(
        t("appointments.selectSlotErr", { defaultValue: "Please select a consultation time slot" }),
      );
      return;
    }

    let patientId: string | undefined;
    let guestPatient:
      | {
          firstName: string;
          lastName: string;
          phone: string;
          email?: string;
          dateOfBirth?: string;
          notes?: string;
        }
      | undefined;

    if (patientSource === "app") {
      if (!selectedAppPatient) {
        toast.error(
          t("appointments.selectAppPatientErr", {
            defaultValue: "Please search and select a registered app patient",
          }),
        );
        return;
      }
      patientId = selectedAppPatient.id;
    } else {
      if (selectedGuestPatient) {
        guestPatient = {
          firstName: selectedGuestPatient.firstName,
          lastName: selectedGuestPatient.lastName,
          phone: selectedGuestPatient.phone,
          dateOfBirth: selectedGuestPatient.dateOfBirth || undefined,
          notes: selectedGuestPatient.notes || undefined,
        };
      } else {
        if (!guestFirstName.trim() || !guestLastName.trim() || !guestPhone.trim()) {
          toast.error(
            t("appointments.guestRequiredErr", {
              defaultValue: "First name, last name, and phone are required for a walk-in patient",
            }),
          );
          return;
        }
        if (!/^\d{10,15}$/.test(guestPhone.trim())) {
          toast.error(
            t("appointments.phoneDigitsErr", {
              defaultValue: "Phone number must be between 10 and 15 digits",
            }),
          );
          return;
        }
        guestPatient = {
          firstName: guestFirstName.trim(),
          lastName: guestLastName.trim(),
          phone: guestPhone.trim(),
          dateOfBirth: guestDob || undefined,
          notes: notes.trim() || undefined,
        };
      }
    }

    setIsSubmitting(true);
    try {
      // NOTE: paymentMethod is strictly omitted as the backend bookAppointmentSchema does not allow it
      const createdAppt = await clinicAppointmentsApi.bookAppointment({
        slotId: selectedSlotId,
        type,
        patientId,
        guestPatient,
        notes: notes.trim() || undefined,
      });

      if (confirmImmediately && createdAppt?.id) {
        try {
          await clinicAppointmentsApi.confirmAppointment(createdAppt.id);
          toast.success(
            t("appointments.bookAndConfirmedSuccess", {
              defaultValue: "Appointment booked and CONFIRMED successfully!",
            }),
          );
        } catch {
          toast.success(
            t("appointments.bookedPendingNotice", {
              defaultValue: "Appointment reserved (Pending confirmation).",
            }),
          );
        }
      } else {
        toast.success(
          t("appointments.bookedPendingSuccess", {
            defaultValue: "Appointment reserved in PENDING status.",
          }),
        );
      }

      void queryClient.invalidateQueries({ queryKey: qk.clinicSelf.all() });
      if (onSuccess) onSuccess();
      resetForm();
      onClose();
    } catch (err: unknown) {
      const e = err as {
        message?: string;
        response?: { data?: { message?: string; error?: string } };
      };
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        "Failed to book appointment";
      toast.error(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setGuestFirstName("");
    setGuestLastName("");
    setGuestPhone("");
    setGuestDob("");
    setNotes("");
    setSelectedSlotId("");
    setSelectedGuestPatient(null);
    setSelectedAppPatient(null);
    setGuestSearchQuery("");
    setAppSearchQuery("");
    setShowQuickSlot(false);
    setDate(defaultDate || todayISO());
  };

  const selectedSlot = slots.find((s) => s.id === selectedSlotId);

  return (
    <>
      <Drawer
        id="walk-in-booking-drawer"
        open={open}
        onClose={onClose}
        title={t("appointments.drawerTitle", { defaultValue: "Book Patient Appointment" })}
        subtitle={t("appointments.drawerSubtitle", {
          defaultValue: "Schedule walk-in, phone, or registered consultations",
        })}
        width="max-w-2xl"
        footer={
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div className="text-[11px] text-muted-foreground truncate max-w-xs">
              {selectedDoctor && (
                <span className="font-bold text-foreground">{selectedDoctor.name}</span>
              )}
              {selectedSlot && (
                <span>
                  {" "}
                  · {date} at {selectedSlot.startTime?.slice(0, 5)}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  onClose();
                }}
                className="rounded-xl border border-border/40 px-3.5 py-2 text-xs font-bold text-muted-foreground hover:bg-muted/20 transition cursor-pointer"
              >
                {t("common.cancel", { defaultValue: "Cancel" })}
              </button>

              {/* Secondary: Book as Pending */}
              <button
                type="button"
                onClick={() => handleBookingSubmit(false)}
                disabled={!selectedSlotId || isSubmitting}
                className="inline-flex items-center gap-1.5 rounded-xl border border-warning/40 bg-warning/10 px-3.5 py-2 text-xs font-bold text-warning hover:bg-warning/20 transition disabled:opacity-40 cursor-pointer"
                title={t("appointments.bookPendingTip", {
                  defaultValue: "Save as Pending for verification",
                })}
              >
                <Clock className="h-3.5 w-3.5" />
                <span>{t("appointments.savePending", { defaultValue: "Save Pending" })}</span>
              </button>

              {/* Primary: Book & Confirm Now */}
              <button
                type="button"
                onClick={() => handleBookingSubmit(true)}
                disabled={!selectedSlotId || isSubmitting}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary-500 px-5 py-2 text-xs font-bold text-primary-foreground shadow-md hover:opacity-90 transition disabled:opacity-40 cursor-pointer"
              >
                {isSubmitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Zap className="h-3.5 w-3.5" />
                )}
                <span>
                  {t("appointments.bookAndConfirmNow", { defaultValue: "Book & Confirm Now" })}
                </span>
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-6 pb-4">
          {/* ─── Section 1: Provider Doctor Picker (Interactive Strip) ─── */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Stethoscope className="h-3.5 w-3.5 text-primary-500" />
                1. {t("appointments.providerDoctor", { defaultValue: "Attending Practitioner" })}
              </label>
              {doctorCardItems.length > 4 && (
                <button
                  type="button"
                  onClick={() => setDoctorModalOpen(true)}
                  className="text-xs font-bold text-primary-500 hover:underline cursor-pointer"
                >
                  {t("schedule.viewAllDoctors", { defaultValue: "Search directory" })} (
                  {doctorCardItems.length})
                </button>
              )}
            </div>

            {/* Horizontal Doctor Cards Strip */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1.5 custom-scrollbar">
              {doctorCardItems.map((doc) => {
                const isSelected = selectedDoctor?.doctorId === doc.doctorId;
                const dColor = getDoctorColor(doc.doctorId);
                return (
                  <button
                    key={doc.doctorId}
                    type="button"
                    onClick={() => {
                      setSelectedDoctor(doc);
                      setSelectedSlotId("");
                    }}
                    className={cn(
                      "flex items-center gap-2.5 rounded-2xl border p-2 text-start transition shrink-0 cursor-pointer",
                      isSelected
                        ? "border-primary-500 shadow-sm ring-2 ring-primary-500/20"
                        : "border-border/40 bg-card/60 hover:bg-accent/40",
                    )}
                    style={{
                      backgroundColor: isSelected ? `${dColor.hex}15` : undefined,
                      borderColor: isSelected ? dColor.hex : undefined,
                    }}
                  >
                    <div
                      className="h-9 w-9 rounded-xl overflow-hidden border-2 shrink-0 bg-muted/40"
                      style={{ borderColor: dColor.hex }}
                    >
                      <RemoteImage
                        src={doc.photoUrl}
                        alt={doc.name}
                        fallback={ASSET_FALLBACKS.doctorPhoto}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 pr-2">
                      <div className="text-xs font-extrabold text-foreground truncate max-w-[120px]">
                        {doc.name}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                        {doc.specialty}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* ─── Section 2: Patient Identification ─── */}
          <section className="space-y-3 pt-4 border-t border-border/30">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <UserCheck className="h-3.5 w-3.5 text-primary-500" />
                2.{" "}
                {t("appointments.patientIdentification", { defaultValue: "Patient Information" })}
              </label>
            </div>

            {/* Segmented Control */}
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-muted/30 border border-border/30">
              <button
                type="button"
                onClick={() => setPatientSource("guest")}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-xl py-2 px-3 text-xs font-bold transition cursor-pointer",
                  patientSource === "guest"
                    ? "bg-primary-500 text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>{t("patients.guestPatients", { defaultValue: "Walk-In / Guest" })}</span>
              </button>

              <button
                type="button"
                onClick={() => setPatientSource("app")}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-xl py-2 px-3 text-xs font-bold transition cursor-pointer",
                  patientSource === "app"
                    ? "bg-primary-500 text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <User className="h-3.5 w-3.5" />
                <span>{t("patients.appRegistered", { defaultValue: "Registered Patient" })}</span>
              </button>
            </div>

            {/* Path A: Live App Patient Search */}
            {patientSource === "app" && (
              <div className="space-y-3 pt-1">
                {selectedAppPatient ? (
                  <div className="flex items-center justify-between p-3.5 rounded-2xl border border-primary-500/40 bg-primary-500/10">
                    <div className="flex items-center gap-3 min-w-0">
                      <RemoteImage
                        src={selectedAppPatient.avatarUrl}
                        alt=""
                        fallback={ASSET_FALLBACKS.userAvatar}
                        className="h-10 w-10 rounded-xl object-cover ring-1 ring-primary-500/30 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-foreground truncate">
                            {selectedAppPatient.firstName} {selectedAppPatient.lastName}
                          </span>
                          <span className="rounded-full bg-primary-500/20 px-2 py-0.5 text-[9px] font-bold text-primary-500 uppercase">
                            Registered
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                          {selectedAppPatient.phone && <span>{selectedAppPatient.phone}</span>}
                          {selectedAppPatient.email && (
                            <span className="truncate">{selectedAppPatient.email}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAppPatient(null);
                        setAppSearchQuery("");
                      }}
                      className="text-xs text-primary-500 font-bold hover:underline cursor-pointer shrink-0 ms-2"
                    >
                      {t("common.edit", { defaultValue: "Change" })}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search registered patient by name, phone (0550...), or email..."
                        value={appSearchQuery}
                        onChange={(e) => setAppSearchQuery(e.target.value)}
                        className="glass w-full ps-9 pe-8 py-2.5 rounded-xl border border-border/40 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                      />
                      {isSearchingApp && (
                        <Loader2 className="absolute end-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-primary-500 animate-spin" />
                      )}
                    </div>

                    {appSearchResults.length > 0 && (
                      <div className="rounded-xl border border-border/40 bg-card divide-y divide-border/20 max-h-48 overflow-y-auto shadow-md">
                        {appSearchResults.map((user) => (
                          <div
                            key={user.id}
                            onClick={() => setSelectedAppPatient(user)}
                            className="flex items-center justify-between p-2.5 hover:bg-accent/40 cursor-pointer transition"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary-500/10 text-primary-500 font-bold text-xs shrink-0">
                                {(user.firstName?.[0] || "P").toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-foreground truncate">
                                  {user.firstName || ""} {user.lastName || ""}
                                </div>
                                <div className="text-[10px] text-muted-foreground truncate">
                                  {user.phone || user.email}
                                </div>
                              </div>
                            </div>
                            <span className="text-[10px] font-bold text-primary-500 bg-primary-500/10 px-2.5 py-1 rounded-lg">
                              Select
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Path B: Guest Patient Form */}
            {patientSource === "guest" && (
              <div className="space-y-3 pt-1">
                {selectedGuestPatient ? (
                  <div className="flex items-center justify-between p-3 rounded-2xl border border-primary-500/40 bg-primary-500/10">
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary-500 text-primary-foreground font-bold text-xs">
                        {(selectedGuestPatient.firstName?.[0] || "G").toUpperCase()}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-foreground">
                          {selectedGuestPatient.firstName} {selectedGuestPatient.lastName}
                        </div>
                        <div className="text-[11px] text-muted-foreground font-mono">
                          {selectedGuestPatient.phone}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedGuestPatient(null)}
                      className="text-xs text-primary-500 font-bold hover:underline cursor-pointer"
                    >
                      {t("common.edit", { defaultValue: "Change" })}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {/* Search existing guest query */}
                    <div className="relative">
                      <Search className="absolute start-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search existing guest patients by phone or name..."
                        value={guestSearchQuery}
                        onChange={(e) => setGuestSearchQuery(e.target.value)}
                        className="glass w-full rounded-xl ps-9 pe-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-primary-500/20"
                      />
                      {isSearchingGuest && (
                        <Loader2 className="absolute end-3 top-2.5 h-3.5 w-3.5 animate-spin text-primary-500" />
                      )}
                    </div>

                    {guestSearchResults.length > 0 && (
                      <div className="max-h-32 overflow-y-auto space-y-1 rounded-2xl border border-primary-500/30 p-1.5 bg-card">
                        <div className="text-[9px] font-bold text-primary-500 uppercase px-2 py-0.5">
                          Existing Guest Matches:
                        </div>
                        {guestSearchResults.map((g) => (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => setSelectedGuestPatient(g)}
                            className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-primary-500/10 text-start text-xs transition cursor-pointer"
                          >
                            <span className="font-bold text-foreground">
                              {g.firstName} {g.lastName}
                            </span>
                            <span className="text-muted-foreground font-mono">{g.phone}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Inline Quick Guest Inputs */}
                    <div className="p-3 rounded-2xl border border-border/30 bg-muted/10 space-y-2.5">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="First Name *"
                          value={guestFirstName}
                          onChange={(e) => setGuestFirstName(e.target.value)}
                          className="glass w-full rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-primary-500/30"
                        />
                        <input
                          type="text"
                          placeholder="Last Name *"
                          value={guestLastName}
                          onChange={(e) => setGuestLastName(e.target.value)}
                          className="glass w-full rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-primary-500/30"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="tel"
                          placeholder="Phone Number (10 digits) *"
                          value={guestPhone}
                          onChange={(e) => setGuestPhone(e.target.value)}
                          className="glass w-full rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-primary-500/30 font-mono"
                        />
                        <input
                          type="date"
                          placeholder="Date of Birth"
                          value={guestDob}
                          onChange={(e) => setGuestDob(e.target.value)}
                          className="glass w-full rounded-xl px-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-primary-500/30 font-mono text-muted-foreground"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ─── Section 3: Date & Slot Picker with Quick Date Chips ─── */}
          <section className="space-y-3 pt-4 border-t border-border/30">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <CalendarRange className="h-3.5 w-3.5 text-primary-500" />
                3. {t("appointments.dateTimeSlot", { defaultValue: "Date & Consultation Slot" })}
              </label>

              <button
                type="button"
                onClick={() => setShowQuickSlot(!showQuickSlot)}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-primary-500 hover:underline cursor-pointer"
              >
                <Sparkles className="h-3 w-3" />
                <span>{t("schedule.quickSlotButton", { defaultValue: "Instant Slot" })}</span>
              </button>
            </div>

            {/* Quick Date Presets */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
              {[
                { label: "Today", value: todayISO() },
                { label: "Tomorrow", value: format(addDays(new Date(), 1), "yyyy-MM-dd") },
                { label: "+2 Days", value: format(addDays(new Date(), 2), "yyyy-MM-dd") },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setDate(preset.value);
                    setSelectedSlotId("");
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0",
                    date === preset.value
                      ? "bg-primary-500 text-primary-foreground shadow-sm"
                      : "border border-border/40 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {preset.label}
                </button>
              ))}

              <div className="shrink-0">
                <ModernDatePickerModal
                  mode="single"
                  value={date}
                  onSelect={(d) => {
                    setDate(d);
                    setSelectedSlotId("");
                  }}
                  placeholder="Other Date..."
                />
              </div>
            </div>

            {/* Available Time Slots grouped by Morning / Afternoon */}
            {isSlotsLoading ? (
              <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin me-2" /> Loading slots…
              </div>
            ) : availableSlots.length === 0 ? (
              <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4 text-center text-xs text-warning flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 font-bold">
                  <AlertCircle className="h-4 w-4" /> No bookable slots available for {date}.
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Create an instant slot on-the-fly for this patient:
                </p>
                <button
                  type="button"
                  onClick={() => setShowQuickSlot(true)}
                  className="rounded-xl bg-primary-500 px-3.5 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90 transition cursor-pointer"
                >
                  + Add Instant Consultation Slot
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {morningSlots.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1 px-1">
                      <Sun className="h-3 w-3 text-amber-500" /> Morning ({morningSlots.length})
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-36 overflow-y-auto custom-scrollbar pe-1">
                      {morningSlots.map((slot) => {
                        const isSelected = selectedSlotId === slot.id;
                        return (
                          <button
                            key={slot.id}
                            type="button"
                            onClick={() => setSelectedSlotId(slot.id)}
                            className={cn(
                              "flex items-center justify-center gap-1.5 rounded-xl border p-2 text-xs font-bold font-mono transition cursor-pointer",
                              isSelected
                                ? "border-primary-500 bg-primary-500 text-primary-foreground shadow-sm ring-2 ring-primary-500/20"
                                : "border-border/40 hover:bg-muted/20 text-foreground bg-card",
                            )}
                          >
                            <Clock className="h-3 w-3" />
                            {slot.startTime?.slice(0, 5)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {afternoonSlots.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1 px-1">
                      <Moon className="h-3 w-3 text-indigo-500" /> Afternoon / Evening (
                      {afternoonSlots.length})
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-36 overflow-y-auto custom-scrollbar pe-1">
                      {afternoonSlots.map((slot) => {
                        const isSelected = selectedSlotId === slot.id;
                        return (
                          <button
                            key={slot.id}
                            type="button"
                            onClick={() => setSelectedSlotId(slot.id)}
                            className={cn(
                              "flex items-center justify-center gap-1.5 rounded-xl border p-2 text-xs font-bold font-mono transition cursor-pointer",
                              isSelected
                                ? "border-primary-500 bg-primary-500 text-primary-foreground shadow-sm ring-2 ring-primary-500/20"
                                : "border-border/40 hover:bg-muted/20 text-foreground bg-card",
                            )}
                          >
                            <Clock className="h-3 w-3" />
                            {slot.startTime?.slice(0, 5)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Quick Slot Creation Panel */}
            {showQuickSlot && (
              <div className="p-3.5 rounded-2xl border border-primary-500/30 bg-primary-500/10 space-y-2.5 animate-in fade-in duration-150">
                <div className="text-xs font-bold text-primary-500 flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5" /> Instant Slot for {date}:
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <ModernTimePickerModal
                    value={quickStartTime}
                    onChange={(t) => setQuickStartTime(t)}
                    placeholder="Start"
                  />
                  <span className="text-xs font-bold text-muted-foreground">to</span>
                  <ModernTimePickerModal
                    value={quickEndTime}
                    onChange={(t) => setQuickEndTime(t)}
                    placeholder="End"
                  />
                  <button
                    type="button"
                    onClick={handleCreateQuickSlot}
                    disabled={isCreatingQuickSlot}
                    className="ms-auto inline-flex items-center gap-1 rounded-xl bg-primary-500 px-3.5 py-2 text-xs font-bold text-primary-foreground hover:opacity-90 transition disabled:opacity-50 cursor-pointer"
                  >
                    {isCreatingQuickSlot ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                    Create Slot
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* ─── Section 4: Consultation Type & Notes ─── */}
          <section className="space-y-3 pt-4 border-t border-border/30">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Consultation Mode
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as "IN_PERSON" | "VIDEO" | "HOME_VISIT")}
                  className="glass w-full rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-primary-500/20 bg-background"
                >
                  <option value="IN_PERSON">In Person (Clinic Visit)</option>
                  <option value="VIDEO">Teleconsultation (Video)</option>
                  <option value="HOME_VISIT">Home Visit</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Additional Notes
                </label>
                <input
                  type="text"
                  placeholder="Symptoms or reason for visit (optional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="glass w-full rounded-xl px-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-primary-500/20"
                />
              </div>
            </div>
          </section>
        </div>
      </Drawer>

      {/* Doctor Selector Modal */}
      <DoctorSelectorModal
        open={doctorModalOpen}
        onClose={() => setDoctorModalOpen(false)}
        doctors={doctorCardItems}
        selectedDoctorId={selectedDoctor?.doctorId}
        onSelectDoctor={(doc) => {
          setSelectedDoctor(doc);
          setSelectedSlotId("");
        }}
      />
    </>
  );
}
