import { useState } from "react";
import { useQuery } from "@/lib/queryClient";
import { Image as ImageIcon, Upload, Loader2, Maximize2 } from "lucide-react";
import { clinicSelfApi, type ClinicGalleryItem } from "@/api/clinicSelfApi";
import { qk } from "@/lib/queryKeys";
import { useEntityMutation } from "@/lib/mutations";
import { ensureArray } from "@/lib/utils";
import { GlassCard } from "@/components/glass/GlassCard";
import { RemoteImage } from "@/components/common/RemoteImage";
import { FormModal } from "@/components/data/FormModal";
import { EmptyState } from "@/components/data/EmptyState";
import { Skeleton } from "@/components/glass/Skeleton";

export default function GalleryPage() {
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const { data: rawGallery, isLoading } = useQuery({
    queryKey: qk.clinicSelf.gallery(),
    queryFn: clinicSelfApi.getGallery,
  });

  const gallery: ClinicGalleryItem[] = ensureArray<ClinicGalleryItem>(rawGallery);

  const uploadMutation = useEntityMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return clinicSelfApi.uploadGalleryImage(formData);
    },
    invalidate: [qk.clinicSelf.gallery()],
    successMessage: "Gallery photo uploaded successfully",
    onSuccess: () => {
      setUploadModalOpen(false);
      setSelectedFile(null);
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Facility Photo Gallery</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Showcase your facility rooms, reception, and medical equipment to patients
          </p>
        </div>

        <button
          onClick={() => setUploadModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 cursor-pointer self-start sm:self-auto"
        >
          <Upload className="h-4 w-4" />
          Upload Photo
        </button>
      </div>

      {/* Gallery Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="aspect-square w-full rounded-2xl" />
          ))}
        </div>
      ) : gallery.length === 0 ? (
        <EmptyState
          title="No gallery photos uploaded yet"
          description="Upload showcase images of your clinic reception, operating rooms, and facilities."
          action={
            <button
              onClick={() => setUploadModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 cursor-pointer"
            >
              <Upload className="h-4 w-4" /> Upload Photo
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
                alt="Clinic photo"
                className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
              />

              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                <button
                  onClick={() => setPreviewImage(item.imageUrl)}
                  className="p-2 rounded-full bg-white/20 text-white backdrop-blur-xs hover:bg-white/40 transition cursor-pointer"
                  title="View Full Size"
                >
                  <Maximize2 className="h-4 w-4" />
                </button>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Upload Photo Modal */}
      <FormModal
        id="upload-gallery-modal"
        open={uploadModalOpen}
        onClose={() => {
          setUploadModalOpen(false);
          setSelectedFile(null);
        }}
        title="Upload Gallery Photo"
        description="Select an image file (JPEG, PNG, WebP, max 5MB)"
      >
        <div className="space-y-4">
          <label className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border/60 p-8 text-center hover:border-primary-500/50 hover:bg-primary-500/5 transition cursor-pointer">
            <ImageIcon className="h-8 w-8 text-primary-500" />
            <span className="text-xs font-semibold text-foreground">
              {selectedFile ? selectedFile.name : "Click to browse or drag & drop photo"}
            </span>
            <span className="text-[11px] text-muted-foreground">Supported: JPG, PNG, WEBP (Max 5MB)</span>
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

          <div className="pt-4 border-t border-border/40 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setUploadModalOpen(false);
                setSelectedFile(null);
              }}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!selectedFile || uploadMutation.isPending}
              onClick={() => {
                if (selectedFile) uploadMutation.mutate(selectedFile);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              {uploadMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Upload Photo
            </button>
          </div>
        </div>
      </FormModal>

      {/* Lightbox Preview Modal */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm cursor-pointer"
        >
          <img
            src={previewImage}
            alt="Clinic preview"
            crossOrigin="anonymous"
            className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}
