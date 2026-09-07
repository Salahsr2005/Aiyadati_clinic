import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@/lib/queryClient";
import {
  UserPlus,
  CheckCircle2,
  XCircle,
  Trash2,
  Search,
  Loader2,
  Stethoscope,
  Users,
  Clock,
  Filter,
  RotateCcw,
  X,
  ChevronRight,
  ShieldCheck,
  Building2,
  Award,
  Phone,
  Mail,
} from "lucide-react";
import { clinicSelfApi, type ClinicDoctor } from "@/api/clinicSelfApi";
import { doctorsApi, type DoctorRow } from "@/api/doctorsApi";
import { clinicAppointmentsApi, type ClinicAppointmentRow } from "@/api/clinicAppointmentsApi";
import { qk } from "@/lib/queryKeys";
import { useEntityMutation } from "@/lib/mutations";
import { ensureArray } from "@/lib/utils";
import { GlassCard } from "@/components/glass/GlassCard";
import { RemoteImage } from "@/components/common/RemoteImage";
import { FormModal } from "@/components/data/FormModal";
import { ConfirmDialog } from "@/components/data/ConfirmDialog";
import { EmptyState } from "@/components/data/EmptyState";
import { Skeleton } from "@/components/glass/Skeleton";
import { StatusBadge } from "@/components/data/StatusBadge";
import { DoctorDetailDrawer } from "@/components/doctors/DoctorDetailDrawer";

type TabStatus = "ACCEPTED" | "PENDING" | "REJECTED";

