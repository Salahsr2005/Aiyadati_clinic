import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@/lib/queryClient";
import {
  Image as ImageIcon,
  Upload,
  Loader2,
  Maximize2,
  Trash2,
  Edit3,
  Info,
  Layers,
  Sparkles,
  ArrowUp,
  ArrowDown,
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
import { GalleryEditModal } from "@/components/gallery/GalleryEditModal";
import { validateUploadFile } from "@/utils/uploadHelper";
import { toast } from "sonner";
import { EmptyState } from "@/components/data/EmptyState";
import { Skeleton } from "@/components/glass/Skeleton";

export default function GalleryPage() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";

  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [captionFrInput, setCaptionFrInput] = useState("");
  const [captionArInput, setCaptionArInput] = useState("");
  const [previewImage, setPreviewImage] = useState<ClinicGalleryItem | null>(null);
  const [editingItem, setEditingItem] = useState<ClinicGalleryItem | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { data: rawGallery, isLoading } = useQuery({
    queryKey: qk.clinicSelf.gallery(),
    queryFn: clinicSelfApi.getGallery,
  });

  const gallery: ClinicGalleryItem[] = ensureArray<ClinicGalleryItem>(rawGallery);

  // Sorted by sortOrder ascending
  const sortedGallery = useMemo(() => {
    return [...gallery].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [gallery]);

  const uploadMutation = useEntityMutation({
    mutationFn: ({ file, captionFr, captionAr }: { file: File; captionFr?: string; captionAr?: string }) => {
      const validation = validateUploadFile(file, "IMAGE");
      if (!validation.valid) {
        toast.error(validation.error);
        return Promise.reject(new Error(validation.error));
      }
      const formData = new FormData();
      formData.append("image", file);
      if (captionFr?.trim()) formData.append("captionFr", captionFr.trim());
      if (captionAr?.trim()) formData.append("captionAr", captionAr.trim());

      return clinicSelfApi.uploadGalleryImage(formData);
    },
    invalidate: [qk.clinicSelf.gallery(), qk.dashboard.gallery()],
    successMessage: t("gallery.uploadSuccess", { defaultValue: "Image uploaded successfully to gallery" }),
    onSuccess: () => {
      setUploadModalOpen(false);
      setSelectedFile(null);
      setCaptionFrInput("");
      setCaptionArInput("");
    },
  });

  const deleteMutation = useEntityMutation({
    mutationFn: (id: string) => clinicSelfApi.deleteGalleryImage(id),
    invalidate: [qk.clinicSelf.gallery()],
    successMessage: t("gallery.deleteSuccess", { defaultValue: "Image deleted successfully" }),
    onSuccess: () => setConfirmDeleteId(null),
  });

  const reorderMutation = useEntityMutation({
    mutationFn: ({ id, sortOrder }: { id: string; sortOrder: number }) => {
      return clinicSelfApi.updateGalleryImage(id, { sortOrder });
    },
    invalidate: [qk.clinicSelf.gallery()],
    successMessage: t("gallery.reorderSuccess", { defaultValue: "Display order updated" }),
  });

  const handleMoveOrder = (item: ClinicGalleryItem, direction: "up" | "down") => {
    const currentIndex = sortedGallery.findIndex((x) => x.id === item.id);
    if (currentIndex === -1) return;

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= sortedGallery.length) return;

    const targetItem = sortedGallery[targetIndex];
    const currentSort = item.sortOrder ?? currentIndex;
    const targetSort = targetItem.sortOrder ?? targetIndex;

    // Swap sort orders
    reorderMutation.mutate({ id: item.id, sortOrder: targetSort });
    reorderMutation.mutate({ id: targetItem.id, sortOrder: currentSort });
  };

  // Stats
  const stats = useMemo(() => {
    const total = gallery.length;
    const withCaptions = gallery.filter((g) => (g.captionFr && g.captionFr.trim()) || (g.captionAr && g.captionAr.trim())).length;
    return { total, withCaptions };
  }, [gallery]);

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("gallery.title", { defaultValue: "Clinic Facility Gallery" })}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("gallery.subtitle", {
              defaultValue: "Manage facility photography, medical equipment imagery, and visual presentation",
            })}
          </p>
        </div>

        <button
          onClick={() => setUploadModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-xs transition hover:opacity-90 cursor-pointer self-start sm:self-auto"
        >
          <Upload className="h-4 w-4" />
          {t("gallery.uploadButton", { defaultValue: "Upload New Image" })}
        </button>
      </div>

      {/* Notice Banner */}
      <GlassCard className="p-4 flex items-center justify-between gap-4 bg-primary-500/5 border-primary-500/20">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary-500/15 text-primary-500 grid place-items-center shrink-0">
            <Info className="h-4.5 w-4.5" />
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t("gallery.noticeText", {
              defaultValue:
                "Images uploaded here will be showcased to patients on the mobile application and web portal. Add bilingual descriptions to maximize patient engagement.",
            })}
          </p>
        </div>
      </GlassCard>

      {/* 2. Mini Statistics */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <GlassCard className="p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary-500/15 text-primary-500 grid place-items-center font-bold">
              <ImageIcon className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("gallery.totalImages", { defaultValue: "Total Images" })}
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
                {t("gallery.captionedImages", { defaultValue: "With Descriptions" })}
              </div>
              <div className="text-base font-bold text-success">{stats.withCaptions}</div>
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
                {t("gallery.limitLabel", { defaultValue: "Facility Capacity" })}
              </div>
              <div className="text-base font-bold">{stats.total} / 30</div>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* 3. Image Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="aspect-square w-full rounded-2xl" />
          ))}
        </div>
      ) : sortedGallery.length === 0 ? (
        <EmptyState
          title={t("gallery.emptyTitle", { defaultValue: "No gallery imagery uploaded yet" })}
          description={t("gallery.emptySub", {
            defaultValue: "Showcase your clinic rooms, diagnostic technology, and waiting areas.",
          })}
          action={
            <button
              onClick={() => setUploadModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 cursor-pointer"
            >
              <Upload className="h-4 w-4" /> {t("gallery.uploadButton", { defaultValue: "Upload New Image" })}
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {sortedGallery.map((item, index) => {
            const caption = isRtl
              ? item.captionAr || item.captionFr || item.title
              : item.captionFr || item.captionAr || item.title;

            return (
              <GlassCard
                key={item.id}
                className="group relative overflow-hidden rounded-2xl aspect-square p-0 border border-border/40 shadow-xs hover:border-primary-500/40 transition flex flex-col justify-between"
              >
                <RemoteImage
                  src={item.imageUrl}
                  alt={caption || "Clinic photo"}
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                />

                {/* Top Badge: Sort Order */}
                <div className="absolute top-2.5 start-2.5 z-10">
                  <span className="rounded-lg bg-black/60 backdrop-blur-md px-2 py-0.5 text-[10px] font-bold text-white shadow-xs border border-white/10">
                    #{item.sortOrder ?? index + 1}
                  </span>
                </div>

                {/* Bottom Caption Overlay */}
                {caption && (
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-3 pt-6 text-white text-xs font-medium truncate">
                    <p className="truncate font-semibold">{caption}</p>
                    {item.captionAr && item.captionFr && (
                      <p className="text-[10px] text-white/75 truncate mt-0.5" dir={isRtl ? "ltr" : "rtl"}>
                        {isRtl ? item.captionFr : item.captionAr}
                      </p>
                    )}
                  </div>
                )}

                {/* Hover Action Overlay */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition duration-200 flex flex-col justify-between p-3">
                  {/* Top re-order buttons */}
                  <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      disabled={index === 0 || reorderMutation.isPending}
                      onClick={() => handleMoveOrder(item, "up")}
                      className="p-1.5 rounded-lg bg-white/20 text-white backdrop-blur-sm hover:bg-white/40 disabled:opacity-30 transition cursor-pointer"
                      title={t("gallery.moveUp", { defaultValue: "Move Earlier" })}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={index === sortedGallery.length - 1 || reorderMutation.isPending}
                      onClick={() => handleMoveOrder(item, "down")}
                      className="p-1.5 rounded-lg bg-white/20 text-white backdrop-blur-sm hover:bg-white/40 disabled:opacity-30 transition cursor-pointer"
                      title={t("gallery.moveDown", { defaultValue: "Move Later" })}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Center main buttons */}
                  <div className="flex items-center justify-center gap-2.5 my-auto" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setPreviewImage(item)}
                      className="p-2.5 rounded-xl bg-white/20 text-white backdrop-blur-md hover:bg-white/40 transition cursor-pointer"
                      title={t("common.view", { defaultValue: "Preview Fullscreen" })}
                    >
                      <Maximize2 className="h-4 w-4" />
                    </button>

                    <button
                      onClick={() => setEditingItem(item)}
                      className="p-2.5 rounded-xl bg-primary-500/90 text-white backdrop-blur-md hover:bg-primary-500 transition cursor-pointer"
                      title={t("common.edit", { defaultValue: "Edit Details & Order" })}
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>

                    <button
                      onClick={() => setConfirmDeleteId(item.id)}
                      className="p-2.5 rounded-xl bg-danger/80 text-white backdrop-blur-md hover:bg-danger transition cursor-pointer"
                      title={t("common.delete", { defaultValue: "Delete" })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="text-[10px] text-white/70 text-center font-medium">
                    {t("gallery.clickToManage", { defaultValue: "Click to preview or edit" })}
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* 4. Upload Photo Modal */}
      <FormModal
        id="upload-gallery-modal"
        open={uploadModalOpen}
        onClose={() => {
          setUploadModalOpen(false);
          setSelectedFile(null);
          setCaptionFrInput("");
          setCaptionArInput("");
        }}
        title={t("gallery.uploadButton", { defaultValue: "Upload New Image" })}
        description={t("gallery.modalDesc", {
          defaultValue: "Select a photo and optionally enter descriptions in French & Arabic.",
        })}
      >
        <div className="space-y-4">
          <label className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border/60 p-6 text-center hover:border-primary-500/50 hover:bg-primary-500/5 transition cursor-pointer">
            <ImageIcon className="h-8 w-8 text-primary-500" />
            <span className="text-xs font-semibold text-foreground">
              {selectedFile ? selectedFile.name : t("gallery.clickToBrowse", { defaultValue: "Click to Browse or Drag File Here" })}
            </span>
            <span className="text-[11px] text-muted-foreground">JPG, PNG, WEBP (Max 5MB)</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setSelectedFile(file);
              }}
            />
          </label>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                {t("gallery.captionFrLabel", { defaultValue: "Caption (French / Latin)" })}
              </label>
              <input
                type="text"
                value={captionFrInput}
                onChange={(e) => setCaptionFrInput(e.target.value)}
                placeholder="e.g. Salle de consultation 1"
                className="w-full rounded-xl border border-border/60 bg-background/60 px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary-500 focus:outline-hidden transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                {t("gallery.captionArLabel", { defaultValue: "Caption (Arabic)" })}
              </label>
              <input
                type="text"
                dir="rtl"
                value={captionArInput}
                onChange={(e) => setCaptionArInput(e.target.value)}
                placeholder="مثال: قاعة الفحص الأولى"
                className="w-full rounded-xl border border-border/60 bg-background/60 px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary-500 focus:outline-hidden transition"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-border/40 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setUploadModalOpen(false);
                setSelectedFile(null);
                setCaptionFrInput("");
                setCaptionArInput("");
              }}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent cursor-pointer"
            >
              {t("common.cancel", { defaultValue: "Cancel" })}
            </button>
            <button
              type="button"
              disabled={!selectedFile || uploadMutation.isPending}
              onClick={() => {
                if (selectedFile) {
                  uploadMutation.mutate({
                    file: selectedFile,
                    captionFr: captionFrInput,
                    captionAr: captionArInput,
                  });
                }
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              {uploadMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {t("common.upload", { defaultValue: "Upload Image" })}
            </button>
          </div>
        </div>
      </FormModal>

      {/* 5. Edit Image Metadata Modal */}
      <GalleryEditModal
        item={editingItem}
        open={!!editingItem}
        onClose={() => setEditingItem(null)}
      />

      {/* 6. Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => {
          if (confirmDeleteId) deleteMutation.mutate(confirmDeleteId);
        }}
        title={t("gallery.deleteImage", { defaultValue: "Delete Gallery Image" })}
        description={t("gallery.deleteConfirmDesc", {
          defaultValue: "Are you sure you want to permanently delete this photo from your clinic gallery?",
        })}
        confirmText={t("common.delete", { defaultValue: "Delete" })}
        variant="danger"
        isLoading={deleteMutation.isPending}
      />

      {/* 7. Fullscreen Lightbox Preview */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewImage(null)}
        >
          <button
            onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/20 text-white hover:bg-white/40 transition"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="max-w-4xl max-h-[85vh] flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            <img
              src={previewImage.imageUrl}
              alt={previewImage.captionFr || "Gallery photo"}
              className="max-h-[75vh] w-auto rounded-2xl object-contain shadow-2xl border border-white/10"
            />
            {(previewImage.captionFr || previewImage.captionAr) && (
              <div className="text-center text-white space-y-0.5">
                {previewImage.captionFr && <p className="text-sm font-semibold">{previewImage.captionFr}</p>}
                {previewImage.captionAr && <p className="text-xs text-white/80" dir="rtl">{previewImage.captionAr}</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
