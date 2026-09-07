import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
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
  CalendarRange,
  Filter,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Users,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { format } from "date-fns";
import { clinicAppointmentsApi, type ClinicAppointmentRow, type DoctorSlot } from "@/api/clinicAppointmentsApi";
import { clinicSelfApi, type ClinicRoom } from "@/api/clinicSelfApi";
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
import { DayHourHeatmap } from "@/components/data/DayHourHeatmap";
import { DoctorSelectorModal, type DoctorCardItem } from "@/components/doctors/DoctorSelectorModal";
import { ModernDatePickerModal } from "@/components/ui/ModernDatePickerModal";
import { KPICard } from "@/components/overview/KPICard";

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
  maxPatients: z.coerce.number().min(1).default(1),
});

const cancelDateSchema = z.object({
  date: z.string().min(1, "Date is required"),
  reason: z.string().optional(),
});

type GenerateFormData = z.infer<typeof generateSchema>;
type QuickSlotFormData = z.infer<typeof quickSlotSchema>;
type CancelDateFormData = z.infer<typeof cancelDateSchema>;

export default function SchedulePage() {
  const { t } = useTranslation();
  const { acceptedDoctors } = useClinicDoctors();
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [rangeFilter, setRangeFilter] = useState<"all" | "available" | "full" | "cancelled">("all");
  const [doctorSelectorOpen, setDoctorSelectorOpen] = useState(false);

  // Modals
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [quickSlotModalOpen, setQuickSlotModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);

  // Rooms
  const { data: rawRooms } = useQuery({
    queryKey: qk.clinicSelf.rooms(),
    queryFn: clinicSelfApi.getRooms,
  });

  const { data: appointmentsData } = useQuery({
    queryKey: qk.clinicSelf.appointments({ limit: 100 }),
    queryFn: () => clinicAppointmentsApi.listAppointments({ limit: 100 }),
  });

  const rooms: ClinicRoom[] = ensureArray<ClinicRoom>(rawRooms);
  const appointments: ClinicAppointmentRow[] = ensureArray<ClinicAppointmentRow>(appointmentsData?.data);

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
        name: `${t("doctors.doctorPrefix", { defaultValue: "د." })} ${name}`,
        specialty: spec,
        photoUrl: d?.avatarUrl || d?.photoUrl,
        email: d?.email,
        phone: d?.phone,
        yearsOfExp: d?.yearsOfExp,
        status: doc.status,
        raw: doc,
      };
    }), [acceptedDoctors, t]);

  // Effective doctor ID
  const activeDoctorId = selectedDoctorId || acceptedDoctors[0]?.doctorId || "";
  const selectedDoctorCard = doctorCardItems.find((d) => d.doctorId === activeDoctorId);

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
    successMessage: t("schedule.batchSuccess", { defaultValue: "تم توليد فترات الحجز بنجاح" }),
    onSuccess: () => {
      setGenerateModalOpen(false);
      generateForm.reset();
    },
  });

  const quickSlotMutation = useEntityMutation({
    mutationFn: (data: QuickSlotFormData) =>
      clinicAppointmentsApi.addQuickDoctorSlot(activeDoctorId, data),
    invalidate: [qk.clinicSelf.all()],
    successMessage: t("schedule.quickSuccess", { defaultValue: "تم إضافة الفترة بنجاح" }),
    onSuccess: () => {
      setQuickSlotModalOpen(false);
      quickSlotForm.reset();
    },
  });

  const cancelDateMutation = useEntityMutation({
    mutationFn: (data: CancelDateFormData) =>
      clinicAppointmentsApi.cancelDoctorSlotsDate(activeDoctorId, data),
    invalidate: [qk.clinicSelf.all()],
    successMessage: t("schedule.cancelSuccess", { defaultValue: "تم إلغاء الفترات لهذا التاريخ" }),
    onSuccess: () => {
      setCancelModalOpen(false);
      cancelDateForm.reset();
    },
  });

  // Stats calculation
  const stats = useMemo(() => {
    const total = slots.length;
    const available = slots.filter((s) => String(s.status).toLowerCase() === "available").length;
    const booked = slots.filter((s) => String(s.status).toLowerCase() === "booked" || String(s.status).toLowerCase() === "full").length;
    const cancelled = slots.filter((s) => String(s.status).toLowerCase() === "cancelled").length;
    return { total, available, booked, cancelled };
  }, [slots]);

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("schedule.title", { defaultValue: "جدول الأطباء والفترات الزمنية" })}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("schedule.subtitle", { defaultValue: "توليد وضبط فترات الحجز المتاحة للمرضى وساعات العمل" })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setQuickSlotModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary-500 px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:opacity-90 transition cursor-pointer"
          >
            <Zap className="h-3.5 w-3.5" /> {t("schedule.quickSlotButton", { defaultValue: "فترة سريعة" })}
          </button>

          <button
            onClick={() => setGenerateModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl glass border border-border/60 px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-accent transition cursor-pointer"
          >
            <CalendarRange className="h-3.5 w-3.5 text-primary-500" /> {t("schedule.batchGenerateButton", { defaultValue: "توليد فترات زمنية تلقائية" })}
          </button>

          <button
            onClick={() => setCancelModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl glass border border-border/60 px-3 py-2 text-xs font-semibold text-danger hover:bg-danger/10 transition cursor-pointer"
            title={t("schedule.cancelSlot", { defaultValue: "إلغاء الفترة" })}
          >
            <Ban className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Main KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label={t("schedule.totalSlots", { defaultValue: "إجمالي الفترات هذا اليوم" })}
          value={stats.total}
          subLabel={`${t("filters.date", { defaultValue: "التاريخ" })}: ${selectedDate}`}
          delta={stats.total}
          tone="primary"
        />
        <KPICard
          label={t("schedule.availableSlots", { defaultValue: "فترات متاحة للحجز" })}
          value={stats.available}
          subLabel="متاحة لحجز المرضى"
          delta={stats.available}
          tone="success"
        />
        <KPICard
          label={t("schedule.bookedSlots", { defaultValue: "فترات محجوزة" })}
          value={stats.booked}
          subLabel="مواعيد مؤكدة للمرضى"
          delta={stats.booked}
          tone="info"
        />
        <KPICard
          label={t("status.CANCELLED", { defaultValue: "ملغى" })}
          value={stats.cancelled}
          subLabel="فترات غير متاحة"
          delta={stats.cancelled}
          tone="warning"
        />
      </div>

      {/* 3. Filter Bar (Aligned with Appointments Filter Bar) */}
      <GlassCard className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
            <Filter className="h-4 w-4 text-primary-500" />
            <span>{t("filters.open", { defaultValue: "تصفية وتنقيب" })}</span>
          </div>

          {/* Doctor Selector */}
          <button
            onClick={() => setDoctorSelectorOpen(true)}
            className="inline-flex items-center gap-2 glass rounded-xl px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-accent transition cursor-pointer"
          >
            <Stethoscope className="h-3.5 w-3.5 text-primary-500" />
            {selectedDoctorCard ? selectedDoctorCard.name : t("doctors.selectorTitle", { defaultValue: "اختيار الطبيب المعالج" })}
            <ChevronRight className="h-3 w-3 text-muted-foreground rtl:rotate-180" />
          </button>

          {/* Single Date Selector */}
          <ModernDatePickerModal
            mode="single"
            value={selectedDate}
            onSelect={(d) => setSelectedDate(d)}
          />

          {/* Filter Reset */}
          {(selectedDoctorId || selectedDate !== format(new Date(), "yyyy-MM-dd")) && (
            <button
              onClick={() => {
                setSelectedDoctorId("");
                setSelectedDate(format(new Date(), "yyyy-MM-dd"));
              }}
              className="inline-flex items-center gap-1 text-xs text-primary-500 font-bold hover:underline cursor-pointer ms-auto"
            >
              <RotateCcw className="h-3 w-3" /> {t("filters.reset", { defaultValue: "إعادة تعيين" })}
            </button>
          )}
        </div>
      </GlassCard>

      {/* 4. Day × Hour Utilization Heatmap */}
      <DayHourHeatmap
        data={[]}
        rawData={appointments}
        getDate={(a) => a.slot?.date || a.createdAt}
        getTime={(a) => a.slot?.startTime}
        getStatus={(a) => a.status}
        hourBlocks={8}
        title={t("dashboard.optimalBookingTitle", { defaultValue: "أفضل أوقات حجز المواعيد" })}
        subtitle={t("dashboard.optimalBookingSub", { defaultValue: "المخطط الحراري لأوقات ذروة طلب المواعيد من المرضى" })}
        tone="primary"
      />

      {/* 5. Schedule Visualizer & Slot Inspector Grid */}
      {isSlotsLoading ? (
        <Skeleton className="h-80 w-full rounded-3xl" />
      ) : (
        <ScheduleVisualizer
          slots={slots}
          selectedDate={selectedDate}
          doctorName={selectedDoctorCard?.name || t("doctors.doctorPrefix", { defaultValue: "د." })}
          onSelectSlot={(slot) => {
            // Optional slot selection callback
          }}
        />
      )}

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

      {/* Quick Slot Modal */}
      <FormModal
        id="quick-slot-modal"
        open={quickSlotModalOpen}
        onClose={() => setQuickSlotModalOpen(false)}
        title={t("schedule.quickSlotButton", { defaultValue: "إضافة فترة حجز سريعة" })}
        description={t("schedule.quickSlotDesc", { defaultValue: "إنشاء فترة استشارة فورية للطبيب المحدد" })}
      >
        <form onSubmit={quickSlotForm.handleSubmit((d) => quickSlotMutation.mutate(d))} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("filters.date", { defaultValue: "التاريخ" })}*</label>
            <input
              type="date"
              {...quickSlotForm.register("date")}
              className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("schedule.startTime", { defaultValue: "وقت البداية" })}*</label>
              <input
                type="time"
                {...quickSlotForm.register("startTime")}
                className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("schedule.endTime", { defaultValue: "وقت النهاية" })}*</label>
              <input
                type="time"
                {...quickSlotForm.register("endTime")}
                className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("rooms.title", { defaultValue: "قاعة الفحص" })} ({t("common.optional", { defaultValue: "اختياري" })})</label>
            <select
              {...quickSlotForm.register("roomId")}
              className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40 bg-background text-foreground"
            >
              <option value="">{t("rooms.generalPurpose", { defaultValue: "استخدام عام / كافة القاعات" })}</option>
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
              {t("common.cancel", { defaultValue: "إلغاء" })}
            </button>
            <button
              type="submit"
              disabled={quickSlotMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              {quickSlotMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {t("common.create", { defaultValue: "إضافة جديد" })}
            </button>
          </div>
        </form>
      </FormModal>

      {/* Batch Generate Slots Modal */}
      <FormModal
        id="batch-generate-modal"
        open={generateModalOpen}
        onClose={() => setGenerateModalOpen(false)}
        title={t("schedule.batchModalTitle", { defaultValue: "توليد فترات حجز جماعية للأطباء" })}
        description={t("schedule.batchDesc", { defaultValue: "توليد فترات الاستشارة تلقائيًا للفترة الزمنية المحددة" })}
      >
        <form onSubmit={generateForm.handleSubmit((d) => generateSlotsMutation.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("schedule.startDate", { defaultValue: "تاريخ البداية" })}*</label>
              <input
                type="date"
                {...generateForm.register("startDate")}
                className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("schedule.endDate", { defaultValue: "تاريخ النهاية" })}*</label>
              <input
                type="date"
                {...generateForm.register("endDate")}
                className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("rooms.title", { defaultValue: "قاعة الفحص" })} ({t("common.optional", { defaultValue: "اختياري" })})</label>
            <select
              {...generateForm.register("roomId")}
              className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40 bg-background text-foreground"
            >
              <option value="">{t("rooms.generalPurpose", { defaultValue: "استخدام عام / كافة القاعات" })}</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <input
              type="checkbox"
              {...generateForm.register("force")}
              className="rounded text-primary-500 focus:ring-primary-500 h-4 w-4"
            />
            <span className="text-xs font-bold text-foreground">{t("schedule.overwriteSlots", { defaultValue: "إعادة كتابة الفترات غير المحجوزة" })}</span>
          </label>

          <div className="pt-4 border-t border-border/40 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setGenerateModalOpen(false)}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent cursor-pointer"
            >
              {t("common.cancel", { defaultValue: "إلغاء" })}
            </button>
            <button
              type="submit"
              disabled={generateSlotsMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              {generateSlotsMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {t("schedule.batchGenerateButton", { defaultValue: "توليد فترات زمنية تلقائية" })}
            </button>
          </div>
        </form>
      </FormModal>

      {/* Cancel Slots Date Modal */}
      <FormModal
        id="cancel-date-modal"
        open={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        title={t("schedule.cancelSlotsTitle", { defaultValue: "إلغاء جميع الفترات لهذا اليوم" })}
        description={t("schedule.cancelSlotsDesc", { defaultValue: "تعليم جميع الفترات الغير محجوزة كملغاة لهذا اليوم" })}
      >
        <form onSubmit={cancelDateForm.handleSubmit((d) => cancelDateMutation.mutate(d))} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("filters.date", { defaultValue: "التاريخ" })}*</label>
            <input
              type="date"
              {...cancelDateForm.register("date")}
              className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("schedule.cancelReason", { defaultValue: "سبب الإلغاء (اختياري)" })}</label>
            <input
              type="text"
              {...cancelDateForm.register("reason")}
              placeholder={t("schedule.reasonPlaceholder", { defaultValue: "مثال: عطلة طارئة للطبيب / عطلة رسمية" })}
              className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
            />
          </div>

          <div className="pt-4 border-t border-border/40 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCancelModalOpen(false)}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent cursor-pointer"
            >
              {t("common.cancel", { defaultValue: "إلغاء" })}
            </button>
            <button
              type="submit"
              disabled={cancelDateMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-danger px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              {cancelDateMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {t("schedule.cancelSlot", { defaultValue: "إلغاء الفترة" })}
            </button>
          </div>
        </form>
      </FormModal>
    </div>
  );
}

