import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";
import {
  Calendar,
  Clock,
  UserCheck,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Search,
  UserPlus,
  User,
  Plus,
  Phone,
  Sparkles,
} from "lucide-react";
import {
  doctorAppointmentsApi,
  doctorSelfApi,
  type SlotRow,
  type PatientSearchResult,
  type GuestPatientRow,
  type GuestPatientInput,
} from "@/api/doctorSelfApi";
import { qk } from "@/lib/queryKeys";
import { ModernDatePickerModal } from "@/components/ui/ModernDatePickerModal";
import { ModernTimePickerModal } from "@/components/ui/ModernTimePickerModal";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CreateAppointmentModalProps {
  open: boolean;
  onClose: () => void;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

type PatientSource = "app" | "guest";

export function CreateAppointmentModal({ open, onClose }: CreateAppointmentModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [patientSource, setPatientSource] = useState<PatientSource>("guest");

  /* App Patient Search State */
  const [appSearchQuery, setAppSearchQuery] = useState("");
  const [selectedAppPatient, setSelectedAppPatient] = useState<PatientSearchResult | null>(null);
  const [appSearchResults, setAppSearchResults] = useState<PatientSearchResult[]>([]);
  const [isSearchingApp, setIsSearchingApp] = useState(false);

  /* Guest Patient Search / Form State */
  const [guestSearchQuery, setGuestSearchQuery] = useState("");
  const [selectedGuestPatient, setSelectedGuestPatient] = useState<GuestPatientRow | null>(null);
  const [guestSearchResults, setGuestSearchResults] = useState<GuestPatientRow[]>([]);
  const [isSearchingGuest, setIsSearchingGuest] = useState(false);

  const [guestForm, setGuestForm] = useState<GuestPatientInput>({
    firstName: "",
    lastName: "",
    phone: "",
    dateOfBirth: "",
    notes: "",
  });

  /* Slot & Booking State */
  const [date, setDate] = useState(todayISO());
  const [selectedSlotId, setSelectedSlotId] = useState<string>("");
  const [type, setType] = useState<"IN_PERSON" | "VIDEO" | "HOME_VISIT">("IN_PERSON");
  const [paymentMethod, setPaymentMethod] = useState<"ON_SITE" | "CREDIT">("ON_SITE");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* Quick Slot Creation State */
  const [showQuickSlot, setShowQuickSlot] = useState(false);
  const [quickStartTime, setQuickStartTime] = useState("09:00");
  const [quickEndTime, setQuickEndTime] = useState("09:30");
  const [isCreatingQuickSlot, setIsCreatingQuickSlot] = useState(false);

  /* Fetch available slots */
  const { data: slots, isLoading: slotsLoading, refetch: refetchSlots } = useQuery({
    queryKey: qk.doctorSelf.slots(date),
    queryFn: () => doctorAppointmentsApi.slots.listByDate(date),
    enabled: open && !!date,
  });

  /* Debounced App Patient Search */
  useEffect(() => {
    if (patientSource !== "app" || appSearchQuery.trim().length < 1) {
      setAppSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingApp(true);
      try {
        const results = await doctorSelfApi.patients.search(appSearchQuery.trim());
        setAppSearchResults(results);
      } finally {
        setIsSearchingApp(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [appSearchQuery, patientSource]);

  /* Debounced Guest Patient Search */
  useEffect(() => {
    if (patientSource !== "guest" || guestSearchQuery.trim().length < 2) {
      setGuestSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingGuest(true);
      try {
        const results = await doctorSelfApi.guestPatients.search(guestSearchQuery.trim());
        setGuestSearchResults(results);
      } finally {
        setIsSearchingGuest(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [guestSearchQuery, patientSource]);

  if (!open) return null;

  const availableSlots = (slots || []).filter(
    (s: SlotRow) => String(s.status).toLowerCase() === "available"
  );

  const handleCreateQuickSlot = async () => {
    if (!date || !quickStartTime || !quickEndTime) return;
    setIsCreatingQuickSlot(true);
    try {
      const newSlot = await doctorAppointmentsApi.slots.quickCreate({
        date,
        startTime: quickStartTime,
        endTime: quickEndTime,
      });
      toast.success(`Quick slot created for ${quickStartTime}–${quickEndTime}`);
      void queryClient.invalidateQueries({ queryKey: qk.doctorSelf.slots(date) });
      await refetchSlots();
      setSelectedSlotId(newSlot.id);
      setShowQuickSlot(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to create quick slot");
    } finally {
      setIsCreatingQuickSlot(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlotId) {
      toast.error("Please select a slot for the appointment");
      return;
    }

    let patientId: string | undefined = undefined;
    let guestPatient: GuestPatientInput | undefined = undefined;

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
        if (!guestForm.firstName.trim() || !guestForm.lastName.trim() || !guestForm.phone.trim()) {
          toast.error("First name, last name, and phone are required for a walk-in patient");
          return;
        }
        guestPatient = {
          firstName: guestForm.firstName.trim(),
          lastName: guestForm.lastName.trim(),
          phone: guestForm.phone.trim(),
          dateOfBirth: guestForm.dateOfBirth || undefined,
          notes: guestForm.notes?.trim() || undefined,
        };
      }
    }

    setIsSubmitting(true);
    try {
      const createdAppt = await doctorAppointmentsApi.book({
        slotId: selectedSlotId,
        type,
        paymentMethod: patientSource === "guest" ? "ON_SITE" : paymentMethod,
        patientId,
        guestPatient,
        notes: notes.trim() || undefined,
      });

      void queryClient.invalidateQueries({ queryKey: qk.doctorSelf.appointmentsAll() });
      void queryClient.invalidateQueries({ queryKey: qk.doctorSelf.slots(date) });

      /* Auto-Confirm toast affordance */
      toast.success("Walk-in slot reserved successfully!", {
        description: "Appointment is currently PENDING.",
        duration: 8000,
        action: {
          label: "Confirm Now",
          onClick: async () => {
            try {
              await doctorAppointmentsApi.confirm(createdAppt.id);
              toast.success("Appointment CONFIRMED!");
              void queryClient.invalidateQueries({ queryKey: qk.doctorSelf.appointmentsAll() });
            } catch (err: any) {
              toast.error(err?.message || "Failed to confirm appointment");
            }
          },
        },
      });

      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to book appointment");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div
        className="glass w-full max-w-xl max-h-[90vh] overflow-y-auto custom-scrollbar rounded-3xl border border-border/40 bg-card p-6 shadow-2xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border/30">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary-500/10 text-primary-500">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Book Walk-In / Phone Appointment</h3>
              <p className="text-xs text-muted-foreground">Reserve and confirm a consultation directly on your schedule</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-xl hover:bg-muted/30 text-muted-foreground hover:text-foreground transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Step 1: Patient Source Segmented Control */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
              1. Patient Identification
            </label>

            <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-muted/30 border border-border/30">
              <button
                type="button"
                onClick={() => setPatientSource("guest")}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-xl py-2 px-3 text-xs font-bold transition",
                  patientSource === "guest"
                    ? "bg-primary-500 text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <UserPlus className="h-4 w-4" /> Walk-In / Phone (Guest)
              </button>
              <button
                type="button"
                onClick={() => setPatientSource("app")}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-xl py-2 px-3 text-xs font-bold transition",
                  patientSource === "app"
                    ? "bg-primary-500 text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <User className="h-4 w-4" /> Registered App Patient
              </button>
            </div>

            {/* Path A: App Patient Search */}
            {patientSource === "app" && (
              <div className="space-y-2 pt-1">
                {selectedAppPatient ? (
                  <div className="flex items-center justify-between p-3 rounded-2xl border border-primary-500/40 bg-primary-500/10">
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary-500 text-primary-foreground font-bold text-xs">
                        {(selectedAppPatient.firstName?.[0] || "P").toUpperCase()}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-foreground">
                          {selectedAppPatient.firstName} {selectedAppPatient.lastName}
                        </div>
                        <div className="text-[11px] text-muted-foreground font-mono">{selectedAppPatient.phone}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedAppPatient(null)}
                      className="text-xs text-primary-500 font-bold hover:underline"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute start-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search app patient by name or phone (min 2 chars)..."
                        value={appSearchQuery}
                        onChange={(e) => setAppSearchQuery(e.target.value)}
                        className="w-full rounded-xl border border-border/40 bg-muted/20 ps-9 pe-3 py-2 text-xs font-semibold outline-none focus:border-primary-500"
                      />
                      {isSearchingApp && <Loader2 className="absolute end-3 top-2.5 h-4 w-4 animate-spin text-primary-500" />}
                    </div>

                    {appSearchResults.length > 0 ? (
                      <div className="max-h-36 overflow-y-auto space-y-1 rounded-2xl border border-border/40 p-1.5 bg-card">
                        {appSearchResults.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setSelectedAppPatient(p)}
                            className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-muted/30 text-start text-xs transition"
                          >
                            <div>
                              <div className="font-bold text-foreground">{p.firstName} {p.lastName}</div>
                              {p.email && <div className="text-[10px] text-muted-foreground">{p.email}</div>}
                            </div>
                            <span className="text-muted-foreground font-mono">{p.phone || "—"}</span>
                          </button>
                        ))}
                      </div>
                    ) : appSearchQuery.trim().length > 0 && !isSearchingApp ? (
                      <div className="p-3 rounded-2xl bg-muted/20 border border-border/30 text-center text-xs text-muted-foreground">
                        No registered patient matches &quot;<span className="font-bold text-foreground">{appSearchQuery}</span>&quot;.
                        <div className="mt-1 text-[11px] text-primary-500 font-semibold cursor-pointer hover:underline" onClick={() => setPatientSource("guest")}>
                          Click here to create a Walk-In / Phone Guest Appointment instead.
                        </div>
                      </div>
                    ) : null}
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
                      className="text-xs text-primary-500 font-bold hover:underline"
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
                      <div className="max-h-32 overflow-y-auto space-y-1 rounded-2xl border border-primary-500/30 p-1.5 bg-card">
                        <div className="text-[10px] font-bold text-primary-500 uppercase px-2 py-1">
                          Existing Guest Matches — Click to Select:
                        </div>
                        {guestSearchResults.map((g) => (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => setSelectedGuestPatient(g)}
                            className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-primary-500/10 text-start text-xs transition"
                          >
                            <span className="font-bold text-foreground">{g.firstName} {g.lastName}</span>
                            <span className="text-muted-foreground font-mono">{g.phone}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Quick Inline Guest Form */}
                    <div className="grid grid-cols-2 gap-2 p-3 rounded-2xl border border-border/30 bg-muted/10 space-y-2">
                      <div className="col-span-2 text-[11px] font-bold text-muted-foreground uppercase flex items-center justify-between">
                        <span>Or enter new walk-in details:</span>
                      </div>
                      <div>
                        <input
                          type="text"
                          placeholder="First Name *"
                          value={guestForm.firstName}
                          onChange={(e) => setGuestForm((f) => ({ ...f, firstName: e.target.value }))}
                          className="w-full rounded-xl border border-border/40 bg-background px-3 py-1.5 text-xs font-semibold outline-none focus:border-primary-500"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          placeholder="Last Name *"
                          value={guestForm.lastName}
                          onChange={(e) => setGuestForm((f) => ({ ...f, lastName: e.target.value }))}
                          className="w-full rounded-xl border border-border/40 bg-background px-3 py-1.5 text-xs font-semibold outline-none focus:border-primary-500"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="tel"
                          placeholder="Phone Number (10 digits) *"
                          value={guestForm.phone}
                          onChange={(e) => setGuestForm((f) => ({ ...f, phone: e.target.value }))}
                          className="w-full rounded-xl border border-border/40 bg-background px-3 py-1.5 text-xs font-semibold outline-none focus:border-primary-500 font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Step 2: Date & Slot Picker */}
          <div className="space-y-2 pt-2 border-t border-border/30">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
              2. Select Date & Slot
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <ModernDatePickerModal
                  mode="single"
                  value={date}
                  onSelect={(d) => {
                    setDate(d);
                    setSelectedSlotId("");
                  }}
                  className="w-full"
                />
              </div>

              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setShowQuickSlot(!showQuickSlot)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-primary-500 hover:underline"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Instant Slot Creator
                </button>
              </div>
            </div>

            {/* Quick Slot Creation Panel */}
            {showQuickSlot && (
              <div className="p-3 rounded-2xl border border-primary-500/30 bg-primary-500/10 space-y-3">
                <div className="text-xs font-bold text-primary-500">Create an Ad-Hoc Slot for {date}:</div>
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
                    className="ms-auto inline-flex items-center gap-1 rounded-xl bg-primary-500 px-3.5 py-2 text-xs font-bold text-primary-foreground hover:bg-primary-600 transition disabled:opacity-50"
                  >
                    {isCreatingQuickSlot ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    Create Slot
                  </button>
                </div>
              </div>
            )}

            {/* Slots Grid */}
            {slotsLoading ? (
              <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading slots…
              </div>
            ) : availableSlots.length === 0 ? (
              <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4 text-center text-xs text-warning flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 font-bold">
                  <AlertCircle className="h-4 w-4" /> No available slots for {date}.
                </div>
                <button
                  type="button"
                  onClick={() => setShowQuickSlot(true)}
                  className="rounded-xl bg-primary-500 px-3.5 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary-600 transition"
                >
                  Create Instant Slot Now
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-36 overflow-y-auto p-1">
                {availableSlots.map((slot) => (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => setSelectedSlotId(slot.id)}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border p-2 text-xs font-bold font-mono transition ${
                      selectedSlotId === slot.id
                        ? "border-primary-500 bg-primary-500/15 text-primary-500 shadow-xs"
                        : "border-border/40 hover:bg-muted/20 text-foreground"
                    }`}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    {slot.startTime?.slice(0, 5)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Step 3: Type & Payment Details */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/30">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                Consultation Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full rounded-xl border border-border/40 bg-muted/20 px-3 py-2 text-xs font-semibold outline-none focus:border-primary-500"
              >
                <option value="IN_PERSON">In Person</option>
                <option value="VIDEO">Video Consultation</option>
                <option value="HOME_VISIT">Home Visit</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                Payment Method
              </label>
              <select
                value={patientSource === "guest" ? "ON_SITE" : paymentMethod}
                disabled={patientSource === "guest"}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full rounded-xl border border-border/40 bg-muted/20 px-3 py-2 text-xs font-semibold outline-none focus:border-primary-500 disabled:opacity-75"
              >
                <option value="ON_SITE">On Site (Cash / Card)</option>
                <option value="CREDIT">Platform Credit</option>
              </select>
              {patientSource === "guest" && (
                <span className="text-[10px] text-muted-foreground block mt-0.5">Guest bookings are always forced to On Site.</span>
              )}
            </div>

            <div className="col-span-2">
              <input
                type="text"
                placeholder="Additional notes / symptoms (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-xl border border-border/40 bg-muted/20 px-3 py-2 text-xs font-semibold outline-none focus:border-primary-500"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/30">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-border/40 px-4 py-2 text-xs font-bold hover:bg-muted/20 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedSlotId || isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary-500 px-5 py-2 text-xs font-bold text-primary-foreground shadow-md hover:bg-primary-600 transition disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Reserve Appointment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
