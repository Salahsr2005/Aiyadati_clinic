import { useState } from "react";
import { useQuery, useQueryClient } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";
import {
  FileText,
  Upload,
  Download,
  ShieldAlert,
  X,
  Loader2,
  FileCheck,
  Calendar,
  HardDrive,
} from "lucide-react";
import { doctorConsentApi, type PatientDocumentRow, type ConsentError } from "@/api/consentApi";
import { qk } from "@/lib/queryKeys";
import { GlassCard } from "@/components/glass/GlassCard";
import { Skeleton } from "@/components/glass/Skeleton";
import { buildUploadFormData, validateUploadFile } from "@/utils/uploadHelper";
import { toast } from "sonner";

interface MedicalDocsDrawerProps {
  patientId: string | null;
  patientName?: string;
  open: boolean;
  onClose: () => void;
}

export function MedicalDocsDrawer({
  patientId,
  patientName = "Patient",
  open,
  onClose,
}: MedicalDocsDrawerProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [docTitle, setDocTitle] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: qk.consent.documents(patientId || ""),
    queryFn: () => doctorConsentApi.documents(patientId!),
    enabled: !!patientId && open,
  });

  if (!open || !patientId) return null;

  const isNoConsent = (error as ConsentError)?.noConsent;
  const documents = data?.documents || [];

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileToUpload || !patientId) return;

    const validation = validateUploadFile(fileToUpload, "DOCUMENT");
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    setIsUploading(true);
    const formData = buildUploadFormData(
      "document",
      fileToUpload,
      docTitle.trim() ? { title: docTitle.trim() } : undefined
    );

    try {
      await doctorConsentApi.upload(patientId, formData);
      toast.success("Medical document uploaded successfully");
      setFileToUpload(null);
      setDocTitle("");
      void queryClient.invalidateQueries({ queryKey: qk.consent.documents(patientId) });
    } catch (err: any) {
      toast.error(err?.message || "Failed to upload document");
    } finally {
      setIsUploading(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-xl border-l border-border/40 bg-card p-6 shadow-2xl overflow-y-auto flex flex-col justify-between"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-border/30">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary-500/10 text-primary-500">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Medical Documents</h3>
                <p className="text-xs text-muted-foreground">{patientName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-xl hover:bg-muted/30 text-muted-foreground hover:text-foreground transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* No Consent Warning State */}
          {isNoConsent ? (
            <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-6 text-center space-y-3">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/20 text-amber-500">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <h4 className="text-sm font-bold text-foreground">Patient Access Consent Required</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                This patient has not granted consent to share their medical documents with your profile yet.
                Ask the patient to share access from their patient portal application.
              </p>
            </div>
          ) : isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-2xl" />
              ))}
            </div>
          ) : (
            <>
              {/* Document List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Shared Records ({documents.length})
                </h4>

                {documents.length === 0 ? (
                  <div className="rounded-2xl border border-border/40 p-6 text-center text-xs text-muted-foreground">
                    No medical documents found for this patient yet.
                  </div>
                ) : (
                  <ul className="space-y-2.5">
                    {documents.map((doc: PatientDocumentRow) => (
                      <li
                        key={doc.id}
                        className="glass flex items-center justify-between gap-3 rounded-2xl border border-border/40 p-3.5 hover:bg-muted/20 transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-500/10 text-primary-500">
                            <FileCheck className="h-4.5 w-4.5" />
                          </div>
                          <div className="min-w-0">
                            <h5 className="text-xs font-bold text-foreground truncate">
                              {doc.title || doc.fileName}
                            </h5>
                            <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                              <span className="flex items-center gap-1">
                                <HardDrive className="h-3 w-3" /> {formatSize(doc.fileSize)}
                              </span>
                              {doc.docDate && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" /> {doc.docDate.slice(0, 10)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {doc.accessUrl && (
                          <a
                            href={doc.accessUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-xl bg-primary-500/15 px-3 py-1.5 text-xs font-bold text-primary-500 hover:bg-primary-500/25 transition shrink-0"
                          >
                            <Download className="h-3.5 w-3.5" /> View
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Upload Document Form */}
              <GlassCard className="p-4 border border-border/40 space-y-3">
                <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Upload className="h-4 w-4 text-primary-500" /> Upload New Medical Record
                </h4>
                <form onSubmit={handleUpload} className="space-y-3">
                  <input
                    type="text"
                    placeholder="Document Title (e.g. Prescription, Consultation Report)"
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                    className="w-full rounded-xl border border-border/40 bg-muted/20 px-3 py-2 text-xs font-semibold outline-none focus:border-primary-500"
                  />
                  <input
                    type="file"
                    onChange={(e) => setFileToUpload(e.target.files?.[0] || null)}
                    className="w-full text-xs text-muted-foreground file:mr-3 file:rounded-xl file:border-0 file:bg-primary-500/15 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-primary-500 hover:file:bg-primary-500/25 cursor-pointer"
                  />
                  <button
                    type="submit"
                    disabled={!fileToUpload || isUploading}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-xs font-bold text-primary-foreground shadow-md hover:bg-primary-600 transition disabled:opacity-50"
                  >
                    {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    Upload to Patient Profile
                  </button>
                </form>
              </GlassCard>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-border/30">
          <button
            onClick={onClose}
            className="w-full rounded-2xl border border-border/40 py-2.5 text-xs font-bold text-foreground hover:bg-muted/20 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
