import { Calendar, Clock, User as UserIcon, Stethoscope, MonitorPlay, Home as HomeIcon, MapPin } from "lucide-react";
import { GlassCard } from "@/components/glass/GlassCard";
import { StatusBadge } from "@/components/data/StatusBadge";
import doctorPlaceholder from "@/assets/standard/doctor-placeholder.png";
import { fullDoctorName, fullPatientName, getCancellationOrigin, type AppointmentRow } from "@/api/appointmentsApi";
import { useTranslation } from "react-i18next";
import { useUIStore } from "@/store/ui";
import { translateEnum } from "@/lib/enumLabel";

const TYPE_ICON = {
  IN_PERSON: UserIcon,
  VIDEO: MonitorPlay,
  HOME_VISIT: HomeIcon,
} as const;

export function AppointmentCard({ appt, onClick, hideDoctor }: { appt: AppointmentRow; onClick?: () => void; hideDoctor?: boolean }) {
  const { t, i18n } = useTranslation();
  const { locale } = useUIStore();
  const doctorName = fullDoctorName(appt.doctor, locale);
  const patientObj = appt.patient || appt.guestPatient || appt.contactUser;
  const patientName = fullPatientName(appt.patient, appt.guestPatient, appt.contactUser);
  const typeKey = (appt.type as keyof typeof TYPE_ICON) || "IN_PERSON";
  const TypeIcon = TYPE_ICON[typeKey] ?? UserIcon;
  const typeLabel = translateEnum(t, i18n, "type", appt.type);
  const payLabel = translateEnum(t, i18n, "payment", appt.paymentMethod);
  const isCancelled = String(appt.status).toUpperCase() === "CANCELLED";

  return (
    <GlassCard onClick={onClick} className="cursor-pointer p-4 transition hover:scale-[1.01] hover:shadow-lg">
      {/* Top row: avatar + full doctor name given all horizontal space, status pill on new row */}
      <div className="flex items-start gap-3">
        {!hideDoctor && (
          <img
            src={appt.doctor?.photoUrl || doctorPlaceholder}
            crossOrigin="anonymous"
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = doctorPlaceholder; }}
            alt=""
            className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-border"
          />
        )}
        <div className="min-w-0 flex-1">
          {!hideDoctor && (
            <div
              className="text-sm font-semibold leading-snug break-words"
              title={doctorName ? `Dr. ${doctorName}` : undefined}
            >
              Dr.&nbsp;{doctorName || "—"}
            </div>
          )}
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
            <span className="inline-flex items-center gap-1 text-primary-500 font-medium">
              <TypeIcon className="h-3 w-3" />
              {typeLabel}
            </span>
            <StatusBadge value={appt.status} />
            {isCancelled && (
              <span className="inline-flex items-center rounded-full bg-danger/10 px-1.5 py-0.5 text-[10px] font-bold text-danger">
                {getCancellationOrigin(appt, i18n.language).label}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-2xl bg-muted/40 p-3">
        <div className="flex items-center gap-2 text-xs">
          <UserIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 truncate font-medium">{patientName || t("appt.noPatient")}</span>
          {patientObj?.phone && (
            <span className="ms-auto shrink-0 text-[11px] text-muted-foreground tabular-nums font-mono">{patientObj.phone}</span>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
        {appt.slot?.date && (
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/30 px-2 py-0.5">
            <Calendar className="h-3 w-3" />
            {new Date(appt.slot.date).toLocaleDateString()}
          </span>
        )}
        {appt.slot?.startTime && (
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/30 px-2 py-0.5 tabular-nums">
            <Clock className="h-3 w-3" />
            {appt.slot.startTime}–{appt.slot.endTime}
          </span>
        )}
        {payLabel && (
          <span className="rounded-full border border-info/30 bg-info/10 px-2 py-0.5 text-info font-medium">{payLabel}</span>
        )}
        {appt.clinic && (
          <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full border border-border bg-muted/30 px-2 py-0.5">
            <Stethoscope className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {locale === "ar" ? appt.clinic.nameAr || appt.clinic.nameFr : appt.clinic.nameFr || appt.clinic.nameAr}
            </span>
          </span>
        )}
        {!appt.clinic && (
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/20 px-2 py-0.5 text-muted-foreground">
            <MapPin className="h-3 w-3" />
            {t("appt.noClinic")}
          </span>
        )}
      </div>

      {appt.notes && (
        <div className="mt-3 line-clamp-2 text-[11px] text-muted-foreground">“{appt.notes}”</div>
      )}
    </GlassCard>
  );
}
