import { useState } from "react";
import { useQuery } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  Edit2,
  Trash2,
  Image as ImageIcon,
  UserCheck,
  Loader2,
  Clock,
  Banknote,
  Upload,
  X,
} from "lucide-react";
import {
  clinicServicesApi,
  type ClinicService,
  type CreateServicePayload,
} from "@/api/clinicServicesApi";
import { useClinicDoctors } from "@/hooks/useClinicDoctors";
import { qk } from "@/lib/queryKeys";
import { useEntityMutation } from "@/lib/mutations";
import { ensureArray } from "@/lib/utils";
import { GlassCard } from "@/components/glass/GlassCard";
import { RemoteImage } from "@/components/common/RemoteImage";
import { FormModal } from "@/components/data/FormModal";
import { Drawer } from "@/components/data/Drawer";
import { ConfirmDialog } from "@/components/data/ConfirmDialog";
import { EmptyState } from "@/components/data/EmptyState";
import { Skeleton } from "@/components/glass/Skeleton";

const serviceSchema = z.object({
  nameFr: z.string().min(2, "French name is required"),
  nameAr: z.string().optional(),
  descriptionFr: z.string().optional(),
  descriptionAr: z.string().optional(),
  durationMinutes: z.coerce.number().min(5).max(480).optional(),
  price: z.coerce.number().min(0).optional(),
  isActive: z.boolean().optional(),
});

type ServiceFormData = z.infer<typeof serviceSchema>;

