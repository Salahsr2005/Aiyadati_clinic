import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
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
  Search,
  Filter,
  RotateCcw,
  List,
  LayoutGrid,
  Sparkles,
  CheckCircle2,
  Stethoscope,
  ChevronRight,
  Building2,
  Check,
} from "lucide-react";
import { buildUploadFormData, validateUploadFile } from "@/utils/uploadHelper";
import { toast } from "sonner";
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
import { StatusBadge } from "@/components/data/StatusBadge";

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

type ViewMode = "grid" | "list";
type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";

export default function ServicesPage() {
  const { t } = useTranslation();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<ClinicService | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Filters & View Mode
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  // Active sub-drawers (store IDs so query invalidations auto-sync UI state)
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);

  const { data: rawServices, isLoading } = useQuery({
    queryKey: qk.clinicSelf.services(),
    queryFn: clinicServicesApi.list,
  });

  const services: ClinicService[] = ensureArray<ClinicService>(rawServices);
  const { acceptedDoctors } = useClinicDoctors();

  const selectedImageService = useMemo(
    () => services.find((s) => s.id === selectedImageId) || null,
    [services, selectedImageId]
  );
  const selectedDoctorService = useMemo(
    () => services.find((s) => s.id === selectedDoctorId) || null,
    [services, selectedDoctorId]
  );

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
    successMessage: t("services.createSuccess", { defaultValue: "Service created successfully" }),
    onSuccess: () => {
      setModalOpen(false);
      reset();
    },
  });

  const updateMutation = useEntityMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ServiceFormData }) =>
      clinicServicesApi.update(id, payload),
    invalidate: [qk.clinicSelf.services()],
    successMessage: t("services.updateSuccess", { defaultValue: "Service updated successfully" }),
    onSuccess: () => {
      setModalOpen(false);
      setEditingService(null);
      reset();
    },
  });

  const deleteMutation = useEntityMutation({
    mutationFn: (id: string) => clinicServicesApi.delete(id),
    invalidate: [qk.clinicSelf.services()],
    successMessage: t("services.deleteSuccess", { defaultValue: "Service deleted successfully" }),
    onSuccess: () => setDeleteConfirmId(null),
  });

  // Doctor assignment mutation
  const assignDoctorMutation = useEntityMutation({
    mutationFn: ({ serviceId, doctorId }: { serviceId: string; doctorId: string }) =>
      clinicServicesApi.assignDoctor(serviceId, { doctorId }),
    invalidate: [qk.clinicSelf.services()],
    successMessage: t("services.assignSuccess", { defaultValue: "Doctor assigned to service" }),
  });

  const unassignDoctorMutation = useEntityMutation({
    mutationFn: ({ serviceId, doctorId }: { serviceId: string; doctorId: string }) =>
      clinicServicesApi.unassignDoctor(serviceId, doctorId),
    invalidate: [qk.clinicSelf.services()],
    successMessage: t("services.unassignSuccess", { defaultValue: "Doctor removed from service" }),
  });

  // Image Upload mutation
  const uploadImageMutation = useEntityMutation({
    mutationFn: ({ serviceId, file }: { serviceId: string; file: File }) => {
      const validation = validateUploadFile(file, "IMAGE");
      if (!validation.valid) {
        toast.error(validation.error);
        return Promise.reject(new Error(validation.error));
      }
      const formData = buildUploadFormData("image", file);
      return clinicServicesApi.uploadImage(serviceId, formData);
    },
    invalidate: [qk.clinicSelf.services(), qk.dashboard.services()],
    successMessage: t("services.imageUploadSuccess", { defaultValue: "Service image uploaded successfully" }),
  });

  const deleteImageMutation = useEntityMutation({
    mutationFn: ({ serviceId, imageId }: { serviceId: string; imageId: string }) =>
      clinicServicesApi.deleteImage(serviceId, imageId),
    invalidate: [qk.clinicSelf.services()],
    successMessage: t("services.imageDeleteSuccess", { defaultValue: "Service image deleted" }),
  });

  const [newServiceImage, setNewServiceImage] = useState<File | null>(null);

  const openCreateModal = () => {
    setEditingService(null);
    setNewServiceImage(null);
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
    setNewServiceImage(null);
    reset({
      nameFr: service.nameFr,
      nameAr: service.nameAr || "",
      descriptionFr: service.descriptionFr || "",
      descriptionAr: service.descriptionAr || "",
      durationMinutes: service.durationMinutes || 30,
      price: service.price || 0,
      isActive: service.isActive !== false,
    });
    setModalOpen(true);
  };

  const onSubmit = (data: ServiceFormData) => {
    if (editingService) {
      updateMutation.mutate(
        { id: editingService.id, payload: data },
        {
          onSuccess: (updated) => {
            if (newServiceImage && (updated?.id || editingService.id)) {
              uploadImageMutation.mutate({
                serviceId: updated?.id || editingService.id,
                file: newServiceImage,
              });
              setNewServiceImage(null);
            }
          },
        }
      );
    } else {
      createMutation.mutate(
        {
          nameFr: data.nameFr,
          nameAr: data.nameAr,
          descriptionFr: data.descriptionFr,
          descriptionAr: data.descriptionAr,
          durationMinutes: data.durationMinutes,
          price: data.price,
        },
        {
          onSuccess: (created) => {
            if (newServiceImage && created?.id) {
              uploadImageMutation.mutate({
                serviceId: created.id,
                file: newServiceImage,
              });
              setNewServiceImage(null);
            }
          },
        }
      );
    }
  };

  // Filtered Services
  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      const matchesSearch =
        !searchQuery.trim() ||
        s.nameFr.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.nameAr || "").includes(searchQuery);

      const isActive = s.isActive !== false;
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && isActive) ||
        (statusFilter === "INACTIVE" && !isActive);

      return matchesSearch && matchesStatus;
    });
  }, [services, searchQuery, statusFilter]);

  // Stats
  const stats = useMemo(() => {
    const total = services.length;
    const active = services.filter((s) => s.isActive !== false).length;
    const inactive = total - active;
    const avgPrice = total > 0 ? Math.round(services.reduce((acc, s) => acc + (s.price || 0), 0) / total) : 0;
    const avgDuration = total > 0 ? Math.round(services.reduce((acc, s) => acc + (s.durationMinutes || 30), 0) / total) : 30;

    return { total, active, inactive, avgPrice, avgDuration };
  }, [services]);

  const hasFilters = searchQuery || statusFilter !== "ALL";
  const currencySuffix = t("common.dzd", { defaultValue: "DZD" });
  const minsSuffix = t("common.minutes", { defaultValue: "mins" });

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("services.title", { defaultValue: "Care Offerings & Services" })}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("services.subtitle", { defaultValue: "Manage clinic treatments, diagnostic offerings, pricing and durations" })}
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-xs transition hover:opacity-90 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          {t("services.createButton", { defaultValue: "Add New Service" })}
        </button>
      </div>

      {/* 2. Mini Statistics Secondary Strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <GlassCard className="p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary-500/15 text-primary-500 grid place-items-center font-bold">
              <Sparkles className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("services.totalServices", { defaultValue: "Total Services" })}
              </div>
              <div className="text-base font-bold">{stats.total}</div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-success/15 text-success grid place-items-center font-bold">
              <CheckCircle2 className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("services.activeServices", { defaultValue: "Active Offerings" })}
              </div>
              <div className="text-base font-bold text-success">{stats.active}</div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-info/15 text-info grid place-items-center font-bold">
              <Banknote className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("services.avgPrice", { defaultValue: "Avg Price" })} ({currencySuffix})
              </div>
              <div className="text-base font-bold">{stats.avgPrice.toLocaleString()} {currencySuffix}</div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-warning/15 text-warning grid place-items-center font-bold">
              <Clock className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("services.avgDuration", { defaultValue: "Avg Duration" })} ({minsSuffix})
              </div>
              <div className="text-base font-bold">{stats.avgDuration} {minsSuffix}</div>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* 3. Filter Bar */}
      <GlassCard className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
            <Filter className="h-4 w-4 text-primary-500" />
            <span>{t("filters.open", { defaultValue: "Filter & Refine" })}</span>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute start-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("services.searchPlaceholder", { defaultValue: "Search service offering..." })}
              className="glass w-full rounded-xl ps-8 pe-8 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-primary-500/40"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute end-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center rounded-xl bg-muted/30 border border-border/30 p-0.5 ms-auto">
            <button
              onClick={() => setViewMode("grid")}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                viewMode === "grid" ? "bg-primary-500 text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t("views.grid", { defaultValue: "Grid Cards" })}</span>
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                viewMode === "list" ? "bg-primary-500 text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <List className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t("views.table", { defaultValue: "Data Table" })}</span>
            </button>
          </div>

          {hasFilters && (
            <button
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("ALL");
              }}
              className="inline-flex items-center gap-1 text-xs text-primary-500 font-bold hover:underline cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" /> {t("filters.reset", { defaultValue: "Reset" })}
            </button>
          )}
        </div>

        {/* Status Pill Filters */}
        <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-border/30">
          {(
            [
              { id: "ALL" as StatusFilter, label: t("common.all", { defaultValue: "All" }), count: stats.total },
              { id: "ACTIVE" as StatusFilter, label: t("common.active", { defaultValue: "Active" }), count: stats.active },
              { id: "INACTIVE" as StatusFilter, label: t("common.inactive", { defaultValue: "Inactive" }), count: stats.inactive },
            ] as const
          ).map((pill) => {
            const isActive = statusFilter === pill.id;
            return (
              <button
                key={pill.id}
                onClick={() => setStatusFilter(pill.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition cursor-pointer ${
                  isActive
                    ? "bg-primary-500 text-primary-foreground shadow-xs"
                    : "bg-accent/30 text-muted-foreground hover:text-foreground hover:bg-accent/60"
                }`}
              >
                <span>{pill.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[9px] ${isActive ? "bg-white/20 text-white" : "bg-muted/40"}`}>
                  {pill.count}
                </span>
              </button>
            );
          })}
        </div>
      </GlassCard>

      {/* 4. Services Grid / List */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-44 w-full rounded-2xl" />
          ))}
        </div>
      ) : filteredServices.length === 0 ? (
        <EmptyState
          title={hasFilters ? t("common.empty", { defaultValue: "No records found" }) : t("services.emptyTitle", { defaultValue: "No services configured" })}
          description={
            hasFilters
              ? t("filters.clear", { defaultValue: "Clear All Filters" })
              : t("services.emptySub", { defaultValue: "Add your clinic treatments and medical offerings to start accepting bookings" })
          }
          action={
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 cursor-pointer"
            >
              <Plus className="h-4 w-4" /> {t("services.createButton", { defaultValue: "Add New Service" })}
            </button>
          }
        />
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredServices.map((service) => {
            const isActive = service.isActive !== false;
            const assignedCount = service.assignedDoctors?.length || 0;
            const imagesCount = service.images?.length || 0;

            return (
              <GlassCard
                key={service.id}
                className="p-5 flex flex-col justify-between space-y-4 hover:bg-accent/40 transition cursor-pointer group border border-border/40"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-foreground group-hover:text-primary-500 transition">
                        {service.nameFr}
                      </h3>
                      {service.nameAr && (
                        <p className="text-xs text-muted-foreground mt-0.5" dir="rtl">
                          {service.nameAr}
                        </p>
                      )}
                    </div>
                    <StatusBadge value={isActive ? "ACTIVE" : "INACTIVE"} />
                  </div>

                  {service.descriptionFr && (
                    <p className="text-xs text-muted-foreground/90 mt-2 line-clamp-2 leading-relaxed">
                      {service.descriptionFr}
                    </p>
                  )}

                  {/* Metrics Badges */}
                  <div className="flex flex-wrap items-center gap-2 mt-3.5">
                    <span className="inline-flex items-center gap-1 rounded-xl bg-primary-500/10 px-2.5 py-1 text-xs font-bold text-primary-500">
                      <Banknote className="h-3.5 w-3.5" />
                      {service.price ? `${service.price.toLocaleString()} ${currencySuffix}` : t("common.included", { defaultValue: "Included" })}
                    </span>

                    <span className="inline-flex items-center gap-1 rounded-xl bg-accent/40 px-2.5 py-1 text-xs font-semibold text-muted-foreground border border-border/40">
                      <Clock className="h-3.5 w-3.5 text-primary-500" />
                      {service.durationMinutes || 30} {minsSuffix}
                    </span>
                  </div>
                </div>

                {/* Sub-actions Toolbar */}
                <div className="pt-3 border-t border-border/30 flex items-center justify-between">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
                    <button
                      onClick={() => setSelectedDoctorId(service.id)}
                      className="inline-flex items-center gap-1 hover:text-primary-500 transition cursor-pointer"
                      title={t("services.assignDoctors", { defaultValue: "Practicing Doctors for Service" })}
                    >
                      <UserCheck className="h-3.5 w-3.5 text-primary-500" />
                      <span>{assignedCount} {t("doctors.title", { defaultValue: "Medical Staff" })}</span>
                    </button>
                    <span className="mx-1">·</span>
                    <button
                      onClick={() => setSelectedImageId(service.id)}
                      className="inline-flex items-center gap-1 hover:text-primary-500 transition cursor-pointer"
                      title={t("gallery.title", { defaultValue: "Facility Gallery" })}
                    >
                      <ImageIcon className="h-3.5 w-3.5 text-primary-500" />
                      <span>{imagesCount} {t("gallery.totalImages", { defaultValue: "Images" })}</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(service)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition cursor-pointer"
                      title={t("common.edit", { defaultValue: "Edit" })}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>

                    <button
                      onClick={() => setDeleteConfirmId(service.id)}
                      className="p-1.5 rounded-lg text-danger/70 hover:bg-danger/10 hover:text-danger transition cursor-pointer"
                      title={t("common.delete", { defaultValue: "Delete" })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      ) : (
        /* List View */
        <GlassCard className="p-2 divide-y divide-border/40">
          {filteredServices.map((service) => {
            const isActive = service.isActive !== false;
            const assignedCount = service.assignedDoctors?.length || 0;

            return (
              <div
                key={service.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl hover:bg-accent/40 transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-2xl bg-primary-500/15 text-primary-500 grid place-items-center font-bold shrink-0">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold text-foreground">{service.nameFr}</h3>
                      <StatusBadge value={isActive ? "ACTIVE" : "INACTIVE"} />
                    </div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-3 mt-0.5">
                      <span className="font-semibold text-primary-500">
                        {service.price ? `${service.price.toLocaleString()} ${currencySuffix}` : t("common.included", { defaultValue: "Included" })}
                      </span>
                      <span>·</span>
                      <span>{service.durationMinutes || 30} {minsSuffix}</span>
                      <span>·</span>
                      <span>{assignedCount} {t("services.assignedDoctorsCount", { defaultValue: "Assigned Doctor(s)" })}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => setSelectedDoctorId(service.id)}
                    className="px-2.5 py-1 rounded-xl text-xs font-bold bg-primary-500/10 text-primary-500 hover:bg-primary-500/20 transition cursor-pointer"
                  >
                    {t("doctors.title", { defaultValue: "Medical Staff" })} ({assignedCount})
                  </button>
                  <button
                    onClick={() => setSelectedImageId(service.id)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition cursor-pointer"
                  >
                    <ImageIcon className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => openEditModal(service)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition cursor-pointer"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(service.id)}
                    className="p-1.5 rounded-lg text-danger/70 hover:bg-danger/10 hover:text-danger transition cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </GlassCard>
      )}

      {/* 5. Create / Edit Service Modal */}
      <FormModal
        id="service-form-modal"
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingService ? t("services.editTitle", { defaultValue: "Edit Care Service Details" }) : t("services.createTitle", { defaultValue: "Create New Care Service" })}
        description={t("services.modalDesc", { defaultValue: "Configure service names, pricing, duration and assign staff" })}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("services.serviceName", { defaultValue: "Service / Treatment Name" })} (FR)*</label>
              <input
                {...register("nameFr")}
                placeholder="e.g. Consultation Générale"
                className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
              />
              {errors.nameFr && <p className="text-xs text-danger">{errors.nameFr.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("services.serviceName", { defaultValue: "Service / Treatment Name" })} (AR)</label>
              <input
                {...register("nameAr")}
                placeholder="مثال: فحص عام"
                dir="rtl"
                className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("services.servicePrice", { defaultValue: "Price" })} ({currencySuffix})</label>
              <input
                type="number"
                {...register("price")}
                placeholder="2500"
                className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">{t("services.serviceDuration", { defaultValue: "Duration" })} ({minsSuffix})</label>
              <input
                type="number"
                {...register("durationMinutes")}
                placeholder="30"
                className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40 font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("common.details", { defaultValue: "Details" })}</label>
            <textarea
              {...register("descriptionFr")}
              rows={2}
              placeholder="Detailed description of the care service and included procedures..."
              className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ImageIcon className="h-4 w-4 text-primary-500" />
                {t("gallery.uploadButton", { defaultValue: "Service Photo / Image" })}
              </span>
              <span className="text-[10px] text-muted-foreground">Optional (JPEG, PNG, WebP)</span>
            </label>
            <label className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-border/60 bg-accent/20 p-3 hover:border-primary-500/50 transition cursor-pointer">
              <span className="text-xs text-foreground font-semibold truncate">
                {newServiceImage ? newServiceImage.name : t("gallery.clickToBrowse", { defaultValue: "Click To Browse" })}
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setNewServiceImage(file);
                }}
              />
              <span className="px-3 py-1 text-xs font-bold rounded-lg bg-primary-500 text-white shrink-0">
                {t("common.browse", { defaultValue: "Browse" })}
              </span>
            </label>
          </div>

          {editingService && (
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                {...register("isActive")}
                className="rounded text-primary-500 focus:ring-primary-500 h-4 w-4"
              />
              <span className="text-xs font-bold text-foreground">{t("services.activeState", { defaultValue: "Active State" })}</span>
            </label>
          )}

          <div className="pt-4 border-t border-border/40 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent cursor-pointer"
            >
              {t("common.cancel", { defaultValue: "Cancel" })}
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              )}
              {editingService ? t("common.save", { defaultValue: "Save Changes" }) : t("common.create", { defaultValue: "Create New" })}
            </button>
          </div>
        </form>
      </FormModal>

      {/* 6. Doctor Assignment Drawer */}
      <Drawer
        open={!!selectedDoctorService}
        onClose={() => setSelectedDoctorId(null)}
        title={selectedDoctorService ? `${t("services.assignDoctors", { defaultValue: "Practicing Doctors for Service" })}: ${selectedDoctorService.nameFr}` : t("services.assignDoctors", { defaultValue: "Practicing Doctors for Service" })}
        subtitle={t("services.assignDoctorsSub", { defaultValue: "Assign licensed medical personnel authorized to perform this service" })}
      >
        {selectedDoctorService && (
          <div className="space-y-5">
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {t("doctors.activeStaff", { defaultValue: "Active Staff" })} ({acceptedDoctors.length})
              </h4>

              {acceptedDoctors.length === 0 ? (
                <div className="p-4 rounded-2xl border border-border/40 text-center text-xs text-muted-foreground">
                  {t("doctors.emptyAccepted", { defaultValue: "No affiliated doctors found for this clinic." })}
                </div>
              ) : (
                <div className="space-y-2">
                  {acceptedDoctors.map((doc) => {
                    const isAssigned = (selectedDoctorService.assignedDoctors || []).some(
                      (a) => a.doctorId === doc.doctorId
                    );
                    const d = doc.doctor;
                    const name = `${d?.firstName || ""} ${d?.lastName || ""}`.trim() || d?.name || "Doctor";

                    return (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 rounded-2xl border border-border/40 glass"
                      >
                        <div className="flex items-center gap-3">
                          <RemoteImage
                            src={d?.avatarUrl || d?.photoUrl}
                            alt={name}
                            className="h-9 w-9 rounded-full object-cover border border-border/40"
                          />
                          <div>
                            <div className="text-xs font-bold text-foreground">Dr. {name}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {d?.specialtyName || t("doctors.specialtyFallback", { defaultValue: "Medical Specialist" })}
                            </div>
                          </div>
                        </div>

                        {isAssigned ? (
                          <button
                            onClick={() =>
                              unassignDoctorMutation.mutate({
                                serviceId: selectedDoctorService.id,
                                doctorId: doc.doctorId,
                              })
                            }
                            disabled={unassignDoctorMutation.isPending}
                            className="px-3 py-1 rounded-xl text-xs font-bold bg-danger/15 text-danger hover:bg-danger/25 transition cursor-pointer inline-flex items-center gap-1"
                          >
                            {unassignDoctorMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                            {t("common.unassign", { defaultValue: "Unassign" })}
                          </button>
                        ) : (
                          <button
                            onClick={() =>
                              assignDoctorMutation.mutate({
                                serviceId: selectedDoctorService.id,
                                doctorId: doc.doctorId,
                              })
                            }
                            disabled={assignDoctorMutation.isPending}
                            className="px-3 py-1 rounded-xl text-xs font-bold bg-primary-500 px-3 py-1 text-primary-foreground hover:opacity-90 transition cursor-pointer inline-flex items-center gap-1"
                          >
                            {assignDoctorMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                            {t("common.assign", { defaultValue: "Assign" })}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* 7. Image Management Drawer */}
      <Drawer
        open={!!selectedImageService}
        onClose={() => setSelectedImageId(null)}
        title={selectedImageService ? `${t("gallery.title", { defaultValue: "Facility Gallery" })}: ${selectedImageService.nameFr}` : t("gallery.title", { defaultValue: "Facility Gallery" })}
        subtitle={t("gallery.subtitle", { defaultValue: "Upload and manage visual documentation for this medical service" })}
      >
        {selectedImageService && (
          <div className="space-y-5">
            {/* Upload Area */}
            <div className="p-4 rounded-2xl border-2 border-dashed border-border/60 bg-accent/20 text-center space-y-3">
              <ImageIcon className="h-8 w-8 text-primary-500 mx-auto" />
              <div className="text-xs font-bold text-foreground">{t("gallery.uploadButton", { defaultValue: "Upload New Image" })}</div>
              <label className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition cursor-pointer">
                {uploadImageMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                {t("gallery.clickToBrowse", { defaultValue: "Click To Browse" })}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      uploadImageMutation.mutate({ serviceId: selectedImageService.id, file });
                    }
                  }}
                />
              </label>
            </div>

            {/* Existing Images */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {t("gallery.totalImages", { defaultValue: "Total Images" })} ({selectedImageService.images?.length || 0})
              </h4>

              {(!selectedImageService.images || selectedImageService.images.length === 0) ? (
                <div className="p-4 text-center text-xs text-muted-foreground rounded-2xl border border-border/40">
                  {t("gallery.emptyTitle", { defaultValue: "No images uploaded for this service yet." })}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {selectedImageService.images.map((img) => (
                    <div key={img.id} className="relative group rounded-xl overflow-hidden aspect-video border border-border/40">
                      <RemoteImage src={img.imageUrl} alt="Service photo" className="h-full w-full object-cover" />
                      <button
                        onClick={() => deleteImageMutation.mutate({ serviceId: selectedImageService.id, imageId: img.id })}
                        className="absolute top-1.5 end-1.5 p-1 rounded-lg bg-danger text-white opacity-0 group-hover:opacity-100 transition cursor-pointer"
                        title={t("common.delete", { defaultValue: "Delete" })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={() => { if (deleteConfirmId) deleteMutation.mutate(deleteConfirmId); }}
        title={t("services.deleteTitle", { defaultValue: "Delete Care Service" })}
        description={t("services.deleteMessage", { defaultValue: 'Are you sure you want to permanently delete service?' })}
        confirmText={t("common.delete", { defaultValue: "Delete" })}
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
