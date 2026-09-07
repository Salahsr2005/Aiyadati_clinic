import { useState, useMemo } from "react";
import { useQuery } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import {
  DoorOpen,
  Plus,
  Loader2,
  Info,
  Search,
  Filter,
  RotateCcw,
  Edit2,
  Trash2,
  CheckCircle2,
  Building2,
  Stethoscope,
  Calendar,
  Layers,
  ChevronRight,
  X,
} from "lucide-react";
import { clinicSelfApi, type ClinicRoom } from "@/api/clinicSelfApi";
import { clinicAppointmentsApi, type ClinicAppointmentRow } from "@/api/clinicAppointmentsApi";
import { specialtyApi, type SpecialtyRow } from "@/api/specialtyApi";
import { qk } from "@/lib/queryKeys";
import { useEntityMutation } from "@/lib/mutations";
import { ensureArray } from "@/lib/utils";
import { GlassCard } from "@/components/glass/GlassCard";
import { FormModal } from "@/components/data/FormModal";
import { ConfirmDialog } from "@/components/data/ConfirmDialog";
import { EmptyState } from "@/components/data/EmptyState";
import { Skeleton } from "@/components/glass/Skeleton";
import { StatusBadge } from "@/components/data/StatusBadge";
import { Drawer } from "@/components/data/Drawer";

const roomSchema = z.object({
  name: z.string().min(2, "Room name is required"),
  specialtyId: z.string().optional(),
});

type RoomFormData = z.infer<typeof roomSchema>;
type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";

