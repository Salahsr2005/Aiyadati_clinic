import { useState } from "react";
import { useQuery } from "@/lib/queryClient";
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
} from "lucide-react";
import { format } from "date-fns";
import { clinicAppointmentsApi } from "@/api/clinicAppointmentsApi";
import { clinicSelfApi } from "@/api/clinicSelfApi";
import { useClinicDoctors } from "@/hooks/useClinicDoctors";
import { qk } from "@/lib/queryKeys";
import { useEntityMutation } from "@/lib/mutations";
import { ensureArray } from "@/lib/utils";
import { GlassCard } from "@/components/glass/GlassCard";
import { RemoteImage } from "@/components/common/RemoteImage";
import { FormModal } from "@/components/data/FormModal";
import { EmptyState } from "@/components/data/EmptyState";
import { Skeleton } from "@/components/glass/Skeleton";
import { ScheduleVisualizer } from "@/components/schedule/ScheduleVisualizer";
import { DateRangeInspector } from "@/components/schedule/DateRangeInspector";
import type { ClinicRoom, DoctorSlot } from "@/api/clinicSelfApi";

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
  maxPatients: z.coerce.number().min(1).optional().default(1),
});

const cancelDateSchema = z.object({
  date: z.string().min(1, "Date is required"),
  reason: z.string().optional(),
});

type GenerateFormData = z.infer<typeof generateSchema>;
type QuickSlotFormData = z.infer<typeof quickSlotSchema>;
type CancelDateFormData = z.infer<typeof cancelDateSchema>;

