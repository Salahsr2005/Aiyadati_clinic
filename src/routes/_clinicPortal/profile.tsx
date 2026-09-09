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
  AlertTriangle,
  MapPin,
  ShieldCheck,
  Save,
  X,
  Edit2,
  ExternalLink,
} from "lucide-react";

import { buildUploadFormData, validateUploadFile } from "@/utils/uploadHelper";
import { toast } from "sonner";
import {
  clinicSelfApi,
  type ClinicProfile,
  type ClinicWorkingHour,
  type ClinicDocument,
} from "@/api/clinicSelfApi";
import { clinicAppointmentsApi, type DoctorSlot } from "@/api/clinicAppointmentsApi";
import { useWilayas, useBaladyas } from "@/hooks/useWilayas";
import { qk } from "@/lib/queryKeys";
import { useEntityMutation } from "@/lib/mutations";
import { ensureArray } from "@/lib/utils";

import { GlassCard } from "@/components/glass/GlassCard";
import { RemoteImage } from "@/components/common/RemoteImage";
import { LocationPicker } from "@/components/data/LocationPicker";
import { StatusBadge } from "@/components/data/StatusBadge";
import { EmptyState } from "@/components/data/EmptyState";
import { Skeleton } from "@/components/glass/Skeleton";
import { FormModal } from "@/components/data/FormModal";
import { ConfirmDialog } from "@/components/data/ConfirmDialog";
import { DoctorScheduleHeatmap } from "@/components/schedule/DoctorScheduleHeatmap";

const profileSchema = z.object({
  nameFr: z.string().min(2, "French name is required"),
  nameAr: z.string().optional(),
  descriptionFr: z.string().optional(),
  descriptionAr: z.string().optional(),
  facilityType: z.string().optional(),
  wilayaId: z.union([z.string(), z.number()]).optional(),
  baladyaId: z.union([z.string(), z.number()]).optional(),
  address: z.string().optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

type ProfileTab = "profile" | "schedule" | "documents";

const DAY_ENUMS = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
] as const;

function normalizeHoursState(rawHours: ClinicWorkingHour[]): ClinicWorkingHour[] {
  return DAY_ENUMS.map((dayEnum, idx) => {
    const found = rawHours.find((h) => {
      if (typeof h.dayOfWeek === "number") return h.dayOfWeek === idx;
      if (typeof h.dayOfWeek === "string") {
        return h.dayOfWeek.toUpperCase() === dayEnum || h.dayOfWeek === String(idx);
      }
      return false;
    });
    return {
      id: found?.id,
      dayOfWeek: dayEnum,
      openTime: found?.openTime || "08:00",
      closeTime: found?.closeTime || "17:00",
      isOpen: found?.isOpen !== undefined ? Boolean(found.isOpen) : idx !== 5,
    };
  });
}

export function parseGoogleMapsUrl(input: string): { latitude: number; longitude: number } | null {
  if (!input || !input.trim()) return null;
  const str = input.trim();

  // @lat,lng
  const atMatch = str.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) return { latitude: lat, longitude: lng };
  }

  // q=lat,lng or ll=lat,lng
  const qMatch = str.match(/(?:q|ll|query|search)=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (qMatch) {
    const lat = parseFloat(qMatch[1]);
    const lng = parseFloat(qMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) return { latitude: lat, longitude: lng };
  }

  // direct lat, lng string
  const directMatch = str.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
  if (directMatch) {
    const lat = parseFloat(directMatch[1]);
    const lng = parseFloat(directMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) return { latitude: lat, longitude: lng };
  }

  return null;
}

