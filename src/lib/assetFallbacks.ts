import doctorPlaceholder from "@/assets/standard/doctor-placeholder.png";
import clinicPlaceholder from "@/assets/home-quick-actions/find-clinic.png";
import findDoctor from "@/assets/home-quick-actions/find-doctor.png";
import nearby from "@/assets/home-quick-actions/nearby.png";
import myAppointments from "@/assets/home-quick-actions/my-appointments.png";
import coin from "@/assets/coin.png";
import validation from "@/assets/standard/validation.png";
import noAppointment from "@/assets/standard/no-appointment.png";

import sp1 from "@/assets/specialities/1.png";
import sp2 from "@/assets/specialities/2.png";
import sp3 from "@/assets/specialities/3.png";
import sp4 from "@/assets/specialities/4.png";
import sp5 from "@/assets/specialities/5.png";
import sp6 from "@/assets/specialities/6.png";

import cancelled from "@/assets/appointments/cancelled.png";
import confirmed from "@/assets/appointments/confirmed.png";
import pending from "@/assets/appointments/pending.png";
import upcoming from "@/assets/appointments/upcoming.png";
import reminder from "@/assets/appointments/reminder.png";
import calendarBrowser from "@/assets/appointments/calendar-browser.png";
import timeline from "@/assets/appointments/timeline.png";

import algeriePoste from "@/assets/payments/AlgeriePoste.svg";
import chargily from "@/assets/payments/chargily.png";
import cib from "@/assets/payments/cib.png";

export const doctorPlaceholderUrl = findDoctor;
export const clinicPlaceholderUrl = clinicPlaceholder;
export const userPlaceholderUrl = doctorPlaceholder;
export const emptyStateUrl = noAppointment;
export const validationUrl = validation;
export const coinUrl = coin;

export const ASSET_FALLBACKS = {
  clinicLogo: clinicPlaceholder,
  doctorPhoto: doctorPlaceholder,
  userAvatar: doctorPlaceholder,
  emptyState: noAppointment,
  serviceImage: clinicPlaceholder,
};

/** Illustrations from the `specialities/` folder — used as primary/fallback for specialty tiles. */
export const specialtyIcons = [sp1, sp2, sp3, sp4, sp5, sp6] as const;

/** Deterministic specialty illustration from id — stable across reloads. */
export function specialtyFallbackUrl(id: string): string {
  const hash = [...id].reduce((a, c) => a + c.charCodeAt(0), 0);
  return specialtyIcons[hash % specialtyIcons.length];
}

/** Appointment status → illustration. */
export function appointmentStatusIllustration(status?: string): string {
  const s = (status || "").toUpperCase();
  if (s.includes("CANCEL")) return cancelled;
  if (s.includes("CONFIRM")) return confirmed;
  if (s.includes("PEND")) return pending;
  if (s.includes("UPCOM") || s.includes("SCHED")) return upcoming;
  if (s.includes("REMIND")) return reminder;
  if (s.includes("TIMELINE")) return timeline;
  return calendarBrowser;
}

/** Payment provider → icon URL. Falls back to coin illustration. */
export function paymentProviderIcon(provider?: string | null): string {
  const p = (provider || "").toLowerCase();
  if (p.includes("chargily")) return chargily;
  if (p.includes("cib")) return cib;
  if (p.includes("poste") || p.includes("edahabia") || p.includes("baridi")) return algeriePoste;
  return coin;
}

/** Quick-action illustrations available as generic tile art. */
export const tileArt = { findDoctor, nearby, myAppointments, coin, validation };
