import { useState } from "react";
import { useQuery } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Users, Plus, Search, Edit2, Loader2, Phone, Mail, Calendar } from "lucide-react";
import { clinicAppointmentsApi, type GuestPatient } from "@/api/clinicAppointmentsApi";
import { qk } from "@/lib/queryKeys";
import { useEntityMutation } from "@/lib/mutations";
import { GlassCard } from "@/components/glass/GlassCard";
import { FormModal } from "@/components/data/FormModal";
import { EmptyState } from "@/components/data/EmptyState";
import { Skeleton } from "@/components/glass/Skeleton";

const patientSchema = z.object({
  firstName: z.string().min(2, "First name is required"),
  lastName: z.string().min(2, "Last name is required"),
  phone: z.string().regex(/^\d{10,15}$/, "Phone number must be 10-15 digits"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  dateOfBirth: z.string().optional(),
  notes: z.string().optional(),
});

type PatientFormData = z.infer<typeof patientSchema>;

export default function PatientsPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<GuestPatient | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: paginatedData, isLoading } = useQuery({
    queryKey: qk.clinicSelf.guestPatients({ search: searchQuery }),
    queryFn: () => clinicAppointmentsApi.listGuestPatients({ search: searchQuery, limit: 50 }),
  });

  const patients = paginatedData?.data ?? [];

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema),
  });

  const createMutation = useEntityMutation({
    mutationFn: (payload: PatientFormData) => clinicAppointmentsApi.createGuestPatient(payload),
    invalidate: [qk.clinicSelf.guestPatients()],
    successMessage: "Guest patient created successfully",
    onSuccess: () => {
      setModalOpen(false);
      reset();
    },
  });

  const updateMutation = useEntityMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<GuestPatient> }) =>
      clinicAppointmentsApi.updateGuestPatient(id, payload),
    invalidate: [qk.clinicSelf.guestPatients()],
    successMessage: "Patient details updated",
    onSuccess: () => {
      setModalOpen(false);
      setEditingPatient(null);
      reset();
    },
  });

  const openCreateModal = () => {
    setEditingPatient(null);
    reset({
      firstName: "",
      lastName: "",
      phone: "",
      email: "",
      dateOfBirth: "",
      notes: "",
    });
    setModalOpen(true);
  };

  const openEditModal = (patient: GuestPatient) => {
    setEditingPatient(patient);
    reset({
      firstName: patient.firstName,
      lastName: patient.lastName,
      phone: patient.phone,
      email: patient.email || "",
      dateOfBirth: patient.dateOfBirth || "",
      notes: patient.notes || "",
    });
    setModalOpen(true);
  };

  const onSubmit = (data: PatientFormData) => {
    if (editingPatient) {
      updateMutation.mutate({ id: editingPatient.id, payload: data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Guest & Walk-in Patients</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Register and manage non-account walk-in patient profiles
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          New Patient
        </button>
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search guest patient by name or phone..."
          className="glass w-full rounded-xl ps-9 pe-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
        />
      </div>

      {/* Patients Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36 w-full rounded-2xl" />
          ))}
        </div>
      ) : patients.length === 0 ? (
        <EmptyState
          title="No guest patients found"
          description="Register walk-in patients to book clinic appointments on their behalf."
          action={
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 cursor-pointer"
            >
              <Plus className="h-4 w-4" /> New Patient
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {patients.map((patient) => (
            <GlassCard key={patient.id} className="p-5 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary-500/15 text-primary-500 font-bold grid place-items-center text-sm">
                      {patient.firstName[0]}
                      {patient.lastName[0]}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold">
                        {patient.firstName} {patient.lastName}
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                        <Phone className="h-3 w-3 text-primary-500" />
                        <span>{patient.phone}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => openEditModal(patient)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition cursor-pointer"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {patient.email && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
                    <Mail className="h-3 w-3" />
                    <span>{patient.email}</span>
                  </div>
                )}

                {patient.dateOfBirth && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                    <Calendar className="h-3 w-3" />
                    <span>DOB: {patient.dateOfBirth}</span>
                  </div>
                )}

                {patient.notes && (
                  <p className="text-xs text-muted-foreground/80 mt-2 bg-accent/30 p-2 rounded-xl">
                    {patient.notes}
                  </p>
                )}
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Create / Edit Patient Modal */}
      <FormModal
        id="guest-patient-modal"
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingPatient ? "Edit Patient Details" : "Register Guest Patient"}
        description="Enter contact details for walk-in patient booking"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">First Name*</label>
              <input
                {...register("firstName")}
                className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
              />
              {errors.firstName && <p className="text-xs text-danger">{errors.firstName.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Last Name*</label>
              <input
                {...register("lastName")}
                className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
              />
              {errors.lastName && <p className="text-xs text-danger">{errors.lastName.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Phone Number*</label>
            <input
              {...register("phone")}
              placeholder="0661234567"
              className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
            />
            {errors.phone && <p className="text-xs text-danger">{errors.phone.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Email (Optional)</label>
              <input
                type="email"
                {...register("email")}
                className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Date of Birth</label>
              <input
                type="date"
                {...register("dateOfBirth")}
                className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Notes (Optional)</label>
            <textarea
              {...register("notes")}
              rows={2}
              placeholder="Medical history notes or observations"
              className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
            />
          </div>

          <div className="pt-4 border-t border-border/40 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              {editingPatient ? "Save Changes" : "Register Patient"}
            </button>
          </div>
        </form>
      </FormModal>
    </div>
  );
}
