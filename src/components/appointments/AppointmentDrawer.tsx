import { useState } from "react";
import {
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  Stethoscope,
  DoorOpen,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Drawer } from "@/components/data/Drawer";
import { GlassCard } from "@/components/glass/GlassCard";
import { StatusBadge } from "@/components/data/StatusBadge";
import { useEntityMutation } from "@/lib/mutations";
import { clinicAppointmentsApi, type ClinicAppointmentRow } from "@/api/clinicAppointmentsApi";
import { qk } from "@/lib/queryKeys";

import { CopyReferenceButton } from "@/components/common/CopyReferenceButton";

interface AppointmentDrawerProps {
  appointment: ClinicAppointmentRow | null;
  onClose: () => void;
}

export function AppointmentDrawer({ appointment, onClose }: AppointmentDrawerProps) {
  if (!appointment) return null;

  const patAny = appointment.patient as any;
  const docAny = appointment.doctor as any;
  const appAny = appointment as any;

  const patientName = appointment.patient
    ? `${patAny.firstNameFr || appointment.patient.firstName || ""} ${patAny.lastNameFr || appointment.patient.lastName || ""}`.trim()
    : appointment.guestPatient
      ? `${appointment.guestPatient.firstName} ${appointment.guestPatient.lastName}`.trim()
      : "Patient";

  const patientPhone = appointment.patient?.phone || appointment.guestPatient?.phone || "N/A";
  const patientEmail = appointment.patient?.email || appointment.guestPatient?.email;

  const doctorName = appointment.doctor
    ? `Dr. ${docAny.firstNameFr || appointment.doctor.firstName || ""} ${docAny.lastNameFr || appointment.doctor.lastName || appointment.doctor.name || ""}`.trim()
    : "Assigned Doctor";

  const doctorSpecialty = Array.isArray(docAny?.specialties) && docAny.specialties.length > 0
    ? docAny.specialties[0].nameFr || docAny.specialties[0].nameAr
    : appointment.doctor?.specialtyName || docAny?.specialty?.nameFr || "Specialist";

  // Status Mutation
  const updateStatusMutation = useEntityMutation({
    mutationFn: (newStatus: string) =>
      clinicAppointmentsApi.updateStatus(appointment.id, { status: newStatus }),
    invalidate: [qk.clinicSelf.all()],
    successMessage: "Appointment status updated successfully",
    onSuccess: () => onClose(),
  });

  return (
    <Drawer
      id="appointment-detail-drawer"
      open={!!appointment}
      onClose={onClose}
      title="Appointment Details"
      subtitle={`Ref ID: ${appointment.id}`}
    >
      <div className="space-y-5">
        {/* Status Header Badge */}
        <div className="flex items-center justify-between rounded-2xl bg-accent/40 p-4 border border-border/40">
          <div>
            <div className="text-xs font-semibold text-muted-foreground">Current Status</div>
            <div className="mt-1">
              <StatusBadge value={appointment.status} />
            </div>
          </div>
          <div className="text-end">
            <div className="text-xs font-bold text-foreground flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-primary-500" />
              {appointment.slot?.date || appointment.createdAt?.slice(0, 10)}
            </div>
            <div className="text-xs text-muted-foreground font-semibold flex items-center justify-end gap-1 mt-0.5">
              <Clock className="h-3 w-3" />
              {appointment.slot?.startTime ? appointment.slot.startTime.slice(0, 5) : "--:--"}
            </div>
          </div>
        </div>

        {/* Patient Details Card */}
        <GlassCard className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-primary-500 uppercase tracking-wide">
            <User className="h-4 w-4" /> Patient Information
          </div>

          <div className="space-y-2">
            <div>
              <div className="text-sm font-bold text-foreground">{patientName}</div>
              <div className="text-[11px] text-muted-foreground">
                {appointment.patient ? "Registered Patient Account" : "Guest / Walk-in Patient"}
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 border-t border-border/30">
              <Phone className="h-3.5 w-3.5 text-primary-500" />
              <a href={`tel:${patientPhone}`} className="hover:underline font-semibold text-foreground">
                {patientPhone}
              </a>
            </div>

            {patientEmail && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Mail className="h-3.5 w-3.5 text-primary-500" />
                <span>{patientEmail}</span>
              </div>
            )}
          </div>
        </GlassCard>

        {/* Assigned Doctor & Room */}
        <GlassCard className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-primary-500 uppercase tracking-wide">
            <Stethoscope className="h-4 w-4" /> Consultation Provider
          </div>

          <div className="space-y-2">
            <div>
              <div className="text-sm font-bold text-foreground">{doctorName}</div>
              <div className="text-xs text-muted-foreground">{doctorSpecialty}</div>
            </div>

            {appAny.room && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 border-t border-border/30">
                <DoorOpen className="h-3.5 w-3.5 text-primary-500" />
                <span className="font-semibold text-foreground">{appAny.room.name}</span>
              </div>
            )}
          </div>
        </GlassCard>

        {/* Notes section if present */}
        {appointment.notes && (
          <GlassCard className="p-4 space-y-1">
            <div className="text-xs font-bold text-muted-foreground">Clinical Notes</div>
            <p className="text-xs text-foreground/90">{appointment.notes}</p>
          </GlassCard>
        )}

        {/* Quick Action Status Update Buttons */}
        <div className="pt-3 border-t border-border/40 space-y-2">
          <div className="text-xs font-bold text-muted-foreground">Update Appointment Status</div>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => updateStatusMutation.mutate("CONFIRMED")}
              disabled={updateStatusMutation.isPending || appointment.status === "CONFIRMED"}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-info/15 px-3 py-2 text-xs font-semibold text-info hover:bg-info/25 disabled:opacity-40 transition cursor-pointer"
            >
              {updateStatusMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
              <AlertCircle className="h-3.5 w-3.5" /> Confirm
            </button>

            <button
              onClick={() => updateStatusMutation.mutate("COMPLETED")}
              disabled={updateStatusMutation.isPending || appointment.status === "COMPLETED"}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-success/15 px-3 py-2 text-xs font-semibold text-success hover:bg-success/25 disabled:opacity-40 transition cursor-pointer"
            >
              {updateStatusMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
              <CheckCircle2 className="h-3.5 w-3.5" /> Complete
            </button>

            <button
              onClick={() => updateStatusMutation.mutate("CANCELLED")}
              disabled={updateStatusMutation.isPending || appointment.status === "CANCELLED"}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-danger/15 px-3 py-2 text-xs font-semibold text-danger hover:bg-danger/25 disabled:opacity-40 transition cursor-pointer"
            >
              {updateStatusMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
              <XCircle className="h-3.5 w-3.5" /> Cancel
            </button>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
