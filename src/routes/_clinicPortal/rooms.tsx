import { useState } from "react";
import { useQuery } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { DoorOpen, Plus, Loader2, Info } from "lucide-react";
import { clinicSelfApi, type ClinicRoom } from "@/api/clinicSelfApi";
import { specialtyApi, type SpecialtyRow } from "@/api/specialtyApi";
import { qk } from "@/lib/queryKeys";
import { useEntityMutation } from "@/lib/mutations";
import { ensureArray } from "@/lib/utils";
import { GlassCard } from "@/components/glass/GlassCard";
import { FormModal } from "@/components/data/FormModal";
import { EmptyState } from "@/components/data/EmptyState";
import { Skeleton } from "@/components/glass/Skeleton";

const roomSchema = z.object({
  name: z.string().min(2, "Room name is required"),
  specialtyId: z.string().optional(),
});

type RoomFormData = z.infer<typeof roomSchema>;

export default function RoomsPage() {
  const [modalOpen, setModalOpen] = useState(false);

  const { data: rawRooms, isLoading } = useQuery({
    queryKey: qk.clinicSelf.rooms(),
    queryFn: clinicSelfApi.getRooms,
  });

  const { data: rawSpecialties } = useQuery({
    queryKey: qk.specialties.all(),
    queryFn: () => specialtyApi.list(),
  });

  const rooms: ClinicRoom[] = ensureArray<ClinicRoom>(rawRooms);
  const specialties: SpecialtyRow[] = ensureArray<SpecialtyRow>(rawSpecialties);

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
    successMessage: "Physical room added successfully",
    onSuccess: () => {
      setModalOpen(false);
      reset();
    },
  });

  const onSubmit = (data: RoomFormData) => {
    createMutation.mutate({
      name: data.name.trim(),
      specialtyId: data.specialtyId?.trim() ? data.specialtyId.trim() : undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Physical Rooms</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure your facility's physical examination and consultation rooms
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          Add Room
        </button>
      </div>

      {/* Info Notice */}
      <GlassCard className="p-4 flex items-center gap-3 bg-primary-500/5 border-primary-500/20">
        <Info className="h-4 w-4 text-primary-500 shrink-0" />
        <p className="text-xs text-muted-foreground">
          Physical rooms can be assigned to doctor slots during slot generation or quick ad-hoc schedule creation.
        </p>
      </GlassCard>

      {/* Rooms Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      ) : rooms.length === 0 ? (
        <EmptyState
          title="No rooms added yet"
          description="Add physical consultation rooms to assign doctors during slot creation."
          action={
            <button
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 cursor-pointer"
            >
              <Plus className="h-4 w-4" /> Add Room
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.map((room) => (
            <GlassCard key={room.id} className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="h-11 w-11 rounded-2xl bg-primary-500/15 text-primary-500 grid place-items-center font-bold">
                  <DoorOpen className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">{room.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {room.specialty?.nameFr || "General Purpose"}
                  </p>
                </div>
              </div>

              <span className="rounded-full bg-success/15 px-2.5 py-0.5 text-[10px] font-bold text-success">
                Active
              </span>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Add Room Modal */}
      <FormModal
        id="add-room-modal"
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Physical Room"
        description="Enter room designation and optional primary specialty"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Room Designation / Name*</label>
            <input
              {...register("name")}
              placeholder="e.g. Room 101 — Pediatrics"
              className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40"
            />
            {errors.name && <p className="text-xs text-danger">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Specialty (Optional)</label>
            <select
              {...register("specialtyId")}
              className="glass w-full rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary-500/40 bg-background text-foreground"
            >
              <option value="">General Purpose (No specific specialty)</option>
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
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Create Room
            </button>
          </div>
        </form>
      </FormModal>
    </div>
  );
}
