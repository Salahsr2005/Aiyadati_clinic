import { useState, useEffect } from "react";
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
  const [activeTab, setActiveTab] = useState<"profile" | "schedule" | "documents">("profile");

  const { data: profile } = useQuery({
    queryKey: qk.clinicSelf.profile(),
    queryFn: clinicSelfApi.getProfile,
  });

  const { data: rawWorkingHours } = useQuery({
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
    successMessage: "Clinic profile updated successfully",
  });

  // Working Hours Mutation
  const saveHoursMutation = useEntityMutation({
    mutationFn: (hours: ClinicWorkingHour[]) => clinicSelfApi.upsertWorkingHours(hours),
    invalidate: [qk.clinicSelf.workingHours()],
    successMessage: "Working hours schedule saved",
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
    successMessage: "Document uploaded successfully",
    onSuccess: () => {
      setDocUploadModalOpen(false);
      setDocFile(null);
      setDocName("");
    },
  });

  const deleteDocMutation = useEntityMutation({
    mutationFn: (id: string) => clinicSelfApi.deleteDocument(id),
    invalidate: [qk.clinicSelf.documents()],
    successMessage: "Document deleted",
    onSuccess: () => setDeleteDocId(null),
  });

  const onProfileSubmit = (data: ProfileFormData) => {
    updateProfileMutation.mutate(data);
  };

  const handleHourToggle = (dayIdx: number, isOpen: boolean) => {
    setHoursState((prev) =>
      prev.map((h) => (h.dayOfWeek === dayIdx ? { ...h, isOpen } : h))
    );
  };

  const handleTimeChange = (dayIdx: number, field: "openTime" | "closeTime", val: string) => {
    setHoursState((prev) =>
      prev.map((h) => (h.dayOfWeek === dayIdx ? { ...h, [field]: val } : h))
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Clinic Profile & Settings</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Manage your facility identity, operating hours, and legal verification documents
        </p>
      </div>

      {/* Profile Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-border/40 pb-2">
        <button
          onClick={() => setActiveTab("profile")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition cursor-pointer ${
            activeTab === "profile"
              ? "bg-primary-500/12 text-primary-500"
              : "text-muted-foreground hover:bg-accent/60"
          }`}
        >
          <Building2 className="h-4 w-4" /> Facility Profile
        </button>

        <button
          onClick={() => setActiveTab("schedule")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition cursor-pointer ${
            activeTab === "schedule"
              ? "bg-primary-500/12 text-primary-500"
              : "text-muted-foreground hover:bg-accent/60"
          }`}
        >
          <Clock className="h-4 w-4" /> Weekly Schedule
        </button>

        <button
          onClick={() => setActiveTab("documents")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition cursor-pointer ${
            activeTab === "documents"
              ? "bg-primary-500/12 text-primary-500"
              : "text-muted-foreground hover:bg-accent/60"
          }`}
        >
          <FileText className="h-4 w-4" /> Verification Documents
        </button>
      </div>

      {/* TAB 1: FACILITY PROFILE */}
      {activeTab === "profile" && (
        <form onSubmit={handleSubmit(onProfileSubmit)} className="space-y-6">
          <GlassCard className="p-6 space-y-6">
            <h2 className="text-base font-bold">Facility Branding & Logo</h2>

            <div className="flex items-center gap-6">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-border/50 bg-accent/40">
                <RemoteImage
                  src={logoFile ? URL.createObjectURL(logoFile) : profile?.logoUrl}
                  alt={profile?.nameFr || "Clinic Logo"}
                  className="h-full w-full object-cover"
                />
              </div>

              <label className="inline-flex items-center gap-2 rounded-xl glass border border-border/60 px-4 py-2.5 text-xs font-semibold text-foreground transition hover:bg-accent cursor-pointer">
                <Upload className="h-4 w-4 text-primary-500" />
                Change Logo Image
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) setLogoFile(e.target.files[0]);
                  }}
                />
              </label>
            </div>
          </GlassCard>

          <GlassCard className="p-6 space-y-4">
            <h2 className="text-base font-bold">General Information</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Clinic Name (French)*</label>
                <input
                  {...register("nameFr")}
                  className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
                />
                {errors.nameFr && <p className="text-xs text-danger">{errors.nameFr.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Clinic Name (Arabic)</label>
                <input
                  {...register("nameAr")}
                  dir="rtl"
                  className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Description (French)</label>
                <textarea
                  {...register("descriptionFr")}
                  rows={3}
                  className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Description (Arabic)</label>
                <textarea
                  {...register("descriptionAr")}
                  rows={3}
                  dir="rtl"
                  className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
                />
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-6 space-y-4">
            <h2 className="text-base font-bold">Location & Address</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Wilaya</label>
                <select
                  {...register("wilayaId")}
                  onChange={(e) => {
                    setSelectedWilayaId(e.target.value);
                    register("wilayaId").onChange(e);
                  }}
                  className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40 bg-background text-foreground"
                >
                  <option value="">Select Wilaya</option>
                  {wilayas.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.id} — {w.nameFr} ({w.nameAr})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Baladya</label>
                <select
                  {...register("baladyaId")}
                  className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40 bg-background text-foreground"
                >
                  <option value="">Select Baladya</option>
                  {baladyat.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.nameFr} ({b.nameAr})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Street Address</label>
              <input
                {...register("address")}
                placeholder="e.g. 12 Rue Didouche Mourad"
                className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
              />
            </div>

            <div className="space-y-2 pt-2">
              <label className="text-sm font-medium">Pin Practice Location on Map</label>
              <LocationPicker
                latitude={profile?.latitude || 36.75}
                longitude={profile?.longitude || 3.05}
                onChange={(lat, lng) => {
                  reset((prev) => ({ ...prev, latitude: lat, longitude: lng }));
                }}
                height={260}
              />
            </div>
          </GlassCard>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={updateProfileMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              {updateProfileMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Profile Settings
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: WEEKLY SCHEDULE */}
      {activeTab === "schedule" && (
        <GlassCard className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold">Operating Hours (7 Days)</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Configure opening and closing times for your facility each day of the week
              </p>
            </div>

            <button
              onClick={() => saveHoursMutation.mutate(hoursState)}
              disabled={saveHoursMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              {saveHoursMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save Working Hours
            </button>
          </div>

          <div className="divide-y divide-border/40">
            {DAYS.map((dayName, idx) => {
              const current = hoursState.find((h) => h.dayOfWeek === idx) || {
                dayOfWeek: idx,
                openTime: "08:00",
                closeTime: "17:00",
                isOpen: true,
              };

              return (
                <div key={dayName} className="flex flex-col sm:flex-row sm:items-center justify-between py-3.5 gap-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={current.isOpen}
                      onChange={(e) => handleHourToggle(idx, e.target.checked)}
                      className="h-4 w-4 rounded border-border text-primary-500"
                    />
                    <span className="text-sm font-semibold w-28">{dayName}</span>
                    <span
                      className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${
                        current.isOpen ? "bg-success/15 text-success" : "bg-accent text-muted-foreground"
                      }`}
                    >
                      {current.isOpen ? "OPEN" : "CLOSED"}
                    </span>
                  </div>

                  {current.isOpen ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={current.openTime}
                        onChange={(e) => handleTimeChange(idx, "openTime", e.target.value)}
                        className="glass rounded-xl px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary-500/40"
                      />
                      <span className="text-xs text-muted-foreground">to</span>
                      <input
                        type="time"
                        value={current.closeTime}
                        onChange={(e) => handleTimeChange(idx, "closeTime", e.target.value)}
                        className="glass rounded-xl px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary-500/40"
                      />
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">Facility closed</span>
                  )}
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}

      {/* TAB 3: VERIFICATION DOCUMENTS */}
      {activeTab === "documents" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold">Verification Documents</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Upload official accreditation documents (PDF, JPEG, PNG, max 20MB)
              </p>
            </div>

            <button
              onClick={() => setDocUploadModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 cursor-pointer"
            >
              <Upload className="h-4 w-4" />
              Upload Document
            </button>
          </div>

          {isDocsLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-20 w-full rounded-2xl" />
              ))}
            </div>
          ) : documents.length === 0 ? (
            <GlassCard className="p-12 text-center">
              <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
              <h3 className="text-base font-semibold">No verification documents uploaded</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                Upload your clinic registration license or facility permit for platform verification.
              </p>
            </GlassCard>
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => (
                <GlassCard key={doc.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3.5">
                    <div className="h-10 w-10 rounded-2xl bg-primary-500/15 text-primary-500 grid place-items-center font-bold">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold">{doc.name}</h4>
                      <p className="text-[11px] text-muted-foreground">
                        {doc.type || "Document"} • Uploaded {doc.createdAt}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-accent text-xs font-semibold hover:bg-accent/80 transition"
                    >
                      View
                    </a>
                    <button
                      onClick={() => setDeleteDocId(doc.id)}
                      className="p-1.5 rounded-xl text-muted-foreground hover:bg-danger/15 hover:text-danger transition cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </GlassCard>
              ))}
            </div>
          )}

          {/* Upload Document Modal */}
          <FormModal
            id="upload-document-modal"
            open={docUploadModalOpen}
            onClose={() => setDocUploadModalOpen(false)}
            title="Upload Verification Document"
            description="Select document file (PDF, JPEG, PNG, max 20MB)"
          >
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Document Title*</label>
                <input
                  type="text"
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  placeholder="e.g. Health Ministry License 2026"
                  className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Document Type</label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40 bg-background text-foreground"
                >
                  <option value="REGISTRATION_LICENSE">Facility Registration License</option>
                  <option value="TAX_PERMIT">Tax / Commercial Permit</option>
                  <option value="ACCREDITATION">Accreditation Certificate</option>
                  <option value="OTHER">Other Official Document</option>
                </select>
              </div>

              <label className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border/60 p-6 text-center hover:border-primary-500/50 hover:bg-primary-500/5 transition cursor-pointer">
                <Upload className="h-6 w-6 text-primary-500" />
                <span className="text-xs font-semibold text-foreground">
                  {docFile ? docFile.name : "Click to browse document file"}
                </span>
                <span className="text-[11px] text-muted-foreground">PDF, PNG, JPG (Max 20MB)</span>
                <input
                  type="file"
                  accept=".pdf,image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setDocFile(f);
                  }}
                />
              </label>

              <div className="pt-4 border-t border-border/40 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDocUploadModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent cursor-pointer"
                >
                  Cancel
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
                  Upload Document
                </button>
              </div>
            </div>
          </FormModal>

          {/* Delete Document Confirm */}
          <ConfirmDialog
            id="delete-doc-dialog"
            open={!!deleteDocId}
            onClose={() => setDeleteDocId(null)}
            onConfirm={() => {
              if (deleteDocId) deleteDocMutation.mutate(deleteDocId);
            }}
            title="Delete Document"
            description="Are you sure you want to remove this verification document?"
            confirmLabel="Delete Document"
            danger={true}
          />
        </div>
      )}
    </div>
  );
}
