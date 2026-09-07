import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Calendar, User, Stethoscope, Building, FileText, ArrowRight, CheckCircle2, XCircle } from "lucide-react";
import { DataTable, type Column } from "@/components/data/DataTable";
import { Drawer } from "@/components/data/Drawer";
import { StatusBadge } from "@/components/data/StatusBadge";
import type { AppointmentRow } from "@/api/appointmentsApi";
import { fullDoctorName, fullPatientName } from "@/api/appointmentsApi";

import { CopyReferenceButton } from "@/components/common/CopyReferenceButton";

export interface RecentAppointmentsTableProps {
  appointments?: AppointmentRow[];
  loading?: boolean;
}

export function RecentAppointmentsTable({
  appointments = [],
  loading = false,
}: RecentAppointmentsTableProps) {
  const { t } = useTranslation();
  const [selectedAppt, setSelectedAppt] = useState<AppointmentRow | null>(null);

  const formatDZD = (n?: number) => {
    if (n == null) return "—";
    return `${n.toLocaleString()} DZD`;
  };

  const columns: Column<AppointmentRow>[] = [
    {
      key: "patient",
      header: "Patient",
      render: (row) => {
        const name = fullPatientName(row.patient);
        return (
          <div className="flex items-center gap-2.5">
            {row.patient?.avatarUrl ? (
              <img src={row.patient.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
            ) : (
              <div className="grid h-7 w-7 place-items-center rounded-full bg-primary-500/10 text-primary-500 text-[10px] font-bold">
                {name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="font-bold text-xs truncate">{name || "—"}</div>
              <div className="text-[9px] text-muted-foreground truncate">{row.patient?.phone}</div>
            </div>
          </div>
        );
      },
    },
    {
      key: "doctor",
      header: "Doctor",
      render: (row) => {
        const name = fullDoctorName(row.doctor);
        const doc = row.doctor as any;
        return (
          <div className="flex items-center gap-2">
            <Stethoscope className="h-3.5 w-3.5 text-purple-400 shrink-0" />
            <div className="min-w-0">
              <div className="font-bold text-xs truncate">Dr. {name}</div>
              {doc?.specialties?.[0]?.specialty && (
                <div className="text-[9px] text-muted-foreground truncate">
                  {doc.specialties[0].specialty.nameFr}
                </div>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: "slot",
      header: "Schedule",
      render: (row) => {
        const date = row.slot?.date ? new Date(row.slot.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—";
        const time = row.slot?.startTime ? `${row.slot.startTime.slice(0, 5)}` : "—";
        return (
          <div className="text-xs font-semibold tabular-nums">
            <div>{date}</div>
            <div className="text-[9px] text-muted-foreground">{time}</div>
          </div>
        );
      },
    },
    {
      key: "type",
      header: "Type & Payment",
      render: (row) => (
        <div className="text-xs font-semibold">
          <div>{row.type || "IN_PERSON"}</div>
          <div className="text-[9px] text-muted-foreground">{row.paymentMethod || "ON_SITE"}</div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge value={row.status || "PENDING"} />,
    },
    {
      key: "amount",
      header: "Amount",
      render: (row) => (
        <span className="text-xs font-bold tabular-nums text-foreground/90">
          {formatDZD(row.amount)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-bold tracking-tight">Recent Appointment Activity</div>
          <div className="text-[10px] text-muted-foreground font-semibold">
            Latest appointment bookings and status updates
          </div>
        </div>
        <Link
          to="/appointments"
          className="glass inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-primary-500 hover:bg-primary-500/10 cursor-pointer transition-colors"
        >
          View all
          <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
        </Link>
      </div>

      <DataTable
        columns={columns}
        rows={appointments.slice(0, 10)}
        loading={loading}
        page={1}
        totalPages={1}
        total={appointments.length}
        limit={10}
        onPage={() => {}}
        onRowClick={(row) => setSelectedAppt(row)}
        emptyTitle="No recent appointments"
        emptyDescription="Appointments booked by users will appear here."
      />

      {/* Slide-over Preview Drawer */}
      <Drawer
        open={!!selectedAppt}
        onClose={() => setSelectedAppt(null)}
        title="Appointment Preview"
        subtitle={selectedAppt ? `Ref ID: ${selectedAppt.id}` : undefined}
        width="max-w-md"
      >
        {selectedAppt && (
          <div className="space-y-6">
            {/* Status Header Banner */}
            <div className="flex items-center justify-between border-b border-border/40 pb-4">
              <div>
                <div className="text-xs text-muted-foreground">Booking Status</div>
                <div className="mt-1">
                  <StatusBadge value={selectedAppt.status || "PENDING"} />
                </div>
              </div>
              <div className="text-end">
                <div className="text-xs text-muted-foreground">Consultation Fee</div>
                <div className="text-base font-extrabold text-primary-500 mt-0.5">
                  {formatDZD(selectedAppt.amount)}
                </div>
              </div>
            </div>

            {/* Patient Segment */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase">
                <User className="h-3.5 w-3.5" />
                Patient Details
              </div>
              <div className="glass p-3.5 rounded-2xl space-y-2">
                <div className="text-sm font-bold">{fullPatientName(selectedAppt.patient)}</div>
                <div className="text-xs text-muted-foreground">Email: {selectedAppt.patient?.email || "—"}</div>
                <div className="text-xs text-muted-foreground">Phone: {selectedAppt.patient?.phone || "—"}</div>
              </div>
            </div>

            {/* Doctor Segment */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase">
                <Stethoscope className="h-3.5 w-3.5" />
                Doctor Details
              </div>
              <div className="glass p-3.5 rounded-2xl space-y-2">
                {(() => {
                  const doc = selectedAppt.doctor as any;
                  return (
                    <>
                      <div className="text-sm font-bold">Dr. {fullDoctorName(selectedAppt.doctor)}</div>
                      {doc?.specialties?.[0]?.specialty && (
                        <div className="text-xs text-muted-foreground">
                          Specialty: {doc.specialties[0].specialty.nameFr}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">Phone: {doc?.phone || "—"}</div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Clinic Segment */}
            {selectedAppt.clinic && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase">
                  <Building className="h-3.5 w-3.5" />
                  Clinic details
                </div>
                <div className="glass p-3.5 rounded-2xl space-y-2">
                  <div className="text-sm font-bold">{selectedAppt.clinic.nameFr}</div>
                </div>
              </div>
            )}

            {/* Booking Details */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase">
                <FileText className="h-3.5 w-3.5" />
                Appointment Info
              </div>
              <div className="glass p-3.5 rounded-2xl space-y-3 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Scheduled Date</span>
                  <span className="font-semibold text-foreground">
                    {selectedAppt.slot?.date ? new Date(selectedAppt.slot.date).toLocaleDateString() : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Start Time</span>
                  <span className="font-semibold text-foreground">{selectedAppt.slot?.startTime}</span>
                </div>
                <div className="flex justify-between">
                  <span>Consultation Type</span>
                  <span className="font-semibold text-foreground">{selectedAppt.type}</span>
                </div>
                <div className="flex justify-between">
                  <span>Payment Method</span>
                  <span className="font-semibold text-foreground">{selectedAppt.paymentMethod}</span>
                </div>
                {selectedAppt.notes && (
                  <div className="border-t border-border/40 pt-2.5 mt-2.5">
                    <span className="font-bold text-[10px] uppercase text-muted-foreground block mb-1">Notes</span>
                    <p className="text-[11px] text-foreground leading-relaxed italic">"{selectedAppt.notes}"</p>
                  </div>
                )}
                {selectedAppt.status === "CANCELLED" && (
                  <div className="border-t border-border/40 pt-2.5 mt-2.5 text-rose-500 bg-rose-500/5 p-2 rounded-xl border border-rose-500/10">
                    <span className="font-bold text-[10px] uppercase block mb-1">Cancellation Reason</span>
                    <p className="text-[11px] leading-relaxed">
                      "{selectedAppt.cancelReason || "No cancellation reason specified."}"
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
