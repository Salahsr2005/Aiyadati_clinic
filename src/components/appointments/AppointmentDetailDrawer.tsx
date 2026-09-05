import { useState } from "react";
import { Drawer } from "@/components/data/Drawer";
import { StatusBadge } from "@/components/data/StatusBadge";
import { useTranslation } from "react-i18next";
import { useUIStore } from "@/store/ui";
import { Calendar, Clock, Phone, MapPin, User as UserIcon, Stethoscope, CreditCard, FileText, XCircle, CheckCircle2, Play, CheckCheck, UserX } from "lucide-react";
import doctorPlaceholder from "@/assets/standard/doctor-placeholder.png";
import { fullDoctorName, fullPatientName, getCancellationOrigin, type AppointmentRow, type AppointmentStatus } from "@/api/appointmentsApi";
import { translateEnum } from "@/lib/enumLabel";
import { canTransitionTo } from "@/lib/statusLifecycle";
import { NoShowConfirmDialog } from "@/components/appointments/NoShowConfirmDialog";

import { CopyReferenceButton } from "@/components/common/CopyReferenceButton";

function Field({ label, value, icon }: { label: string; value?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl p-3">
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-sm">{value ?? <span className="text-muted-foreground">—</span>}</div>
    </div>
  );
}

export function AppointmentDetailDrawer({
  appt,
  open,
  onClose,
  hideDoctor,
  onStatusChange,
}: {
  appt: AppointmentRow | null;
  open: boolean;
  onClose: () => void;
  hideDoctor?: boolean;
  onStatusChange?: (id: string, status: AppointmentStatus, cancelReason?: string) => Promise<void> | void;
}) {
  const { t, i18n } = useTranslation();
  const { locale } = useUIStore();
  const [showNoShowModal, setShowNoShowModal] = useState(false);
  const [isActionSubmitting, setIsActionSubmitting] = useState(false);

  if (!appt) return null;

  const doctorName = fullDoctorName(appt.doctor, locale);
  const patientObj = appt.patient || appt.guestPatient || appt.contactUser;
  const patientName = fullPatientName(appt.patient, appt.guestPatient, appt.contactUser);
  const typeLabel = translateEnum(t, i18n, "type", appt.type);
  const payLabel = translateEnum(t, i18n, "payment", appt.paymentMethod);
  const isCancelled = String(appt.status).toUpperCase() === "CANCELLED";

  const handleAction = async (status: AppointmentStatus, reason?: string) => {
    if (!onStatusChange) return;
    setIsActionSubmitting(true);
    try {
      await onStatusChange(appt.id, status, reason);
    } finally {
      setIsActionSubmitting(false);
    }
  };

  return (
    <>
      <Drawer open={open} onClose={onClose} title="Appointment Details" subtitle={<CopyReferenceButton value={appt.id} label="Copy Appt Ref" />}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <StatusBadge value={appt.status} />
            <div className="text-xs text-muted-foreground">
              {t("appt.createdBy")}: {appt.createdByType || "—"}
            </div>
          </div>

          {/* Lifecycle Action Buttons */}
          {onStatusChange && (
            <div className="flex flex-wrap items-center gap-2 pt-1 pb-2 border-b border-border/30">
              {canTransitionTo(appt.status, "CONFIRMED") && (
                <button
                  onClick={() => handleAction("CONFIRMED")}
                  disabled={isActionSubmitting}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-info/15 text-info border border-info/30 px-3 py-1.5 text-xs font-bold hover:bg-info/25 transition disabled:opacity-50"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Confirm
                </button>
              )}
              {canTransitionTo(appt.status, "IN_PROGRESS") && (
                <button
                  onClick={() => handleAction("IN_PROGRESS")}
                  disabled={isActionSubmitting}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-warning/15 text-warning border border-warning/30 px-3 py-1.5 text-xs font-bold hover:bg-warning/25 transition disabled:opacity-50"
                >
                  <Play className="h-3.5 w-3.5" /> Start Visit
                </button>
              )}
              {canTransitionTo(appt.status, "COMPLETED") && (
                <button
                  onClick={() => handleAction("COMPLETED")}
                  disabled={isActionSubmitting}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-success px-3 py-1.5 text-xs font-bold text-success-foreground hover:bg-success/90 transition disabled:opacity-50"
                >
                  <CheckCheck className="h-3.5 w-3.5" /> Complete Visit
                </button>
              )}
              {canTransitionTo(appt.status, "NO_SHOW") && (
                <button
                  onClick={() => setShowNoShowModal(true)}
                  disabled={isActionSubmitting}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-muted text-muted-foreground border border-border px-3 py-1.5 text-xs font-bold hover:bg-muted/80 transition disabled:opacity-50"
                >
                  <UserX className="h-3.5 w-3.5" /> Mark No-Show
                </button>
              )}
              {canTransitionTo(appt.status, "CANCELLED") && (
                <button
                  onClick={() => {
                    const reason = prompt("Cancellation reason (optional):") || undefined;
                    void handleAction("CANCELLED", reason);
                  }}
                  disabled={isActionSubmitting}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-danger/10 text-danger border border-danger/30 px-3 py-1.5 text-xs font-bold hover:bg-danger/20 transition disabled:opacity-50 ms-auto"
                >
                  <XCircle className="h-3.5 w-3.5" /> Cancel
                </button>
              )}
            </div>
          )}

          {/* Doctor */}
          {!hideDoctor && (
            <div className="glass flex items-center justify-between gap-3 rounded-2xl p-3">
              <div className="flex items-center gap-3">
                <img
                  src={appt.doctor?.photoUrl || doctorPlaceholder}
                  crossOrigin="anonymous"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = doctorPlaceholder; }}
                  alt=""
                  className="h-12 w-12 rounded-full object-cover ring-1 ring-border"
                />
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("filters.doctor")}</div>
                  <div className="truncate text-sm font-medium">Dr. {doctorName || "—"}</div>
                </div>
              </div>
              {appt.doctorId && <CopyReferenceButton value={appt.doctorId} label="Copy Doctor Ref" />}
            </div>
          )}

          {/* Patient Dual-Mode Display */}
          <div className="glass rounded-2xl p-3">
            <div className="mb-1 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <UserIcon className="h-3 w-3" /> {t("filters.patient")}
              </div>
              {appt.patientType && (
                <span className="rounded-full bg-primary-500/10 px-2 py-0.5 text-[10px] font-bold text-primary-500 uppercase">
                  {appt.patientType === "GUEST" ? "Walk-In / Guest" : "Registered User"}
                </span>
              )}
            </div>
            {patientName || patientObj ? (
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{patientName || "—"}</div>
                  {patientObj?.phone && (
                    <div className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3" /> {patientObj.phone}
                    </div>
                  )}
                </div>
                {(appt.patientId || appt.guestPatientId || appt.contactUserId) && (
                  <CopyReferenceButton value={appt.patientId || appt.guestPatientId || appt.contactUserId} label="Copy Patient Ref" />
                )}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">{t("appt.noPatient")}</div>
            )}
          </div>

          {/* Slot */}
          <Field
            label={t("appt.slot")}
            icon={<Calendar className="h-3 w-3" />}
            value={
              appt.slot ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{new Date(appt.slot.date).toLocaleDateString()}</span>
                  <span className="inline-flex items-center gap-1 tabular-nums"><Clock className="h-3.5 w-3.5" />{appt.slot.startTime}–{appt.slot.endTime}</span>
                  {typeof appt.slot.maxPatients === "number" && (
                    <span className="text-[11px] text-muted-foreground">{appt.slot.currentPatients ?? 0}/{appt.slot.maxPatients}</span>
                  )}
                </div>
              ) : undefined
            }
          />

          <div className="grid grid-cols-2 gap-2">
            <Field label={t("appt.type")} value={typeLabel} icon={<Stethoscope className="h-3 w-3" />} />
            <Field label={t("appt.payment")} value={payLabel} icon={<CreditCard className="h-3 w-3" />} />
          </div>

          {/* Clinic */}
          <Field
            label={t("nav.clinics")}
            icon={<MapPin className="h-3 w-3" />}
            value={
              appt.clinic ? (
                <div className="flex items-center gap-2">
                  {appt.clinic.logoUrl && <img src={appt.clinic.logoUrl} crossOrigin="anonymous" alt="" className="h-8 w-8 rounded-lg object-cover" />}
                  <span>{locale === "ar" ? appt.clinic.nameAr || appt.clinic.nameFr : appt.clinic.nameFr || appt.clinic.nameAr}</span>
                </div>
              ) : (
                <span className="text-muted-foreground">{t("appt.noClinic")}</span>
              )
            }
          />

          {appt.notes && <Field label={t("appt.notes")} value={appt.notes} icon={<FileText className="h-3 w-3" />} />}

          {(appt.cancelledAt || appt.cancelReason || appt.cancelledByRole || appt.cancelledBy || isCancelled) && (
            <div className="rounded-2xl border border-danger/30 bg-danger/10 p-3">
              <div className="mb-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-danger">
                <span className="flex items-center gap-1.5"><XCircle className="h-3 w-3" /> {t("appt.cancelReason")}</span>
                <span className="rounded-full bg-danger/20 px-2 py-0.5 text-[10px] text-danger font-bold">
                  {getCancellationOrigin(appt, i18n.language).label}
                </span>
              </div>
              {appt.cancelReason && <div className="text-sm">{appt.cancelReason}</div>}
              {appt.cancelledAt && (
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {t("appt.cancelledAt")}: {new Date(appt.cancelledAt).toLocaleString()}
                </div>
              )}
            </div>
          )}
        </div>
      </Drawer>

      <NoShowConfirmDialog
        open={showNoShowModal}
        onClose={() => setShowNoShowModal(false)}
        onConfirm={async () => {
          setShowNoShowModal(false);
          await handleAction("NO_SHOW");
        }}
        patientName={patientName}
        isSubmitting={isActionSubmitting}
      />
    </>
  );
}