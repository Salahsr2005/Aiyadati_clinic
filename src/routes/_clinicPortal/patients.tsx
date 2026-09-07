import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Users,
  Plus,
  Search,
  Edit2,
  Loader2,
  Phone,
  Mail,
  Calendar,
  FileText,
  Clock,
  ChevronRight,
  UserCheck,
  StickyNote,
  Filter,
  RotateCcw,
  X,
  UserPlus,
  ShieldCheck,
  History,
  FolderOpen,
} from "lucide-react";
import { clinicAppointmentsApi, type GuestPatient, type ClinicAppointmentRow } from "@/api/clinicAppointmentsApi";
import { qk } from "@/lib/queryKeys";
import { useEntityMutation } from "@/lib/mutations";
import { ensureArray } from "@/lib/utils";
import { GlassCard } from "@/components/glass/GlassCard";
import { FormModal } from "@/components/data/FormModal";
import { EmptyState } from "@/components/data/EmptyState";
import { Skeleton } from "@/components/glass/Skeleton";
import { StatusBadge } from "@/components/data/StatusBadge";
import { Drawer } from "@/components/data/Drawer";
import { Pagination } from "@/components/data/Pagination";
import { MedicalDocsDrawer } from "@/components/patients/MedicalDocsDrawer";

const patientSchema = z.object({
  firstName: z.string().min(2, "First name is required"),
  lastName: z.string().min(2, "Last name is required"),
  phone: z.string().regex(/^\d{10,15}$/, "Phone number must be 10-15 digits"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  dateOfBirth: z.string().optional(),
  notes: z.string().optional(),
});

type PatientFormData = z.infer<typeof patientSchema>;

export default function PatientsPage() {
  const { t } = useTranslation();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<GuestPatient | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<GuestPatient | null>(null);
  const [docsModalPatient, setDocsModalPatient] = useState<{ id: string; name: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  const { data: paginatedData, isLoading } = useQuery({
    queryKey: qk.clinicSelf.guestPatients({ page, search: searchQuery }),
    queryFn: () => clinicAppointmentsApi.listGuestPatients({ page, limit: 12, search: searchQuery }),
  });

  const { data: appointmentsData } = useQuery({
    queryKey: qk.clinicSelf.appointments({ limit: 100 }),
    queryFn: () => clinicAppointmentsApi.listAppointments({ limit: 100 }),
  });

  const patients = paginatedData?.data ?? [];
  const totalCount = paginatedData?.total ?? patients.length;
  const totalPages = paginatedData?.totalPages ?? 1;
  const appointments: ClinicAppointmentRow[] = ensureArray<ClinicAppointmentRow>(appointmentsData?.data);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema),
  });

  const createMutation = useEntityMutation({
    mutationFn: (payload: PatientFormData) => clinicAppointmentsApi.createGuestPatient(payload),
    invalidate: [qk.clinicSelf.guestPatients()],
    successMessage: t("patients.createSuccess", { defaultValue: "Guest patient registered successfully" }),
    onSuccess: () => {
      setModalOpen(false);
      reset();
    },
  });

  const updateMutation = useEntityMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<GuestPatient> }) =>
      clinicAppointmentsApi.updateGuestPatient(id, payload),
    invalidate: [qk.clinicSelf.guestPatients()],
    successMessage: t("patients.updateSuccess", { defaultValue: "Patient details updated" }),
    onSuccess: () => {
      setModalOpen(false);
      setEditingPatient(null);
      reset();
    },
  });

  const openCreateModal = () => {
    setEditingPatient(null);
    reset({
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
      dateOfBirth: "",
      notes: "",
    });
    setModalOpen(true);
  };

  const openEditModal = (patient: GuestPatient) => {
    setEditingPatient(patient);
    reset({
      firstName: patient.firstName,
      lastName: patient.lastName,
      phone: patient.phone,
      email: patient.email || "",
      dateOfBirth: patient.dateOfBirth || "",
      notes: patient.notes || "",
    });
    setModalOpen(true);
  };

  const onSubmit = (data: PatientFormData) => {
    if (editingPatient) {
      updateMutation.mutate({ id: editingPatient.id, payload: data });
    } else {
      createMutation.mutate(data);
    }
  };

  // Compute patient appointment history for inspector drawer
  const patientAppointments = useMemo(() => {
    if (!selectedPatient) return [];
    return appointments.filter(
      (a) =>
        a.guestPatientId === selectedPatient.id ||
        a.guestPatient?.id === selectedPatient.id ||
        (a.guestPatient?.phone && a.guestPatient.phone === selectedPatient.phone)
    );
  }, [selectedPatient, appointments]);

  // Statistics
  const stats = useMemo(() => {
    const total = totalCount;
    const withNotes = patients.filter((p) => p.notes && p.notes.trim().length > 0).length;
    const withEmail = patients.filter((p) => p.email && p.email.trim().length > 0).length;
    const withAppts = patients.filter((p) =>
      appointments.some((a) => a.guestPatientId === p.id || a.guestPatient?.phone === p.phone)
    ).length;

    return { total, withNotes, withEmail, withAppts };
  }, [patients, totalCount, appointments]);

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("patients.title", { defaultValue: "سجل المرضى والزوار" })}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("patients.subtitle", { defaultValue: "متابعة بيانات المرضى المباشرين والزوار المسجلين بالعيادة" })}
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-xs transition hover:opacity-90 cursor-pointer self-start sm:self-auto"
        >
          <UserPlus className="h-4 w-4" />
          {t("patients.createGuestButton", { defaultValue: "حجز مريض زائر جديد" })}
        </button>
      </div>

      {/* 2. Mini Statistics Strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <GlassCard className="p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary-500/15 text-primary-500 grid place-items-center font-bold">
              <Users className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("patients.guestPatients", { defaultValue: "مرضى زوار بالعيادة" })}
              </div>
              <div className="text-base font-bold">{stats.total}</div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-success/15 text-success grid place-items-center font-bold">
              <UserCheck className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("patients.totalVisits", { defaultValue: "إجمالي الزيارات والمواعيد" })}
              </div>
              <div className="text-base font-bold text-success">{stats.withAppts}</div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-info/15 text-info grid place-items-center font-bold">
              <Mail className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("common.email", { defaultValue: "البريد الإلكتروني" })}
              </div>
              <div className="text-base font-bold">{stats.withEmail}</div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-warning/15 text-warning grid place-items-center font-bold">
              <StickyNote className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("patients.medicalNotes", { defaultValue: "الملاحظات الطبية" })}
              </div>
              <div className="text-base font-bold">{stats.withNotes}</div>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* 3. Search & Filter Bar */}
      <GlassCard className="p-4 flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute start-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder={t("patients.searchPlaceholder", { defaultValue: "البحث باسم المريض أو رقم الهاتف..." })}
            className="glass w-full rounded-xl ps-8 pe-8 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-primary-500/40"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery("");
                setPage(1);
              }}
              className="absolute end-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {searchQuery && (
          <button
            onClick={() => {
              setSearchQuery("");
              setPage(1);
            }}
            className="inline-flex items-center gap-1 text-xs text-primary-500 font-bold hover:underline cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" /> {t("filters.reset", { defaultValue: "إعادة تعيين" })}
          </button>
        )}
      </GlassCard>

      {/* 4. Patients Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-44 w-full rounded-2xl" />
          ))}
        </div>
      ) : patients.length === 0 ? (
        <EmptyState
          title={searchQuery ? t("common.empty", { defaultValue: "لا توجد سجّلات متاحة حاليًا" }) : t("patients.emptyTitle", { defaultValue: "لا يوجد مرضى زوار مسجلين حتى الآن" })}
          description={
            searchQuery
              ? t("filters.clear", { defaultValue: "جرب تعديل كلمات البحث." })
              : t("patients.emptySub", { defaultValue: "قم بحجز المريض الزائر لمتابعة مواعيده ورسائله بالعيادة." })
          }
          action={
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 cursor-pointer"
            >
              <Plus className="h-4 w-4" /> {t("patients.createGuestButton", { defaultValue: "حجز مريض زائر جديد" })}
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {patients.map((patient) => {
            const initials = `${patient.firstName?.[0] || ""}${patient.lastName?.[0] || ""}`.toUpperCase() || "P";
            const apptCount = appointments.filter(
              (a) => a.guestPatientId === patient.id || a.guestPatient?.phone === patient.phone
            ).length;

            return (
              <GlassCard
                key={patient.id}
                onClick={() => setSelectedPatient(patient)}
                className="p-5 flex flex-col justify-between space-y-4 hover:bg-accent/40 transition cursor-pointer group border border-border/40"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative h-11 w-11 rounded-full bg-primary-500/15 text-primary-500 font-bold grid place-items-center text-sm shrink-0 border border-primary-500/30">
                        {initials}
                        <span className="absolute -top-0.5 -end-0.5 h-4 w-4 rounded-full bg-primary-500 text-primary-foreground text-[9px] font-extrabold grid place-items-center border border-card">
                          G
                        </span>
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-foreground truncate group-hover:text-primary-500 transition">
                          {patient.firstName} {patient.lastName}
                        </h3>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                          <Phone className="h-3 w-3 text-primary-500 shrink-0" />
                          <span className="font-mono">{patient.phone}</span>
                        </div>
                      </div>
                    </div>

                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-bold text-amber-600 uppercase">{t("patients.guestTag", { defaultValue: "مريض زائر" })}</span>
                  </div>

                  {patient.email && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-3 truncate">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{patient.email}</span>
                    </div>
                  )}

                  {patient.dateOfBirth && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span>{t("patients.dob", { defaultValue: "تاريخ الميلاد" })}: {patient.dateOfBirth}</span>
                    </div>
                  )}

                  {patient.notes && (
                    <p className="text-xs text-muted-foreground/90 mt-2.5 bg-accent/30 p-2.5 rounded-xl border border-border/30 line-clamp-2">
                      {patient.notes}
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-border/30 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1 font-medium">
                    <Clock className="h-3.5 w-3.5 text-primary-500" />
                    {apptCount} {t("patients.visitsCount", { defaultValue: "زيارات" })}
                  </span>

                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setDocsModalPatient({ id: patient.id, name: `${patient.firstName} ${patient.lastName}` })}
                      className="p-1.5 rounded-lg text-primary-500 hover:bg-primary-500/10 transition cursor-pointer"
                      title={t("patients.openDocs", { defaultValue: "عرض المستندات والتحاليل الطبية" })}
                    >
                      <FolderOpen className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => openEditModal(patient)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition cursor-pointer"
                      title={t("common.edit", { defaultValue: "تعديل" })}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary-500 transition ms-1 rtl:rotate-180" />
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          total={totalPages * 20}
          limit={20}
          onPage={(p: number) => setPage(p)}
        />
      )}

      {/* 5. Patient Detail Inspector Drawer */}
      <Drawer
        open={!!selectedPatient}
        onClose={() => setSelectedPatient(null)}
        title={selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName}` : t("patients.patientDetails", { defaultValue: "الملف الطبي للمريض" })}
        subtitle={t("patients.inspectorSub", { defaultValue: "بيانات المريض الشخصية والتأكيدات وسجل المواعيد" })}
      >
        {selectedPatient && (
          <div className="space-y-5">
            {/* Header Identity */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-accent/30 border border-border/40">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary-500/15 text-primary-500 font-bold grid place-items-center text-base border border-primary-500/30">
                  {selectedPatient.firstName[0]}
                  {selectedPatient.lastName[0]}
                </div>
                <div>
                  <h3 className="text-base font-bold">
                    {selectedPatient.firstName} {selectedPatient.lastName}
                  </h3>
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <Phone className="h-3 w-3 text-primary-500" />
                    <span className="font-mono">{selectedPatient.phone}</span>
                  </div>
                </div>
              </div>
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-bold text-amber-600 uppercase">{t("patients.guestTag", { defaultValue: "مريض زائر" })}</span>
            </div>

            {/* Information Section */}
            <div className="rounded-2xl border border-border/40 bg-accent/30 p-4 space-y-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-primary-500" /> {t("patients.contactDetails", { defaultValue: "بيانات التواصل والتأكيد" })}
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-muted-foreground text-[11px]">{t("common.email", { defaultValue: "البريد الإلكتروني" })}</div>
                  <div className="font-bold text-foreground mt-0.5 truncate">
                    {selectedPatient.email || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground text-[11px]">{t("patients.dob", { defaultValue: "تاريخ الميلاد" })}</div>
                  <div className="font-bold text-foreground mt-0.5">
                    {selectedPatient.dateOfBirth || "—"}
                  </div>
                </div>
              </div>
              {selectedPatient.notes && (
                <div className="pt-2 border-t border-border/30">
                  <div className="text-muted-foreground text-[11px] mb-1">{t("patients.medicalNotes", { defaultValue: "الملاحظات والسجلات الطبية الرقمية" })}</div>
                  <div className="p-2.5 rounded-xl bg-card border border-border/30 text-xs leading-relaxed text-foreground">
                    {selectedPatient.notes}
                  </div>
                </div>
              )}
            </div>

            {/* Appointment History */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5 text-primary-500" /> {t("patients.visitHistory", { defaultValue: "سجل الزيارات والمواعيد السابقة" })} ({patientAppointments.length})
                </span>
              </h4>

              {patientAppointments.length === 0 ? (
                <div className="p-4 rounded-2xl border border-border/40 bg-muted/10 text-center text-xs text-muted-foreground">
                  {t("patients.noHistory", { defaultValue: "لا توجد زيارات مسجلة لهذا المريض حتى الآن." })}
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar pe-1">
                  {patientAppointments.map((app) => (
                    <div
                      key={app.id}
                      className="p-3 rounded-xl border border-border/30 bg-card flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="font-bold text-foreground">
                          {app.doctor ? `${t("doctors.doctorPrefix", { defaultValue: "د." })} ${app.doctor.firstName || app.doctor.name || ""}` : t("patients.consultation", { defaultValue: "استشارة طبية" })}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {app.slot?.date} {app.slot?.startTime ? `· ${app.slot.startTime.slice(0, 5)}` : ""}
                        </div>
                      </div>
                      <StatusBadge value={app.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="pt-4 border-t border-border/40 flex items-center gap-2">
              <button
                onClick={() => {
                  setDocsModalPatient({
                    id: selectedPatient.id,
                    name: `${selectedPatient.firstName} ${selectedPatient.lastName}`,
                  });
                }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary-500/10 px-4 py-2.5 text-xs font-bold text-primary-500 hover:bg-primary-500/20 transition cursor-pointer"
              >
                <FolderOpen className="h-3.5 w-3.5" /> {t("patients.openDocs", { defaultValue: "عرض المستندات والتحاليل الطبية" })}
              </button>
              <button
                onClick={() => {
                  const pToEdit = selectedPatient;
                  setSelectedPatient(null);
                  openEditModal(pToEdit);
                }}
                className="inline-flex items-center justify-center p-2.5 rounded-xl bg-accent text-foreground hover:bg-accent/80 transition cursor-pointer"
                title={t("common.edit", { defaultValue: "تعديل" })}
              >
                <Edit2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </Drawer>

      {/* 6. Integrated Medical Documents Drawer */}
      <MedicalDocsDrawer
        open={!!docsModalPatient}
        patientId={docsModalPatient?.id || null}
        patientName={docsModalPatient?.name}
        onClose={() => setDocsModalPatient(null)}
      />

      {/* 7. Create / Edit Patient Modal */}
      <FormModal
        id="guest-patient-modal"
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingPatient ? t("patients.editTitle", { defaultValue: "تعديل بيانات المريض" }) : t("patients.createGuestButton", { defaultValue: "حجز مريض زائر جديد" })}
        description={t("patients.modalDesc", { defaultValue: "أدخل المعلومات والبيانات الشخصية للمريض الزائر" })}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("patients.firstName", { defaultValue: "الاسم الأول" })}*</label>
              <input
                {...register("firstName")}
                className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
              />
              {errors.firstName && <p className="text-xs text-danger">{errors.firstName.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("patients.lastName", { defaultValue: "اللقب" })}*</label>
              <input
                {...register("lastName")}
                className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
              />
              {errors.lastName && <p className="text-xs text-danger">{errors.lastName.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("common.phone", { defaultValue: "رقم الهاتف" })}*</label>
            <input
              {...register("phone")}
              placeholder="0661234567"
              className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40 font-mono"
            />
            {errors.phone && <p className="text-xs text-danger">{errors.phone.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("common.email", { defaultValue: "البريد الإلكتروني" })}</label>
              <input
                type="email"
                {...register("email")}
                className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("patients.dob", { defaultValue: "تاريخ الميلاد" })}</label>
              <input
                type="date"
                {...register("dateOfBirth")}
                className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("patients.medicalNotes", { defaultValue: "الملاحظات الطبية" })}</label>
            <textarea
              {...register("notes")}
              rows={2}
              placeholder={t("patients.notesPlaceholder", { defaultValue: "الملاحظات الطبية الخاصة بالعيادة..." })}
              className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
            />
          </div>

          <div className="pt-4 border-t border-border/40 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent cursor-pointer"
            >
              {t("common.cancel", { defaultValue: "إلغاء" })}
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              {editingPatient ? t("common.save", { defaultValue: "حفظ التغييرات" }) : t("common.create", { defaultValue: "إضافة جديد" })}
            </button>
          </div>
        </form>
      </FormModal>
    </div>
  );
}