export default function DoctorsPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabStatus>("ACCEPTED");
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [searchDoctorQuery, setSearchDoctorQuery] = useState("");
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
  const [selectedAffiliation, setSelectedAffiliation] = useState<ClinicDoctor | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [listSearchQuery, setListSearchQuery] = useState("");

  // Fetch clinic affiliated doctors
  const { data: rawAffiliations, isLoading } = useQuery({
    queryKey: qk.clinicSelf.doctors(),
    queryFn: clinicSelfApi.getDoctors,
  });

  const { data: appointmentsData } = useQuery({
    queryKey: qk.clinicSelf.appointments({ limit: 100 }),
    queryFn: () => clinicAppointmentsApi.listAppointments({ limit: 100 }),
  });

  const affiliations: ClinicDoctor[] = ensureArray<ClinicDoctor>(rawAffiliations);
  const appointments: ClinicAppointmentRow[] = ensureArray<ClinicAppointmentRow>(appointmentsData?.data);

  // Search doctors on platform for invitation
  const { data: platformDoctorsData, isLoading: isSearchLoading } = useQuery({
    queryKey: ["platformDoctorsSearch", searchDoctorQuery],
    queryFn: () => doctorsApi.list({ search: searchDoctorQuery, limit: 10 }),
    enabled: inviteModalOpen && searchDoctorQuery.trim().length >= 2,
  });

  const searchedDoctors: DoctorRow[] = (platformDoctorsData as any)?.items ?? (platformDoctorsData as any)?.data ?? [];

  // Mutations
  const inviteMutation = useEntityMutation({
    mutationFn: (doctorId: string) => clinicSelfApi.inviteDoctor(doctorId),
    invalidate: [qk.clinicSelf.doctors()],
    successMessage: t("doctors.inviteSuccess", { defaultValue: "تم إرسال دعوة الانضمام للطبيب بنجاح" }),
    onSuccess: () => {
      setInviteModalOpen(false);
      setSelectedDoctorId(null);
      setSearchDoctorQuery("");
    },
  });

  const acceptMutation = useEntityMutation({
    mutationFn: (id: string) => clinicSelfApi.acceptDoctor(id),
    invalidate: [qk.clinicSelf.doctors()],
    successMessage: t("doctors.acceptSuccess", { defaultValue: "تم قبول طلب الاعتماد بالعيادة" }),
  });

  const rejectMutation = useEntityMutation({
    mutationFn: (id: string) => clinicSelfApi.rejectDoctor(id),
    invalidate: [qk.clinicSelf.doctors()],
    successMessage: t("doctors.rejectSuccess", { defaultValue: "تم رفض طلب الاعتماد" }),
  });

  const removeMutation = useEntityMutation({
    mutationFn: (id: string) => clinicSelfApi.removeDoctor(id),
    invalidate: [qk.clinicSelf.doctors()],
    successMessage: t("doctors.removeSuccess", { defaultValue: "تم إلغاء اعتماد الطبيب من العيادة" }),
    onSuccess: () => setConfirmRemoveId(null),
  });

  // Filtered list
  const filteredAffiliations = useMemo(() => {
    return affiliations.filter((a) => {
      const matchesTab = a.status === activeTab;
      const doc = a.doctor;
      const docAny = doc as any;
      const name = `${doc?.firstName || docAny?.firstNameFr || ""} ${doc?.lastName || docAny?.lastNameFr || ""}`.trim() || doc?.name || "";
      const spec = doc?.specialtyName || doc?.specialty?.nameFr || "";

      const matchesSearch =
        !listSearchQuery.trim() ||
        name.toLowerCase().includes(listSearchQuery.toLowerCase()) ||
        spec.toLowerCase().includes(listSearchQuery.toLowerCase());

      return matchesTab && matchesSearch;
    });
  }, [affiliations, activeTab, listSearchQuery]);

  const counts = {
    ACCEPTED: affiliations.filter((a) => a.status === "ACCEPTED").length,
    PENDING: affiliations.filter((a) => a.status === "PENDING").length,
    REJECTED: affiliations.filter((a) => a.status === "REJECTED").length,
    total: affiliations.length,
  };

  const clearFilters = () => {
    setListSearchQuery("");
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("doctors.title", { defaultValue: "الطاقم الطبي والأطباء المعتمدون" })}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("doctors.subtitle", { defaultValue: "إدارة الأطباء المعتمدين بإنشاء العيادة واعتماداتهم التشغيلية" })}
          </p>
        </div>

        <button
          onClick={() => setInviteModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-xs transition hover:opacity-90 cursor-pointer self-start sm:self-auto"
        >
          <UserPlus className="h-4 w-4" />
          {t("doctors.inviteButton", { defaultValue: "دعوة طبيب جديد للانضمام" })}
        </button>
      </div>

      {/* 2. Mini Statistics Secondary Strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <GlassCard className="p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary-500/15 text-primary-500 grid place-items-center font-bold">
              <Stethoscope className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("doctors.activeStaff", { defaultValue: "أطباء نشطون حالياً" })}
              </div>
              <div className="text-base font-bold text-primary-500">{counts.ACCEPTED}</div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-warning/15 text-warning grid place-items-center font-bold">
              <Clock className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("doctors.pendingInvites", { defaultValue: "طلبات انضمام معلقة" })}
              </div>
              <div className="text-base font-bold text-warning">{counts.PENDING}</div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-danger/15 text-danger grid place-items-center font-bold">
              <XCircle className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("doctors.rejectedInvites", { defaultValue: "طلبات مرفوضة" })}
              </div>
              <div className="text-base font-bold text-danger">{counts.REJECTED}</div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-info/15 text-info grid place-items-center font-bold">
              <Users className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("doctors.totalDoctors", { defaultValue: "إجمالي الأطباء المعتمدين" })}
              </div>
              <div className="text-base font-bold">{counts.total}</div>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* 3. Filter Bar */}
      <GlassCard className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
            <Filter className="h-4 w-4 text-primary-500" />
            <span>{t("filters.open", { defaultValue: "تصفية وتنقيب" })}</span>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute start-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={listSearchQuery}
              onChange={(e) => setListSearchQuery(e.target.value)}
              placeholder={t("doctors.searchPlaceholder", { defaultValue: "البحث عن طبيب بالاسم أو التخصص..." })}
              className="glass w-full rounded-xl ps-8 pe-8 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-primary-500/40"
            />
            {listSearchQuery && (
              <button
                onClick={() => setListSearchQuery("")}
                className="absolute end-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {listSearchQuery && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 text-xs text-primary-500 font-bold hover:underline cursor-pointer ms-auto"
            >
              <RotateCcw className="h-3 w-3" /> {t("filters.reset", { defaultValue: "إعادة تعيين" })}
            </button>
          )}
        </div>

        {/* Status Pill Filters */}
        <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-border/30">
          {(
            [
              { id: "ACCEPTED" as TabStatus, label: t("doctors.acceptedTab", { defaultValue: "الأطباء المقبولون" }), count: counts.ACCEPTED },
              { id: "PENDING" as TabStatus, label: t("doctors.pendingTab", { defaultValue: "الطلبات المعلقة" }), count: counts.PENDING },
              { id: "REJECTED" as TabStatus, label: t("doctors.rejectedTab", { defaultValue: "الطلبات المرفوضة" }), count: counts.REJECTED },
            ] as const
          ).map((pill) => {
            const isActive = activeTab === pill.id;
            return (
              <button
                key={pill.id}
                onClick={() => setActiveTab(pill.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-bold transition cursor-pointer ${
                  isActive
                    ? "bg-primary-500 text-primary-foreground shadow-xs"
                    : "bg-accent/30 text-muted-foreground hover:text-foreground hover:bg-accent/60"
                }`}
              >
                <span>{pill.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[9px] ${isActive ? "bg-white/20 text-white" : "bg-muted/40"}`}>
                  {pill.count}
                </span>
              </button>
            );
          })}
        </div>
      </GlassCard>

      {/* 4. Doctor Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-48 w-full rounded-2xl" />
          ))}
        </div>
      ) : filteredAffiliations.length === 0 ? (
        <EmptyState
          title={t("common.empty", { defaultValue: "لا توجد سجّلات متاحة حاليًا" })}
          description={
            listSearchQuery
              ? t("filters.clear", { defaultValue: "جرب تعديل كلمات البحث." })
              : activeTab === "ACCEPTED"
                ? t("doctors.emptyAccepted", { defaultValue: "لا يوجد أطباء نشطون معتمدون بالعيادة حالياً." })
                : activeTab === "PENDING"
                  ? t("doctors.emptyPending", { defaultValue: "لا توجد طلبات اعتماد معلقة." })
                  : t("doctors.emptyRejected", { defaultValue: "لا توجد طلبات مرفوضة." })
          }
          action={
            activeTab === "ACCEPTED" && !listSearchQuery ? (
              <button
                onClick={() => setInviteModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 cursor-pointer"
              >
                <UserPlus className="h-4 w-4" /> {t("doctors.inviteButton", { defaultValue: "دعوة طبيب جديد للانضمام" })}
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAffiliations.map((affiliation) => {
            const doc = affiliation.doctor;
            const docAny = doc as any;
            const firstName = docAny?.firstNameFr || docAny?.firstNameAr || doc?.firstName || "";
            const lastName = docAny?.lastNameFr || docAny?.lastNameAr || doc?.lastName || "";
            const fullName = `${firstName} ${lastName}`.trim() || doc?.name || "Doctor";
            const specialtyName = Array.isArray(docAny?.specialties) && docAny.specialties.length > 0
              ? docAny.specialties[0]?.specialty?.nameFr || docAny.specialties[0]?.nameFr || docAny.specialties[0]?.nameAr
              : doc?.specialtyName || doc?.specialty?.nameFr || "General Practice";

            const docApptsCount = appointments.filter((a) => a.doctorId === affiliation.doctorId).length;

            return (
              <GlassCard
                key={affiliation.id}
                onClick={() => setSelectedAffiliation(affiliation)}
                className="p-5 flex flex-col justify-between space-y-4 hover:bg-accent/40 transition cursor-pointer group border border-border/40"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <RemoteImage
                        src={doc?.avatarUrl || doc?.photoUrl}
                        alt={fullName}
                        className="h-12 w-12 rounded-2xl object-cover border border-border/50 shadow-xs shrink-0"
                      />
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-foreground truncate group-hover:text-primary-500 transition">
                          {t("doctors.doctorPrefix", { defaultValue: "د." })} {fullName}
                        </h3>
                        <p className="text-xs text-primary-500 font-semibold truncate mt-0.5">
                          {specialtyName}
                        </p>
                      </div>
                    </div>

                    <StatusBadge value={affiliation.status} />
                  </div>

                  <div className="mt-3.5 space-y-1.5 text-xs text-muted-foreground">
                    {doc?.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 text-primary-500 shrink-0" />
                        <span className="font-mono">{doc.phone}</span>
                      </div>
                    )}
                    {doc?.email && (
                      <div className="flex items-center gap-2 truncate">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">{doc.email}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-border/30 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1 font-medium">
                    <Clock className="h-3.5 w-3.5 text-primary-500" />
                    {docApptsCount} {t("doctors.apptsScheduled", { defaultValue: "مواعيد مجدولة" })}
                  </span>

                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {affiliation.status === "PENDING" && (
                      <>
                        <button
                          onClick={() => acceptMutation.mutate(affiliation.id)}
                          disabled={acceptMutation.isPending}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-success/15 text-success hover:bg-success/25 transition cursor-pointer"
                        >
                          {t("doctors.acceptButton", { defaultValue: "قبول طلب الانضمام" })}
                        </button>
                        <button
                          onClick={() => rejectMutation.mutate(affiliation.id)}
                          disabled={rejectMutation.isPending}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-danger/15 text-danger hover:bg-danger/25 transition cursor-pointer"
                        >
                          {t("doctors.rejectButton", { defaultValue: "رفض الطلب" })}
                        </button>
                      </>
                    )}

                    {affiliation.status === "ACCEPTED" && (
                      <button
                        onClick={() => setConfirmRemoveId(affiliation.id)}
                        className="p-1.5 rounded-lg text-danger/70 hover:bg-danger/10 hover:text-danger transition cursor-pointer"
                        title={t("doctors.cancelAffiliation", { defaultValue: "إلغاء الاعتماد بالعيادة" })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}

                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary-500 transition ms-1 rtl:rotate-180" />
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* 5. Doctor Detail Drawer */}
      <DoctorDetailDrawer
        doctorAffiliation={selectedAffiliation}
        onClose={() => setSelectedAffiliation(null)}
        onAccept={(id) => acceptMutation.mutate(id)}
        onReject={(id) => rejectMutation.mutate(id)}
      />

      {/* 6. Doctor Invite Modal */}
      <FormModal
        id="invite-doctor-modal"
        open={inviteModalOpen}
        onClose={() => {
          setInviteModalOpen(false);
          setSelectedDoctorId(null);
          setSearchDoctorQuery("");
        }}
        title={t("doctors.inviteModalTitle", { defaultValue: "دعوة طبيب للاعتماد بالعيادة" })}
        description={t("doctors.inviteModalSub", { defaultValue: "ابحث في دليل الأطباء وأرسل دعوة اعتماد رسمية بالعيادة" })}
      >
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute start-3 top-3 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchDoctorQuery}
              onChange={(e) => setSearchDoctorQuery(e.target.value)}
              placeholder={t("doctors.searchPlaceholder", { defaultValue: "البحث عن طبيب بالاسم أو التخصص..." })}
              className="glass w-full rounded-xl ps-9 pe-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
            />
            {isSearchLoading && (
              <Loader2 className="absolute end-3 top-3 h-4 w-4 animate-spin text-primary-500" />
            )}
          </div>

          {searchDoctorQuery.trim().length >= 2 && (
            <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar pe-1">
              {searchedDoctors.length === 0 && !isSearchLoading ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  {t("common.empty", { defaultValue: "لا توجد سجّلات متاحة حاليًا" })}
                </div>
              ) : (
                searchedDoctors.map((doc) => {
                  const docAny = doc as any;
                  const firstName = docAny.firstNameFr || docAny.firstNameAr || docAny.firstName || "";
                  const lastName = docAny.lastNameFr || docAny.lastNameAr || docAny.lastName || "";
                  const docName = `${firstName} ${lastName}`.trim() || docAny.name || "Doctor";
                  const isSelected = selectedDoctorId === doc.id;
                  const photo = docAny.avatarUrl || docAny.photoUrl;
                  const specName = docAny.specialtyName || docAny.specialties?.[0]?.specialty?.nameFr || docAny.specialty?.nameFr || "Specialist";

                  return (
                    <div
                      key={doc.id}
                      onClick={() => setSelectedDoctorId(doc.id)}
                      className={`flex items-center justify-between p-3 rounded-2xl border transition cursor-pointer ${
                        isSelected
                          ? "border-primary-500 bg-primary-500/10 shadow-xs"
                          : "border-border/40 glass hover:bg-accent/40"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <RemoteImage
                          src={photo}
                          alt={docName}
                          className="h-10 w-10 rounded-full object-cover border border-border/40 shrink-0"
                        />
                        <div>
                          <div className="text-xs font-bold text-foreground">
                            {t("doctors.doctorPrefix", { defaultValue: "د." })} {docName}
                          </div>
                          <div className="text-[11px] text-primary-500 font-medium">
                            {specName}
                          </div>
                        </div>
                      </div>

                      {isSelected && <CheckCircle2 className="h-5 w-5 text-primary-500 shrink-0" />}
                    </div>
                  );
                })
              )}
            </div>
          )}

          <div className="pt-4 border-t border-border/40 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setInviteModalOpen(false)}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent cursor-pointer"
            >
              {t("common.cancel", { defaultValue: "إلغاء" })}
            </button>
            <button
              type="button"
              disabled={!selectedDoctorId || inviteMutation.isPending}
              onClick={() => selectedDoctorId && inviteMutation.mutate(selectedDoctorId)}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              {inviteMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {t("doctors.inviteButton", { defaultValue: "دعوة طبيب جديد للانضمام" })}
            </button>
          </div>
        </div>
      </FormModal>

      {/* Remove Affiliation Confirmation Dialog */}
      <ConfirmDialog
        open={!!confirmRemoveId}
        onClose={() => setConfirmRemoveId(null)}
        onConfirm={() => { if (confirmRemoveId) removeMutation.mutate(confirmRemoveId); }}
        title={t("doctors.cancelAffiliation", { defaultValue: "إلغاء الاعتماد بالعيادة" })}
        description={t("doctors.removeConfirmDesc", { defaultValue: "هل أنت متأكد من إلغاء اعتماد هذا الطبيب بالعيادة؟ لن يظهر ضمن طاقم العيادة الطبي." })}
        confirmText={t("doctors.cancelAffiliation", { defaultValue: "إلغاء الاعتماد بالعيادة" })}
        variant="danger"
        isLoading={removeMutation.isPending}
      />
    </div>
  );
}