export default function SchedulePage() {
  const { acceptedDoctors } = useClinicDoctors();
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [rangeFilter, setRangeFilter] = useState<"all" | "available" | "full" | "cancelled">("all");

  // Modals
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [quickSlotModalOpen, setQuickSlotModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);

  // Rooms
  const { data: rawRooms } = useQuery({
    queryKey: qk.clinicSelf.rooms(),
    queryFn: clinicSelfApi.getRooms,
  });

  const rooms: ClinicRoom[] = ensureArray<ClinicRoom>(rawRooms);

  // Effective doctor ID
  const activeDoctorId = selectedDoctorId || acceptedDoctors[0]?.doctorId || "";

  // Slots query for selected doctor
  const { data: rawSlots, isLoading: isSlotsLoading } = useQuery({
    queryKey: qk.clinicSelf.doctorSlots(activeDoctorId, { date: selectedDate }),
    queryFn: () =>
      activeDoctorId
        ? clinicAppointmentsApi.getDoctorSlots(activeDoctorId, { date: selectedDate })
        : Promise.resolve([]),
    enabled: !!activeDoctorId,
  });

  const slots: DoctorSlot[] = ensureArray<DoctorSlot>(rawSlots);

  // Forms
  const generateForm = useForm<GenerateFormData>({
    resolver: zodResolver(generateSchema),
    defaultValues: {
      startDate: format(new Date(), "yyyy-MM-dd"),
      endDate: format(new Date(), "yyyy-MM-dd"),
      force: false,
    },
  });

  const quickSlotForm = useForm<QuickSlotFormData>({
    resolver: zodResolver(quickSlotSchema),
    defaultValues: {
      date: format(new Date(), "yyyy-MM-dd"),
      startTime: "09:00",
      endTime: "09:30",
      maxPatients: 1,
    },
  });

  const cancelDateForm = useForm<CancelDateFormData>({
    resolver: zodResolver(cancelDateSchema),
    defaultValues: {
      date: format(new Date(), "yyyy-MM-dd"),
      reason: "",
    },
  });

  // Mutations
  const generateSlotsMutation = useEntityMutation({
    mutationFn: (data: GenerateFormData) =>
      clinicAppointmentsApi.generateDoctorSlots(activeDoctorId, data),
    invalidate: [qk.clinicSelf.all()],
    successMessage: "Slots batch generated successfully",
    onSuccess: () => {
      setGenerateModalOpen(false);
      generateForm.reset();
    },
  });

  const quickSlotMutation = useEntityMutation({
    mutationFn: (data: QuickSlotFormData) =>
      clinicAppointmentsApi.addQuickDoctorSlot(activeDoctorId, data),
    invalidate: [qk.clinicSelf.all()],
    successMessage: "Ad-hoc slot added successfully",
    onSuccess: () => {
      setQuickSlotModalOpen(false);
      quickSlotForm.reset();
    },
  });

  const cancelDateMutation = useEntityMutation({
    mutationFn: (data: CancelDateFormData) =>
      clinicAppointmentsApi.cancelDoctorSlotsDate(activeDoctorId, data),
    invalidate: [qk.clinicSelf.all()],
    successMessage: "Slots on date cancelled",
    onSuccess: () => {
      setCancelModalOpen(false);
      cancelDateForm.reset();
    },
  });

  const selectedDoctorInfo = acceptedDoctors.find((d) => d.doctorId === activeDoctorId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Doctor Slots & Schedule</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage consultation slots for your affiliated doctors
          </p>
        </div>

        {activeDoctorId && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setGenerateModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary-500 px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition cursor-pointer"
            >
              <Zap className="h-3.5 w-3.5" /> Batch Generate
            </button>

            <button
              onClick={() => setQuickSlotModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl glass border border-border/60 px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-accent transition cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" /> Quick Slot
            </button>

            <button
              onClick={() => setCancelModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-danger/15 px-3.5 py-2 text-xs font-semibold text-danger hover:bg-danger/25 transition cursor-pointer"
            >
              <Ban className="h-3.5 w-3.5" /> Cancel Date
            </button>
          </div>
        )}
      </div>

      {/* Doctor Selector & Date Filter Controls */}
      <GlassCard className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Stethoscope className="h-5 w-5 text-primary-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
              Select Affiliated Doctor
            </label>
            <select
              value={activeDoctorId}
              onChange={(e) => setSelectedDoctorId(e.target.value)}
              className="glass w-full rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-primary-500/40 bg-background text-foreground"
            >
              {acceptedDoctors.length === 0 ? (
                <option value="">No active affiliated doctors found</option>
              ) : (
                acceptedDoctors.map((doc) => (
                  <option key={doc.doctorId} value={doc.doctorId}>
                    Dr. {doc.doctor?.firstName || ""} {doc.doctor?.lastName || doc.doctor?.name || "Doctor"} — {doc.doctor?.specialtyName || "Specialist"}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <CalendarIcon className="h-4 w-4 text-primary-500 shrink-0" />
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
              Schedule Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="glass rounded-xl px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-primary-500/40"
            />
          </div>
        </div>
      </GlassCard>

      {/* Doctor Info Card */}
      {selectedDoctorInfo && (
        <GlassCard className="p-4 flex items-center justify-between bg-primary-500/5 border-primary-500/20">
          <div className="flex items-center gap-3">
            <RemoteImage
              src={selectedDoctorInfo.doctor?.avatarUrl || selectedDoctorInfo.doctor?.photoUrl}
              alt={selectedDoctorInfo.doctor?.name || "Doctor"}
              className="h-10 w-10 rounded-full object-cover"
            />
            <div>
              <h3 className="text-xs font-bold">
                Dr. {selectedDoctorInfo.doctor?.firstName || ""} {selectedDoctorInfo.doctor?.lastName || selectedDoctorInfo.doctor?.name || "Doctor"}
              </h3>
              <p className="text-[11px] text-muted-foreground">
                {selectedDoctorInfo.doctor?.specialtyName || "Specialist"}
              </p>
            </div>
          </div>

          <div className="text-end">
            <span className="text-xs font-bold text-primary-500">{slots.length} Slots</span>
            <div className="text-[10px] text-muted-foreground">For {selectedDate}</div>
          </div>
        </GlassCard>
      )}

      {/* Visual Timeline Inspector */}
      {activeDoctorId && (
        <GlassCard className="p-5">
          <ScheduleVisualizer slots={slots} selectedDate={selectedDate} />
        </GlassCard>
      )}

      {/* Date Range Inspector Matrix */}
      {activeDoctorId && (
        <GlassCard className="p-5 border border-border/40 space-y-4">
          <DateRangeInspector
            startDate={selectedDate}
            endDate={selectedDate}
            onRangeChange={(start) => setSelectedDate(start)}
            slotsByDate={{ [selectedDate]: slots }}
            isLoading={isSlotsLoading}
            filter={rangeFilter}
            onFilterChange={setRangeFilter}
            onCancelDate={(d) => cancelDateMutation.mutate({ date: d })}
            onRemoveSlot={(slotId) => {
              // Delete slot trigger
            }}
          />
        </GlassCard>
      )}

      {/* Slots Grid Visualizer */}
      {!activeDoctorId ? (
        <EmptyState
          title="No doctor selected"
          description="Invite or select an affiliated doctor to manage their slot calendar."
        />
      ) : isSlotsLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      ) : slots.length === 0 ? (
        <EmptyState
          title="No slots generated for this date"
          description="Use 'Batch Generate' or 'Quick Slot' above to populate availability for this doctor."
          action={
            <button
              onClick={() => setGenerateModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 cursor-pointer"
            >
              <Zap className="h-4 w-4" /> Batch Generate Slots
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {slots.map((slot) => (
            <GlassCard
              key={slot.id}
              className={`p-3 text-center space-y-1 transition ${
                slot.isCancelled
                  ? "opacity-50 bg-danger/10 border-danger/30"
                  : slot.isBooked
                    ? "bg-primary-500/15 border-primary-500/30"
                    : "hover:border-primary-500/50"
              }`}
            >
              <div className="flex items-center justify-center gap-1 text-xs font-bold">
                <Clock className="h-3 w-3 text-primary-500" />
                <span>{slot.startTime}</span>
              </div>
              <div className="text-[10px] text-muted-foreground">{slot.endTime}</div>

              <span
                className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-bold ${
                  slot.isCancelled
                    ? "bg-danger/20 text-danger"
                    : slot.isBooked
                      ? "bg-primary-500 text-primary-foreground"
                      : "bg-success/20 text-success"
                }`}
              >
                {slot.isCancelled ? "Cancelled" : slot.isBooked ? "Booked" : "Available"}
              </span>

              {slot.room && (
                <div className="text-[9px] text-muted-foreground truncate flex items-center justify-center gap-0.5 pt-0.5">
                  <DoorOpen className="h-2.5 w-2.5" />
                  {slot.room.name}
                </div>
              )}
            </GlassCard>
          ))}
        </div>
      )}

      {/* Batch Slot Generation Modal */}
      <FormModal
        id="generate-slots-modal"
        open={generateModalOpen}
        onClose={() => setGenerateModalOpen(false)}
        title="Batch Generate Doctor Slots"
        description="Generate standard consultation slots for a date range based on doctor weekly schedule"
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
            <label className="text-sm font-medium">Assign Physical Room (Optional)</label>
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

          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
            <input
              type="checkbox"
              {...generateForm.register("force")}
              className="h-4 w-4 rounded border-border text-primary-500"
            />
            Overwrite existing unbooked slots
          </label>

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
              Generate Slots Range
            </button>
          </div>
        </form>
      </FormModal>

      {/* Quick Ad-hoc Slot Modal */}
      <FormModal
        id="quick-slot-modal"
        open={quickSlotModalOpen}
        onClose={() => setQuickSlotModalOpen(false)}
        title="Add Quick Ad-hoc Slot"
        description="Add a single specific slot time for this doctor"
      >
        <form onSubmit={quickSlotForm.handleSubmit((d) => quickSlotMutation.mutate(d))} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Date*</label>
            <input
              type="date"
              {...quickSlotForm.register("date")}
              className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Start Time*</label>
              <input
                type="time"
                {...quickSlotForm.register("startTime")}
                className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">End Time*</label>
              <input
                type="time"
                {...quickSlotForm.register("endTime")}
                className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Physical Room (Optional)</label>
            <select
              {...quickSlotForm.register("roomId")}
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
              onClick={() => setQuickSlotModalOpen(false)}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={quickSlotMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              {quickSlotMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Add Slot
            </button>
          </div>
        </form>
      </FormModal>

      {/* Cancel Date Slots Modal */}
      <FormModal
        id="cancel-slots-modal"
        open={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        title="Cancel All Slots on Date"
        description="Cancel all consultation slots for this doctor on a given day"
      >
        <form onSubmit={cancelDateForm.handleSubmit((d) => cancelDateMutation.mutate(d))} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Date to Cancel*</label>
            <input
              type="date"
              {...cancelDateForm.register("date")}
              className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Reason for Cancellation</label>
            <textarea
              {...cancelDateForm.register("reason")}
              rows={2}
              placeholder="e.g. Emergency doctor absence"
              className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
            />
          </div>

          <div className="pt-4 border-t border-border/40 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCancelModalOpen(false)}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent cursor-pointer"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={cancelDateMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-danger px-4 py-2 text-xs font-semibold text-danger-foreground hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              {cancelDateMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Cancel Date Slots
            </button>
          </div>
        </form>
      </FormModal>
    </div>
  );
}
