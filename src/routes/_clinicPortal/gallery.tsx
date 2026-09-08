import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@/lib/queryClient";
import {
  Image as ImageIcon,
  Upload,
  Loader2,
  Maximize2,
  Trash2,
  Info,
  Calendar,
  Layers,
  Sparkles,
  X,
} from "lucide-react";
import { clinicSelfApi, type ClinicGalleryItem } from "@/api/clinicSelfApi";
import { qk } from "@/lib/queryKeys";
import { useEntityMutation } from "@/lib/mutations";
import { ensureArray } from "@/lib/utils";
import { GlassCard } from "@/components/glass/GlassCard";
import { RemoteImage } from "@/components/common/RemoteImage";
import { FormModal } from "@/components/data/FormModal";
import { ConfirmDialog } from "@/components/data/ConfirmDialog";
import { buildUploadFormData, validateUploadFile } from "@/utils/uploadHelper";
import { toast } from "sonner";
import { EmptyState } from "@/components/data/EmptyState";
import { Skeleton } from "@/components/glass/Skeleton";

export default function GalleryPage() {
  const { t } = useTranslation();
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [titleInput, setTitleInput] = useState("");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { data: rawGallery, isLoading } = useQuery({
    queryKey: qk.clinicSelf.gallery(),
    queryFn: clinicSelfApi.getGallery,
  });

  const gallery: ClinicGalleryItem[] = ensureArray<ClinicGalleryItem>(rawGallery);

  const uploadMutation = useEntityMutation({
    mutationFn: ({ file, title }: { file: File; title?: string }) => {
      const validation = validateUploadFile(file, "IMAGE");
      if (!validation.valid) {
        toast.error(validation.error);
        return Promise.reject(new Error(validation.error));
      }
      const formData = buildUploadFormData("image", file, title?.trim() ? { title: title.trim() } : undefined);
      return clinicSelfApi.uploadGalleryImage(formData);
    },
    invalidate: [qk.clinicSelf.gallery(), qk.dashboard.gallery()],
    successMessage: t("gallery.uploadSuccess", { defaultValue: "تم رفع صورة المعرض بنجاح" }),
    onSuccess: () => {
      setUploadModalOpen(false);
      setSelectedFile(null);
      setTitleInput("");
    },
  });

  const deleteMutation = useEntityMutation({
    mutationFn: (id: string) => clinicSelfApi.deleteGalleryImage(id),
    invalidate: [qk.clinicSelf.gallery()],
    successMessage: t("gallery.deleteSuccess", { defaultValue: "تم حذف الصورة من المعرض" }),
    onSuccess: () => setConfirmDeleteId(null),
  });

  // Stats
  const stats = useMemo(() => {
    const total = gallery.length;
    const withTitle = gallery.filter((g) => g.title && g.title.trim().length > 0).length;
    return { total, withTitle };
  }, [gallery]);

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("gallery.title", { defaultValue: "معرض صور ومرافق العيادة" })}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("gallery.subtitle", { defaultValue: "إدارة التوثيق البصري للعيادة والتجهيزات الطبيّة" })}
          </p>
        </div>

        <button
          onClick={() => setUploadModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-xs transition hover:opacity-90 cursor-pointer self-start sm:self-auto"
        >
          <Upload className="h-4 w-4" />
          {t("gallery.uploadButton", { defaultValue: "إضافة صورة جديدة للمعرض" })}
        </button>
      </div>

      {/* Notice Banner */}
      <GlassCard className="p-4 flex items-center justify-between gap-4 bg-primary-500/5 border-primary-500/20">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary-500/15 text-primary-500 grid place-items-center shrink-0">
            <Info className="h-4.5 w-4.5" />
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t("gallery.noticeText", { defaultValue: "الصور ذات الجودة العالية ترفع موثوقية العيادة وتظهر مباشرة للمرضى على المنصة." })}
          </p>
        </div>
      </GlassCard>

      {/* 2. Mini Statistics Secondary Strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <GlassCard className="p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary-500/15 text-primary-500 grid place-items-center font-bold">
              <ImageIcon className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("gallery.totalImages", { defaultValue: "إجمالي الصور" })}
              </div>
              <div className="text-base font-bold">{stats.total}</div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-success/15 text-success grid place-items-center font-bold">
              <Sparkles className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("gallery.featuredImages", { defaultValue: "صور بعناوين" })}
              </div>
              <div className="text-base font-bold text-success">{stats.withTitle}</div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-3.5 flex items-center justify-between col-span-2 md:col-span-1">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-info/15 text-info grid place-items-center font-bold">
              <Layers className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("gallery.limitLabel", { defaultValue: "حد الصور المسموح" })}
              </div>
              <div className="text-base font-bold">{stats.total} / 20</div>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* 3. Gallery Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="aspect-square w-full rounded-2xl" />
          ))}
        </div>
      ) : gallery.length === 0 ? (
        <EmptyState
          title={t("gallery.emptyTitle", { defaultValue: "لا توجد صور في المعرض حالياً" })}
          description={t("gallery.emptySub", { defaultValue: "قم برفع صور واضحة لقاعات الانتظار وقاعات الفحص والتجهيزات." })}
          action={
            <button
              onClick={() => setUploadModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 cursor-pointer"
            >
              <Upload className="h-4 w-4" /> {t("gallery.uploadButton", { defaultValue: "إضافة صورة جديدة للمعرض" })}
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {gallery.map((item) => (
            <GlassCard
              key={item.id}
              className="group relative overflow-hidden rounded-2xl aspect-square p-0 border border-border/40"
            >
              <RemoteImage
                src={item.imageUrl}
                alt={item.title || "Clinic photo"}
                className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
              />

              {item.title && (
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-6 text-white text-xs font-bold truncate">
                  {item.title}
                </div>
              )}

              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-3">
                <button
                  onClick={() => setPreviewImage(item.imageUrl)}
                  className="p-2.5 rounded-xl bg-white/20 text-white backdrop-blur-xs hover:bg-white/40 transition cursor-pointer"
                  title={t("common.view", { defaultValue: "معاينة" })}
                >
                  <Maximize2 className="h-4 w-4" />
                </button>

                <button
                  onClick={() => setConfirmDeleteId(item.id)}
                  className="p-2.5 rounded-xl bg-danger/80 text-white backdrop-blur-xs hover:bg-danger transition cursor-pointer"
                  title={t("common.delete", { defaultValue: "حذف" })}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* 4. Upload Photo Modal */}
      <FormModal
        id="upload-gallery-modal"
        open={uploadModalOpen}
        onClose={() => {
          setUploadModalOpen(false);
          setSelectedFile(null);
          setTitleInput("");
        }}
        title={t("gallery.uploadButton", { defaultValue: "إضافة صورة جديدة للمعرض" })}
        description={t("gallery.modalDesc", { defaultValue: "اختر صورة عالية الجودة (JPEG, PNG, WebP) بحجم أقل من 5 ميجابايت" })}
      >
        <div className="space-y-4">
          <label className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border/60 p-8 text-center hover:border-primary-500/50 hover:bg-primary-500/5 transition cursor-pointer">
            <ImageIcon className="h-8 w-8 text-primary-500" />
            <span className="text-xs font-semibold text-foreground">
              {selectedFile ? selectedFile.name : t("gallery.clickToBrowse", { defaultValue: "اضغط لاختيار صورة أو اسحبها هنا" })}
            </span>
            <span className="text-[11px] text-muted-foreground">JPG, PNG, WEBP (Max 5MB)</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setSelectedFile(file);
              }}
            />
          </label>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t("gallery.imageTitlePlaceholder", { defaultValue: "عنوان الصورة (اختياري)" })}</label>
            <input
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              placeholder={t("gallery.imageTitlePlaceholder", { defaultValue: "عنوان الصورة (مثال: قاعة الانتظار الرئيسية)" })}
              className="glass w-full rounded-xl px-3.5 py-2 text-xs outline-none focus:ring-2 focus:ring-primary-500/40"
            />
          </div>

          <div className="pt-4 border-t border-border/40 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setUploadModalOpen(false);
                setSelectedFile(null);
                setTitleInput("");
              }}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent cursor-pointer"
            >
              {t("common.cancel", { defaultValue: "إلغاء" })}
            </button>
            <button
              type="button"
              disabled={!selectedFile || uploadMutation.isPending}
              onClick={() => {
                if (selectedFile) uploadMutation.mutate({ file: selectedFile, title: titleInput });
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              {uploadMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {t("gallery.uploadButton", { defaultValue: "إضافة صورة جديدة للمعرض" })}
            </button>
          </div>
        </div>
      </FormModal>

      {/* Lightbox Preview Modal */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md cursor-pointer"
        >
          <div className="relative max-h-[90vh] max-w-[90vw]">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-10 end-0 text-white hover:text-primary-500 transition"
            >
              <X className="h-6 w-6" />
            </button>
            <img
              src={previewImage}
              alt="Facility preview"
              crossOrigin="anonymous"
              className="max-h-[85vh] max-w-[85vw] rounded-2xl object-contain shadow-2xl border border-white/10"
            />
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!confirmDeleteId}
        onClose={() => { setConfirmDeleteId(null); }}
        onConfirm={() => { if (confirmDeleteId) deleteMutation.mutate(confirmDeleteId); }}
        title={t("gallery.deleteTitle", { defaultValue: "حذف صورة من المعرض" })}
        description={t("gallery.deleteMessage", { defaultValue: "هل أنت متأكد من حذف هذه الصورة من معرض صور العيادة؟" })}
        confirmText={t("common.delete", { defaultValue: "حذف" })}
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}

