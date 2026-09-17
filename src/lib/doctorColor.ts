const PALETTE = [
  { name: "violet", hex: "#8b5cf6", bg: "bg-violet-500/15", border: "border-violet-500/40", text: "text-violet-600 dark:text-violet-300", ring: "ring-violet-500/50" },
  { name: "cyan", hex: "#06b6d4", bg: "bg-cyan-500/15", border: "border-cyan-500/40", text: "text-cyan-600 dark:text-cyan-300", ring: "ring-cyan-500/50" },
  { name: "amber", hex: "#f59e0b", bg: "bg-amber-500/15", border: "border-amber-500/40", text: "text-amber-600 dark:text-amber-300", ring: "ring-amber-500/50" },
  { name: "rose", hex: "#f43f5e", bg: "bg-rose-500/15", border: "border-rose-500/40", text: "text-rose-600 dark:text-rose-300", ring: "ring-rose-500/50" },
  { name: "emerald", hex: "#10b981", bg: "bg-emerald-500/15", border: "border-emerald-500/40", text: "text-emerald-600 dark:text-emerald-300", ring: "ring-emerald-500/50" },
  { name: "blue", hex: "#3b82f6", bg: "bg-blue-500/15", border: "border-blue-500/40", text: "text-blue-600 dark:text-blue-300", ring: "ring-blue-500/50" },
  { name: "fuchsia", hex: "#d946ef", bg: "bg-fuchsia-500/15", border: "border-fuchsia-500/40", text: "text-fuchsia-600 dark:text-fuchsia-300", ring: "ring-fuchsia-500/50" },
  { name: "orange", hex: "#f97316", bg: "bg-orange-500/15", border: "border-orange-500/40", text: "text-orange-600 dark:text-orange-300", ring: "ring-orange-500/50" },
  { name: "teal", hex: "#14b8a6", bg: "bg-teal-500/15", border: "border-teal-500/40", text: "text-teal-600 dark:text-teal-300", ring: "ring-teal-500/50" },
  { name: "indigo", hex: "#6366f1", bg: "bg-indigo-500/15", border: "border-indigo-500/40", text: "text-indigo-600 dark:text-indigo-300", ring: "ring-indigo-500/50" },
] as const;

export type DoctorColor = (typeof PALETTE)[number];

// Stable hash so the same doctorId always resolves to the same palette entry,
// independent of list order (order can change as doctors are added/removed).
function hashId(id: string): number {
  if (!id) return 0;
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h << 5) - h + id.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function getDoctorColor(doctorId: string): DoctorColor {
  return PALETTE[hashId(doctorId || "") % PALETTE.length];
}
