import { useState } from "react";
import { useQuery } from "@/lib/queryClient";
import {
  UserPlus,
  CheckCircle2,
  XCircle,
  Trash2,
  Search,
  Loader2,
} from "lucide-react";
import { clinicSelfApi, type ClinicDoctor } from "@/api/clinicSelfApi";
import { doctorsApi, type DoctorRow } from "@/api/doctorsApi";
import { qk } from "@/lib/queryKeys";
import { useEntityMutation } from "@/lib/mutations";
import { ensureArray } from "@/lib/utils";
import { GlassCard } from "@/components/glass/GlassCard";
import { RemoteImage } from "@/components/common/RemoteImage";
import { FormModal } from "@/components/data/FormModal";
import { ConfirmDialog } from "@/components/data/ConfirmDialog";
import { EmptyState } from "@/components/data/EmptyState";
import { Skeleton } from "@/components/glass/Skeleton";

export default function DoctorsPage() {
  const [activeTab, setActiveTab] = useState<"ACCEPTED" | "PENDING" | "REJECTED">("ACCEPTED");
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [searchDoctorQuery, setSearchDoctorQuery] = useState("");
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);

  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  // Fetch clinic affiliated doctors
  const { data: rawAffiliations, isLoading } = useQuery({
    queryKey: qk.clinicSelf.doctors(),
    queryFn: clinicSelfApi.getDoctors,
  });

  const affiliations: ClinicDoctor[] = ensureArray<ClinicDoctor>(rawAffiliations);

  // Search doctors on platform for invitation
  const { data: platformDoctorsData, isLoading: isSearchLoading } = useQuery({
    queryKey: ["platformDoctorsSearch", searchDoctorQuery],
    queryFn: () => doctorsApi.list({ search: searchDoctorQuery, limit: 10 }),
    enabled: inviteModalOpen && searchDoctorQuery.trim().length >= 2,
  });

  const searchedDoctors: DoctorRow[] = platformDoctorsData?.items ?? [];

  // Mutations
  const inviteMutation = useEntityMutation({
    mutationFn: (doctorId: string) => clinicSelfApi.inviteDoctor(doctorId),
    invalidate: [qk.clinicSelf.doctors()],
    successMessage: "Doctor invitation sent successfully",
    onSuccess: () => {
      setInviteModalOpen(false);
      setSelectedDoctorId(null);
      setSearchDoctorQuery("");
    },
  });

  const acceptMutation = useEntityMutation({
    mutationFn: (id: string) => clinicSelfApi.acceptDoctor(id),
    invalidate: [qk.clinicSelf.doctors()],
    successMessage: "Doctor request accepted",
  });

  const rejectMutation = useEntityMutation({
    mutationFn: (id: string) => clinicSelfApi.rejectDoctor(id),
    invalidate: [qk.clinicSelf.doctors()],
    successMessage: "Doctor request rejected",
  });

  const removeMutation = useEntityMutation({
    mutationFn: (id: string) => clinicSelfApi.removeDoctor(id),
    invalidate: [qk.clinicSelf.doctors()],
    successMessage: "Doctor unaffiliated from clinic",
    onSuccess: () => setConfirmRemoveId(null),
  });

  const filteredAffiliations = affiliations.filter((a) => a.status === activeTab);

  const counts = {
    ACCEPTED: affiliations.filter((a) => a.status === "ACCEPTED").length,
    PENDING: affiliations.filter((a) => a.status === "PENDING").length,
    REJECTED: affiliations.filter((a) => a.status === "REJECTED").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Affiliated Doctors</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage your clinic's medical staff and invitation requests
          </p>
        </div>

        <button
          onClick={() => setInviteModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 cursor-pointer self-start sm:self-auto"
        >
          <UserPlus className="h-4 w-4" />
          Invite Doctor
        </button>
      </div>

      {/* Tabs Filter */}
      <div className="flex items-center gap-2 border-b border-border/40 pb-2">
        {(["ACCEPTED", "PENDING", "REJECTED"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`relative rounded-xl px-4 py-2 text-xs font-semibold transition cursor-pointer ${
              activeTab === tab
                ? "bg-primary-500/12 text-primary-500"
                : "text-muted-foreground hover:bg-accent/60"
            }`}
          >
            <span>{tab === "ACCEPTED" ? "Active Staff" : tab === "PENDING" ? "Pending Requests" : "Rejected"}</span>
            <span
              className={`ms-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                activeTab === tab ? "bg-primary-500 text-primary-foreground" : "bg-accent text-muted-foreground"
              }`}
            >
              {counts[tab]}
            </span>
          </button>
        ))}
      </div>

      {/* Doctor Cards / List Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-44 w-full rounded-2xl" />
          ))}
        </div>
      ) : filteredAffiliations.length === 0 ? (
        <EmptyState
          title={`No ${activeTab.toLowerCase()} doctors found`}
          description={
            activeTab === "ACCEPTED"
              ? "Your clinic doesn't have any active affiliated doctors yet. Click 'Invite Doctor' to search and invite medical practitioners."
              : activeTab === "PENDING"
                ? "There are no pending invitation or affiliation requests."
                : "No rejected requests."
          }
          action={
            activeTab === "ACCEPTED" ? (
              <button
                onClick={() => setInviteModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 cursor-pointer"
              >
                <UserPlus className="h-4 w-4" /> Invite Doctor
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAffiliations.map((item) => (
            <GlassCard key={item.id} className="p-5 flex flex-col justify-between space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <RemoteImage
                    src={item.doctor?.avatarUrl || item.doctor?.photoUrl}
                    alt={item.doctor?.name || "Doctor"}
                    className="h-12 w-12 rounded-2xl object-cover border border-border/40"
                  />
                  <div>
                    <h3 className="text-sm font-bold">
                      Dr. {item.doctor?.firstNameFr || item.doctor?.firstNameAr || item.doctor?.firstName || ""} {item.doctor?.lastNameFr || item.doctor?.lastNameAr || item.doctor?.lastName || item.doctor?.name || "Doctor"}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {Array.isArray(item.doctor?.specialties) && item.doctor.specialties.length > 0
                        ? item.doctor.specialties[0].nameFr || item.doctor.specialties[0].nameAr
                        : item.doctor?.specialtyName || item.doctor?.specialty?.nameFr || "General Practitioner"}
                    </p>
                    {item.doctor?.email && (
                      <p className="text-[11px] text-muted-foreground/80 mt-0.5 truncate max-w-[180px]">
                        {item.doctor.email}
                      </p>
                    )}
                  </div>
                </div>

                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                    item.status === "ACCEPTED"
                      ? "bg-success/15 text-success"
                      : item.status === "PENDING"
                        ? "bg-warning/15 text-warning"
                        : "bg-danger/15 text-danger"
                  }`}
                >
                  {item.status}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-border/30 flex items-center justify-end gap-2">
                {item.status === "PENDING" && (
                  <>
                    <button
                      onClick={() => acceptMutation.mutate(item.id)}
                      disabled={acceptMutation.isPending}
                      className="inline-flex items-center gap-1 rounded-xl bg-success/15 px-3 py-1.5 text-xs font-semibold text-success hover:bg-success/25 transition cursor-pointer"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Accept
                    </button>
                    <button
                      onClick={() => rejectMutation.mutate(item.id)}
                      disabled={rejectMutation.isPending}
                      className="inline-flex items-center gap-1 rounded-xl bg-danger/15 px-3 py-1.5 text-xs font-semibold text-danger hover:bg-danger/25 transition cursor-pointer"
                    >
                      <XCircle className="h-3.5 w-3.5" /> Reject
                    </button>
                  </>
                )}

                {item.status === "ACCEPTED" && (
                  <button
                    onClick={() => setConfirmRemoveId(item.id)}
                    className="inline-flex items-center gap-1 rounded-xl bg-accent px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-danger/15 hover:text-danger transition cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Unaffiliate
                  </button>
                )}
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Invite Doctor Modal */}
      <FormModal
        id="invite-doctor-modal"
        open={inviteModalOpen}
        onClose={() => {
          setInviteModalOpen(false);
          setSelectedDoctorId(null);
          setSearchDoctorQuery("");
        }}
        title="Invite Doctor to Clinic"
        description="Search platform doctors by name or email and send an affiliation request."
      >
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchDoctorQuery}
              onChange={(e) => setSearchDoctorQuery(e.target.value)}
              placeholder="Search doctor by name or email..."
              className="glass w-full rounded-xl ps-9 pe-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
            />
          </div>

          {searchDoctorQuery.trim().length < 2 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              Type at least 2 characters to search for registered doctors.
            </p>
          ) : isSearchLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
            </div>
          ) : searchedDoctors.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              No doctors found matching "{searchDoctorQuery}".
            </p>
          ) : (
            <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {searchedDoctors.map((doc) => {
                const isSelected = selectedDoctorId === doc.id;
                return (
                  <div
                    key={doc.id}
                    onClick={() => setSelectedDoctorId(doc.id)}
                    className={`flex items-center justify-between p-3 rounded-xl border transition cursor-pointer ${
                      isSelected
                        ? "border-primary-500 bg-primary-500/10"
                        : "border-border/40 hover:bg-accent/40"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <RemoteImage
                        src={doc.photoUrl || doc.photoPath}
                        alt={doc.firstNameFr || "Doctor"}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                      <div>
                        <div className="text-xs font-bold">
                          Dr. {doc.firstNameFr} {doc.lastNameFr}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {doc.specialties?.[0]?.specialty?.nameFr || "General Medicine"} • {doc.email}
                        </div>
                      </div>
                    </div>
                    {isSelected && <CheckCircle2 className="h-4 w-4 text-primary-500" />}
                  </div>
                );
              })}
            </div>
          )}

          <div className="pt-4 border-t border-border/40 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setInviteModalOpen(false)}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!selectedDoctorId || inviteMutation.isPending}
              onClick={() => {
                if (selectedDoctorId) inviteMutation.mutate(selectedDoctorId);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              {inviteMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Send Invitation
            </button>
          </div>
        </div>
      </FormModal>

      {/* Confirm Unaffiliate Dialog */}
      <ConfirmDialog
        id="confirm-remove-doctor"
        open={!!confirmRemoveId}
        onClose={() => setConfirmRemoveId(null)}
        onConfirm={() => {
          if (confirmRemoveId) removeMutation.mutate(confirmRemoveId);
        }}
        title="Unaffiliate Doctor"
        description="Are you sure you want to remove this doctor from your clinic staff? They will no longer be listed under your clinic."
        confirmLabel="Remove Doctor"
        danger={true}
      />
    </div>
  );
}
