import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  UserPlus,
  Stethoscope,
  Upload,
  X,
  Loader2,
  CheckCircle2,
  Sparkles,
  MapPin,
  FileText,
  Mail,
  Camera,
} from "lucide-react";
import { FormModal } from "@/components/data/FormModal";
import { clinicSelfApi } from "@/api/clinicSelfApi";
import { specialtyApi, type SpecialtyRow } from "@/api/specialtyApi";
import { useWilayas, useBaladyas } from "@/hooks/useWilayas";
import { useQuery } from "@/lib/queryClient";
import { useEntityMutation } from "@/lib/mutations";
import { qk } from "@/lib/queryKeys";
import { ensureArray } from "@/lib/utils";
import { validateUploadFile } from "@/utils/uploadHelper";
import { toast } from "sonner";

const doctorCreateSchema = z.object({
  firstNameFr: z.string().min(2, "French first name must be at least 2 characters").max(50),
  lastNameFr: z.string().min(2, "French last name must be at least 2 characters").max(50),
  firstNameAr: z.string().min(2, "Arabic first name must be at least 2 characters").max(50),
  lastNameAr: z.string().min(2, "Arabic last name must be at least 2 characters").max(50),
  email: z.string().email("Valid email address is required"),
  phone: z
    .string()
    .regex(/^[0-9]{10}$/, "Phone must be exactly 10 digits (e.g. 0550123456)"),
  wilayaId: z.string().min(1, "Wilaya is required"),
  baladyaId: z.string().optional(),
  specialtyIds: z.array(z.string()).min(1, "Select at least one medical specialty"),
  yearsOfExp: z.coerce.number().min(0).max(60).optional(),
  practiceType: z.enum(["INDEPENDENT", "CLINIC_BASED", "BOTH"]).default("CLINIC_BASED"),
  bioFr: z.string().max(1000).optional(),
  bioAr: z.string().max(1000).optional(),
});

type DoctorCreateFormData = z.infer<typeof doctorCreateSchema>;

interface DoctorCreateModalProps {
  open: boolean;
  onClose: () => void;
}

