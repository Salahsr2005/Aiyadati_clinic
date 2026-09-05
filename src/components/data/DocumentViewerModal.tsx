import { useState } from "react";
import { X, ZoomIn, ZoomOut, RotateCw, Download, FileText } from "lucide-react";
import { ModalPortal } from "@/components/ui/ModalPortal";
import { motion, AnimatePresence } from "framer-motion";

interface DocumentViewerModalProps {
  open: boolean;
  onClose: () => void;
  url?: string;
  mimeType?: string;
  title?: string;
}

export function DocumentViewerModal({
  open,
  onClose,
  url,
  mimeType,
  title = "Document Preview",
}: DocumentViewerModalProps) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  if (!url) return null;

  const normalizedMime = (mimeType || "").toLowerCase();
  const lowerUrl = url.toLowerCase();

  const isPDF =
    normalizedMime.includes("pdf") ||
    lowerUrl.includes(".pdf") ||
    lowerUrl.includes("pdf");

  const isImage =
    normalizedMime.startsWith("image/") ||
    Boolean(lowerUrl.match(/\.(png|jpe?g|webp|gif|svg)($|\?)/i));

  const isUnsupported = !isPDF && !isImage;

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.25, 3));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.25, 0.5));
  const handleRotate = () => setRotation((r) => (r + 90) % 360);

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = url;
    a.download = title || "document";
    a.target = "_blank";
    a.click();
  };

  const handleReset = () => {
    setScale(1);
    setRotation(0);
  };

  return (
    <ModalPortal
      id="document-viewer-modal"
      open={open}
      onClose={onClose}
      backdropClassName="fixed inset-0 z-[2000] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
    >
      <div className="relative flex h-[90vh] w-full max-w-5xl flex-col rounded-3xl border border-white/10 bg-zinc-950/90 text-white shadow-2xl overflow-hidden">
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-white/5 bg-zinc-900/50 px-6 py-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-white/5 text-primary-400">
              <FileText className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold truncate">{title}</h3>
              <p className="text-[10px] text-zinc-400 truncate mt-0.5">
                {isPDF ? "PDF Document" : isImage ? "Image File" : "Document File"}
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2">
            {isImage && (
              <>
                <button
                  onClick={handleZoomIn}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition text-zinc-300 hover:text-white"
                  title="Zoom In"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
                <button
                  onClick={handleZoomOut}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition text-zinc-300 hover:text-white"
                  title="Zoom Out"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <button
                  onClick={handleRotate}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition text-zinc-300 hover:text-white"
                  title="Rotate"
                >
                  <RotateCw className="h-4 w-4" />
                </button>
                <button
                  onClick={handleReset}
                  className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 transition text-[10px] font-bold text-zinc-400 hover:text-white"
                >
                  Reset
                </button>
              </>
            )}

            <button
              onClick={handleDownload}
              className="p-2 rounded-xl bg-primary-500/20 hover:bg-primary-500/30 transition text-primary-400 hover:text-primary-300"
              title="Download File"
            >
              <Download className="h-4 w-4" />
            </button>

            <div className="h-6 w-px bg-white/5 mx-1" />

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-red-500/20 hover:text-red-400 transition text-zinc-400"
              title="Close Preview"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content Viewer viewport */}
        <div className="flex-1 bg-zinc-950 flex items-center justify-center p-6 overflow-hidden relative">
          <AnimatePresence mode="wait">
            {isPDF ? (
              <iframe
                src={`${url}#toolbar=1`}
                className="h-full w-full rounded-2xl bg-white"
                title={title}
              />
            ) : isImage ? (
              <motion.div
                key={url}
                className="relative flex items-center justify-center max-h-full max-w-full"
                style={{
                  transform: `scale(${scale}) rotate(${rotation}deg)`,
                  transition: "transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)",
                }}
              >
                <img
                  src={url}
                  crossOrigin="anonymous"
                  alt={title}
                  className="max-h-[70vh] max-w-full rounded-2xl object-contain shadow-2xl border border-white/5 select-none pointer-events-none"
                />
              </motion.div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center space-y-4 max-w-md">
                <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white/5 text-zinc-400">
                  <FileText className="h-8 w-8" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-white">Preview Not Available</h4>
                  <p className="text-xs text-zinc-400 mt-1">
                    This file format cannot be rendered directly in the browser. Click below to download and view it.
                  </p>
                </div>
                <button
                  onClick={handleDownload}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-md hover:bg-primary-600 transition"
                >
                  <Download className="h-4 w-4" /> Download File
                </button>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </ModalPortal>
  );
}
