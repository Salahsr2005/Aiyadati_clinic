import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Edit3, Sparkles } from "lucide-react";
import { FormModal } from "@/components/data/FormModal";
import { RemoteImage } from "@/components/common/RemoteImage";
import { clinicSelfApi, type ClinicGalleryItem } from "@/api/clinicSelfApi";
import { useEntityMutation } from "@/lib/mutations";
import { qk } from "@/lib/queryKeys";

interface GalleryEditModalProps {
  item: ClinicGalleryItem | null;
  open: boolean;
  onClose: () => void;
}

export function GalleryEditModal({ item, open, onClose }: GalleryEditModalProps) {
  const { t } = useTranslation();

  const [captionFr, setCaptionFr] = useState("");
  const [captionAr, setCaptionAr] = useState("");
  const [sortOrder, setSortOrder] = useState(0);

  useEffect(() => {
    if (item) {
      setCaptionFr(item.captionFr || item.title || "");
      setCaptionAr(item.captionAr || "");
      setSortOrder(item.sortOrder ?? 0);
    }
  }, [item]);

  const updateMutation = useEntityMutation({
    mutationFn: (payload: { captionFr: string; captionAr: string; sortOrder: number }) => {
      if (!item) return Promise.reject(new Error("No item selected"));
      return clinicSelfApi.updateGalleryImage(item.id, {
        captionFr: payload.captionFr.trim() || null,
        captionAr: payload.captionAr.trim() || null,
        sortOrder: payload.sortOrder,
      });
    },
    invalidate: [qk.clinicSelf.gallery(), qk.dashboard.gallery()],
    successMessage: t("gallery.updateSuccess", { defaultValue: "Image details updated successfully" }),
    onSuccess: () => {
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({ captionFr, captionAr, sortOrder });
  };

  if (!item) return null;

  return (
    <FormModal
      id="gallery-edit-modal"
      open={open}
      onClose={onClose}
      title={t("gallery.editModalTitle", { defaultValue: "Edit Gallery Image Details" })}
      description={t("gallery.editModalSubtitle", {
        defaultValue: "Update image captions in French & Arabic, and adjust display sort priority.",
      })}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Preview Thumbnail */}
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-muted/30 border border-border/40">
          <RemoteImage
            src={item.imageUrl}
            alt={captionFr || "Gallery photo"}
            className="h-16 w-16 rounded-xl object-cover border border-border/50 shadow-xs shrink-0"
          />
          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-1 rounded-md bg-primary-500/10 px-2 py-0.5 text-[10px] font-bold text-primary-500">
              #{sortOrder} {t("gallery.sortOrderLabel", { defaultValue: "Display Order" })}
            </span>
            <p className="text-xs text-muted-foreground truncate mt-1">
              {captionFr || captionAr || t("gallery.untitledImage", { defaultValue: "Untitled image" })}
            </p>
          </div>
        </div>

        {/* Captions */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              {t("gallery.captionFrLabel", { defaultValue: "Caption (French / Latin)" })}
            </label>
            <input
              type="text"
              value={captionFr}
              onChange={(e) => setCaptionFr(e.target.value)}
              placeholder="e.g. Salle d'attente principale"
              className="w-full rounded-xl border border-border/60 bg-background/60 px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary-500 focus:outline-hidden transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              {t("gallery.captionArLabel", { defaultValue: "Caption (Arabic)" })}
            </label>
            <input
              type="text"
              dir="rtl"
              value={captionAr}
              onChange={(e) => setCaptionAr(e.target.value)}
              placeholder="مثال: قاعة الانتظار الرئيسية"
              className="w-full rounded-xl border border-border/60 bg-background/60 px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary-500 focus:outline-hidden transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              {t("gallery.sortOrder", { defaultValue: "Sort Priority (Lower number displays first)" })}
            </label>
            <input
              type="number"
              min={0}
              max={999}
              value={sortOrder}
              onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 0)}
              className="w-full rounded-xl border border-border/60 bg-background/60 px-3.5 py-2 text-xs text-foreground focus:border-primary-500 focus:outline-hidden transition"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-border/40">
          <button
            type="button"
            onClick={onClose}
            disabled={updateMutation.isPending}
            className="rounded-xl px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted/80 transition cursor-pointer"
          >
            {t("common.cancel", { defaultValue: "Cancel" })}
          </button>
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:opacity-90 transition cursor-pointer disabled:opacity-60"
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>{t("common.saving", { defaultValue: "Saving..." })}</span>
              </>
            ) : (
              <>
                <Edit3 className="h-3.5 w-3.5" />
                <span>{t("common.saveChanges", { defaultValue: "Save Changes" })}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </FormModal>
  );
}
