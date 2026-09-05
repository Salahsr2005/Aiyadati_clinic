import type { SlotRow } from "@/api/doctorSelfApi";

/**
 * Parses an ISO date string (YYYY-MM-DD) into a local Date object at midnight.
 */
export function parseISODate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Formats a Date object to YYYY-MM-DD ISO date string.
 */
export function formatISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Adds `days` to an ISO date string and returns the new YYYY-MM-DD string.
 */
export function addDaysISO(dateStr: string, days: number): string {
  const d = parseISODate(dateStr);
  d.setDate(d.getDate() + days);
  return formatISODate(d);
}

/**
 * Generates an array of all ISO date strings between startDate and endDate (inclusive).
 */
export function getDatesInRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  let curr = parseISODate(startDate);
  const end = parseISODate(endDate);

  while (curr <= end) {
    dates.push(formatISODate(curr));
    curr.setDate(curr.getDate() + 1);
  }
  return dates;
}

/**
 * Finds all dates in `slotsByDate` that contain at least one booked appointment or full slot.
 */
export function findBookedDatesFromSlots(
  slotsByDate: Record<string, SlotRow[] | undefined>
): Set<string> {
  const bookedDates = new Set<string>();

  for (const [date, slots] of Object.entries(slotsByDate)) {
    if (!slots || !Array.isArray(slots)) continue;
    const hasBooked = slots.some(
      (s) =>
        (s.currentPatients && s.currentPatients > 0) ||
        String(s.status).toLowerCase() === "full"
    );
    if (hasBooked) {
      bookedDates.add(date);
    }
  }

  return bookedDates;
}

export interface SubRange {
  startDate: string;
  endDate: string;
}

/**
 * Splits a requested date range [startDate, endDate] into contiguous sub-ranges
 * that exclude any dates containing booked appointments.
 *
 * This avoids Prisma foreign-key restriction errors when backend `generateSlots`
 * calls `deleteByDoctorAndDateRange`.
 */
export function splitDateRangeExcludingBooked(
  startDate: string,
  endDate: string,
  bookedDates: Set<string> | string[]
): SubRange[] {
  const bookedSet = bookedDates instanceof Set ? bookedDates : new Set(bookedDates);
  const allDates = getDatesInRange(startDate, endDate);
  const ranges: SubRange[] = [];

  let currentSubStart: string | null = null;
  let currentSubEnd: string | null = null;

  for (const d of allDates) {
    if (bookedSet.has(d)) {
      // End previous sub-range if active
      if (currentSubStart && currentSubEnd) {
        ranges.push({ startDate: currentSubStart, endDate: currentSubEnd });
        currentSubStart = null;
        currentSubEnd = null;
      }
    } else {
      // Start or extend current sub-range
      if (!currentSubStart) {
        currentSubStart = d;
      }
      currentSubEnd = d;
    }
  }

  if (currentSubStart && currentSubEnd) {
    ranges.push({ startDate: currentSubStart, endDate: currentSubEnd });
  }

  return ranges;
}

/**
 * Checks if a proposed break/time-off range overlaps with any dates containing booked appointments.
 * Returns array of overlapping ISO dates.
 */
export function checkBreakOverlapsBookedSlots(
  breakStart: string,
  breakEnd: string,
  bookedDates: Set<string> | string[]
): string[] {
  const bookedSet = bookedDates instanceof Set ? bookedDates : new Set(bookedDates);
  const breakDates = getDatesInRange(breakStart, breakEnd);
  return breakDates.filter((d) => bookedSet.has(d));
}
