import { cn } from "@/lib/utils";

const TONES: Record<string, string> = {
  success: "bg-success/15 text-success border-success/30",
  danger: "bg-danger/15 text-danger border-danger/30",
  warning: "bg-warning/15 text-warning border-warning/30",
  info: "bg-info/15 text-info border-info/30",
  muted: "bg-muted/40 text-muted-foreground border-border",
  primary: "bg-primary-500/15 text-primary-500 border-primary-500/30",
};

const STATUS_MAP: Record<string, keyof typeof TONES> = {
  ACTIVE: "success",
  VERIFIED: "success",
  APPROVED: "success",
  ACCEPTED: "success",
  COMPLETED: "success",
  PAID: "success",
  CONFIRMED: "info",
  PENDING: "warning",
  IN_PROGRESS: "warning",
  WAITING: "warning",
  IN_REVIEW: "warning",
  SUSPENDED: "danger",
  BANNED: "danger",
  REJECTED: "danger",
  CANCELLED: "danger",
  FAILED: "danger",
  NO_SHOW: "muted",
  ARCHIVED: "muted",
  INACTIVE: "muted",
  DRAFT: "muted",
  UNVERIFIED: "muted",
};

export function StatusBadge({ value, tone, className }: { value?: string | null; tone?: keyof typeof TONES; className?: string }) {
  if (!value) return <span className="text-xs text-muted-foreground">—</span>;
  const key = String(value).toUpperCase();
  const toneKey = tone ?? STATUS_MAP[key] ?? "muted";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide",
        TONES[toneKey],
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {key.replace(/_/g, " ")}
    </span>
  );
}