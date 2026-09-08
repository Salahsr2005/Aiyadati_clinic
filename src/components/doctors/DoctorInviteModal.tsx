import { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@/lib/queryClient";
import { Search, UserPlus, Stethoscope, Award, CheckCircle2, Loader2, Clock, X } from "lucide-react";
import { FormModal } from "@/components/data/FormModal";
import { clinicSelfApi } from "@/api/clinicSelfApi";
import { specialtyApi, type SpecialtyRow } from "@/api/specialtyApi";
import { useEntityMutation } from "@/lib/mutations";
import { qk } from "@/lib/queryKeys";
import { ensureArray } from "@/lib/utils";

interface DoctorInviteModalProps {
  open: boolean;
  onClose: () => void;
}

export function DoctorInviteModal({ open, onClose }: DoctorInviteModalProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState("");

  const fallbackPhoto = "/assets/standard/doctor-placeholder.png";

  // Debounce search input (~350ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch real specialties directory
  const { data: specialtiesRaw } = useQuery({
    queryKey: qk.specialties.list(),
    queryFn: () => specialtyApi.list(),
    enabled: open,
  });
  const specialties: SpecialtyRow[] = ensureArray<SpecialtyRow>(specialtiesRaw);

  // Fetch current clinic doctor roster to check existing affiliations
  const { data: rosterRaw } = useQuery({
    queryKey: qk.clinicSelf.doctors(),
    queryFn: clinicSelfApi.getDoctors,
    enabled: open,
  });
  const roster = ensureArray<any>(rosterRaw);

  // Map doctor ID to affiliation status
  const rosterStatusMap = useMemo(() => {
    const map = new Map<string, string>();
    roster.forEach((r) => {
      const docId = r.doctorId || r.doctor?.id || r.id;
      if (docId) {
        map.set(String(docId), r.status || "ACCEPTED");
      }
    });
    return map;
  }, [roster]);

  // Gate query: require >= 2 chars unless empty
  const searchEnabled = open && (debouncedSearch.length >= 2 || debouncedSearch.length === 0);

  // Platform doctor search query
  const { data: doctorsRaw, isLoading } = useQuery({
    queryKey: ["platformDoctorsInviteSearch", debouncedSearch, specialtyFilter],
    queryFn: () => clinicSelfApi.searchPlatformDoctors(debouncedSearch, 30),
    enabled: searchEnabled,
  });

  const doctors = ensureArray<any>(doctorsRaw);

  // Filtered list by specialty
  const filteredDoctors = useMemo(() => {
    return doctors.filter((doc) => {
      if (!specialtyFilter) return true;
      const docAny = doc as any;
      const specId = docAny.specialtyId || docAny.specialty?.id;
      const specName = docAny.specialtyName || docAny.specialty?.nameFr || docAny.specialties?.[0]?.nameFr;
      return String(specId) === String(specialtyFilter) || specName === specialtyFilter;
    });
  }, [doctors, specialtyFilter]);

  // Invitation Mutation
  const inviteMutation = useEntityMutation({
    mutationFn: (doctorId: string) => clinicSelfApi.inviteDoctor(doctorId),
    invalidate: [qk.clinicSelf.doctors(), qk.dashboard.doctors(), qk.dashboard.pendingInvites()],
    successMessage: t("doctors.inviteSuccess", { defaultValue: "تم إرسال طلب الانضمام إلى الطبيب بنجاح" }),
    onSuccess: () => {
      onClose();
    },
  });

  return (
    <FormModal
      id="doctor-invite-modal"
      open={open}
      onClose={onClose}
      title={t("doctors.inviteModalTitle", { defaultValue: "Invite Doctor for Affiliation" })}
      description={t("doctors.inviteModalSub", { defaultValue: "Search platform doctors and send facility affiliation invitations" })}
    >
      <div className="space-y-4">
        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-2">
          <div className="relative flex-1 w-full">
            <Search className="absolute start-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("doctors.searchPlaceholder", { defaultValue: "Search doctor by name or specialty..." })}
              className="glass w-full rounded-xl ps-9 pe-3.5 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-primary-500/40"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute end-3 top-2.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="relative w-full sm:w-48">
            <select
              value={specialtyFilter}
              onChange={(e) => setSpecialtyFilter(e.target.value)}
              className="glass w-full rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-primary-500/40 bg-background text-foreground"
            >
              <option value="">{t("doctors.allSpecialties", { defaultValue: "All Specialties" })}</option>
              {specialties.map((spec) => (
                <option key={spec.id} value={spec.id}>
                  {spec.nameFr || spec.nameAr}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Doctor Cards Directory */}
        <div className="max-h-[420px] overflow-y-auto custom-scrollbar space-y-3 pe-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
            </div>
          ) : filteredDoctors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Stethoscope className="h-9 w-9 text-muted-foreground/40 mb-2" />
              <p className="text-xs font-bold text-foreground">{t("common.empty", { defaultValue: "No doctors found" })}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {t("doctors.searchHint", {
                  defaultValue: "Type at least 2 characters to search the nationwide doctor directory.",
                })}
              </p>
            </div>
          ) : (
            filteredDoctors.map((doc) => {
              const docAny = doc as any;
              const doctorId = String(doc.id);
              const name = `${t("doctors.drPrefix", { defaultValue: "Dr." })} ${docAny.firstNameFr || docAny.firstName || docAny.name || ""} ${docAny.lastNameFr || docAny.lastName || ""}`.trim();
              const spec = docAny.specialtyName || docAny.specialty?.nameFr || docAny.specialties?.[0]?.nameFr || t("doctors.generalPractitioner", { defaultValue: "General Practitioner" });
              const existingStatus = rosterStatusMap.get(doctorId);

              return (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-accent/30 border border-border/40 hover:bg-accent/60 hover:border-primary-500/40 transition"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="relative h-12 w-12 shrink-0 rounded-2xl overflow-hidden border border-border/40 bg-accent">
                      <img
                        src={docAny.avatarUrl || docAny.photoUrl || fallbackPhoto}
                        alt={name}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = fallbackPhoto;
                        }}
                        className="h-full w-full object-cover"
                      />
                    </div>

                    <div className="min-w-0">
                      <h4 className="text-xs font-extrabold text-foreground truncate">{name}</h4>
                      <p className="text-[11px] font-semibold text-primary-500 mt-0.5 truncate">{spec}</p>
                      {docAny.yearsOfExp !== undefined && (
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Award className="h-3 w-3 text-amber-500" />
                          <span>{t("doctors.experienceYears", { defaultValue: "{{years}} Years Experience", years: docAny.yearsOfExp })}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 ms-3">
                    {existingStatus === "ACCEPTED" || existingStatus === "APPROVED" ? (
                      <span className="inline-flex items-center gap-1 rounded-xl bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {t("doctors.alreadyAffiliated", { defaultValue: "Already on team" })}
                      </span>
                    ) : existingStatus === "PENDING" ? (
                      <span className="inline-flex items-center gap-1 rounded-xl bg-amber-500/15 px-3 py-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                        <Clock className="h-3.5 w-3.5" />
                        {t("doctors.pendingInviteBadge", { defaultValue: "Pending Invite" })}
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={inviteMutation.isPending}
                        onClick={() => inviteMutation.mutate(doc.id)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-primary-500 px-3.5 py-1.5 text-xs font-bold text-primary-foreground shadow-xs hover:opacity-90 transition disabled:opacity-50 cursor-pointer"
                      >
                        {inviteMutation.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <UserPlus className="h-3.5 w-3.5" />
                        )}
                        {t("doctors.inviteButton", { defaultValue: "Invite" })}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </FormModal>
  );
}

