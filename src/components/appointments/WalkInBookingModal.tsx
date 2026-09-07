import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@/lib/queryClient";
import {
  UserCheck,
  Clock,
  User,
  Plus,
  Loader2,
  CheckCircle2,
  Stethoscope,
  Phone,
  Sparkles,
  UserPlus,
  Search,
  AlertCircle,
  CalendarRange,
  X,
} from "lucide-react";
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
import { ensureArray } from "@/lib/utils";
import findDoctorImg from "@/assets/home-quick-actions/find-doctor.png";

interface WalkInBookingModalProps {
  open: boolean;
  onClose: () => void;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

type PatientSource = "guest" | "app";

export function WalkInBookingModal({ open, onClose }: WalkInBookingModalProps) {
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
  const [date, setDate] = useState(todayISO());
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [type, setType] = useState<"IN_PERSON" | "VIDEO" | "HOME_VISIT">("IN_PERSON");
  const [paymentMethod, setPaymentMethod] = useState<"ON_SITE" | "CREDIT">("ON_SITE");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* Quick Slot state */
  const [showQuickSlot, setShowQuickSlot] = useState(false);
  const [quickStartTime, setQuickStartTime] = useState("09:00");
  const [quickEndTime, setQuickEndTime] = useState("09:30");
  const [isCreatingQuickSlot, setIsCreatingQuickSlot] = useState(false);

  /* Map accepted doctors to DoctorCardItem format */
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

  /* Auto-select first doctor */
  useEffect(() => {
    if (!selectedDoctor && doctorCardItems.length > 0) {
      setSelectedDoctor(doctorCardItems[0]);
    }
  }, [acceptedDoctors]);

  const activeDoctorId = selectedDoctor?.doctorId || "";

  /* Fetch slots for selected doctor and date */
  const { data: rawSlots, isLoading: isSlotsLoading, refetch: refetchSlots } = useQuery({
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
  const bookedSlots = slots.filter(isSlotBooked);

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
      toast.success(`Quick slot created for ${quickStartTime}–${quickEndTime}`);
      void queryClient.invalidateQueries({ queryKey: qk.clinicSelf.all() });
      const refetched = await refetchSlots();
      if (createdSlot && createdSlot.id) {
        setSelectedSlotId(createdSlot.id);
      } else if (refetched.data && refetched.data.length > 0) {
        const matching = refetched.data.find((s: any) => s.startTime === quickStartTime);
        if (matching) setSelectedSlotId(matching.id);
      }
      setShowQuickSlot(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to create quick slot");
    } finally {
      setIsCreatingQuickSlot(false);
    }
  };

  /* Submit booking */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedDoctor) {
      toast.error("Please select a doctor provider");
      return;
    }
    if (!selectedSlotId) {
      toast.error("Please select a time slot");
      return;
    }

    let patientId: string | undefined;
    let guestPatient: { firstName: string; lastName: string; phone: string; email?: string; dateOfBirth?: string; notes?: string } | undefined;

    if (patientSource === "app") {
      if (!selectedAppPatient) {
        toast.error("Please search and select a registered app patient");
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
          toast.error("First name, last name, and phone are required for a walk-in patient");
          return;
        }
        if (!/^\d{10,15}$/.test(guestPhone.trim())) {
          toast.error("Phone number must be between 10 and 15 digits");
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
      const createdAppt = await clinicAppointmentsApi.bookAppointment({
        slotId: selectedSlotId,
        type,
        paymentMethod: patientSource === "guest" ? "ON_SITE" : paymentMethod,
        patientId,
        guestPatient,
        notes: notes.trim() || undefined,
      });

      void queryClient.invalidateQueries({ queryKey: qk.clinicSelf.all() });

      toast.success("Appointment reserved successfully!", {
        description: "Appointment is currently PENDING.",
        duration: 8000,
        action: {
          label: "Confirm Now",
          onClick: async () => {
            try {
              await clinicAppointmentsApi.confirmAppointment(createdAppt.id);
              toast.success("Appointment CONFIRMED!");
              void queryClient.invalidateQueries({ queryKey: qk.clinicSelf.all() });
            } catch (err: any) {
              toast.error(err?.message || "Failed to confirm appointment");
            }
          },
        },
      });

      resetForm();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to book appointment");
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
    setDate(todayISO());
  };

  const selectedSlot = slots.find((s) => s.id === selectedSlotId);

  return (
    <>
      <Drawer
        id="walk-in-booking-drawer"
        open={open}
        onClose={onClose}
        title="Book Walk-In / Phone Appointment"
        subtitle="Reserve and confirm a consultation on your schedule"
        width="max-w-2xl"
        footer={
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] text-muted-foreground">
              {selectedDoctor && (
                <span className="font-semibold text-foreground">{selectedDoctor.name}</span>
              )}
              {selectedSlot && (
                <span> · {date} at {selectedSlot.startTime?.slice(0, 5)}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { resetForm(); onClose(); }}
                className="rounded-xl border border-border/40 px-4 py-2 text-xs font-bold hover:bg-muted/20 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit as any}
                disabled={!selectedSlotId || isSubmitting}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary-500 px-5 py-2 text-xs font-bold text-primary-foreground shadow-md hover:bg-primary-600 transition disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Reserve Appointment
              </button>
            </div>
          </div>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ─── Section 1: Provider Doctor ─── */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Stethoscope className="h-3.5 w-3.5 text-primary-500" />
                1. Provider Doctor
              </label>
              <button
                type="button"
                onClick={() => setDoctorModalOpen(true)}
                className="text-xs font-bold text-primary-500 hover:underline cursor-pointer"
              >
                Change
              </button>
            </div>

            {selectedDoctor ? (
              <div
                onClick={() => setDoctorModalOpen(true)}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-accent/40 border border-border/40 hover:border-primary-500/40 transition cursor-pointer"
              >
                <div className="flex items-center gap-3.5">
                  <img
                    src={selectedDoctor.photoUrl || findDoctorImg}
                    alt={selectedDoctor.name}
                    className="h-12 w-12 rounded-2xl object-cover border border-border/40"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = findDoctorImg; }}
                  />
                  <div>
                    <h4 className="text-sm font-extrabold text-foreground">{selectedDoctor.name}</h4>
                    <p className="text-[11px] font-semibold text-primary-500">{selectedDoctor.specialty}</p>
                    {selectedDoctor.yearsOfExp !== undefined && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">{selectedDoctor.yearsOfExp} years experience</p>
                    )}
                  </div>
                </div>
                <span className="rounded-xl bg-primary-500/10 px-2.5 py-1 text-[10px] font-bold text-primary-500">
                  Selected ✓
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setDoctorModalOpen(true)}
                className="w-full p-4 rounded-2xl border-2 border-dashed border-border/60 text-sm font-semibold text-muted-foreground hover:border-primary-500 hover:text-primary-500 transition cursor-pointer"
              >
                + Select Provider Doctor
              </button>
            )}
          </section>

