import {
  Stethoscope,
  Mail,
  Phone,
  Calendar,
  CheckCircle2,
  XCircle,
  Award,
  ShieldCheck,
  Building2,
  MapPin,
  FileText,
  UserCheck,
} from "lucide-react";
import { Drawer } from "@/components/data/Drawer";
import { GlassCard } from "@/components/glass/GlassCard";
import { RemoteImage } from "@/components/common/RemoteImage";
import { StatusBadge } from "@/components/data/StatusBadge";
import type { ClinicDoctor } from "@/api/clinicSelfApi";
import { useTranslation } from "react-i18next";

interface DoctorDetailDrawerProps {
  doctorAffiliation: ClinicDoctor | null;
  onClose: () => void;
  onAccept?: (id: string) => void;
  onReject?: (id: string) => void;
}

export function DoctorDetailDrawer({
  doctorAffiliation,
  onClose,
  onAccept,
  onReject,
}: DoctorDetailDrawerProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";

  if (!doctorAffiliation) return null;

  const d = doctorAffiliation.doctor as any;
  const affAny = doctorAffiliation as any;
  const firstNameFr = d?.firstNameFr || d?.firstName || "";
  const lastNameFr = d?.lastNameFr || d?.lastName || "";
  const firstNameAr = d?.firstNameAr || "";
  const lastNameAr = d?.lastNameAr || "";

  const nameFr = `${firstNameFr} ${lastNameFr}`.trim();
  const nameAr = `${firstNameAr} ${lastNameAr}`.trim();
  const displayName = isRtl ? nameAr || nameFr || d?.name || "طبيب" : nameFr || nameAr || d?.name || "Doctor";
  const secondaryName = isRtl ? nameFr : nameAr;

  // Specialties list
  const specialties: string[] = [];
  if (Array.isArray(d?.specialties) && d.specialties.length > 0) {
    d.specialties.forEach((s: any) => {
      const spec = s.specialty || s;
      const title = isRtl ? spec.nameAr || spec.nameFr : spec.nameFr || spec.nameAr;
      if (title) specialties.push(title);
    });
  } else if (d?.specialtyName || d?.specialty?.nameFr || d?.specialty?.nameAr) {
    const title = isRtl
      ? d.specialty?.nameAr || d.specialtyName || d.specialty?.nameFr
      : d.specialtyName || d.specialty?.nameFr || d.specialty?.nameAr;
    if (title) specialties.push(title);
  }

  const practiceTypeLabels: Record<string, string> = {
    CLINIC_BASED: t("doctors.practiceClinicBased", { defaultValue: "Clinic Based" }),
    INDEPENDENT: t("doctors.practiceIndependent", { defaultValue: "Independent Cabinet" }),
    BOTH: t("doctors.practiceBoth", { defaultValue: "Hybrid Practice" }),
  };

  return (
    <Drawer
      id="doctor-detail-drawer"
      open={!!doctorAffiliation}
      onClose={onClose}
      title={`Dr. ${displayName}`}
      subtitle={t("doctors.detailDrawerSubtitle", { defaultValue: "Affiliated Specialist Profile" })}
    >
      <div className="space-y-4">
        {/* Doctor Header Banner */}
        <div className="flex items-center gap-4 rounded-2xl bg-accent/40 p-4 border border-border/40">
          <RemoteImage
            src={d?.avatarUrl || d?.photoUrl}
            alt={displayName}
            className="h-16 w-16 rounded-2xl object-cover border border-border/50 shadow-xs"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-foreground truncate">Dr. {displayName}</h3>
              {d?.isVerified && (
                <span title="Verified Practitioner">
                  <ShieldCheck className="h-4 w-4 text-primary-500 shrink-0" />
                </span>
              )}
            </div>
            {secondaryName && (
              <p className="text-xs text-muted-foreground font-medium">{secondaryName}</p>
            )}
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <StatusBadge value={doctorAffiliation.status} />
              {d?.practiceType && (
                <span className="inline-flex items-center gap-1 rounded-md bg-primary-500/10 px-2 py-0.5 text-[10px] font-semibold text-primary-500">
                  <Building2 className="h-3 w-3" />
                  {practiceTypeLabels[d.practiceType] || d.practiceType}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Specialties Chips */}
        {specialties.length > 0 && (
          <GlassCard className="p-3.5 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-primary-500 uppercase tracking-wide">
              <Stethoscope className="h-3.5 w-3.5" />
              <span>{t("doctors.specialtiesLabel", { defaultValue: "Medical Specialties" })}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {specialties.map((spec, i) => (
                <span
                  key={i}
                  className="rounded-lg bg-primary-500/15 border border-primary-500/20 px-2.5 py-1 text-xs font-semibold text-primary-500"
                >
                  {spec}
                </span>
              ))}
            </div>
          </GlassCard>
        )}

        {/* Contact Info & Location */}
        <GlassCard className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-primary-500 uppercase tracking-wide">
            <UserCheck className="h-4 w-4" />
            <span>{t("doctors.sectionContact", { defaultValue: "Contact & Credentials" })}</span>
          </div>

          <div className="space-y-2 text-xs">
            {d?.phone && (
              <div className="flex items-center justify-between py-1 border-b border-border/30">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5 text-primary-500" />
                  <span>{t("doctors.phone", { defaultValue: "Phone" })}</span>
                </div>
                <a
                  href={`tel:${d.phone}`}
                  className="font-mono font-semibold text-foreground hover:text-primary-500 hover:underline"
                >
                  {d.phone}
                </a>
              </div>
            )}

            {d?.email && (
              <div className="flex items-center justify-between py-1 border-b border-border/30">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-3.5 w-3.5 text-primary-500" />
                  <span>{t("doctors.email", { defaultValue: "Email" })}</span>
                </div>
                <a
                  href={`mailto:${d.email}`}
                  className="font-medium text-foreground hover:text-primary-500 hover:underline truncate max-w-[200px]"
                >
                  {d.email}
                </a>
              </div>
            )}

            {d?.yearsOfExp !== undefined && (
              <div className="flex items-center justify-between py-1 border-b border-border/30">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Award className="h-3.5 w-3.5 text-primary-500" />
                  <span>{t("doctors.yearsOfExp", { defaultValue: "Experience" })}</span>
                </div>
                <span className="font-semibold text-foreground">
                  {d.yearsOfExp} {t("common.years", { defaultValue: "Years" })}
                </span>
              </div>
            )}

            {(d?.wilaya?.nameFr || d?.wilaya?.nameAr) && (
              <div className="flex items-center justify-between py-1 border-b border-border/30">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 text-primary-500" />
                  <span>{t("doctors.wilaya", { defaultValue: "Location" })}</span>
                </div>
                <span className="font-medium text-foreground">
                  {isRtl
                    ? d.wilaya.nameAr || d.wilaya.nameFr
                    : d.wilaya.nameFr || d.wilaya.nameAr}
                  {d?.baladya && ` (${isRtl ? d.baladya.nameAr || d.baladya.nameFr : d.baladya.nameFr || d.baladya.nameAr})`}
                </span>
              </div>
            )}

            {(affAny.joinedAt || affAny.createdAt) && (
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5 text-primary-500" />
                  <span>{t("doctors.joinedDate", { defaultValue: "Affiliation Date" })}</span>
                </div>
                <span className="font-medium text-foreground">
                  {(affAny.joinedAt || affAny.createdAt).slice(0, 10)}
                </span>
              </div>
            )}
          </div>
        </GlassCard>

        {/* Medical Biography */}
        {(d?.bioFr || d?.bioAr) && (
          <GlassCard className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-primary-500 uppercase tracking-wide">
              <FileText className="h-3.5 w-3.5" />
              <span>{t("doctors.sectionBio", { defaultValue: "Practitioner Biography" })}</span>
            </div>
            {d?.bioFr && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                {d.bioFr}
              </p>
            )}
            {d?.bioAr && (
              <p className="text-xs text-muted-foreground leading-relaxed" dir="rtl">
                {d.bioAr}
              </p>
            )}
          </GlassCard>
        )}

        {/* Pending Actions */}
        {doctorAffiliation.status === "PENDING" && (onAccept || onReject) && (
          <div className="pt-3 border-t border-border/40 space-y-2">
            <div className="text-xs font-bold text-muted-foreground">
              {t("doctors.pendingActionsTitle", { defaultValue: "Affiliation Request Actions" })}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {onAccept && (
                <button
                  onClick={() => {
                    onAccept(doctorAffiliation.id);
                    onClose();
                  }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-success/15 px-3 py-2 text-xs font-semibold text-success hover:bg-success/25 transition cursor-pointer"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{t("doctors.acceptAction", { defaultValue: "Accept Request" })}</span>
                </button>
              )}

              {onReject && (
                <button
                  onClick={() => {
                    onReject(doctorAffiliation.id);
                    onClose();
                  }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-danger/15 px-3 py-2 text-xs font-semibold text-danger hover:bg-danger/25 transition cursor-pointer"
                >
                  <XCircle className="h-4 w-4" />
                  <span>{t("doctors.rejectAction", { defaultValue: "Decline Request" })}</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
}