export default function ServicesPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<ClinicService | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Active sub-views
  const [selectedImageService, setSelectedImageService] = useState<ClinicService | null>(null);
  const [selectedDoctorService, setSelectedDoctorService] = useState<ClinicService | null>(null);

  const { data: rawServices, isLoading } = useQuery({
    queryKey: qk.clinicSelf.services(),
    queryFn: clinicServicesApi.list,
  });

  const services: ClinicService[] = ensureArray<ClinicService>(rawServices);

  const { acceptedDoctors } = useClinicDoctors();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ServiceFormData>({
    resolver: zodResolver(serviceSchema),
  });

  // Service CRUD Mutations
  const createMutation = useEntityMutation({
    mutationFn: (payload: CreateServicePayload) => clinicServicesApi.create(payload),
    invalidate: [qk.clinicSelf.services()],
    successMessage: "Service created successfully",
    onSuccess: () => {
      setModalOpen(false);
      reset();
    },
  });

  const updateMutation = useEntityMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ServiceFormData }) =>
      clinicServicesApi.update(id, payload),
    invalidate: [qk.clinicSelf.services()],
    successMessage: "Service updated successfully",
    onSuccess: () => {
      setModalOpen(false);
      setEditingService(null);
      reset();
    },
  });

  const deleteMutation = useEntityMutation({
    mutationFn: (id: string) => clinicServicesApi.delete(id),
    invalidate: [qk.clinicSelf.services()],
    successMessage: "Service deleted successfully",
    onSuccess: () => setDeleteConfirmId(null),
  });

  // Doctor assignment mutation
  const assignDoctorMutation = useEntityMutation({
    mutationFn: ({ serviceId, doctorId }: { serviceId: string; doctorId: string }) =>
      clinicServicesApi.assignDoctor(serviceId, { doctorId }),
    invalidate: [qk.clinicSelf.services()],
    successMessage: "Doctor assigned to service",
  });

  const unassignDoctorMutation = useEntityMutation({
    mutationFn: ({ serviceId, doctorId }: { serviceId: string; doctorId: string }) =>
      clinicServicesApi.unassignDoctor(serviceId, doctorId),
    invalidate: [qk.clinicSelf.services()],
    successMessage: "Doctor unassigned from service",
  });

  // Image Upload mutation
  const uploadImageMutation = useEntityMutation({
    mutationFn: ({ serviceId, file }: { serviceId: string; file: File }) => {
      const formData = new FormData();
      formData.append("file", file);
      return clinicServicesApi.uploadImage(serviceId, formData);
    },
    invalidate: [qk.clinicSelf.services()],
    successMessage: "Service image uploaded",
  });

  const deleteImageMutation = useEntityMutation({
    mutationFn: ({ serviceId, imageId }: { serviceId: string; imageId: string }) =>
      clinicServicesApi.deleteImage(serviceId, imageId),
    invalidate: [qk.clinicSelf.services()],
    successMessage: "Service image removed",
  });

  const openCreateModal = () => {
    setEditingService(null);
    reset({
      nameFr: "",
      nameAr: "",
      descriptionFr: "",
      descriptionAr: "",
      durationMinutes: 30,
      price: 0,
      isActive: true,
    });
    setModalOpen(true);
  };

  const openEditModal = (service: ClinicService) => {
    setEditingService(service);
    reset({
      nameFr: service.nameFr,
      nameAr: service.nameAr || "",
      descriptionFr: service.descriptionFr || "",
      descriptionAr: service.descriptionAr || "",
      durationMinutes: service.durationMinutes || 30,
      price: service.price || 0,
      isActive: service.isActive ?? true,
    });
    setModalOpen(true);
  };

  const onSubmit = (data: ServiceFormData) => {
    if (editingService) {
      updateMutation.mutate({ id: editingService.id, payload: data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Services Catalogue</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage your clinic's medical offerings, prices, and doctor assignments
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          Add Service
        </button>
      </div>

      {/* Services Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full rounded-2xl" />
          ))}
        </div>
      ) : services.length === 0 ? (
        <EmptyState
          title="No services added yet"
          description="Create your first medical service offering to configure your clinic catalogue."
          action={
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 cursor-pointer"
            >
              <Plus className="h-4 w-4" /> Add Service
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((service) => (
            <GlassCard key={service.id} className="p-5 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold">{service.nameFr}</h3>
                    {service.nameAr && (
                      <p className="text-xs text-muted-foreground font-medium">{service.nameAr}</p>
                    )}
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      service.isActive !== false
                        ? "bg-success/15 text-success"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {service.isActive !== false ? "Active" : "Inactive"}
                  </span>
                </div>

                {service.descriptionFr && (
                  <p className="text-xs text-muted-foreground/80 mt-2 line-clamp-2">
                    {service.descriptionFr}
                  </p>
                )}

                <div className="mt-3 flex items-center gap-4 text-xs font-medium text-muted-foreground">
                  {service.durationMinutes && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-primary-500" />
                      <span>{service.durationMinutes} mins</span>
                    </div>
                  )}
                  {service.price !== undefined && (
                    <div className="flex items-center gap-1">
                      <Banknote className="h-3.5 w-3.5 text-success" />
                      <span>{service.price} DZD</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions & Sub-view buttons */}
              <div className="pt-3 border-t border-border/30 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setSelectedImageService(service)}
                    className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold bg-accent/60 hover:bg-accent transition cursor-pointer"
                    title="Manage Photos"
                  >
                    <ImageIcon className="h-3.5 w-3.5 text-primary-500" />
                    <span>{service.images?.length || 0}</span>
                  </button>

                  <button
                    onClick={() => setSelectedDoctorService(service)}
                    className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold bg-accent/60 hover:bg-accent transition cursor-pointer"
                    title="Assigned Doctors"
                  >
                    <UserCheck className="h-3.5 w-3.5 text-secondary-500" />
                    <span>{service.assignedDoctors?.length || 0}</span>
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(service)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition cursor-pointer"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(service.id)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-danger/15 hover:text-danger transition cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Create / Edit Service Modal */}
      <FormModal
        id="service-form-modal"
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingService ? "Edit Service" : "Add Service"}
        description="Configure medical offering details, duration, and price"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Service Name (French)*</label>
            <input
              {...register("nameFr")}
              placeholder="e.g. Consultation Générale"
              className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
            />
            {errors.nameFr && <p className="text-xs text-danger">{errors.nameFr.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Service Name (Arabic)</label>
            <input
              {...register("nameAr")}
              placeholder="e.g. فحص عام"
              dir="rtl"
              className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Duration (minutes)</label>
              <input
                type="number"
                {...register("durationMinutes")}
                className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Price (DZD)</label>
              <input
                type="number"
                {...register("price")}
                className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Description (French)</label>
            <textarea
              {...register("descriptionFr")}
              rows={2}
              className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
            />
          </div>

          {editingService && (
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
              <input
                type="checkbox"
                {...register("isActive")}
                className="h-4 w-4 rounded border-border text-primary-500"
              />
              Service is Active
            </label>
          )}

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
              {editingService ? "Save Changes" : "Create Service"}
            </button>
          </div>
        </form>
      </FormModal>

      {/* Doctor Assignment Drawer */}
      <Drawer
        id="doctor-assignment-drawer"
        open={!!selectedDoctorService}
        onClose={() => setSelectedDoctorService(null)}
        title={`Assign Doctors — ${selectedDoctorService?.nameFr}`}
      >
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Select affiliated doctors authorized to perform this service offering.
          </p>

          <div className="space-y-2">
            {acceptedDoctors.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                No active affiliated doctors available.
              </p>
            ) : (
              acceptedDoctors.map((doc) => {
                const assigned = selectedDoctorService?.assignedDoctors?.some(
                  (a) => a.doctorId === doc.doctorId
                );
                return (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-accent/40 border border-border/30"
                  >
                    <div className="flex items-center gap-3">
                      <RemoteImage
                        src={doc.doctor?.avatarUrl || doc.doctor?.photoUrl}
                        alt={doc.doctor?.name || "Doctor"}
                        className="h-9 w-9 rounded-full object-cover"
                      />
                      <div>
                        <div className="text-xs font-bold">
                          Dr. {doc.doctor?.firstName || ""} {doc.doctor?.lastName || doc.doctor?.name || "Doctor"}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {doc.doctor?.specialtyName || "Specialist"}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        if (!selectedDoctorService) return;
                        if (assigned) {
                          unassignDoctorMutation.mutate({
                            serviceId: selectedDoctorService.id,
                            doctorId: doc.doctorId,
                          });
                        } else {
                          assignDoctorMutation.mutate({
                            serviceId: selectedDoctorService.id,
                            doctorId: doc.doctorId,
                          });
                        }
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                        assigned
                          ? "bg-danger/15 text-danger hover:bg-danger/25"
                          : "bg-primary-500 text-primary-foreground hover:opacity-90"
                      }`}
                    >
                      {assigned ? "Unassign" : "Assign"}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Drawer>

      {/* Photos Manager Drawer */}
      <Drawer
        id="photos-manager-drawer"
        open={!!selectedImageService}
        onClose={() => setSelectedImageService(null)}
        title={`Service Photos — ${selectedImageService?.nameFr}`}
      >
        <div className="space-y-4">
          <label className="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border/60 p-4 text-xs font-semibold text-muted-foreground hover:border-primary-500/50 hover:bg-primary-500/5 transition cursor-pointer">
            <Upload className="h-4 w-4 text-primary-500" />
            Upload Service Image (JPEG/PNG/WebP, max 5MB)
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file && selectedImageService) {
                  uploadImageMutation.mutate({ serviceId: selectedImageService.id, file });
                }
              }}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            {selectedImageService?.images?.map((img) => (
              <div key={img.id} className="relative group rounded-xl overflow-hidden border border-border/40 aspect-video">
                <RemoteImage src={img.imageUrl} alt="Service" className="h-full w-full object-cover" />
                <button
                  onClick={() => {
                    deleteImageMutation.mutate({
                      serviceId: selectedImageService.id,
                      imageId: img.id,
                    });
                  }}
                  className="absolute top-2 end-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-danger transition cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </Drawer>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        id="delete-service-dialog"
        open={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={() => {
          if (deleteConfirmId) deleteMutation.mutate(deleteConfirmId);
        }}
        title="Delete Service"
        description="Are you sure you want to delete this service from your catalogue? Existing appointments will remain unaffected."
        confirmLabel="Delete Service"
        danger={true}
      />
    </div>
  );
}