          {/* ─── Section 2: Patient Identification ─── */}
          <section className="space-y-3 pt-4 border-t border-border/30">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <UserCheck className="h-3.5 w-3.5 text-primary-500" />
              2. Patient Identification
            </label>

            {/* Segmented Control */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-muted/30 border border-border/30">
              <button
                type="button"
                onClick={() => setPatientSource("guest")}
                className={`flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-bold transition cursor-pointer ${
                  patientSource === "guest"
                    ? "bg-primary-500 text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <UserPlus className="h-4 w-4" /> Walk-In / Phone (Guest)
              </button>
              <button
                type="button"
                onClick={() => setPatientSource("app")}
                className={`flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-bold transition cursor-pointer ${
                  patientSource === "app"
                    ? "bg-primary-500 text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <User className="h-4 w-4" /> Registered App Patient
              </button>
            </div>

            {/* Path A: Live App Patient Search */}
            {patientSource === "app" && (
              <div className="space-y-3 pt-1">
                {selectedAppPatient ? (
                  <div className="flex items-center justify-between p-3.5 rounded-2xl border border-primary-500/40 bg-primary-500/10">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={selectedAppPatient.avatarUrl || findDoctorImg}
                        alt=""
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = findDoctorImg; }}
                        className="h-10 w-10 rounded-xl object-cover ring-1 ring-primary-500/30 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-foreground truncate">
                            {selectedAppPatient.firstName} {selectedAppPatient.lastName}
                          </span>
                          <span className="rounded-full bg-primary-500/20 px-2 py-0.5 text-[9px] font-bold text-primary-500 uppercase">
                            Registered App Patient
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                          {selectedAppPatient.phone && <span>{selectedAppPatient.phone}</span>}
                          {selectedAppPatient.email && <span className="truncate">{selectedAppPatient.email}</span>}
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
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search registered app patient by name, phone (0550...), or email..."
                        value={appSearchQuery}
                        onChange={(e) => setAppSearchQuery(e.target.value)}
                        className="w-full ps-9 pe-8 py-2.5 rounded-xl border border-border/40 bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                      />
                      {isSearchingApp && (
                        <Loader2 className="absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary-500 animate-spin" />
                      )}
                    </div>

                    {/* Results list */}
                    {appSearchResults.length > 0 && (
                      <div className="rounded-xl border border-border/40 bg-background divide-y divide-border/20 max-h-52 overflow-y-auto shadow-lg">
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
                                  {user.phone || user.email || "Registered Patient"}
                                </div>
                              </div>
                            </div>
                            <span className="text-[11px] font-bold text-primary-500 bg-primary-500/10 px-2.5 py-1 rounded-lg hover:bg-primary-500 hover:text-white transition">
                              Select
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {appSearchQuery.trim().length >= 2 && !isSearchingApp && appSearchResults.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        No registered app patients found matching "{appSearchQuery}". Try phone number or email, or switch to Walk-In / Guest.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Path B: Guest Patient Search-or-Create */}
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
                        <div className="text-[11px] text-muted-foreground font-mono">{selectedGuestPatient.phone}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedGuestPatient(null)}
                      className="text-xs text-primary-500 font-bold hover:underline cursor-pointer"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Search existing guest */}
                    <div className="relative">
                      <Search className="absolute start-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search existing guest by phone or name..."
                        value={guestSearchQuery}
                        onChange={(e) => setGuestSearchQuery(e.target.value)}
                        className="w-full rounded-xl border border-border/40 bg-muted/20 ps-9 pe-3 py-2 text-xs font-semibold outline-none focus:border-primary-500"
                      />
                      {isSearchingGuest && <Loader2 className="absolute end-3 top-2.5 h-4 w-4 animate-spin text-primary-500" />}
                    </div>

                    {guestSearchResults.length > 0 && (
                      <div className="max-h-32 overflow-y-auto space-y-1 rounded-2xl border border-primary-500/30 p-1.5 bg-card custom-scrollbar">
                        <div className="text-[10px] font-bold text-primary-500 uppercase px-2 py-1">
                          Existing Guest Matches — Click to Select:
                        </div>
                        {guestSearchResults.map((g) => (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => setSelectedGuestPatient(g)}
                            className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-primary-500/10 text-start text-xs transition cursor-pointer"
                          >
                            <span className="font-bold text-foreground">{g.firstName} {g.lastName}</span>
                            <span className="text-muted-foreground font-mono">{g.phone}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Quick Inline Guest Form */}
                    <div className="p-3.5 rounded-2xl border border-border/30 bg-muted/10 space-y-3">
                      <div className="text-[11px] font-bold text-muted-foreground uppercase">
                        Or enter new walk-in details:
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="First Name *"
                          value={guestFirstName}
                          onChange={(e) => setGuestFirstName(e.target.value)}
                          className="w-full rounded-xl border border-border/40 bg-background px-3 py-2 text-xs font-semibold outline-none focus:border-primary-500"
                        />
                        <input
                          type="text"
                          placeholder="Last Name *"
                          value={guestLastName}
                          onChange={(e) => setGuestLastName(e.target.value)}
                          className="w-full rounded-xl border border-border/40 bg-background px-3 py-2 text-xs font-semibold outline-none focus:border-primary-500"
                        />
                      </div>
                      <input
                        type="tel"
                        placeholder="Phone Number (10 digits) *"
                        value={guestPhone}
                        onChange={(e) => setGuestPhone(e.target.value)}
                        className="w-full rounded-xl border border-border/40 bg-background px-3 py-2 text-xs font-semibold outline-none focus:border-primary-500 font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ─── Section 3: Date & Slot Picker with Schedule Visualization ─── */}
          <section className="space-y-3 pt-4 border-t border-border/30">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <CalendarRange className="h-3.5 w-3.5 text-primary-500" />
                3. Date & Time Slot
              </label>
              <div className="flex items-center gap-2">
                <ModernDatePickerModal
                  mode="single"
                  value={date}
                  onSelect={(d) => { setDate(d); setSelectedSlotId(""); }}
                  placeholder="Select Date"
                />
                <button
                  type="button"
                  onClick={() => setShowQuickSlot(!showQuickSlot)}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-primary-500 hover:underline cursor-pointer"
                >
                  <Sparkles className="h-3 w-3" /> Instant Slot
                </button>
              </div>
            </div>

            {/* Schedule Timeline Visualization */}
            {activeDoctorId && (
              <div className="rounded-2xl bg-accent/30 border border-border/30 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-foreground">
                    Schedule for {date}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {availableSlots.length} open · {bookedSlots.length} booked · {slots.length} total
                  </span>
                </div>

                {/* Mini timeline bar */}
                {slots.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {slots.map((slot) => {
                      const isAvailable = isSlotAvailable(slot);
                      const isBooked = isSlotBooked(slot);
                      const isCancelled = String(slot.status).toLowerCase() === "cancelled" || !!slot.isCancelled;
                      const isSelected = selectedSlotId === slot.id;

                      return (
                        <button
                          key={slot.id}
                          type="button"
                          disabled={!isAvailable}
                          onClick={() => isAvailable && setSelectedSlotId(slot.id)}
                          title={`${slot.startTime}–${slot.endTime} ${isBooked ? "(Booked)" : isCancelled ? "(Cancelled)" : "(Available)"}`}
                          className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold font-mono transition cursor-pointer disabled:cursor-not-allowed ${
                            isSelected
                              ? "bg-primary-500 text-primary-foreground ring-2 ring-primary-500/40 shadow-sm"
                              : isAvailable
                                ? "bg-success/15 text-success hover:bg-success/25 border border-success/30"
                                : isBooked
                                  ? "bg-danger/10 text-danger/60 border border-danger/20"
                                  : "bg-muted/30 text-muted-foreground/40 border border-border/20 line-through"
                          }`}
                        >
                          {slot.startTime?.slice(0, 5)}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Legend */}
                <div className="flex items-center gap-3 text-[9px] text-muted-foreground pt-1">
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-success inline-block" /> Available</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-danger inline-block" /> Booked</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary-500 inline-block" /> Selected</span>
                </div>
              </div>
            )}

            {/* Slots Grid (available only) */}
            {isSlotsLoading ? (
              <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin me-2" /> Loading slots…
              </div>
            ) : availableSlots.length === 0 ? (
              <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4 text-center text-xs text-warning flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 font-bold">
                  <AlertCircle className="h-4 w-4" /> No available slots for {date}.
                </div>
                <button
                  type="button"
                  onClick={() => setShowQuickSlot(true)}
                  className="rounded-xl bg-primary-500 px-3.5 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary-600 transition cursor-pointer"
                >
                  Create Instant Slot Now
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-40 overflow-y-auto custom-scrollbar pe-1">
                {availableSlots.map((slot) => {
                  const isSelected = selectedSlotId === slot.id;
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => setSelectedSlotId(slot.id)}
                      className={`flex items-center justify-center gap-1.5 rounded-xl border p-2.5 text-xs font-bold font-mono transition cursor-pointer ${
                        isSelected
                          ? "border-primary-500 bg-primary-500/15 text-primary-500 shadow-xs"
                          : "border-border/40 hover:bg-muted/20 text-foreground"
                      }`}
                    >
                      <Clock className="h-3.5 w-3.5" />
                      {slot.startTime?.slice(0, 5)}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Quick Slot Creation Panel */}
            {showQuickSlot && (
              <div className="p-3.5 rounded-2xl border border-primary-500/30 bg-primary-500/10 space-y-3 animate-in fade-in duration-150">
                <div className="text-xs font-bold text-primary-500 flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5" /> Create an Ad-Hoc Slot for {date}:
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <ModernTimePickerModal
                    value={quickStartTime}
                    onChange={(t) => setQuickStartTime(t)}
                    placeholder="Start time"
                  />
                  <span className="text-xs font-bold text-muted-foreground">to</span>
                  <ModernTimePickerModal
                    value={quickEndTime}
                    onChange={(t) => setQuickEndTime(t)}
                    placeholder="End time"
                  />
                  <button
                    type="button"
                    onClick={handleCreateQuickSlot}
                    disabled={isCreatingQuickSlot}
                    className="ms-auto inline-flex items-center gap-1 rounded-xl bg-primary-500 px-3.5 py-2 text-xs font-bold text-primary-foreground hover:bg-primary-600 transition disabled:opacity-50 cursor-pointer"
                  >
                    {isCreatingQuickSlot ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    Create Slot
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* ─── Section 4: Type & Payment ─── */}
          <section className="grid grid-cols-2 gap-3 pt-4 border-t border-border/30">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                Consultation Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full rounded-xl border border-border/40 bg-muted/20 px-3 py-2.5 text-xs font-semibold outline-none focus:border-primary-500"
              >
                <option value="IN_PERSON">In Person</option>
                <option value="VIDEO">Video Consultation</option>
                <option value="HOME_VISIT">Home Visit</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                Payment Method
              </label>
              <select
                value={patientSource === "guest" ? "ON_SITE" : paymentMethod}
                disabled={patientSource === "guest"}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full rounded-xl border border-border/40 bg-muted/20 px-3 py-2.5 text-xs font-semibold outline-none focus:border-primary-500 disabled:opacity-75"
              >
                <option value="ON_SITE">On Site (Cash / Card)</option>
                <option value="CREDIT">Platform Credit</option>
              </select>
              {patientSource === "guest" && (
                <span className="text-[10px] text-muted-foreground block mt-0.5">Guest bookings are always On Site.</span>
              )}
            </div>

            <div className="col-span-2">
              <input
                type="text"
                placeholder="Additional notes / symptoms (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-xl border border-border/40 bg-muted/20 px-3 py-2.5 text-xs font-semibold outline-none focus:border-primary-500"
              />
            </div>
          </section>
        </form>
      </Drawer>

      {/* Doctor Selector Modal */}
      <DoctorSelectorModal
        open={doctorModalOpen}
        onClose={() => setDoctorModalOpen(false)}
        doctors={doctorCardItems}
        selectedDoctorId={selectedDoctor?.doctorId}
        onSelectDoctor={(doc) => { setSelectedDoctor(doc); setSelectedSlotId(""); }}
      />
    </>
  );
}
