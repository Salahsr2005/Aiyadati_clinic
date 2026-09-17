import type { DoctorSlot } from "@/api/clinicAppointmentsApi";

export interface SlotConflict {
  date: string;
  roomId: string;
  slotA: DoctorSlot;
  slotB: DoctorSlot;
}

function toMinutes(t?: string): number {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function isActive(s: DoctorSlot): boolean {
  const st = String(s.status || "").toLowerCase();
  return st !== "cancelled" && !s.isCancelled;
}

function overlaps(a: DoctorSlot, b: DoctorSlot): boolean {
  const aStart = toMinutes(a.startTime);
  const aEnd = toMinutes(a.endTime);
  const bStart = toMinutes(b.startTime);
  const bEnd = toMinutes(b.endTime);
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Detects same-room, overlapping-time, different-doctor conflicts across a flat
 * list of slots spanning any number of doctors/dates. O(n log n) via room+date bucketing.
 */
export function detectRoomConflicts(allSlots: DoctorSlot[]): SlotConflict[] {
  const buckets = new Map<string, DoctorSlot[]>();
  for (const s of allSlots) {
    if (!s.roomId || !isActive(s)) continue;
    const key = `${s.date?.slice(0, 10)}::${s.roomId}`;
    const arr = buckets.get(key) ?? [];
    arr.push(s);
    buckets.set(key, arr);
  }

  const conflicts: SlotConflict[] = [];
  for (const [key, slots] of buckets) {
    const [date, roomId] = key.split("::");
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        const a = slots[i];
        const b = slots[j];
        if (a.doctorId !== b.doctorId && overlaps(a, b)) {
          conflicts.push({ date, roomId, slotA: a, slotB: b });
        }
      }
    }
  }
  return conflicts;
}
