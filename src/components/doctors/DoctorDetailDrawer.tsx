import {
  Stethoscope,
  Mail,
  Phone,
  Calendar,
  CheckCircle2,
  XCircle,
  Award,
} from "lucide-react";
import { Drawer } from "@/components/data/Drawer";
import { GlassCard } from "@/components/glass/GlassCard";
import { RemoteImage } from "@/components/common/RemoteImage";
import { StatusBadge } from "@/components/data/StatusBadge";
import type { ClinicDoctor } from "@/api/clinicSelfApi";

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
  if (!doctorAffiliation) return null;

  const d = doctorAffiliation.doctor as any;
  const affAny = doctorAffiliation as any;
  const firstName = d?.firstNameFr || d?.firstNameAr || d?.firstName || "";
  const lastName = d?.lastNameFr || d?.lastNameAr || d?.lastName || "";
  const fullDoctorName = `${firstName} ${lastName}`.trim() || d?.name || "Doctor";

  const specialtyName = Array.isArray(d?.specialties) && d.specialties.length > 0
    ? d.specialties[0].nameFr || d.specialties[0].nameAr
    : d?.specialtyName || d?.specialty?.nameFr || "General Practice";

  return (
    <Drawer
      id="doctor-detail-drawer"
      open={!!doctorAffiliation}
      onClose={onClose}
      title={`Dr. ${fullDoctorName}`}
      subtitle="Affiliated Specialist Profile"
    >
      <div className="space-y-5">
        {/* Doctor Header Banner */}
        <div className="flex items-center gap-4 rounded-2xl bg-accent/40 p-4 border border-border/40">
          <RemoteImage
            src={d?.avatarUrl || d?.photoUrl}
            alt={fullDoctorName}
            className="h-16 w-16 rounded-2xl object-cover border border-border/50 shadow-xs"
          />
          <div>
            <h3 className="text-base font-bold text-foreground">Dr. {fullDoctorName}</h3>
            <p className="text-xs font-semibold text-primary-500">{specialtyName}</p>
            <div className="mt-1.5">
              <StatusBadge value={doctorAffiliation.status} />
            </div>
          </div>
        </div>

        {/* Contact Info */}
        <GlassCard className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-primary-500 uppercase tracking-wide">
            <Stethoscope className="h-4 w-4" /> Contact & Qualifications
          </div>

          <div className="space-y-2">
            {d?.phone && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Phone className="h-3.5 w-3.5 text-primary-500" />
                <a href={`tel:${d.phone}`} className="hover:underline font-semibold text-foreground">
                  {d.phone}
                </a>
              </div>
            )}

            {d?.email && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Mail className="h-3.5 w-3.5 text-primary-500" />
                <span>{d.email}</span>
              </div>
            )}

            {d?.yearsOfExp !== undefined && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Award className="h-3.5 w-3.5 text-primary-500" />
                <span>{d.yearsOfExp} Years of Medical Experience</span>
              </div>
            )}

            {(affAny.joinedAt || affAny.createdAt) && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 border-t border-border/30">
                <Calendar className="h-3.5 w-3.5 text-primary-500" />
                <span>Joined Facility: {(affAny.joinedAt || affAny.createdAt).slice(0, 10)}</span>
              </div>
            )}
          </div>
        </GlassCard>

        {/* Pending Actions if applicable */}
        {doctorAffiliation.status === "PENDING" && (onAccept || onReject) && (
          <div className="pt-3 border-t border-border/40 space-y-2">
            <div className="text-xs font-bold text-muted-foreground">Affiliation Request Actions</div>
            <div className="grid grid-cols-2 gap-3">
              {onAccept && (
                <button
                  onClick={() => {
                    onAccept(doctorAffiliation.id);
                    onClose();
                  }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-success/15 px-3 py-2 text-xs font-semibold text-success hover:bg-success/25 transition cursor-pointer"
                >
                  <CheckCircle2 className="h-4 w-4" /> Accept Invitation
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
                  <XCircle className="h-4 w-4" /> Decline Request
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
}
