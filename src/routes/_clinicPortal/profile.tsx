import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Building2,
  Clock,
  FileText,
  Upload,
  Loader2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  MapPin,
  ShieldCheck,
  Percent,
  Plus,
  Save,
  Phone,
  Mail,
  Calendar,
  Globe,
  Sparkles,
  Info,
} from "lucide-react";
import {
  clinicSelfApi,
  type ClinicWorkingHour,
  type ClinicDocument,
} from "@/api/clinicSelfApi";
import { useWilayas, useBaladyas } from "@/hooks/useWilayas";
import { qk } from "@/lib/queryKeys";
import { useEntityMutation } from "@/lib/mutations";
import { ensureArray } from "@/lib/utils";
import { GlassCard } from "@/components/glass/GlassCard";
import { RemoteImage } from "@/components/common/RemoteImage";
import { FormModal } from "@/components/data/FormModal";
import { ConfirmDialog } from "@/components/data/ConfirmDialog";
import { LocationPicker } from "@/components/data/LocationPicker";
import { Skeleton } from "@/components/glass/Skeleton";
import { StatusBadge } from "@/components/data/StatusBadge";
import { EmptyState } from "@/components/data/EmptyState";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const profileSchema = z.object({
  nameFr: z.string().min(2, "French name is required"),
  nameAr: z.string().optional(),
  descriptionFr: z.string().optional(),
  descriptionAr: z.string().optional(),
  facilityType: z.string().optional(),
  wilayaId: z.string().or(z.number()).optional(),
  baladyaId: z.string().or(z.number()).optional(),
  address: z.string().optional(),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export default function ProfilePage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"profile" | "schedule" | "documents">("profile");

  const { data: profile, isLoading: isProfileLoading } = useQuery({
    queryKey: qk.clinicSelf.profile(),
    queryFn: clinicSelfApi.getProfile,
  });

  const { data: rawWorkingHours, isLoading: isHoursLoading } = useQuery({
    queryKey: qk.clinicSelf.workingHours(),
    queryFn: clinicSelfApi.getWorkingHours,
  });

  const { data: rawDocuments, isLoading: isDocsLoading } = useQuery({
    queryKey: qk.clinicSelf.documents(),
    queryFn: clinicSelfApi.getDocuments,
  });

  const workingHours: ClinicWorkingHour[] = ensureArray<ClinicWorkingHour>(rawWorkingHours);
  const documents: ClinicDocument[] = ensureArray<ClinicDocument>(rawDocuments);

  // Location data
  const { data: wilayas = [] } = useWilayas();
  const [selectedWilayaId, setSelectedWilayaId] = useState<string | number>("");
  const { data: baladyat = [] } = useBaladyas(selectedWilayaId);

  // Logo file state
  const [logoFile, setLogoFile] = useState<File | null>(null);

  // Working hours local state for 7 days
  const [hoursState, setHoursState] = useState<ClinicWorkingHour[]>([]);

  useEffect(() => {
    if (workingHours.length > 0) {
      setHoursState(workingHours);
    } else {
      // Default 7 days setup
      const initial = DAYS.map((_, idx) => ({
        dayOfWeek: idx,
        openTime: "08:00",
        closeTime: "17:00",
        isOpen: idx !== 5, // Friday closed by default
      }));
      setHoursState(initial);
    }
  }, [workingHours]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
  });

  useEffect(() => {
    if (profile) {
      reset({
        nameFr: profile.nameFr || "",
        nameAr: profile.nameAr || "",
        descriptionFr: profile.descriptionFr || "",
        descriptionAr: profile.descriptionAr || "",
        facilityType: profile.facilityType || "CLINIC",
        wilayaId: profile.wilayaId || "",
        baladyaId: profile.baladyaId || "",
        address: profile.address || "",
        latitude: profile.latitude || 36.75,
        longitude: profile.longitude || 3.05,
      });
      if (profile.wilayaId) setSelectedWilayaId(profile.wilayaId);
    }
  }, [profile, reset]);

  // Profile Update Mutation
  const updateProfileMutation = useEntityMutation({
    mutationFn: (data: ProfileFormData) => {
      const formData = new FormData();
      Object.entries(data).forEach(([key, val]) => {
        if (val !== undefined && val !== null) formData.append(key, String(val));
      });
      if (logoFile) {
        formData.append("logo", logoFile);
      }
      return clinicSelfApi.updateProfile(formData);
    },
    invalidate: [qk.clinicSelf.profile()],
    successMessage: t("profile.updateSuccess", { defaultValue: "تم تحديث ملف العيادة بنجاح" }),
  });

  // Working Hours Mutation
  const saveHoursMutation = useEntityMutation({
    mutationFn: (hours: ClinicWorkingHour[]) => clinicSelfApi.upsertWorkingHours(hours),
    invalidate: [qk.clinicSelf.workingHours()],
    successMessage: t("profile.hoursSuccess", { defaultValue: "تم حفظ جدول ساعات العمل بنجاح" }),
  });

  // Document Upload Mutation
  const [docUploadModalOpen, setDocUploadModalOpen] = useState(false);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docName, setDocName] = useState("");
  const [docType, setDocType] = useState("REGISTRATION_LICENSE");
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);

  const uploadDocMutation = useEntityMutation({
    mutationFn: ({ file, name, type }: { file: File; name: string; type: string }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", name);
      formData.append("type", type);
      return clinicSelfApi.uploadDocument(formData);
    },
    invalidate: [qk.clinicSelf.documents()],
    successMessage: t("profile.docSuccess", { defaultValue: "تم رفع الوثيقة القانونية بنجاح" }),
    onSuccess: () => {
      setDocUploadModalOpen(false);
      setDocFile(null);
      setDocName("");
    },
  });

  const deleteDocMutation = useEntityMutation({
    mutationFn: (id: string) => clinicSelfApi.deleteDocument(id),
    invalidate: [qk.clinicSelf.documents()],
    successMessage: t("profile.docDeleteSuccess", { defaultValue: "تم حذف الوثيقة بنجاح" }),
    onSuccess: () => setDeleteDocId(null),
  });

  // Profile Completeness Calculation
  const completeness = useMemo(() => {
    if (!profile) return 0;
    let score = 0;
    if (profile.nameFr) score += 20;
    if (profile.logoUrl || logoFile) score += 20;
    if (profile.wilayaId && profile.address) score += 20;
    if (workingHours.length > 0) score += 20;
    if (documents.length > 0) score += 20;
    return score;
  }, [profile, logoFile, workingHours, documents]);

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Profile Completeness Strip */}
      <GlassCard className="p-6 md:p-8 border border-border/40 relative overflow-hidden">
        <div className="pointer-events-none absolute -end-16 -top-16 h-64 w-64 rounded-full bg-primary-500/10 blur-3xl" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-border/50 bg-accent/40 shadow-xs">
              <RemoteImage
                src={logoFile ? URL.createObjectURL(logoFile) : profile?.logoUrl}
                alt={profile?.nameFr || "Clinic"}
                className="h-full w-full object-cover"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">
                  {profile?.nameFr || t("profile.title", { defaultValue: "ملف العيادة والاعتمادات الرسمية" })}
                </h1>
                <StatusBadge value={profile?.isVerified ? "VERIFIED" : "PENDING"} />
              </div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5 text-primary-500" />
                <span>{profile?.facilityType || "عيادة"}</span>
                <span>·</span>
                <MapPin className="h-3.5 w-3.5 text-primary-500" />
                <span>{profile?.address || t("common.address", { defaultValue: "العنوان الرئيسي" })}</span>
              </p>
            </div>
          </div>

          {/* Completeness Gauge */}
          <div className="flex flex-col gap-2 min-w-[200px] p-3 rounded-2xl bg-accent/30 border border-border/40">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="flex items-center gap-1.5 text-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary-500" /> {t("profile.bannerTitle", { defaultValue: "اكتمل الملف بنسبة {{pct}}%", pct: completeness })}
              </span>
              <span className="text-primary-500 font-extrabold">{completeness}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted/40 overflow-hidden">
              <div
                className="h-full bg-primary-500 rounded-full transition-all duration-500"
                style={{ width: `${completeness}%` }}
              />
            </div>
            <div className="text-[10px] text-muted-foreground">
              {t("profile.bannerSub", { defaultValue: "قم باستكمال كافة الوثائق القانونية والساعات لرفع موثوقية العيادة" })}
            </div>
          </div>
        </div>
      </GlassCard>

      {/* 2. Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-border/40 pb-2">
        {[
          { id: "profile", label: t("profile.basicInfo", { defaultValue: "المعلومات الأساسية والتواصل" }), icon: Building2 },
          { id: "schedule", label: t("profile.hoursInfo", { defaultValue: "ساعات العمل والدياجات الأسبوعية" }), icon: Clock },
          { id: "documents", label: t("profile.documentsInfo", { defaultValue: "الوثائق والتراخيص القانونية الطبيّة" }), icon: FileText, count: documents.length },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition cursor-pointer ${
                isActive
                  ? "bg-primary-500 text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`px-1.5 py-0.2 rounded-full text-[9px] ${isActive ? "bg-white/20 text-white" : "bg-muted/40"}`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 3. Tab Content */}
      {activeTab === "profile" && (
        <form onSubmit={handleSubmit((d) => updateProfileMutation.mutate(d))} className="space-y-6">
          {/* Basic Info GlassCard */}
          <GlassCard className="p-6 space-y-4 border border-border/40">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Building2 className="h-4.5 w-4.5 text-primary-500" /> {t("profile.basicInfo", { defaultValue: "المعلومات الأساسية والتواصل" })}
            </h2>

            {/* Logo Upload Dropzone */}
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-accent/30 border border-border/40">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-border/50 bg-background">
                <RemoteImage
                  src={logoFile ? URL.createObjectURL(logoFile) : profile?.logoUrl}
                  alt="Clinic Logo"
                  className="h-full w-full object-cover"
                />
              </div>
              <div>
                <label className="inline-flex items-center gap-2 rounded-xl bg-primary-500/15 px-3 py-1.5 text-xs font-bold text-primary-500 hover:bg-primary-500/25 transition cursor-pointer">
                  <Upload className="h-3.5 w-3.5" /> {t("gallery.uploadButton", { defaultValue: "تغيير شعار العيادة" })}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setLogoFile(file);
                    }}
                  />
                </label>
                <p className="text-[11px] text-muted-foreground mt-1">
                  PNG/WEBP (Max 2MB)
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t("app.name", { defaultValue: "اسم العيادة" })} (الفرنسية)*</label>
                <input
                  {...register("nameFr")}
                  placeholder="e.g. Clinique El Shifa"
                  className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
                />
                {errors.nameFr && <p className="text-xs text-danger">{errors.nameFr.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t("app.name", { defaultValue: "اسم العيادة" })} (العربية)</label>
                <input
                  {...register("nameAr")}
                  placeholder="مثال: عيادة الشفاء"
                  dir="rtl"
                  className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("filters.practiceType", { defaultValue: "نمط الممارسة" })}</label>
              <select
                {...register("facilityType")}
                className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40 bg-background text-foreground"
              >
                <option value="CLINIC">عيادة متعددة التخصصات</option>
                <option value="CABINET">عيادة خاصة</option>
                <option value="POLYCLINIC">مركز طبي متكامل</option>
                <option value="HOSPITAL">مستشفى خاص</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t("common.details", { defaultValue: "التفاصيل" })} (الفرنسية)</label>
                <textarea
                  {...register("descriptionFr")}
                  rows={3}
                  placeholder="Describe your clinic services, specialties, and equipment..."
                  className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t("common.details", { defaultValue: "التفاصيل" })} (العربية)</label>
                <textarea
                  {...register("descriptionAr")}
                  rows={3}
                  dir="rtl"
                  placeholder="وصف الخدمات الطبية والتجهيزات المتوفرة بالعيادة..."
                  className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
                />
              </div>
            </div>
          </GlassCard>

          {/* Location & Coordinates GlassCard */}
          <GlassCard className="p-6 space-y-4 border border-border/40">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <MapPin className="h-4.5 w-4.5 text-primary-500" /> {t("profile.locationInfo", { defaultValue: "الموقع الجغرافي والإحداثيات" })}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t("filters.wilaya", { defaultValue: "الولاية" })}*</label>
                <select
                  value={selectedWilayaId}
                  onChange={(e) => {
                    setSelectedWilayaId(e.target.value);
                    setValue("wilayaId", e.target.value);
                    setValue("baladyaId", "");
                  }}
                  className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40 bg-background text-foreground"
                >
                  <option value="">اختر الولاية...</option>
                  {wilayas.map((w: any) => (
                    <option key={w.id} value={w.id}>
                      {w.code ? `${w.code} - ` : ""}{w.nameFr || w.nameAr}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">البلدية*</label>
                <select
                  {...register("baladyaId")}
                  className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40 bg-background text-foreground"
                >
                  <option value="">اختر البلدية...</option>
                  {baladyat.map((b: any) => (
                    <option key={b.id} value={b.id}>
                      {b.nameFr || b.nameAr}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("common.address", { defaultValue: "العنوان الرئيسي" })}</label>
              <input
                {...register("address")}
                placeholder="مثال: 14 شارع ديدوش مراد، الجزائر العاصمة"
                className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">خط العرض (Latitude)</label>
                <input
                  type="number"
                  step="any"
                  {...register("latitude")}
                  placeholder="36.7528"
                  className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">خط الطول (Longitude)</label>
                <input
                  type="number"
                  step="any"
                  {...register("longitude")}
                  placeholder="3.0420"
                  className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40 font-mono"
                />
              </div>
            </div>
          </GlassCard>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={updateProfileMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-6 py-2.5 text-xs font-bold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              {updateProfileMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {t("common.save", { defaultValue: "حفظ التغييرات" })}
            </button>
          </div>
        </form>
      )}

      {/* Schedule Tab */}
      {activeTab === "schedule" && (
        <GlassCard className="p-6 space-y-6 border border-border/40">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Clock className="h-4.5 w-4.5 text-primary-500" /> {t("profile.hoursInfo", { defaultValue: "ساعات العمل والدياجات الأسبوعية" })}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                تحديد مواعيد وساعات عمل العيادة الرسمية للأسبوع
              </p>
            </div>

            <button
              onClick={() => saveHoursMutation.mutate(hoursState)}
              disabled={saveHoursMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              {saveHoursMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {t("common.save", { defaultValue: "حفظ التغييرات" })}
            </button>
          </div>

          <div className="space-y-3">
            {DAYS.map((dayName, idx) => {
              const current = hoursState.find((h) => h.dayOfWeek === idx) || {
                dayOfWeek: idx,
                openTime: "08:00",
                closeTime: "17:00",
                isOpen: idx !== 5,
              };

              return (
                <div
                  key={dayName}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border transition ${
                    current.isOpen ? "bg-accent/30 border-border/40" : "bg-muted/10 border-border/20 opacity-70"
                  }`}
                >
                  <div className="flex items-center gap-3 w-36">
                    <input
                      type="checkbox"
                      checked={current.isOpen}
                      onChange={(e) => {
                        const updated = hoursState.map((h) =>
                          h.dayOfWeek === idx ? { ...h, isOpen: e.target.checked } : h
                        );
                        setHoursState(updated);
                      }}
                      className="rounded text-primary-500 focus:ring-primary-500 h-4 w-4 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-foreground">{dayName}</span>
                  </div>

                  {current.isOpen ? (
                    <div className="flex items-center gap-2 text-xs">
                      <input
                        type="time"
                        value={current.openTime}
                        onChange={(e) => {
                          const updated = hoursState.map((h) =>
                            h.dayOfWeek === idx ? { ...h, openTime: e.target.value } : h
                          );
                          setHoursState(updated);
                        }}
                        className="glass rounded-xl px-3 py-1.5 outline-none font-mono text-xs"
                      />
                      <span className="text-muted-foreground font-semibold">إلى</span>
                      <input
                        type="time"
                        value={current.closeTime}
                        onChange={(e) => {
                          const updated = hoursState.map((h) =>
                            h.dayOfWeek === idx ? { ...h, closeTime: e.target.value } : h
                          );
                          setHoursState(updated);
                        }}
                        className="glass rounded-xl px-3 py-1.5 outline-none font-mono text-xs"
                      />
                    </div>
                  ) : (
                    <span className="text-xs font-bold text-muted-foreground px-3 py-1.5">
                      مغلق
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}

      {/* Documents Tab */}
      {activeTab === "documents" && (
        <div className="space-y-6">
          <GlassCard className="p-6 space-y-4 border border-border/40">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <ShieldCheck className="h-4.5 w-4.5 text-primary-500" /> {t("profile.documentsInfo", { defaultValue: "الوثائق والتراخيص القانونية الطبيّة" })}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  رفع تراخيص فتح العيادة والوثائق الرسمية للاعتماد الرقمي
                </p>
              </div>

              <button
                onClick={() => setDocUploadModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-xs transition hover:opacity-90 cursor-pointer self-start sm:self-auto"
              >
                <Upload className="h-4 w-4" />
                {t("profile.uploadDoc", { defaultValue: "رفع وثيقة ترخيص جديدة" })}
              </button>
            </div>

            {isDocsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-2xl" />
                ))}
              </div>
            ) : documents.length === 0 ? (
              <EmptyState
                title="لا توجد وثائق رسمية مرفوعة حاليًا"
                description="قم برفع وثائق الترخيص القانوني لتوثيق العيادة على منصة عيادتي."
                action={
                  <button
                    onClick={() => setDocUploadModalOpen(true)}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 cursor-pointer"
                  >
                    <Upload className="h-4 w-4" /> {t("profile.uploadDoc", { defaultValue: "رفع وثيقة ترخيص جديدة" })}
                  </button>
                }
              />
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-accent/30 border border-border/40 hover:bg-accent/60 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-2xl bg-primary-500/15 text-primary-500 grid place-items-center font-bold shrink-0">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-foreground">{doc.name}</h4>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                          <span>النوع: {doc.type || "وثيقة اعتماد"}</span>
                          {doc.createdAt && (
                            <>
                              <span>·</span>
                              <span>تم الرفع {doc.createdAt.slice(0, 10)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <StatusBadge value={doc.status || "APPROVED"} />
                      <button
                        onClick={() => setDeleteDocId(doc.id)}
                        className="p-1.5 rounded-lg text-danger/70 hover:bg-danger/10 hover:text-danger transition cursor-pointer"
                        title={t("common.delete", { defaultValue: "حذف" })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </div>
      )}

      {/* Upload Document Modal */}
      <FormModal
        id="upload-doc-modal"
        open={docUploadModalOpen}
        onClose={() => setDocUploadModalOpen(false)}
        title={t("profile.uploadDoc", { defaultValue: "رفع وثيقة ترخيص جديدة" })}
        description="اختر ملف الوثيقة (PDF, PNG, JPG, بحجم أقل من 10 ميجابايت)"
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">اسم الوثيقة / الترخيص*</label>
            <input
              type="text"
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
              placeholder="مثال: رخصة الاعتماد السنوية 2026"
              className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">نوع الوثيقة</label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40 bg-background text-foreground"
            >
              <option value="REGISTRATION_LICENSE">السجل التجاري / السجل الطبي</option>
              <option value="MEDICAL_APPROVAL">اعتماد وزارة الصحة</option>
              <option value="TAX_CARD">البطاقة الجبائية NIF</option>
              <option value="FACILITY_PHOTO">ترخيص ممارسة النشاط</option>
            </select>
          </div>

          <label className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border/60 p-6 text-center hover:border-primary-500/50 hover:bg-primary-500/5 transition cursor-pointer">
            <FileText className="h-8 w-8 text-primary-500" />
            <span className="text-xs font-semibold text-foreground">
              {docFile ? docFile.name : "اضغط لاختيار ملف الوثيقة"}
            </span>
            <input
              type="file"
              accept=".pdf,image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setDocFile(file);
              }}
            />
          </label>

          <div className="pt-4 border-t border-border/40 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDocUploadModalOpen(false)}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent cursor-pointer"
            >
              {t("common.cancel", { defaultValue: "إلغاء" })}
            </button>
            <button
              type="button"
              disabled={!docFile || !docName.trim() || uploadDocMutation.isPending}
              onClick={() => {
                if (docFile && docName.trim()) {
                  uploadDocMutation.mutate({ file: docFile, name: docName.trim(), type: docType });
                }
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              {uploadDocMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {t("profile.uploadDoc", { defaultValue: "رفع وثيقة ترخيص جديدة" })}
            </button>
          </div>
        </div>
      </FormModal>

      {/* Delete Document Confirmation Dialog */}
      <ConfirmDialog
        open={!!deleteDocId}
        onClose={() => setDeleteDocId(null)}
        onConfirm={() => { if (deleteDocId) deleteDocMutation.mutate(deleteDocId); }}
        title={t("profile.deleteDocTitle", { defaultValue: "حذف وثيقة ترخيص" })}
        description={t("profile.deleteDocMessage", { defaultValue: "هل أنت متأكد من حذف هذه الوثيقة من ملف العيادة الرسمي؟" })}
        confirmText={t("common.delete", { defaultValue: "حذف" })}
        variant="danger"
        isLoading={deleteDocMutation.isPending}
      />
    </div>
  );
}

