import { useQuery } from "@/lib/queryClient";
import { Building2, Clock, Globe, Mail, MapPin, Phone, Stethoscope } from "lucide-react";
import { Drawer } from "@/components/data/Drawer";
import { Skeleton } from "@/components/glass/Skeleton";
import { StatusBadge } from "@/components/data/StatusBadge";
import { clinicsApi, type ClinicRow, type WorkingHours } from "@/api/clinicsApi";
import { resolveMediaUrl } from "@/components/users/UserAvatar";
import { clinicPlaceholderUrl } from "@/lib/assetFallbacks";
import { qk } from "@/lib/queryKeys";

function formatWorkingHours(wh?: ClinicRow["workingHours"]): { day: string; label: string }[] {
  if (!wh) return [];
  const rows: WorkingHours[] = Array.isArray(wh) ? wh : Object.values(wh);
  return rows
    .filter((r) => r && (r.day || r.open || r.close))
    .map((r) => ({
      day: r.day ?? "",
      label: r.closed ? "Closed" : [r.open, r.close].filter(Boolean).join(" – ") || "—",
    }));
}

type PublicClinicFallback = Partial<{
  id: string;
  nameFr: string;
  nameAr: string;
  phone: string;
  logoUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  wilaya?: { id: string; nameFr?: string; nameAr?: string } | null;
}>;

export function ClinicDetailDrawer({
  clinicId,
  fallback,
  open,
  onClose,
}: {
  clinicId: string | null;
  fallback?: Partial<ClinicRow> | PublicClinicFallback | null;
  open: boolean;
  onClose: () => void;
}) {
  const detail = useQuery({
    queryKey: qk.clinics.detail(clinicId ?? ""),
    queryFn: () => clinicsApi.getById(clinicId as string),
    enabled: open && !!clinicId,
  });

  const clinic = detail.data ?? (fallback as ClinicRow | undefined);
  const hours = formatWorkingHours(clinic?.workingHours);
  const mapUrl =
    clinic?.latitude && clinic?.longitude
      ? `https://www.google.com/maps?q=${clinic.latitude},${clinic.longitude}`
      : undefined;

  return (
    <Drawer
      id="clinic-detail"
      open={open}
      onClose={onClose}
      title={clinic?.nameFr || clinic?.nameAr || "Clinic"}
      subtitle={clinic?.wilaya?.nameFr ?? clinic?.wilaya?.nameAr ?? undefined}
    >
      {detail.isLoading && !fallback ? (
        <div className="space-y-3">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
      ) : !clinic ? (
        <p className="text-sm text-muted-foreground">Clinic details unavailable.</p>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <img
              src={resolveMediaUrl(clinic.logoUrl) ?? clinicPlaceholderUrl}
              alt=""
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = clinicPlaceholderUrl;
              }}
              className="h-16 w-16 shrink-0 rounded-2xl object-cover"
            />
            <div className="min-w-0">
              <div className="truncate text-base font-semibold">{clinic.nameFr || clinic.nameAr}</div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {clinic.facilityType && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary-500/10 px-2 py-0.5 text-[11px] text-primary-500">
                    <Building2 className="h-3 w-3" /> {clinic.facilityType}
                  </span>
                )}
                {clinic.isVerified != null && <StatusBadge value={clinic.isVerified ? "VERIFIED" : "PENDING"} />}
              </div>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span>
                {clinic.addressFr || clinic.address || clinic.addressAr || "—"}
                {clinic.baladya?.nameFr ? ` · ${clinic.baladya.nameFr}` : ""}
                {clinic.wilaya?.nameFr ? ` · ${clinic.wilaya.nameFr}` : ""}
              </span>
            </div>
            {clinic.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                <a href={`tel:${clinic.phone}`} className="hover:text-primary-500">{clinic.phone}</a>
              </div>
            )}
            {clinic.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                <a href={`mailto:${clinic.email}`} className="truncate hover:text-primary-500">{clinic.email}</a>
              </div>
            )}
            {clinic.website && (
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
                <a href={clinic.website} target="_blank" rel="noreferrer" className="truncate hover:text-primary-500">
                  {clinic.website}
                </a>
              </div>
            )}
            {typeof clinic.doctorsCount === "number" && (
              <div className="flex items-center gap-2">
                <Stethoscope className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span>{clinic.doctorsCount} doctor{clinic.doctorsCount === 1 ? "" : "s"} affiliated</span>
              </div>
            )}
          </div>

          {(clinic.descriptionFr || clinic.descriptionAr) && (
            <div>
              <h3 className="mb-1 text-xs font-semibold text-muted-foreground">About</h3>
              <p className="text-sm">{clinic.descriptionFr || clinic.descriptionAr}</p>
            </div>
          )}

          {hours.length > 0 && (
            <div>
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> Working hours
              </h3>
              <ul className="space-y-1 text-xs">
                {hours.map((h, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{h.day || `Day ${i + 1}`}</span>
                    <span>{h.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {mapUrl && (
            <a
              href={mapUrl}
              target="_blank"
              rel="noreferrer"
              className="glass flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-medium hover:bg-primary-500/10"
            >
              <MapPin className="h-3.5 w-3.5" /> View on map
            </a>
          )}
        </div>
      )}
    </Drawer>
  );
}