export function DoctorCreateModal({ open, onClose }: DoctorCreateModalProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";

  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [specialtySearch, setSpecialtySearch] = useState("");

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors },
  } = useForm<DoctorCreateFormData>({
    resolver: zodResolver(doctorCreateSchema),
    defaultValues: {
      practiceType: "CLINIC_BASED",
      specialtyIds: [],
      yearsOfExp: 0,
    },
  });

  const selectedWilayaId = watch("wilayaId");

  // Wilayas & Baladyas
  const { data: wilayasRaw, isLoading: isWilayasLoading } = useWilayas();
  const wilayas = ensureArray<any>(wilayasRaw);

  const { data: baladyasRaw, isLoading: isBaladyasLoading } = useBaladyas(selectedWilayaId);
  const baladyas = ensureArray<any>(baladyasRaw);

  // Platform Specialties
  const { data: specialtiesRaw, isLoading: isSpecialtiesLoading } = useQuery({
    queryKey: qk.specialties.list(),
    queryFn: () => specialtyApi.list(),
    enabled: open,
  });
  const specialties: SpecialtyRow[] = ensureArray<SpecialtyRow>(specialtiesRaw);

  const filteredSpecialties = useMemo(() => {
    if (!specialtySearch.trim()) return specialties;
    const term = specialtySearch.toLowerCase();
    return specialties.filter((s) => {
      const nameFr = (s.nameFr || "").toLowerCase();
      const nameAr = (s.nameAr || "").toLowerCase();
      return nameFr.includes(term) || nameAr.includes(term);
    });
  }, [specialties, specialtySearch]);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateUploadFile(file, "IMAGE");
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    setSelectedPhoto(file);
    const previewUrl = URL.createObjectURL(file);
    setPhotoPreview(previewUrl);
  };

  const removePhoto = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setSelectedPhoto(null);
    setPhotoPreview(null);
  };

  const createDoctorMutation = useEntityMutation({
    mutationFn: (data: DoctorCreateFormData) => {
      return clinicSelfApi.createDoctor({
        ...data,
        logo: selectedPhoto,
      });
    },
    invalidate: [
      qk.clinicSelf.doctors(),
      qk.dashboard.doctors(),
      qk.dashboard.pendingInvites(),
    ],
    successMessage: t("doctors.createSuccess", {
      defaultValue: "Doctor registered successfully! Credentials email dispatched.",
    }),
    onSuccess: () => {
      reset();
      removePhoto();
      onClose();
    },
  });

  const onSubmit = (data: DoctorCreateFormData) => {
    createDoctorMutation.mutate(data);
  };

  return (
    <FormModal
      id="doctor-create-modal"
      open={open}
      onClose={() => {
        removePhoto();
        onClose();
      }}
      title={t("doctors.createModalTitle", { defaultValue: "Register New Practice Doctor" })}
      description={t("doctors.createModalSubtitle", {
        defaultValue:
          "Onboard a medical specialist directly to your clinic facility roster with instant affiliation.",
      })}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Photo Upload & Preview Header */}
        <div className="flex items-center gap-4 p-3.5 rounded-2xl bg-muted/30 border border-border/40">
          <div className="relative group shrink-0">
            {photoPreview ? (
              <img
                src={photoPreview}
                alt="Doctor avatar"
                className="h-18 w-18 rounded-2xl object-cover border-2 border-primary-500/50 shadow-md"
              />
            ) : (
              <div className="h-18 w-18 rounded-2xl bg-primary-500/10 border-2 border-dashed border-primary-500/30 grid place-items-center text-primary-500">
                <Camera className="h-6 w-6" />
              </div>
            )}
            {photoPreview && (
              <button
                type="button"
                onClick={removePhoto}
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-danger text-white grid place-items-center shadow hover:scale-105 transition"
                title={t("common.remove", { defaultValue: "Remove" })}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <label className="text-xs font-bold text-foreground">
              {t("doctors.photoLabel", { defaultValue: "Doctor Portrait / Photo" })}
            </label>
            <p className="text-[11px] text-muted-foreground leading-snug">
              {t("doctors.photoHint", {
                defaultValue: "JPG, PNG or WEBP up to 5MB. Professional headshot recommended.",
              })}
            </p>
            <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-lg bg-primary-500/10 px-2.5 py-1 text-xs font-semibold text-primary-500 hover:bg-primary-500/20 transition mt-1">
              <Upload className="h-3.5 w-3.5" />
              <span>{photoPreview ? t("common.change", { defaultValue: "Change Photo" }) : t("common.browse", { defaultValue: "Choose File" })}</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handlePhotoSelect}
              />
            </label>
          </div>
        </div>

        {/* Section 1: Names (French & Arabic) */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary-500">
            <Sparkles className="h-3.5 w-3.5" />
            <span>{t("doctors.sectionNames", { defaultValue: "Doctor Identity (Bilingual)" })}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                {t("doctors.firstNameFr", { defaultValue: "First Name (French/Latin)" })}{" "}
                <span className="text-danger">*</span>
              </label>
              <input
                {...register("firstNameFr")}
                placeholder="e.g. Amine"
                className="w-full rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary-500 focus:outline-hidden transition"
              />
              {errors.firstNameFr && (
                <p className="text-[10px] text-danger mt-1">{errors.firstNameFr.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                {t("doctors.lastNameFr", { defaultValue: "Last Name (French/Latin)" })}{" "}
                <span className="text-danger">*</span>
              </label>
              <input
                {...register("lastNameFr")}
                placeholder="e.g. Benali"
                className="w-full rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary-500 focus:outline-hidden transition"
              />
              {errors.lastNameFr && (
                <p className="text-[10px] text-danger mt-1">{errors.lastNameFr.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                {t("doctors.firstNameAr", { defaultValue: "First Name (Arabic)" })}{" "}
                <span className="text-danger">*</span>
              </label>
              <input
                {...register("firstNameAr")}
                dir="rtl"
                placeholder="مثال: أمين"
                className="w-full rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary-500 focus:outline-hidden transition"
              />
              {errors.firstNameAr && (
                <p className="text-[10px] text-danger mt-1">{errors.firstNameAr.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                {t("doctors.lastNameAr", { defaultValue: "Last Name (Arabic)" })}{" "}
                <span className="text-danger">*</span>
              </label>
              <input
                {...register("lastNameAr")}
                dir="rtl"
                placeholder="مثال: بن علي"
                className="w-full rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary-500 focus:outline-hidden transition"
              />
              {errors.lastNameAr && (
                <p className="text-[10px] text-danger mt-1">{errors.lastNameAr.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Contact & Credentials */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary-500">
            <Mail className="h-3.5 w-3.5" />
            <span>{t("doctors.sectionContact", { defaultValue: "Contact & Credentials" })}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                {t("doctors.email", { defaultValue: "Professional Email" })}{" "}
                <span className="text-danger">*</span>
              </label>
              <input
                {...register("email")}
                type="email"
                placeholder="doctor@hospital.dz"
                className="w-full rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary-500 focus:outline-hidden transition"
              />
              {errors.email && (
                <p className="text-[10px] text-danger mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                {t("doctors.phone", { defaultValue: "Mobile Phone (10 digits)" })}{" "}
                <span className="text-danger">*</span>
              </label>
              <div className="relative">
                <input
                  {...register("phone")}
                  type="tel"
                  maxLength={10}
                  placeholder="0550123456"
                  className="w-full rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground/60 focus:border-primary-500 focus:outline-hidden transition"
                />
              </div>
              {errors.phone && (
                <p className="text-[10px] text-danger mt-1">{errors.phone.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Section 3: Professional Practice */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary-500">
            <Stethoscope className="h-3.5 w-3.5" />
            <span>{t("doctors.sectionPractice", { defaultValue: "Specialties & Experience" })}</span>
          </div>

          {/* Specialties Multi-Select */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              {t("doctors.specialtiesLabel", { defaultValue: "Medical Specialties" })}{" "}
              <span className="text-danger">*</span>
            </label>

            <Controller
              control={control}
              name="specialtyIds"
              render={({ field }) => {
                const selectedIds = field.value || [];
                const toggleSpecialty = (id: string) => {
                  if (selectedIds.includes(id)) {
                    field.onChange(selectedIds.filter((x: string) => x !== id));
                  } else {
                    field.onChange([...selectedIds, id]);
                  }
                };

                return (
                  <div className="space-y-2">
                    {/* Search box */}
                    <input
                      type="text"
                      value={specialtySearch}
                      onChange={(e) => setSpecialtySearch(e.target.value)}
                      placeholder={t("doctors.searchSpecialtyPlaceholder", {
                        defaultValue: "Filter specialties (e.g. Cardiology, Pédiatrie)...",
                      })}
                      className="w-full rounded-xl border border-border/50 bg-background/50 px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-primary-500 focus:outline-hidden transition"
                    />

                    {/* Chips container */}
                    <div className="max-h-36 overflow-y-auto p-2 rounded-xl border border-border/40 bg-muted/20 flex flex-wrap gap-1.5">
                      {isSpecialtiesLoading ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2 px-1">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>{t("common.loading", { defaultValue: "Loading specialties..." })}</span>
                        </div>
                      ) : filteredSpecialties.length === 0 ? (
                        <p className="text-xs text-muted-foreground p-1">
                          {t("doctors.noSpecialtiesFound", { defaultValue: "No matching specialties found" })}
                        </p>
                      ) : (
                        filteredSpecialties.map((spec) => {
                          const isSelected = selectedIds.includes(spec.id);
                          const label = isRtl
                            ? spec.nameAr || spec.nameFr
                            : spec.nameFr || spec.nameAr;

                          return (
                            <button
                              key={spec.id}
                              type="button"
                              onClick={() => toggleSpecialty(spec.id)}
                              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                                isSelected
                                  ? "bg-primary-500 text-primary-foreground shadow-xs font-semibold"
                                  : "bg-background/80 text-muted-foreground hover:bg-muted/80 hover:text-foreground border border-border/40"
                              }`}
                            >
                              {isSelected && <CheckCircle2 className="h-3 w-3" />}
                              <span>{label}</span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              }}
            />
            {errors.specialtyIds && (
              <p className="text-[10px] text-danger mt-1">{errors.specialtyIds.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                {t("doctors.practiceType", { defaultValue: "Practice Mode" })}
              </label>
              <select
                {...register("practiceType")}
                className="w-full rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-xs text-foreground focus:border-primary-500 focus:outline-hidden transition"
              >
                <option value="CLINIC_BASED">
                  {t("doctors.practiceClinicBased", { defaultValue: "Clinic Facility Based" })}
                </option>
                <option value="INDEPENDENT">
                  {t("doctors.practiceIndependent", { defaultValue: "Independent Private Cabinet" })}
                </option>
                <option value="BOTH">
                  {t("doctors.practiceBoth", { defaultValue: "Hybrid / Both" })}
                </option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                {t("doctors.yearsOfExp", { defaultValue: "Years of Experience" })}
              </label>
              <input
                {...register("yearsOfExp")}
                type="number"
                min={0}
                max={60}
                placeholder="5"
                className="w-full rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary-500 focus:outline-hidden transition"
              />
              {errors.yearsOfExp && (
                <p className="text-[10px] text-danger mt-1">{errors.yearsOfExp.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Section 4: Location (Wilaya & Baladya) */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary-500">
            <MapPin className="h-3.5 w-3.5" />
            <span>{t("doctors.sectionLocation", { defaultValue: "Location & Jurisdiction" })}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                {t("doctors.wilaya", { defaultValue: "Wilaya" })} <span className="text-danger">*</span>
              </label>
              <select
                {...register("wilayaId")}
                className="w-full rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-xs text-foreground focus:border-primary-500 focus:outline-hidden transition"
              >
                <option value="">{t("doctors.selectWilaya", { defaultValue: "-- Select Wilaya --" })}</option>
                {wilayas.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code ? `${String(w.code).padStart(2, "0")} - ` : ""}
                    {isRtl ? w.nameAr || w.nameFr : w.nameFr || w.nameAr}
                  </option>
                ))}
              </select>
              {errors.wilayaId && (
                <p className="text-[10px] text-danger mt-1">{errors.wilayaId.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                {t("doctors.baladya", { defaultValue: "Baladya (Commune)" })}
              </label>
              <select
                {...register("baladyaId")}
                disabled={!selectedWilayaId || isBaladyasLoading}
                className="w-full rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-xs text-foreground focus:border-primary-500 focus:outline-hidden transition disabled:opacity-50"
              >
                <option value="">
                  {!selectedWilayaId
                    ? t("doctors.selectWilayaFirst", { defaultValue: "-- Choose Wilaya First --" })
                    : isBaladyasLoading
                    ? t("common.loading", { defaultValue: "Loading..." })
                    : t("doctors.selectBaladya", { defaultValue: "-- Select Baladya --" })}
                </option>
                {baladyas.map((b) => (
                  <option key={b.id} value={b.id}>
                    {isRtl ? b.nameAr || b.nameFr : b.nameFr || b.nameAr}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Section 5: Medical Bio (Bilingual) */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary-500">
            <FileText className="h-3.5 w-3.5" />
            <span>{t("doctors.sectionBio", { defaultValue: "Practitioner Biography" })}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                {t("doctors.bioFr", { defaultValue: "Biography (French/Latin)" })}
              </label>
              <textarea
                {...register("bioFr")}
                rows={3}
                placeholder="Dr. Amine est spécialisé en..."
                className="w-full rounded-xl border border-border/60 bg-background/60 p-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary-500 focus:outline-hidden transition resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                {t("doctors.bioAr", { defaultValue: "Biography (Arabic)" })}
              </label>
              <textarea
                {...register("bioAr")}
                dir="rtl"
                rows={3}
                placeholder="الدكتور أمين متخصص في..."
                className="w-full rounded-xl border border-border/60 bg-background/60 p-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary-500 focus:outline-hidden transition resize-none"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/40">
          <button
            type="button"
            onClick={onClose}
            disabled={createDoctorMutation.isPending}
            className="rounded-xl border border-border px-4 py-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted/80 transition cursor-pointer"
          >
            {t("common.cancel", { defaultValue: "Cancel" })}
          </button>

          <button
            type="submit"
            disabled={createDoctorMutation.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-2.5 text-xs font-semibold text-primary-foreground shadow-md hover:opacity-90 transition cursor-pointer disabled:opacity-60"
          >
            {createDoctorMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{t("doctors.submitting", { defaultValue: "Registering Doctor..." })}</span>
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                <span>{t("doctors.submitCreate", { defaultValue: "Register & Affiliate Doctor" })}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </FormModal>
  );
}