export default function ClinicProfilePage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ProfileTab>("profile");
  const [isEditing, setIsEditing] = useState(false);

  const daysList = [
    t("days.sunday", { defaultValue: "Sunday" }),
    t("days.monday", { defaultValue: "Monday" }),
    t("days.tuesday", { defaultValue: "Tuesday" }),
    t("days.wednesday", { defaultValue: "Wednesday" }),
    t("days.thursday", { defaultValue: "Thursday" }),
    t("days.friday", { defaultValue: "Friday" }),
    t("days.saturday", { defaultValue: "Saturday" }),
  ];

  const { data: rawProfile, isLoading: isProfileLoading } = useQuery({
    queryKey: qk.clinicSelf.profile(),
    queryFn: clinicSelfApi.getProfile,
  });

  const profile = rawProfile as ClinicProfile | undefined;

  const { data: rawWorkingHours } = useQuery({
    queryKey: qk.clinicSelf.workingHours(),
    queryFn: clinicSelfApi.getWorkingHours,
  });

  const { data: rawDocuments, isLoading: isDocsLoading } = useQuery({
    queryKey: qk.clinicSelf.documents(),
    queryFn: clinicSelfApi.getDocuments,
  });

  const { data: slotsData } = useQuery({
    queryKey: qk.appointments.all(),
    queryFn: () => clinicAppointmentsApi.listSlots({}),
  });

  const workingHours: ClinicWorkingHour[] = ensureArray<ClinicWorkingHour>(rawWorkingHours);
  const documents: ClinicDocument[] = ensureArray<ClinicDocument>(rawDocuments);
  const slots: DoctorSlot[] = useMemo(() => ensureArray<DoctorSlot>(slotsData), [slotsData]);

  const { data: wilayas = [] } = useWilayas();
  const [selectedWilayaId, setSelectedWilayaId] = useState<string | number>("");
  const { data: baladyat = [] } = useBaladyas(selectedWilayaId);

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [hoursState, setHoursState] = useState<ClinicWorkingHour[]>([]);

  useEffect(() => {
    setHoursState(normalizeHoursState(workingHours));
  }, [workingHours]);

  const [gmapsUrl, setGmapsUrl] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
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

  const updateProfileMutation = useEntityMutation({
    mutationFn: (data: ProfileFormData) => {
      const formData = new FormData();
      if (data.nameFr) formData.append("nameFr", data.nameFr);
      if (data.nameAr) formData.append("nameAr", data.nameAr);
      if (data.descriptionFr) formData.append("descriptionFr", data.descriptionFr);
      if (data.descriptionAr) formData.append("descriptionAr", data.descriptionAr);
      if (data.facilityType) formData.append("facilityType", data.facilityType);
      if (data.wilayaId) formData.append("wilayaId", String(data.wilayaId));
      if (data.baladyaId) formData.append("baladyaId", String(data.baladyaId));
      if (data.address) formData.append("address", data.address);
      if (data.latitude !== undefined && data.latitude !== null)
        formData.append("latitude", String(data.latitude));
      if (data.longitude !== undefined && data.longitude !== null)
        formData.append("longitude", String(data.longitude));
      if (logoFile) {
        formData.append("logo", logoFile);
      }
      return clinicSelfApi.updateProfile(formData);
    },
    invalidate: [qk.clinicSelf.profile(), qk.dashboard.profile()],
    successMessage: t("profile.updateSuccess", { defaultValue: "Profile updated successfully" }),
    onSuccess: () => {
      setIsEditing(false);
    },
  });

  const saveHoursMutation = useEntityMutation({
    mutationFn: (hours: ClinicWorkingHour[]) => clinicSelfApi.upsertWorkingHours(hours),
    invalidate: [qk.clinicSelf.workingHours()],
    successMessage: t("profile.hoursSuccess", { defaultValue: "Working hours updated successfully" }),
  });

  const [docUploadModalOpen, setDocUploadModalOpen] = useState(false);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docName, setDocName] = useState("");
  const [docType, setDocType] = useState("REGISTRATION_LICENSE");
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);

  const uploadDocMutation = useEntityMutation({
    mutationFn: ({ file, name, type }: { file: File; name: string; type: string }) => {
      const validation = validateUploadFile(file, "DOCUMENT");
      if (!validation.valid) {
        toast.error(validation.error);
        return Promise.reject(new Error(validation.error));
      }
      const formData = buildUploadFormData("document", file, { name, type });
      return clinicSelfApi.uploadDocument(formData);
    },
    invalidate: [qk.clinicSelf.documents(), qk.dashboard.profile()],
    successMessage: t("profile.docSuccess", { defaultValue: "License document uploaded" }),
    onSuccess: () => {
      setDocUploadModalOpen(false);
      setDocFile(null);
      setDocName("");
    },
  });

  const deleteDocMutation = useEntityMutation({
    mutationFn: (id: string) => clinicSelfApi.deleteDocument(id),
    invalidate: [qk.clinicSelf.documents()],
    successMessage: t("profile.docDeleteSuccess", { defaultValue: "Document deleted" }),
    onSuccess: () => setDeleteDocId(null),
  });

  const completeness = useMemo(() => {
    if (!profile) return 0;
    let score = 0;
    if (profile.nameFr) score += 20;
    if (profile.logoUrl) score += 20;
    if (profile.descriptionFr) score += 15;
    if (profile.wilayaId && profile.baladyaId) score += 15;
    if (profile.latitude && profile.longitude) score += 10;
    if (workingHours.length > 0) score += 10;
    if (documents.length > 0) score += 10;
    return Math.min(100, score);
  }, [profile, workingHours, documents]);

  if (isProfileLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <GlassCard className="p-6 relative overflow-hidden border border-border/40 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-border/50 bg-background shadow-md">
              <RemoteImage
                src={logoFile ? URL.createObjectURL(logoFile) : profile?.logoUrl}
                alt={profile?.nameFr || "Clinic Logo"}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-foreground">
                  {profile?.nameFr || t("app.name", { defaultValue: "Iyadati Clinic Portal" })}
                </h1>
                <StatusBadge value={profile?.isVerified ? "VERIFIED" : "PENDING"} />
              </div>
              {profile?.nameAr && (
                <p className="text-xs text-muted-foreground font-semibold" dir="rtl">
                  {profile.nameAr}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1 font-semibold">
                  <Building2 className="h-3.5 w-3.5 text-primary-500" />
                  <span>{profile?.facilityType || t("profile.clinicFallback", { defaultValue: "Clinic Facility" })}</span>
                </span>
                {profile?.phone && (
                  <>
                    <span>·</span>
                    <span className="font-mono">{profile.phone}</span>
                  </>
                )}
                {profile?.email && (
                  <>
                    <span>·</span>
                    <span>{profile.email}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 self-end md:self-auto">
            {activeTab === "profile" && (
              <button
                onClick={() => setIsEditing(!isEditing)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition cursor-pointer ${
                  isEditing
                    ? "bg-accent text-foreground hover:bg-accent/80"
                    : "bg-primary-500 text-primary-foreground shadow-xs hover:opacity-90"
                }`}
              >
                {isEditing ? <X className="h-4 w-4" /> : <Edit2 className="h-4 w-4" />}
                {isEditing ? t("common.cancel", { defaultValue: "Cancel" }) : t("common.edit", { defaultValue: "Edit Profile" })}
              </button>
            )}
          </div>
        </div>
        <div className="pt-4 border-t border-border/30 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-primary-500" />
              {t("profile.completenessTitle", { defaultValue: "Profile Completeness" })}
            </span>
            <span className="font-mono font-bold text-primary-500">{completeness}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-accent/40 overflow-hidden">
            <div
              className="h-full bg-primary-500 transition-all duration-500 rounded-full"
              style={{ width: `${completeness}%` }}
            />
          </div>
          {completeness < 80 && (
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-warning shrink-0" />
              {t("profile.bannerSub", { defaultValue: "Complete all legal verification documents and hours to boost credibility" })}
            </p>
          )}
        </div>
      </GlassCard>

      <div className="flex items-center gap-2 border-b border-border/40 pb-2">
        {[
          { id: "profile" as ProfileTab, label: t("profile.basicInfo", { defaultValue: "General Profile & Location" }), icon: Building2 },
          { id: "schedule" as ProfileTab, label: t("profile.hoursInfo", { defaultValue: "Weekly Schedule Matrix" }), icon: Clock },
          { id: "documents" as ProfileTab, label: t("profile.documentsInfo", { defaultValue: "Legal Documents & Licensing" }), icon: ShieldCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setIsEditing(false);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                isActive
                  ? "bg-primary-500 text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeTab === "profile" && !isEditing && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GlassCard className="p-6 space-y-4 border border-border/40">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Building2 className="h-4.5 w-4.5 text-primary-500" /> {t("profile.facilityOverview", { defaultValue: "Facility Details" })}
            </h2>
            <div className="space-y-3">
              <div>
                <span className="text-[11px] font-bold text-muted-foreground uppercase">{t("services.serviceName", { defaultValue: "French Name" })}</span>
                <p className="text-sm font-bold text-foreground mt-0.5">{profile?.nameFr || "—"}</p>
              </div>
              {profile?.nameAr && (
                <div>
                  <span className="text-[11px] font-bold text-muted-foreground uppercase">{t("services.serviceName", { defaultValue: "Arabic Name" })}</span>
                  <p className="text-sm font-bold text-foreground mt-0.5" dir="rtl">{profile.nameAr}</p>
                </div>
              )}
              <div>
                <span className="text-[11px] font-bold text-muted-foreground uppercase">{t("common.details", { defaultValue: "French Description" })}</span>
                <p className="text-xs text-foreground/80 leading-relaxed mt-0.5">
                  {profile?.descriptionFr || t("profile.noDesc", { defaultValue: "No description available" })}
                </p>
              </div>
              {profile?.descriptionAr && (
                <div>
                  <span className="text-[11px] font-bold text-muted-foreground uppercase">{t("common.details", { defaultValue: "Arabic Description" })}</span>
                  <p className="text-xs text-foreground/80 leading-relaxed mt-0.5" dir="rtl">{profile.descriptionAr}</p>
                </div>
              )}
            </div>
          </GlassCard>
          <GlassCard className="p-6 space-y-4 border border-border/40">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <MapPin className="h-4.5 w-4.5 text-primary-500" /> {t("profile.locationTitle", { defaultValue: "Geographic Location & Map" })}
            </h2>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-2xl bg-accent/30 border border-border/30">
                <span className="text-[11px] font-bold text-muted-foreground uppercase">Wilaya</span>
                <p className="text-xs font-bold text-foreground mt-1">
                  {wilayas.find((w: any) => String(w.id) === String(profile?.wilayaId))?.nameFr || profile?.wilayaId || "—"}
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-accent/30 border border-border/30">
                <span className="text-[11px] font-bold text-muted-foreground uppercase">{t("profile.baladya", { defaultValue: "Baladya" })}</span>
                <p className="text-xs font-bold text-foreground mt-1">
                  {baladyat.find((b: any) => String(b.id) === String(profile?.baladyaId))?.nameFr || profile?.baladyaId || "—"}
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-accent/30 border border-border/30">
                <span className="text-[11px] font-bold text-muted-foreground uppercase">{t("profile.coordinates", { defaultValue: "Coordinates" })}</span>
                <p className="text-xs font-mono font-semibold text-foreground mt-1">
                  {profile?.latitude && profile?.longitude ? `${profile.latitude}, ${profile.longitude}` : "36.75, 3.05"}
                </p>
              </div>
            </div>
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground">{t("common.address", { defaultValue: "Primary Address" })}</span>
              <p className="text-xs font-medium text-foreground p-3 rounded-2xl bg-muted/20 border border-border/30">
                {profile?.address || t("profile.noAddress", { defaultValue: "No detailed address specified" })}
              </p>
            </div>
            <div className="h-64 rounded-2xl overflow-hidden border border-border/40">
              <LocationPicker
                latitude={profile?.latitude || 36.75}
                longitude={profile?.longitude || 3.05}
                onChange={() => {}}
              />
            </div>
          </GlassCard>
        </div>
      )}

      {activeTab === "profile" && isEditing && (
        <form onSubmit={handleSubmit((d) => updateProfileMutation.mutate(d))} className="space-y-6">
          <GlassCard className="p-6 space-y-4 border border-border/40">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Building2 className="h-4.5 w-4.5 text-primary-500" /> {t("profile.basicInfo", { defaultValue: "Basic Information & Contact" })}
            </h2>
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
                  <Upload className="h-3.5 w-3.5" /> {t("gallery.uploadButton", { defaultValue: "Upload Logo Image" })}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) setLogoFile(file); }} />
                </label>
                <p className="text-[10px] text-muted-foreground mt-1">JPEG, PNG, WebP (Max 5MB)</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t("app.name", { defaultValue: "Clinic Name" })} (FR)*</label>
                <input {...register("nameFr")} className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40" />
                {errors.nameFr && <p className="text-xs text-danger">{errors.nameFr.message}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t("app.name", { defaultValue: "Clinic Name" })} (AR)</label>
                <input {...register("nameAr")} placeholder="مثال: عيادة الشفاء" dir="rtl" className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("profile.facilityType", { defaultValue: "Facility Type" })}</label>
              <select {...register("facilityType")} className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40 bg-background text-foreground">
                <option value="CLINIC">{t("facilityTypes.clinic", { defaultValue: "Polyclinic / Multidisciplinary" })}</option>
                <option value="CABINET">{t("facilityTypes.cabinet", { defaultValue: "Private Cabinet" })}</option>
                <option value="POLYCLINIC">{t("facilityTypes.center", { defaultValue: "Integrated Medical Center" })}</option>
                <option value="HOSPITAL">{t("facilityTypes.hospital", { defaultValue: "Private Hospital" })}</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t("common.details", { defaultValue: "Description" })} (FR)</label>
                <textarea {...register("descriptionFr")} rows={3} className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t("common.details", { defaultValue: "Description" })} (AR)</label>
                <textarea {...register("descriptionAr")} rows={3} dir="rtl" placeholder="وصف الخدمات الطبية والتجهيزات المتوفرة بالعيادة..." className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40" />
              </div>
            </div>
          </GlassCard>
          <GlassCard className="p-6 space-y-4 border border-border/40">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <MapPin className="h-4.5 w-4.5 text-primary-500" /> {t("profile.locationTitle", { defaultValue: "Location & Address Settings" })}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Wilaya*</label>
                <select {...register("wilayaId")} onChange={(e) => { setSelectedWilayaId(e.target.value); setValue("wilayaId", e.target.value); }} className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40 bg-background text-foreground">
                  <option value="">{t("profile.selectWilaya", { defaultValue: "Select Wilaya..." })}</option>
                  {wilayas.map((w: any) => <option key={w.id} value={w.id}>{w.code} - {w.nameFr} ({w.nameAr})</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t("profile.baladya", { defaultValue: "Baladya / Municipality" })}*</label>
                <select {...register("baladyaId")} className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40 bg-background text-foreground">
                  <option value="">{t("profile.selectBaladya", { defaultValue: "Select Baladya..." })}</option>
                  {baladyat.map((b: any) => <option key={b.id} value={b.id}>{b.nameFr} ({b.nameAr})</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("common.address", { defaultValue: "Primary Street Address" })}</label>
              <input {...register("address")} placeholder="e.g. 14 Boulevard Colonel Amirouche, Algiers" className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40" />
            </div>
            <div className="p-3 rounded-2xl bg-primary-500/5 border border-primary-500/20 space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <ExternalLink className="h-3.5 w-3.5 text-primary-500" />
                {t("profile.pasteGoogleMapsUrl", { defaultValue: "Paste Google Maps Link to Auto-Extract Coordinates" })}
              </label>
              <input type="text" value={gmapsUrl} onChange={(e) => { const val = e.target.value; setGmapsUrl(val); const parsed = parseGoogleMapsUrl(val); if (parsed) { setValue("latitude", Number(parsed.latitude.toFixed(6))); setValue("longitude", Number(parsed.longitude.toFixed(6))); toast.success(t("profile.coordsExtracted", { defaultValue: "Coordinates extracted from link!" })); } }} placeholder="https://maps.google.com/?q=36.7528,3.0420" className="glass w-full rounded-xl px-3.5 py-2 text-xs outline-none focus:ring-2 focus:ring-primary-500/40 font-mono" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Latitude</label>
                <input type="number" step="any" {...register("latitude")} placeholder="36.7528" className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40 font-mono" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Longitude</label>
                <input type="number" step="any" {...register("longitude")} placeholder="3.0420" className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40 font-mono" />
              </div>
            </div>
            <div className="pt-2">
              <LocationPicker latitude={watch("latitude")} longitude={watch("longitude")} onChange={(lat, lng) => { setValue("latitude", Number(lat.toFixed(6))); setValue("longitude", Number(lng.toFixed(6))); }} height={260} />
            </div>
            <div className="flex justify-end pt-2">
              <button type="submit" disabled={updateProfileMutation.isPending} className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-6 py-2.5 text-xs font-bold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-50 cursor-pointer">
                {updateProfileMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {t("common.save", { defaultValue: "Save Changes" })}
              </button>
            </div>
          </GlassCard>
        </form>
      )}

      {activeTab === "schedule" && (
        <div className="space-y-6">
          <DoctorScheduleHeatmap slots={slots} />
          <GlassCard className="p-6 space-y-6 border border-border/40">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Clock className="h-4.5 w-4.5 text-primary-500" /> {t("profile.hoursInfo", { defaultValue: "Weekly Working Schedule" })}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">Set facility working hours & days of week</p>
              </div>
              <button onClick={() => saveHoursMutation.mutate(hoursState)} disabled={saveHoursMutation.isPending} className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 cursor-pointer">
                {saveHoursMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {t("common.save", { defaultValue: "Save Changes" })}
              </button>
            </div>
            <div className="space-y-3">
              {daysList.map((dayName, idx) => {
                const dayEnum = DAY_ENUMS[idx];
                const current = hoursState.find((h) => h.dayOfWeek === dayEnum || h.dayOfWeek === idx) || {
                  dayOfWeek: dayEnum,
                  openTime: "08:00",
                  closeTime: "17:00",
                  isOpen: idx !== 5,
                };
                return (
                  <div key={dayEnum} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border transition ${current.isOpen ? "bg-accent/30 border-border/40" : "bg-muted/10 border-border/20 opacity-70"}`}>
                    <div className="flex items-center gap-3 w-36">
                      <input type="checkbox" checked={current.isOpen} onChange={(e) => { const updated = hoursState.map((h) => h.dayOfWeek === dayEnum ? { ...h, isOpen: e.target.checked } : h); setHoursState(updated); }} className="rounded text-primary-500 focus:ring-primary-500 h-4 w-4 cursor-pointer" />
                      <span className="text-xs font-bold text-foreground">{dayName}</span>
                    </div>
                    {current.isOpen ? (
                      <div className="flex items-center gap-2 text-xs">
                        <input type="time" value={current.openTime} onChange={(e) => { const updated = hoursState.map((h) => h.dayOfWeek === dayEnum ? { ...h, openTime: e.target.value } : h); setHoursState(updated); }} className="glass rounded-xl px-3 py-1.5 outline-none font-mono text-xs" />
                        <span className="text-muted-foreground font-semibold">{t("common.to", { defaultValue: "To" })}</span>
                        <input type="time" value={current.closeTime} onChange={(e) => { const updated = hoursState.map((h) => h.dayOfWeek === dayEnum ? { ...h, closeTime: e.target.value } : h); setHoursState(updated); }} className="glass rounded-xl px-3 py-1.5 outline-none font-mono text-xs" />
                      </div>
                    ) : (
                      <span className="text-xs font-bold text-muted-foreground px-3 py-1.5">{t("common.closed", { defaultValue: "Closed" })}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </GlassCard>
        </div>
      )}

      {activeTab === "documents" && (
        <div className="space-y-6">
          <GlassCard className="p-6 space-y-4 border border-border/40">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <ShieldCheck className="h-4.5 w-4.5 text-primary-500" /> {t("profile.documentsInfo", { defaultValue: "Legal Licenses & Credentials" })}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("profile.documentsSub", { defaultValue: "Upload official practice licenses and registration certificates for verification" })}
                </p>
              </div>
              <button onClick={() => setDocUploadModalOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-xs transition hover:opacity-90 cursor-pointer self-start sm:self-auto">
                <Upload className="h-4 w-4" />
                {t("profile.uploadDoc", { defaultValue: "Upload License Document" })}
              </button>
            </div>
            {isDocsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}
              </div>
            ) : documents.length === 0 ? (
              <EmptyState
                title={t("profile.noDocsTitle", { defaultValue: "No official documents uploaded yet" })}
                description={t("profile.noDocsSub", { defaultValue: "Upload your legal registration documents to gain official verification." })}
                action={
                  <button onClick={() => setDocUploadModalOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 cursor-pointer">
                    <Upload className="h-4 w-4" /> {t("profile.uploadDoc", { defaultValue: "Upload License Document" })}
                  </button>
                }
              />
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-accent/30 border border-border/40 hover:bg-accent/60 transition">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-2xl bg-primary-500/15 text-primary-500 grid place-items-center font-bold shrink-0">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-foreground">{doc.name}</h4>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                          <span>{t("profile.docTypePrefix", { defaultValue: "Type: " })}{doc.type || "REGISTRATION_LICENSE"}</span>
                          {doc.createdAt && (
                            <>
                              <span>·</span>
                              <span>{t("profile.uploadedOn", { defaultValue: "Uploaded on " })}{doc.createdAt.slice(0, 10)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge value={doc.status || "APPROVED"} />
                      <button onClick={() => setDeleteDocId(doc.id)} className="p-1.5 rounded-lg text-danger/70 hover:bg-danger/10 hover:text-danger transition cursor-pointer">
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

      <FormModal
        id="upload-doc-modal"
        open={docUploadModalOpen}
        onClose={() => setDocUploadModalOpen(false)}
        title={t("profile.uploadDoc", { defaultValue: "Upload License Document" })}
        description={t("profile.uploadDocModalSub", { defaultValue: "Select document file (PDF, PNG, JPG under 10MB)" })}
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("profile.docNameLabel", { defaultValue: "Document Name / Title*" })}</label>
            <input type="text" value={docName} onChange={(e) => setDocName(e.target.value)} placeholder="e.g. Annual Practice License 2026" className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("profile.docTypeLabel", { defaultValue: "Document Category" })}</label>
            <select value={docType} onChange={(e) => setDocType(e.target.value)} className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40 bg-background text-foreground">
              <option value="REGISTRATION_LICENSE">{t("docTypes.registration", { defaultValue: "Medical / Commercial Registration" })}</option>
              <option value="MEDICAL_APPROVAL">{t("docTypes.approval", { defaultValue: "Ministry of Health Approval" })}</option>
              <option value="TAX_CARD">{t("docTypes.nif", { defaultValue: "Tax Certificate (NIF)" })}</option>
              <option value="FACILITY_PHOTO">{t("docTypes.practice", { defaultValue: "Practice License" })}</option>
            </select>
          </div>
          <label className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border/60 p-6 text-center hover:border-primary-500/50 hover:bg-primary-500/5 transition cursor-pointer">
            <FileText className="h-8 w-8 text-primary-500" />
            <span className="text-xs font-semibold text-foreground">{docFile ? docFile.name : t("profile.clickToSelectDoc", { defaultValue: "Click to select document file" })}</span>
            <input type="file" accept=".pdf,image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) setDocFile(file); }} />
          </label>
          <div className="pt-4 border-t border-border/40 flex justify-end gap-2">
            <button type="button" onClick={() => setDocUploadModalOpen(false)} className="rounded-xl px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent cursor-pointer">
              {t("common.cancel", { defaultValue: "Cancel" })}
            </button>
            <button type="button" disabled={!docFile || !docName.trim() || uploadDocMutation.isPending} onClick={() => { if (docFile && docName.trim()) { uploadDocMutation.mutate({ file: docFile, name: docName.trim(), type: docType }); } }} className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 cursor-pointer">
              {uploadDocMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {t("profile.uploadDoc", { defaultValue: "Upload License Document" })}
            </button>
          </div>
        </div>
      </FormModal>
      <ConfirmDialog
        open={!!deleteDocId}
        onClose={() => setDeleteDocId(null)}
        onConfirm={() => { if (deleteDocId) deleteDocMutation.mutate(deleteDocId); }}
        title={t("profile.deleteDocTitle", { defaultValue: "Delete License Document" })}
        description={t("profile.deleteDocMessage", { defaultValue: "Are you sure you want to remove this document from the clinic profile?" })}
        confirmText={t("common.delete", { defaultValue: "Delete" })}
        variant="danger"
        isLoading={deleteDocMutation.isPending}
      />
    </div>
  );
}
