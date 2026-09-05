import type { AppointmentStatus } from "@/api/appointmentsApi";

/**
 * Strict server-side state machine transition matrix:
 * PENDING → CONFIRMED → IN_PROGRESS → COMPLETED
 * PENDING → CANCELLED
 * CONFIRMED → CANCELLED | NO_SHOW
 * IN_PROGRESS → CANCELLED
 * COMPLETED / CANCELLED / NO_SHOW → terminal
 */
const TRANSITION_MAP: Record<string, AppointmentStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["IN_PROGRESS", "CANCELLED", "NO_SHOW"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

export function getValidTransitions(currentStatus?: string | null): AppointmentStatus[] {
  if (!currentStatus) return [];
  const key = String(currentStatus).toUpperCase();
  return TRANSITION_MAP[key] ?? [];
}

export function canTransitionTo(currentStatus: string | undefined | null, targetStatus: AppointmentStatus): boolean {
  if (!currentStatus) return false;
  const allowed = getValidTransitions(currentStatus);
  return allowed.includes(targetStatus);
}

export function isTerminalStatus(status?: string | null): boolean {
  if (!status) return false;
  const key = String(status).toUpperCase();
  return key === "COMPLETED" || key === "CANCELLED" || key === "NO_SHOW";
}
