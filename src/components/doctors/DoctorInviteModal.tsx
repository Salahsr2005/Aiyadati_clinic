import { useState, useMemo } from "react";
import { useQuery } from "@/lib/queryClient";
import { Search, UserPlus, Stethoscope, Award, CheckCircle2, Loader2, Sparkles, X } from "lucide-react";
import { FormModal } from "@/components/data/FormModal";
import { doctorsApi, type DoctorRow } from "@/api/doctorsApi";
import { clinicSelfApi } from "@/api/clinicSelfApi";
import { useEntityMutation } from "@/lib/mutations";
import { qk } from "@/lib/queryKeys";
import { ensureArray } from "@/lib/utils";

interface DoctorInviteModalProps {
  open: boolean;
  onClose: () => void;
}

export function DoctorInviteModal({ open, onClose }: DoctorInviteModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState("");

  const fallbackPhoto = "/assets/standard/doctor-placeholder.png";

  // Platform doctor search query
  const { data: doctorsData, isLoading } = useQuery({
    queryKey: ["platformDoctorsInviteSearch", searchQuery, specialtyFilter],
    queryFn: () => doctorsApi.list({ search: searchQuery, limit: 30 }),
    enabled: open,
  });

  const doctors: DoctorRow[] = ensureArray<DoctorRow>(doctorsData?.data);

  // Filtered list
  const filteredDoctors = useMemo(() => {
    return doctors.filter((doc) => {
      const spec = doc.specialtyName || doc.specialties?.[0]?.nameFr || "Specialist";
      const matchesSpecialty = !specialtyFilter || spec === specialtyFilter;
      return matchesSpecialty;
    });
  }, [doctors, specialtyFilter]);

  // Unique specialties for filter dropdown
  const uniqueSpecialties = useMemo(() => {
    const set = new Set<string>();
    doctors.forEach((d) => {
      const spec = d.specialtyName || d.specialties?.[0]?.nameFr;
      if (spec) set.add(spec);
    });
    return Array.from(set).sort();
  }, [doctors]);

  // Invitation Mutation
  const inviteMutation = useEntityMutation({
    mutationFn: (doctorId: string) => clinicSelfApi.inviteDoctor({ doctorId }),
    invalidate: [qk.clinicSelf.doctors()],
    successMessage: "Doctor affiliation request sent successfully",
    onSuccess: () => {
      onClose();
    },
  });

  return (
    <FormModal
      id="doctor-invite-modal"
      open={open}
      onClose={onClose}
      title="Invite Doctor for Affiliation"
      description="Search platform doctors and send facility affiliation invitations"
    >
      <div className="space-y-4">
        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-2">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search doctor by name or specialty..."
              className="glass w-full rounded-xl pl-9 pr-3.5 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-primary-500/40"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {uniqueSpecialties.length > 0 && (
            <div className="relative w-full sm:w-48">
              <select
                value={specialtyFilter}
                onChange={(e) => setSpecialtyFilter(e.target.value)}
                className="glass w-full rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-primary-500/40 bg-background text-foreground"
              >
                <option value="">All Specialties ({uniqueSpecialties.length})</option>
                {uniqueSpecialties.map((spec) => (
                  <option key={spec} value={spec}>
                    {spec}
                  </option>
                ))}
              </select>
            </div>
          )}
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
              <p className="text-xs font-bold text-foreground">No doctors found</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Type at least 2 characters to search the nationwide doctor directory.
              </p>
            </div>
          ) : (
            filteredDoctors.map((doc) => {
              const name = `Dr. ${doc.firstName || doc.name || ""} ${doc.lastName || ""}`.trim();
              const spec = doc.specialtyName || doc.specialties?.[0]?.nameFr || "General Practitioner";

              return (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-accent/30 border border-border/40 hover:bg-accent/60 hover:border-primary-500/40 transition"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="relative h-12 w-12 shrink-0 rounded-2xl overflow-hidden border border-border/40 bg-accent">
                      <img
                        src={doc.avatarUrl || doc.photoUrl || fallbackPhoto}
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
                      {doc.yearsOfExp !== undefined && (
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Award className="h-3 w-3 text-amber-500" />
                          <span>{doc.yearsOfExp} Years Medical Experience</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 ms-3">
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
                      Invite
                    </button>
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