export default function RoomsPage() {
  const { t } = useTranslation();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<ClinicRoom | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<ClinicRoom | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const { data: rawRooms, isLoading } = useQuery({
    queryKey: qk.clinicSelf.rooms(),
    queryFn: clinicSelfApi.getRooms,
  });

  const { data: rawSpecialties } = useQuery({
    queryKey: qk.specialties.all(),
    queryFn: () => specialtyApi.list(),
  });

  const { data: appointmentsData } = useQuery({
    queryKey: qk.clinicSelf.appointments({ limit: 100 }),
    queryFn: () => clinicAppointmentsApi.listAppointments({ limit: 100 }),
  });

  const rooms: ClinicRoom[] = ensureArray<ClinicRoom>(rawRooms);
  const specialties: SpecialtyRow[] = ensureArray<SpecialtyRow>(rawSpecialties);
  const appointments: ClinicAppointmentRow[] = ensureArray<ClinicAppointmentRow>(appointmentsData?.data);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RoomFormData>({
    resolver: zodResolver(roomSchema),
  });

  const createMutation = useEntityMutation({
    mutationFn: (payload: RoomFormData) => clinicSelfApi.createRoom(payload),
    invalidate: [qk.clinicSelf.rooms()],
    successMessage: t("rooms.createSuccess", { defaultValue: "Physical room created successfully" }),
    onSuccess: () => {
      setModalOpen(false);
      reset();
    },
  });

  const updateMutation = useEntityMutation({
    mutationFn: ({ id, payload }: { id: string; payload: RoomFormData }) =>
      clinicSelfApi.updateRoom(id, payload),
    invalidate: [qk.clinicSelf.rooms()],
    successMessage: t("rooms.updateSuccess", { defaultValue: "Room details updated" }),
    onSuccess: () => {
      setModalOpen(false);
      setEditingRoom(null);
      reset();
    },
  });

  const toggleActiveMutation = useEntityMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      clinicSelfApi.toggleRoomActive(id, isActive),
    invalidate: [qk.clinicSelf.rooms()],
    successMessage: t("rooms.deactivateSuccess", { defaultValue: "Room status updated" }),
  });

  const deleteMutation = useEntityMutation({
    mutationFn: (id: string) => clinicSelfApi.deleteRoom(id),
    invalidate: [qk.clinicSelf.rooms()],
    successMessage: t("rooms.deleteSuccess", { defaultValue: "Room deleted successfully" }),
    onSuccess: () => setConfirmDeleteId(null),
  });

  const openCreateModal = () => {
    setEditingRoom(null);
    reset({ name: "", specialtyId: "" });
    setModalOpen(true);
  };

  const openEditModal = (room: ClinicRoom) => {
    setEditingRoom(room);
    reset({
      name: room.name,
      specialtyId: room.specialtyId || "",
    });
    setModalOpen(true);
  };

  const onSubmit = (data: RoomFormData) => {
    const payload = {
      name: data.name.trim(),
      specialtyId: data.specialtyId?.trim() ? data.specialtyId.trim() : undefined,
    };
    if (editingRoom) {
      updateMutation.mutate({ id: editingRoom.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const filteredRooms = useMemo(() => {
    return rooms.filter((r) => {
      const matchesSearch =
        !searchQuery.trim() ||
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.specialty?.nameFr || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.specialty?.nameAr || "").includes(searchQuery);

      const isActive = r.isActive !== false;
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && isActive) ||
        (statusFilter === "INACTIVE" && !isActive);

      return matchesSearch && matchesStatus;
    });
  }, [rooms, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    const total = rooms.length;
    const active = rooms.filter((r) => r.isActive !== false).length;
    const inactive = total - active;
    const specialized = rooms.filter((r) => r.specialtyId || r.specialty).length;
    const general = total - specialized;
    return { total, active, inactive, specialized, general };
  }, [rooms]);

  const roomAppointments = useMemo(() => {
    if (!selectedRoom) return [];
    return appointments.filter(
      (a: any) => a.roomId === selectedRoom.id || a.room?.id === selectedRoom.id || a.room?.name === selectedRoom.name
    );
  }, [selectedRoom, appointments]);

  const hasFilters = searchQuery || statusFilter !== "ALL";
  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("ALL");
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("rooms.title", { defaultValue: "Physical Consultation Rooms" })}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("rooms.subtitle", { defaultValue: "Configure examination rooms, specialty allocations, and schedule assignments" })}
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-xs transition hover:opacity-90 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          {t("rooms.createButton", { defaultValue: "Add Physical Room" })}
        </button>
      </div>

      {/* Notice Banner */}
      <GlassCard className="p-4 flex items-center justify-between gap-4 bg-primary-500/5 border-primary-500/20">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary-500/15 text-primary-500 grid place-items-center shrink-0">
            <Info className="h-4.5 w-4.5" />
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t("rooms.noticeBanner", { defaultValue: "Physical rooms can be assigned directly to doctor shifts, ad-hoc walk-ins, or batch consultation slots during schedule generation." })}
          </p>
        </div>
      </GlassCard>

      {/* 2. Mini Statistics Secondary Strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <GlassCard className="p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary-500/15 text-primary-500 grid place-items-center font-bold">
              <DoorOpen className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t("rooms.totalRooms", { defaultValue: "Total Rooms" })}</div>
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
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t("rooms.activeRooms", { defaultValue: "Active Rooms" })}</div>
              <div className="text-base font-bold text-success">{stats.active}</div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-info/15 text-info grid place-items-center font-bold">
              <Stethoscope className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t("rooms.specialtyAssigned", { defaultValue: "Specialty Assigned" })}</div>
              <div className="text-base font-bold">{stats.specialized}</div>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-warning/15 text-warning grid place-items-center font-bold">
              <Building2 className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t("rooms.generalRooms", { defaultValue: "General Purpose" })}</div>
              <div className="text-base font-bold">{stats.general}</div>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* 3. Filter Bar */}
      <GlassCard className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
            <Filter className="h-4 w-4 text-primary-500" />
            <span>{t("filters.open", { defaultValue: "Filters" })}</span>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute start-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("rooms.searchPlaceholder", { defaultValue: "Search room designation or specialty..." })}
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

          {/* Reset Filters */}
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 text-xs text-primary-500 font-bold hover:underline cursor-pointer ms-auto"
            >
              <RotateCcw className="h-3 w-3" /> {t("filters.reset", { defaultValue: "Reset" })}
            </button>
          )}
        </div>

        {/* Status Pill Filters */}
        <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-border/30">
          {(
            [
              { id: "ALL", label: t("common.all", { defaultValue: "All Rooms" }), count: stats.total },
              { id: "ACTIVE", label: t("common.active", { defaultValue: "Active" }), count: stats.active },
              { id: "INACTIVE", label: t("common.inactive", { defaultValue: "Inactive" }), count: stats.inactive },
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

      {/* 4. Rooms Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-40 w-full rounded-2xl" />
          ))}
        </div>
      ) : filteredRooms.length === 0 ? (
        <EmptyState
          title={hasFilters ? t("rooms.noMatchingTitle", { defaultValue: "No matching rooms found" }) : t("rooms.noRoomsTitle", { defaultValue: "No physical rooms added yet" })}
          description={
            hasFilters
              ? t("rooms.noMatchingDesc", { defaultValue: "Try adjusting your search keywords or status filters." })
              : t("rooms.noRoomsDesc", { defaultValue: "Add physical consultation rooms to assign doctors during slot creation." })
          }
          action={
            hasFilters ? (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" /> {t("filters.reset", { defaultValue: "Reset Filters" })}
              </button>
            ) : (
              <button
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 cursor-pointer"
              >
                <Plus className="h-4 w-4" /> {t("rooms.createButton", { defaultValue: "Add Room" })}
              </button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRooms.map((room) => {
            const isActive = room.isActive !== false;
            const linkedApptsCount = appointments.filter(
              (a: any) => a.roomId === room.id || a.room?.id === room.id || a.room?.name === room.name
            ).length;

            return (
              <GlassCard
                key={room.id}
                onClick={() => setSelectedRoom(room)}
                className="p-5 flex flex-col justify-between space-y-4 hover:bg-accent/40 transition cursor-pointer group border border-border/40"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-11 w-11 rounded-2xl bg-primary-500/15 text-primary-500 grid place-items-center font-bold shrink-0">
                        <DoorOpen className="h-5.5 w-5.5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-foreground truncate group-hover:text-primary-500 transition">
                          {room.name}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate flex items-center gap-1">
                          <Stethoscope className="h-3 w-3 text-primary-500" />
                          <span>{room.specialty?.nameFr || room.specialty?.nameAr || t("rooms.generalPurpose", { defaultValue: "General Purpose" })}</span>
                        </p>
                      </div>
                    </div>

                    <StatusBadge value={isActive ? "ACTIVE" : "INACTIVE"} />
                  </div>

                  <div className="mt-4 pt-3 border-t border-border/30 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1 font-medium">
                      <Calendar className="h-3.5 w-3.5 text-primary-500" />
                      {linkedApptsCount} {t("rooms.scheduledAppts", { defaultValue: "Scheduled Appts" })}
                    </span>
                    <span className="text-[11px] font-bold text-primary-500 flex items-center gap-0.5 group-hover:translate-x-0.5 transition">
                      {t("common.details", { defaultValue: "Details" })} <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
                    </span>
                  </div>
                </div>

                {/* Toolbar actions */}
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center justify-end gap-1.5 pt-2 border-t border-border/30"
                >
                  <button
                    onClick={() => openEditModal(room)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition cursor-pointer"
                    title={t("common.edit", { defaultValue: "Edit room" })}
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>

                  <button
                    onClick={() => toggleActiveMutation.mutate({ id: room.id, isActive: !isActive })}
                    disabled={toggleActiveMutation.isPending}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                      isActive
                        ? "bg-warning/15 text-warning hover:bg-warning/25"
                        : "bg-success/15 text-success hover:bg-success/25"
                    }`}
                  >
                    {isActive ? t("rooms.deactivate", { defaultValue: "Deactivate" }) : t("rooms.activate", { defaultValue: "Activate" })}
                  </button>

                  <button
                    onClick={() => setConfirmDeleteId(room.id)}
                    className="p-1.5 rounded-lg text-danger/70 hover:bg-danger/10 hover:text-danger transition cursor-pointer"
                    title={t("common.delete", { defaultValue: "Delete room" })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* 5. Detail Inspector Drawer */}
      <Drawer
        open={!!selectedRoom}
        onClose={() => setSelectedRoom(null)}
        title={selectedRoom?.name || t("rooms.detailsTitle", { defaultValue: "Room Inspector" })}
        subtitle={t("rooms.subtitle", { defaultValue: "Physical room configuration and active schedules" })}
      >
        {selectedRoom && (
          <div className="space-y-5">
            {/* Identity Header Card */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-accent/30 border border-border/40">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-primary-500/15 text-primary-500 grid place-items-center font-bold">
                  <DoorOpen className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold">{selectedRoom.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {selectedRoom.specialty?.nameFr || t("rooms.generalPurpose", { defaultValue: "General Purpose Examination Room" })}
                  </p>
                </div>
              </div>
              <StatusBadge value={selectedRoom.isActive !== false ? "ACTIVE" : "INACTIVE"} />
            </div>

            {/* Room Metadata Group */}
            <div className="rounded-2xl border border-border/40 bg-accent/30 p-4 space-y-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-primary-500" /> {t("rooms.properties", { defaultValue: "Room Properties" })}
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-muted-foreground text-[11px]">{t("rooms.specialtyLabel", { defaultValue: "Specialty Allocation" })}</div>
                  <div className="font-bold text-foreground mt-0.5">
                    {selectedRoom.specialty?.nameFr || selectedRoom.specialty?.nameAr || t("rooms.generalPurpose", { defaultValue: "General / Unassigned" })}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground text-[11px]">{t("common.status", { defaultValue: "Active Status" })}</div>
                  <div className="font-bold text-foreground mt-0.5">
                    {selectedRoom.isActive !== false ? t("rooms.statusEnabled", { defaultValue: "Enabled for slot generation" }) : t("rooms.statusDisabled", { defaultValue: "Disabled" })}
                  </div>
                </div>
              </div>
            </div>

            {/* Schedule & Appointments Usage Section */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                <span>{t("rooms.linkedAppointments", { defaultValue: "Linked Appointments" })} ({roomAppointments.length})</span>
              </h4>

              {roomAppointments.length === 0 ? (
                <div className="p-4 rounded-2xl border border-border/40 bg-muted/10 text-center text-xs text-muted-foreground">
                  {t("rooms.noLinkedAppointments", { defaultValue: "No appointments currently assigned to this room." })}
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pe-1">
                  {roomAppointments.map((app) => (
                    <div
                      key={app.id}
                      className="p-3 rounded-xl border border-border/30 bg-card flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="font-bold text-foreground">
                          {app.patient?.name || (app.guestPatient ? `${app.guestPatient.firstName} ${app.guestPatient.lastName}` : "Patient")}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {app.slot?.date} {app.slot?.startTime ? `· ${app.slot.startTime.slice(0, 5)}` : ""}
                        </div>
                      </div>
                      <StatusBadge value={app.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Drawer Actions */}
            <div className="pt-4 border-t border-border/40 flex items-center gap-2">
              <button
                onClick={() => {
                  const roomToEdit = selectedRoom;
                  setSelectedRoom(null);
                  openEditModal(roomToEdit);
                }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary-500/10 px-4 py-2.5 text-xs font-bold text-primary-500 hover:bg-primary-500/20 transition cursor-pointer"
              >
                <Edit2 className="h-3.5 w-3.5" /> {t("common.edit", { defaultValue: "Edit Configuration" })}
              </button>
              <button
                onClick={() => {
                  setConfirmDeleteId(selectedRoom.id);
                  setSelectedRoom(null);
                }}
                className="inline-flex items-center justify-center p-2.5 rounded-xl bg-danger/10 text-danger hover:bg-danger/20 transition cursor-pointer"
                title={t("common.delete", { defaultValue: "Delete room" })}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </Drawer>

      {/* 6. Create / Edit Room Modal */}
      <FormModal
        id="room-form-modal"
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingRoom ? t("rooms.editTitle", { defaultValue: "Edit Room Details" }) : t("rooms.createTitle", { defaultValue: "Add Physical Room" })}
        description={t("rooms.formDescription", { defaultValue: "Enter room designation and optional primary specialty assignment" })}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("rooms.nameLabel", { defaultValue: "Room Designation / Name*" })}</label>
            <input
              {...register("name")}
              placeholder={t("rooms.namePlaceholder", { defaultValue: "e.g. Room 101 — Pediatrics & Cardiology" })}
              className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
            />
            {errors.name && <p className="text-xs text-danger">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("rooms.specialtyLabel", { defaultValue: "Primary Specialty (Optional)" })}</label>
            <select
              {...register("specialtyId")}
              className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40 bg-background text-foreground"
            >
              <option value="">{t("rooms.selectSpecialty", { defaultValue: "General Purpose (No specific specialty)" })}</option>
              {specialties.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nameFr || s.nameAr}
                </option>
              ))}
            </select>
          </div>

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
              {editingRoom ? t("common.save", { defaultValue: "Save Changes" }) : t("common.create", { defaultValue: "Create Room" })}
            </button>
          </div>
        </form>
      </FormModal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => { if (confirmDeleteId) deleteMutation.mutate(confirmDeleteId); }}
        title={t("rooms.deleteTitle", { defaultValue: "Delete Consultation Room" })}
        description={t("rooms.deleteMessage", { defaultValue: "Are you sure you want to delete this physical room? This action cannot be undone." })}
        confirmText={t("common.delete", { defaultValue: "Delete Room" })}
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
